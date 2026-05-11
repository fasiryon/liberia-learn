import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { logLearningEvent } from "@/lib/events/logLearningEvent";
import { withDbWriteThrottle } from "@/lib/db/writeThrottle";
import { evaluateActionPolicy } from "@/lib/autonomous/actions/actionPolicyEngine";
import { executeApprovedAction, markActionResult } from "@/lib/autonomous/actions/actionExecutor";
import { recordActionTrace } from "@/lib/autonomous/actions/actionTraceService";
import { recordWorkflowCheckpoint } from "@/lib/autonomous/workflowStateManager";
import type { ApprovalDecisionInput, ApprovalStatus } from "@/lib/autonomous/actions/types";

function canApprove(user: any, approval: any) {
  if (user.isPlatformAdmin) return true;
  if (approval.schoolId && user.schoolId && approval.schoolId !== user.schoolId) return false;
  if (approval.approverRole === "TEACHER") return user.role === "TEACHER" || user.role === "ADMIN";
  if (approval.approverRole === "ADMIN") return user.role === "ADMIN";
  if (approval.approverRole === "MOE_OFFICIAL") {
    return user.role === "MOE_OFFICIAL" || user.role === "MOE_SUPER_ADMIN" || user.role === "DISTRICT_ADMIN";
  }
  if (approval.approverRole === "PLATFORM_ADMIN" || approval.approverRole === "GOVERNANCE") return user.isPlatformAdmin;
  return false;
}

async function loadApproval(id: string) {
  const approval = await (prisma as any).approvalRequest.findUnique({ where: { id } });
  if (!approval) throw Object.assign(new Error("Approval not found"), { status: 404 });
  const action = approval.actionExecutionId
    ? await (prisma as any).actionExecution.findUnique({ where: { id: approval.actionExecutionId } })
    : null;
  if (!action) throw Object.assign(new Error("ActionExecution not found"), { status: 404 });
  const decision = action.agentDecisionId
    ? await (prisma as any).agentDecision.findUnique({ where: { id: action.agentDecisionId } })
    : null;
  return { approval, action, decision };
}

export async function expireStaleApprovals(now = new Date()) {
  const stale = await (prisma as any).approvalRequest.findMany({
    where: { status: "PENDING", expiresAt: { lt: now } },
    take: 100,
  });
  for (const approval of stale) {
    await cancelOrExpireApproval({ approvalRequestId: approval.id, status: "EXPIRED", actorId: null, comment: "Approval expired" });
  }
  return stale.length;
}

async function cancelOrExpireApproval(input: {
  approvalRequestId: string;
  status: "CANCELLED" | "EXPIRED";
  actorId?: string | null;
  comment?: string | null;
  loadedApproval?: any;
  loadedAction?: any;
}): Promise<any> {
  const { approval, action } =
    input.loadedApproval && input.loadedAction
      ? { approval: input.loadedApproval, action: input.loadedAction }
      : await loadApproval(input.approvalRequestId);
  const actionStatus = input.status === "CANCELLED" ? "CANCELLED" : "CANCELLED";
  const updated = await withDbWriteThrottle("autonomous.approval.cancel", () =>
    (prisma as any).approvalRequest.update({
      where: { id: approval.id },
      data: {
        status: input.status,
        approverUserId: input.actorId ?? null,
        decidedAt: new Date(),
        decisionPayload: { comment: input.comment ?? null },
      },
    })
  );
  await (prisma as any).actionExecution.update({
    where: { id: action.id },
    data: { status: actionStatus, completedAt: new Date(), executionMetadata: { ...(action.executionMetadata ?? {}), terminalReason: input.status } },
  });
  await recordWorkflowCheckpoint({
    workflowRunId: action.workflowRunId,
    checkpointKey: `approval_${input.status.toLowerCase()}`,
    traceId: action.traceId,
    actorType: "approval",
    actorId: input.actorId ?? "system",
    executionMetadata: { approvalRequestId: approval.id, actionExecutionId: action.id },
  });
  return updated;
}

