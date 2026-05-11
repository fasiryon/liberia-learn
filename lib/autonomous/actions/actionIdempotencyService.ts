import { createHash } from "crypto";

export function buildActionIdempotencyKey(input: {
  agentDecisionId: string;
  actionType: string;
  schoolId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
}) {
  return createHash("sha256")
    .update(
      [
        "action",
        input.agentDecisionId,
        input.actionType,
        input.schoolId ?? "aggregate",
        input.targetType ?? "none",
        input.targetId ?? "none",
      ].join("|")
    )
    .digest("hex");
}

export function buildApprovalIdempotencyKey(input: { actionExecutionId: string; approvalType: string }) {
  return createHash("sha256")
    .update(["approval", input.actionExecutionId, input.approvalType].join("|"))
    .digest("hex");
}
