import type { ActionPolicy } from "@/lib/autonomous/actions/types";

export function resolveApprovalRoute(policy: ActionPolicy) {
  const expiresAt = new Date(Date.now() + (policy.riskLevel === "high" ? 3 : 7) * 86_400_000);
  return {
    approverRole: policy.requiredApproverRole,
    approvalType: `action.${policy.actionType}`,
    expiresAt,
    escalationRoute:
      policy.requiredApproverRole === "MOE_OFFICIAL"
        ? "moe_official_and_platform_admin"
        : policy.requiredApproverRole === "PLATFORM_ADMIN"
          ? "platform_admin"
          : policy.requiredApproverRole === "TEACHER"
            ? "teacher_or_school_admin"
            : "school_admin",
  };
}
