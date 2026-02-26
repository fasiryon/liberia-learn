import { prisma } from "@/lib/db";
import { computeSchoolDashboard, type SchoolDashboardMetrics } from "@/lib/reporting/dashboard/dashboardAggregator";
import { computeSchoolTrends } from "@/lib/reporting/trends/trendAggregator";
import { computeRecommendations } from "@/lib/ai/interventions/recommendationEngine";
import { fetchLatestImpactSnapshot } from "@/lib/metrics/impact/impactSnapshotRepo";

export type DistrictDashboardMetrics = SchoolDashboardMetrics & {
  schoolCount: number;
  schoolsAtRisk: number;
  topInterventionPriority: number;
};

function avg(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

function isAtRisk(flag: "none" | "low" | "medium" | "high" | "critical"): boolean {
  return flag === "medium" || flag === "high" || flag === "critical";
}

export async function computeDistrictDashboard(params: {
  tenantId: string;
  districtId: string;
}): Promise<DistrictDashboardMetrics> {
  const { tenantId, districtId } = params;

  const schools = await prisma.school.findMany({
    where: { districtId },
    select: { id: true },
  });

  if (schools.length === 0) {
    return {
      avgMasteryScore: 0,
      trainingAdoptionRate: 0,
      evidenceSubmissionRate: 0,
      schoolCount: 0,
      schoolsAtRisk: 0,
      topInterventionPriority: 0,
    };
  }

  const dashboards = await Promise.all(
    schools.map((s) => computeSchoolDashboard({ tenantId, schoolId: s.id }))
  );

  const recommendations = await Promise.all(
    schools.map(async (s, idx) => {
      const trends = await computeSchoolTrends({
        tenantId,
        schoolId: s.id,
        period: "monthly",
        lookbackMonths: 6,
      });
      const impactData = await fetchLatestImpactSnapshot({ tenantId, schoolId: s.id });
      const rec = await computeRecommendations({
        tenantId,
        schoolId: s.id,
        currentMetrics: dashboards[idx],
        trends,
        impactData,
      });
      return rec;
    })
  );

  const schoolCount = schools.length;
  const avgMasteryScore = avg(dashboards.map((d) => d.avgMasteryScore));
  const trainingAdoptionRate = avg(dashboards.map((d) => d.trainingAdoptionRate));
  const evidenceSubmissionRate = avg(dashboards.map((d) => d.evidenceSubmissionRate));

  const schoolsAtRisk = recommendations.filter((r) => isAtRisk(r.growthRiskFlag)).length;
  const topInterventionPriority = Math.max(
    0,
    ...recommendations.map((r) => r.interventionPriorityScore)
  );

  return {
    avgMasteryScore,
    trainingAdoptionRate,
    evidenceSubmissionRate,
    schoolCount,
    schoolsAtRisk,
    topInterventionPriority,
  };
}
