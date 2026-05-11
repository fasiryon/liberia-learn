import { prisma } from "@/lib/db";
import { withDbWriteThrottle } from "@/lib/db/writeThrottle";
import { isImplementationWorkflowEnabled, isAutonomousOptimizationEnabled } from "@/lib/serverFlags";
import { logLearningEvent } from "@/lib/events/logLearningEvent";
import { recordConfigChangeAudit } from "@/lib/autonomous/optimization/configChangeAuditService";
import type { OptimizationCategory } from "@/lib/autonomous/optimization/types";

export type ChangeRequestActor = {
  id: string;
  role?: string | null;
  schoolId?: string | null;
  isPlatformAdmin?: boolean;
};

// Derived from proposal category — every category requires manual human implementation.
// The system never writes to detector thresholds, evidence weights, or approval rules.
const REQUIRED_REVIEWER_ROLES: Record<OptimizationCategory, string[]> = {
  detector_threshold: ["platform_admin", "governance_reviewer"],
  evidence_weighting: ["platform_admin", "governance_reviewer"],
  confidence_calibration: ["platform_admin"],
  intervention_timing: ["platform_admin"],
  curriculum_review_priority: ["platform_admin", "curriculum_reviewer"],
  low_risk_rollout_sizing: ["platform_admin", "governance_reviewer"],
  reviewer_assignment: ["platform_admin"],
  escalation_timing: ["platform_admin"],
};

function ensureEnabled() {
  if (!isImplementationWorkflowEnabled()) {
    throw Object.assign(new Error("Implementation workflow is disabled"), { status: 404, code: "implementation_workflow_disabled" });
  }
  if (!isAutonomousOptimizationEnabled()) {
    throw Object.assign(new Error("Autonomous optimization is disabled"), { status: 404, code: "autonomous_optimization_disabled" });
  }
}

function canRead(changeRequest: any, actor: ChangeRequestActor) {
  if (actor.isPlatformAdmin) return true;
  if (changeRequest.schoolId) return actor.role === "ADMIN" && actor.schoolId === changeRequest.schoolId;
  return ["MOE_OFFICIAL", "MOE_SUPER_ADMIN", "DISTRICT_ADMIN"].includes(String(actor.role ?? ""));
}

function canWrite(changeRequest: any, actor: ChangeRequestActor) {
  if (actor.isPlatformAdmin) return true;
  if (changeRequest.schoolId) return actor.role === "ADMIN" && actor.schoolId === changeRequest.schoolId;
  return actor.role === "MOE_OFFICIAL";
}

export async function createChangeRequestFromProposal(input: {
  proposalEventId: string;
  actor: ChangeRequestActor;
  workflowRunId?: string | null;
  workflowTraceId?: string | null;
  correlationId: string;
}) {
  ensureEnabled();

  // Load proposal — must be APPROVED and of correct type.
  const proposal = await (prisma as any).learningEvent.findUnique({ where: { id: input.proposalEventId } });
  if (!proposal || proposal.eventType !== "autonomous.optimization.proposed") {
    throw Object.assign(new Error("Optimization proposal not found"), { status: 404 });
  }

  // Check approval status from review events.
  const reviews = await (prisma as any).learningEvent.findMany({
    where: { eventType: "autonomous.optimization.reviewed" },
    orderBy: { occurredAt: "desc" },
    take: 500,
  });
  const latestReview = reviews.find((r: any) => r.metadata?.proposalEventId === proposal.id);
  const reviewStatus = latestReview?.metadata?.reviewStatus ?? proposal.metadata?.reviewStatus ?? "PENDING_REVIEW";

  if (reviewStatus !== "APPROVED") {
    throw Object.assign(new Error(`Cannot create change request: proposal is ${reviewStatus}, must be APPROVED`), { status: 422, code: "proposal_not_approved" });
  }

  // Scope guard.
  if (!canRead(proposal, input.actor)) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }

  const metadata = proposal.metadata ?? {};
  const category: OptimizationCategory = metadata.category ?? "detector_threshold";
  const requiredRoles = [...(REQUIRED_REVIEWER_ROLES[category] ?? ["platform_admin"])];
  if (proposal.schoolId) requiredRoles.push("school_admin");

  const idempotencyKey = `change-request:${proposal.id}`;

  const existing = await (prisma as any).optimizationChangeRequest.findUnique({ where: { idempotencyKey } });
  if (existing) return existing;

  const changeRequest: any = await withDbWriteThrottle("implementation.createChangeRequest", () =>
    (prisma as any).optimizationChangeRequest.create({
      data: {
        proposalEventId: proposal.id,
        category,
        title: metadata.title ?? `Change request for ${category}`,
        affectedScope: metadata.targetScope ?? "platform",
        affectedArea: category,
        schoolId: proposal.schoolId ?? null,
        districtId: proposal.districtId ?? null,
        tenantId: null,
        expectedImpact: metadata.expectedImpact ?? null,
        riskAssessment: { riskLevel: metadata.riskLevel, approvalRequirement: metadata.approvalRequirement, notes: "Generated from approved optimization proposal." },
        evidenceRefs: metadata.evidenceRefs ?? {},
        proposedImplementationPlan: {
          proposal: metadata.proposedChange ?? {},
          evaluationPlan: metadata.evaluationPlan ?? "",
          limitations: metadata.limitations ?? [],
          requiresManualImplementation: true,
          implementationNote: "This change request is a governed implementation plan artifact. No detector threshold, evidence weight, or approval rule is mutated automatically. Human reviewers must apply any changes after full sign-off.",
        },
        rollbackPlan: {
          guidance: metadata.rollbackGuidance ?? "Restore prior configuration.",
          rollbackTrigger: "Any validation failure, reviewer concern, or tenant safety issue.",
          rollbackOwner: "platform_admin",
          steps: ["Disable any partially applied changes", "Restore previous configuration baseline", "Verify detector/policy outputs return to pre-change state", "Record rollback verification"],
          expectedRestoredState: { status: "pre-change baseline restored", policyMutation: false },
        },
        requiredReviewerRoles: requiredRoles,
        workflowRunId: input.workflowRunId ?? null,
        workflowTraceId: input.workflowTraceId ?? null,
        correlationId: input.correlationId,
        status: "DRAFT",
        implementationStatus: "NOT_STARTED",
        requiresManualImplementation: true,
        idempotencyKey,
        createdBy: input.actor.id,
      },
    })
  );

  // Log creation event.
  await logLearningEvent(
    {
      workflowTraceId: input.workflowTraceId ?? null,
      schoolId: changeRequest.schoolId,
      districtId: changeRequest.districtId,
      actor: { type: "user", id: input.actor.id, role: input.actor.role },
      target: { type: "OptimizationChangeRequest", id: changeRequest.id },
      eventType: "autonomous.implementation.change_request.created",
      source: "autonomous.implementation",
      status: "DRAFT",
      metadata: { changeRequestId: changeRequest.id, proposalEventId: proposal.id, category, policyMutation: false },
    },
    { throwOnError: true }
  );
  await recordConfigChangeAudit({
    actorId: input.actor.id,
    action: "change_request.created",
    changeRequestId: changeRequest.id,
    proposalEventId: proposal.id,
    category,
    affectedScope: changeRequest.affectedScope,
    traceId: input.workflowTraceId ?? null,
    schoolId: changeRequest.schoolId,
    details: { status: "DRAFT", requiredReviewerRoles: requiredRoles },
  });

  return changeRequest;
}

