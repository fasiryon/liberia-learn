import { prisma } from "@/lib/db";
import type { ApprovalSLAStatus } from "@/lib/autonomous/actions/types";

function slaMsForRisk(riskLevel?: string | null) {
  if (riskLevel === "high" || riskLevel === "critical") return 3 * 24 * 60 * 60_000;
  if (riskLevel === "medium") return 7 * 24 * 60 * 60_000;
  return 14 * 24 * 60 * 60_000;
}

export function classifyApprovalSLA(input: { requestedAt: Date | string; expiresAt?: Date | string | null; riskLevel?: string | null; now?: Date }) {
  const now = input.now ?? new Date();
  const requestedAt = new Date(input.requestedAt);
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : new Date(requestedAt.getTime() + slaMsForRisk(input.riskLevel));
  const ageMs = now.getTime() - requestedAt.getTime();
  const remainingMs = expiresAt.getTime() - now.getTime();
  let status: ApprovalSLAStatus = "within_sla";
  if (remainingMs <= 0) status = "expired";
  else if (ageMs >= slaMsForRisk(input.riskLevel) * 0.85) status = "breached";
  else if (ageMs >= slaMsForRisk(input.riskLevel) * 0.6) status = "warning";
  return { status, ageMs, remainingMs, expiresAt };
}

export async function getApprovalSLAAnalytics(input: { schoolId?: string | null; now?: Date } = {}) {
  const where: any = { actionExecutionId: { not: null } };
  if (input.schoolId) where.schoolId = input.schoolId;
  const approvals = await (prisma as any).approvalRequest.findMany({ where, orderBy: { requestedAt: "desc" }, take: 500 });
  const buckets = { pending: 0, approved: 0, rejected: 0, cancelled: 0, expired: 0, warning: 0, breached: 0 };
  for (const approval of approvals) {
    const status = String(approval.status).toLowerCase();
    if (status in buckets) (buckets as any)[status] += 1;
    if (approval.status === "PENDING") {
      const sla = classifyApprovalSLA({ requestedAt: approval.requestedAt, expiresAt: approval.expiresAt, riskLevel: approval.riskLevel, now: input.now });
      if (sla.status === "warning") buckets.warning += 1;
      if (sla.status === "breached" || sla.status === "expired") buckets.breached += 1;
    }
  }
  return { total: approvals.length, buckets, generatedAt: (input.now ?? new Date()).toISOString() };
}

