import { prisma } from "@/lib/db";
import { isApprovalExpirationWorkerEnabled } from "@/lib/serverFlags";
import { expireStaleApprovals } from "@/lib/autonomous/actions/approvalDecisionService";
import { escalateOverdueApprovals } from "@/lib/autonomous/actions/escalationService";

export async function processStaleApprovals(input: { schoolId?: string | null; now?: Date; dryRun?: boolean } = {}) {
  if (!isApprovalExpirationWorkerEnabled()) {
    return { enabled: false, expired: 0, escalated: 0, stalePending: 0 };
  }
  const now = input.now ?? new Date();
  const stalePending = await (prisma as any).approvalRequest.count({
    where: {
      status: "PENDING",
      actionExecutionId: { not: null },
      expiresAt: { lt: now },
      ...(input.schoolId ? { schoolId: input.schoolId } : {}),
    },
  });
  if (input.dryRun) {
    return { enabled: true, expired: 0, escalated: 0, stalePending, dryRun: true };
  }
  const expired = await expireStaleApprovals(now);
  const escalation = await escalateOverdueApprovals({ schoolId: input.schoolId, now });
  return { enabled: true, expired, escalated: escalation.escalated, stalePending };
}

