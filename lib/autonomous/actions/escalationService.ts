import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { withDbWriteThrottle } from "@/lib/db/writeThrottle";
import { recordWorkflowCheckpoint } from "@/lib/autonomous/workflowStateManager";
import { classifyApprovalSLA } from "@/lib/autonomous/actions/approvalSLAService";

function nextApproverRole(current?: string | null) {
  if (current === "TEACHER") return "ADMIN";
  if (current === "ADMIN") return "PLATFORM_ADMIN";
  if (current === "MOE_OFFICIAL") return "PLATFORM_ADMIN";
  return current ?? "PLATFORM_ADMIN";
}

export async function escalateApproval(input: {
  approvalRequestId: string;
  actorId?: string | null;
  reason?: string | null;
  now?: Date;
}) {
  const approval = await (prisma as any).approvalRequest.findUnique({ where: { id: input.approvalRequestId } });
  if (!approval) throw Object.assign(new Error("Approval not found"), { status: 404 });
  if (approval.status !== "PENDING") throw Object.assign(new Error("Approval is not pending"), { status: 409 });

  const currentPayload = approval.requestPayload ?? {};
  const updated = (await withDbWriteThrottle("autonomous.approval.escalate", () =>
    (prisma as any).approvalRequest.update({
      where: { id: approval.id },
      data: {
        approverRole: nextApproverRole(approval.approverRole),
        requestPayload: {
          ...currentPayload,
          escalation: {
            escalatedAt: (input.now ?? new Date()).toISOString(),
            reason: input.reason ?? "approval_sla_or_operator_escalation",
            fromApproverRole: approval.approverRole ?? null,
            toApproverRole: nextApproverRole(approval.approverRole),
          },
        },
      },
    })
  )) as any;

  await recordWorkflowCheckpoint({
    workflowRunId: approval.workflowRunId,
    checkpointKey: "approval_escalated",
    traceId: approval.traceId,
    actorType: "approval",
    actorId: input.actorId ?? "system",
    executionMetadata: { approvalRequestId: approval.id, reason: input.reason ?? null },
  });
  await logAudit({
    userId: input.actorId ?? null,
    action: "approval.escalated",
    resourceType: "ApprovalRequest",
    resourceId: approval.id,
    traceId: approval.traceId,
    schoolId: approval.schoolId,
    details: { reason: input.reason ?? null, fromRole: approval.approverRole, toRole: updated.approverRole },
  });
  return updated;
}

export async function escalateOverdueApprovals(input: { schoolId?: string | null; now?: Date; limit?: number } = {}) {
  const now = input.now ?? new Date();
  const where: any = { status: "PENDING", actionExecutionId: { not: null } };
  if (input.schoolId) where.schoolId = input.schoolId;
  const approvals = await (prisma as any).approvalRequest.findMany({ where, orderBy: { requestedAt: "asc" }, take: input.limit ?? 50 });
  const escalated = [];
  for (const approval of approvals) {
    const sla = classifyApprovalSLA({ requestedAt: approval.requestedAt, expiresAt: approval.expiresAt, riskLevel: approval.riskLevel, now });
    if (sla.status === "breached") {
      escalated.push(await escalateApproval({ approvalRequestId: approval.id, reason: "sla_breached", now }));
    }
  }
  return { inspected: approvals.length, escalated: escalated.length, approvals: escalated };
}
