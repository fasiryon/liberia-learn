import { prisma } from "@/lib/db";
import { withDbWriteThrottle } from "@/lib/db/writeThrottle";
import { isImplementationWorkflowEnabled, isAutonomousOptimizationEnabled } from "@/lib/serverFlags";
import { createChangeRequestFromProposal } from "@/lib/autonomous/optimization/optimizationChangeRequestService";
import { recordImplementationCheckpoint } from "@/lib/autonomous/optimization/implementationTraceService";
import { recordConfigChangeAudit } from "@/lib/autonomous/optimization/configChangeAuditService";

export type WorkflowActor = {
  id: string;
  role?: string | null;
  schoolId?: string | null;
  isPlatformAdmin?: boolean;
};

// Generates a deterministic correlationId for the implementation workflow.
function buildCorrelationId(proposalEventId: string, actorId: string): string {
  return `impl-workflow:${proposalEventId}:${actorId.slice(0, 8)}`;
}

// Creates a governing WorkflowRun for the implementation workflow, then creates the
// change request. Approved optimization proposals → governed change request lifecycle.
export async function createImplementationWorkflow(input: {
  proposalEventId: string;
  actor: WorkflowActor;
}) {
  if (!isImplementationWorkflowEnabled()) {
    throw Object.assign(new Error("Implementation workflow is disabled"), { status: 404, code: "implementation_workflow_disabled" });
  }
  if (!isAutonomousOptimizationEnabled()) {
    throw Object.assign(new Error("Autonomous optimization is disabled"), { status: 404, code: "autonomous_optimization_disabled" });
  }

  const proposal = await (prisma as any).learningEvent.findUnique({ where: { id: input.proposalEventId } });
  if (!proposal || proposal.eventType !== "autonomous.optimization.proposed") {
    throw Object.assign(new Error("Optimization proposal not found"), { status: 404 });
  }

  const correlationId = buildCorrelationId(input.proposalEventId, input.actor.id);
  const traceId = `impl-trace:${input.proposalEventId}`;

  // Idempotent: reuse existing WorkflowRun if already created for this proposal.
  const existingRun = await (prisma as any).workflowRun.findFirst({
    where: { correlationId, workflowType: "implementation_workflow" },
  });

  let workflowRun = existingRun;
  if (!workflowRun) {
    workflowRun = await withDbWriteThrottle("implementation.workflowRun", () =>
      (prisma as any).workflowRun.create({
        data: {
          workflowType: "implementation_workflow",
          tenantId: null,
          schoolId: proposal.schoolId ?? null,
          districtId: proposal.districtId ?? null,
          partitionKey: proposal.schoolId ?? "platform",
          status: "running",
          riskLevel: "medium",
          traceId,
          correlationId,
          triggerEventId: input.proposalEventId,
          source: "implementationWorkflowService",
          targetType: "OptimizationProposal",
          targetId: input.proposalEventId,
          currentCheckpoint: "trigger_received",
          approvalRequired: true,
          attempt: 1,
          maxAttempts: 1,
          evidenceRefs: { proposalEventId: input.proposalEventId },
          executionMetadata: { actorId: input.actor.id, phase: "7" },
          startedAt: new Date(),
        },
      })
    );
  }

  await recordImplementationCheckpoint({
    workflowRunId: workflowRun.id,
    checkpointKey: "trigger_received",
    sequence: 0,
    actorId: input.actor.id,
    traceId,
    state: { proposalEventId: input.proposalEventId },
  });

  const changeRequest = await createChangeRequestFromProposal({
    proposalEventId: input.proposalEventId,
    actor: input.actor,
    workflowRunId: workflowRun.id,
    workflowTraceId: traceId,
    correlationId,
  });

  await recordImplementationCheckpoint({
    workflowRunId: workflowRun.id,
    checkpointKey: "change_request_created",
    sequence: 1,
    actorId: input.actor.id,
    traceId,
    state: { changeRequestId: changeRequest.id, status: changeRequest.status },
  });

  await withDbWriteThrottle("implementation.workflowRun.update", () =>
    (prisma as any).workflowRun.update({
      where: { id: workflowRun!.id },
      data: { currentCheckpoint: "change_request_created", status: "waiting_for_approval" },
    })
  );

  await recordConfigChangeAudit({
    actorId: input.actor.id,
    action: "workflow.created",
    changeRequestId: changeRequest.id,
    proposalEventId: input.proposalEventId,
    category: changeRequest.category,
    affectedScope: changeRequest.affectedScope,
    traceId,
    schoolId: changeRequest.schoolId,
    details: { workflowRunId: workflowRun.id, correlationId },
  });

  return { workflowRun, changeRequest };
}

export async function getImplementationAuditTrace(changeRequestId: string, actor: WorkflowActor) {
  if (!isImplementationWorkflowEnabled()) {
    throw Object.assign(new Error("Implementation workflow is disabled"), { status: 404 });
  }
  const changeRequest = await (prisma as any).optimizationChangeRequest.findUnique({
    where: { id: changeRequestId },
  });
  if (!changeRequest) throw Object.assign(new Error("Change request not found"), { status: 404 });
  if (!actor.isPlatformAdmin && !(changeRequest.schoolId && actor.role === "ADMIN" && actor.schoolId === changeRequest.schoolId)) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }

  const [signoffs, rolloutPlan, postChangeEval, auditEntries] = await Promise.all([
    (prisma as any).changeRequestSignoff.findMany({ where: { changeRequestId }, orderBy: { createdAt: "asc" } }),
    (prisma as any).stagedRolloutPlan.findUnique({ where: { changeRequestId } }),
    (prisma as any).postChangeEvaluationPlan.findUnique({ where: { changeRequestId } }),
    (prisma as any).auditLog.findMany({
      where: { resourceType: "OptimizationChangeRequest", resourceId: changeRequestId },
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
  ]);

  const learningEvents = await (prisma as any).learningEvent.findMany({
    where: {
      eventType: { in: ["autonomous.implementation.change_request.created", "autonomous.implementation.change_request.approved_for_rollout", "autonomous.implementation.change_request.rejected", "autonomous.implementation.post_change_eval.created"] },
      metadata: { path: ["changeRequestId"], equals: changeRequestId },
    },
    orderBy: { occurredAt: "asc" },
    take: 100,
  });

  return { changeRequest, signoffs, rolloutPlan, postChangeEval, auditEntries, learningEvents };
}