export async function approveAction(input: ApprovalDecisionInput) {
  const { approval, action, decision } = await loadApproval(input.approvalRequestId);
  if (!canApprove(input.decidedBy, approval)) throw Object.assign(new Error("Forbidden"), { status: 403 });
  if (approval.status !== "PENDING") throw Object.assign(new Error("Approval is not pending"), { status: 409 });
  if (approval.expiresAt && new Date(approval.expiresAt) < new Date()) {
    await cancelOrExpireApproval({ approvalRequestId: approval.id, status: "EXPIRED", comment: "Approval expired" });
    throw Object.assign(new Error("Approval expired"), { status: 409 });
  }

  const policy = evaluateActionPolicy({
    actionType: action.actionType,
    sourceRisk: action.riskLevel,
    targetType: action.targetType,
    targetId: action.targetId,
    schoolId: action.schoolId,
    districtId: approval.districtId,
    decision,
  });
  if (!policy.executionAllowed) throw Object.assign(new Error("Policy does not allow execution"), { status: 403 });

  await withDbWriteThrottle("autonomous.approval.approve", () =>
    (prisma as any).approvalRequest.update({
      where: { id: approval.id },
      data: {
        status: "APPROVED",
        approverUserId: input.decidedBy.id,
        decidedAt: new Date(),
        decisionPayload: { comment: input.comment ?? null, policy },
      },
    })
  );
  const approvedAction = await (prisma as any).actionExecution.update({
    where: { id: action.id },
    data: { status: "APPROVED", approvalRequestId: approval.id },
  });
  await recordWorkflowCheckpoint({
    workflowRunId: action.workflowRunId,
    checkpointKey: "approval_resolved",
    traceId: action.traceId,
    actorType: "user",
    actorId: input.decidedBy.id,
    executionMetadata: { approvalRequestId: approval.id, status: "APPROVED", comment: input.comment ?? null },
  });
  await Promise.all([
    logLearningEvent({
      workflowRunId: action.workflowRunId,
      workflowTraceId: action.traceId,
      schoolId: action.schoolId,
      actor: { type: "user", id: input.decidedBy.id, role: input.decidedBy.role },
      target: { type: "ApprovalRequest", id: approval.id },
      eventType: "action.approved",
      source: "autonomous.actions",
      status: "APPROVED",
      metadata: { actionExecutionId: action.id, comment: input.comment ?? null },
    }),
    logAudit({
      userId: input.decidedBy.id,
      action: "approval.approved",
      resourceType: "ApprovalRequest",
      resourceId: approval.id,
      traceId: action.traceId,
      schoolId: action.schoolId,
      details: { actionExecutionId: action.id, actionType: action.actionType, comment: input.comment ?? null },
    }),
  ]);

  const result = await executeApprovedAction({ actionExecution: approvedAction, approvalRequest: approval, actor: input.decidedBy, policy, decision });
  return markActionResult({ actionExecution: approvedAction, result, actorId: input.decidedBy.id });
}

export async function rejectAction(input: ApprovalDecisionInput) {
  const { approval, action } = await loadApproval(input.approvalRequestId);
  if (!canApprove(input.decidedBy, approval)) throw Object.assign(new Error("Forbidden"), { status: 403 });
  if (approval.status !== "PENDING") throw Object.assign(new Error("Approval is not pending"), { status: 409 });
  await withDbWriteThrottle("autonomous.approval.reject", () =>
    (prisma as any).approvalRequest.update({
      where: { id: approval.id },
      data: {
        status: "REJECTED",
        approverUserId: input.decidedBy.id,
        decidedAt: new Date(),
        decisionPayload: { comment: input.comment ?? null },
      },
    })
  );
  const updated = await (prisma as any).actionExecution.update({
    where: { id: action.id },
    data: { status: "REJECTED", completedAt: new Date() },
  });
  await recordActionTrace({
    workflowRunId: action.workflowRunId,
    actionExecutionId: action.id,
    actionType: action.actionType,
    status: "REJECTED",
    traceId: action.traceId,
    schoolId: action.schoolId,
    actorId: input.decidedBy.id,
    metadata: { approvalRequestId: approval.id, comment: input.comment ?? null },
  });
  await logAudit({
    userId: input.decidedBy.id,
    action: "approval.rejected",
    resourceType: "ApprovalRequest",
    resourceId: approval.id,
    traceId: action.traceId,
    schoolId: action.schoolId,
    details: { actionExecutionId: action.id, comment: input.comment ?? null },
  });
  return updated;
}

export async function cancelActionApproval(input: ApprovalDecisionInput): Promise<any> {
  const { approval, action } = await loadApproval(input.approvalRequestId);
  if (!input.decidedBy.isPlatformAdmin && approval.requestedById !== input.decidedBy.id) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
  return cancelOrExpireApproval({
    approvalRequestId: input.approvalRequestId,
    status: "CANCELLED",
    actorId: input.decidedBy.id,
    comment: input.comment ?? null,
    loadedApproval: approval,
    loadedAction: action,
  });
}

export function approvalStatusLabel(status: string): ApprovalStatus {
  const upper = status.toUpperCase();
  if (["PENDING", "APPROVED", "REJECTED", "CANCELLED", "EXPIRED"].includes(upper)) return upper as ApprovalStatus;
  return "PENDING";
}
