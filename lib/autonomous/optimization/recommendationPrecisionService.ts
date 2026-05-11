import { prisma } from "@/lib/db";
import { getRecommendationPrecisionAnalytics } from "@/lib/autonomous/evaluation/recommendationOutcomeTracker";

function ratio(count: number, total: number) {
  return total > 0 ? Number((count / total).toFixed(2)) : 0;
}

export async function getDetectorPrecisionMetrics(input: { schoolId?: string | null; detectorId?: string | null } = {}) {
  const base = await getRecommendationPrecisionAnalytics(input);
  const where: any = { eventType: "autonomous.evaluation.recorded" };
  if (input.schoolId) where.schoolId = input.schoolId;
  const events = await (prisma as any).learningEvent.findMany({ where, orderBy: { occurredAt: "desc" }, take: 1000 });
  const filtered = input.detectorId ? events.filter((event: any) => event.metadata?.detectorId === input.detectorId) : events;
  const falseNegatives = filtered.filter((event: any) => (event.metadata?.outcome ?? event.status) === "false_negative").length;
  const averageEvidenceCoverage = filtered.length
    ? Number((filtered.reduce((sum: number, event: any) => sum + Number(event.metadata?.evidenceCoverageScore ?? 0), 0) / filtered.length).toFixed(2))
    : 0;
  const averageEffectiveness = filtered.length
    ? Number((filtered.reduce((sum: number, event: any) => sum + Number(event.metadata?.effectivenessScore ?? 0), 0) / filtered.length).toFixed(2))
    : 0;
  const approvalWhere: any = {};
  if (input.schoolId) approvalWhere.schoolId = input.schoolId;
  const approvals = await (prisma as any).approvalRequest.findMany({ where: approvalWhere, orderBy: { createdAt: "desc" }, take: 1000 });
  const rejectedApprovals = approvals.filter((approval: any) => approval.status === "REJECTED").length;
  return {
    ...base,
    detectorId: input.detectorId ?? null,
    falseNegatives,
    recallProxy: ratio(base.accepted, base.accepted + falseNegatives),
    averageEvidenceCoverage,
    averageEffectiveness,
    approvalRejectionRate: ratio(rejectedApprovals, approvals.length),
  };
}