export async function getChangeRequest(input: { id: string; actor: ChangeRequestActor }) {
  ensureEnabled();
  const changeRequest = await (prisma as any).optimizationChangeRequest.findUnique({
    where: { id: input.id },
    include: { signoffs: true, rolloutPlan: true, postChangeEval: true },
  });
  if (!changeRequest) throw Object.assign(new Error("Change request not found"), { status: 404 });
  if (!canRead(changeRequest, input.actor)) throw Object.assign(new Error("Forbidden"), { status: 403 });
  return changeRequest;
}

export async function listChangeRequests(input: {
  actor: ChangeRequestActor;
  status?: string;
  schoolId?: string | null;
  limit?: number;
}) {
  ensureEnabled();
  const where: any = {};
  if (!input.actor.isPlatformAdmin) {
    if (input.actor.schoolId) where.schoolId = input.actor.schoolId;
    else where.schoolId = null;
  } else if (input.schoolId) {
    where.schoolId = input.schoolId;
  }
  if (input.status) where.status = input.status;
  const changeRequests = await (prisma as any).optimizationChangeRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: input.limit ?? 50,
    include: { signoffs: { select: { decision: true, reviewerRole: true, decidedAt: true } } },
  });
  return changeRequests.filter((cr: any) => canRead(cr, input.actor));
}

export async function submitChangeRequestForReview(input: { id: string; actor: ChangeRequestActor }) {
  ensureEnabled();
  const changeRequest = await (prisma as any).optimizationChangeRequest.findUnique({ where: { id: input.id } });
  if (!changeRequest) throw Object.assign(new Error("Change request not found"), { status: 404 });
  if (!canWrite(changeRequest, input.actor)) throw Object.assign(new Error("Forbidden"), { status: 403 });
  if (changeRequest.status !== "DRAFT") {
    throw Object.assign(new Error(`Cannot submit change request in status ${changeRequest.status}`), { status: 422 });
  }
  const updated = await withDbWriteThrottle("implementation.submitForReview", () =>
    (prisma as any).optimizationChangeRequest.update({ where: { id: input.id }, data: { status: "PENDING_REVIEW", updatedAt: new Date() } })
  );
  await recordConfigChangeAudit({
    actorId: input.actor.id,
    action: "change_request.submitted_for_review",
    changeRequestId: input.id,
    proposalEventId: changeRequest.proposalEventId,
    category: changeRequest.category,
    affectedScope: changeRequest.affectedScope,
    schoolId: changeRequest.schoolId,
    details: { previousStatus: "DRAFT" },
  });
  return updated;
}

export async function cancelChangeRequest(input: { id: string; actor: ChangeRequestActor; reason?: string }) {
  ensureEnabled();
  const changeRequest = await (prisma as any).optimizationChangeRequest.findUnique({ where: { id: input.id } });
  if (!changeRequest) throw Object.assign(new Error("Change request not found"), { status: 404 });
  if (!canWrite(changeRequest, input.actor)) throw Object.assign(new Error("Forbidden"), { status: 403 });
  const cancellableStatuses = ["DRAFT", "PENDING_REVIEW", "ROLLOUT_PAUSED"];
  if (!cancellableStatuses.includes(changeRequest.status)) {
    throw Object.assign(new Error(`Cannot cancel change request in status ${changeRequest.status}`), { status: 422 });
  }
  const updated = await withDbWriteThrottle("implementation.cancel", () =>
    (prisma as any).optimizationChangeRequest.update({
      where: { id: input.id },
      data: { status: "CANCELLED", updatedAt: new Date() },
    })
  );
  await recordConfigChangeAudit({
    actorId: input.actor.id,
    action: "change_request.cancelled",
    changeRequestId: input.id,
    proposalEventId: changeRequest.proposalEventId,
    category: changeRequest.category,
    affectedScope: changeRequest.affectedScope,
    schoolId: changeRequest.schoolId,
    details: { reason: input.reason ?? null, previousStatus: changeRequest.status },
  });
  return updated;
}
