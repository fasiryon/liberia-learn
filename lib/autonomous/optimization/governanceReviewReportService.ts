import { listOptimizationRecommendations, type OptimizationReviewer } from "@/lib/autonomous/optimization/optimizationReviewService";
import { scoreAutonomyReadiness } from "@/lib/autonomous/optimization/rolloutCalibrationService";
import { getDetectorPrecisionMetrics } from "@/lib/autonomous/optimization/recommendationPrecisionService";

export async function getGovernanceOptimizationReport(input: { requester: OptimizationReviewer; schoolId?: string | null; aggregateOnly?: boolean }) {
  const [recommendations, readiness, precision] = await Promise.all([
    listOptimizationRecommendations({ requester: input.requester, schoolId: input.schoolId, aggregateOnly: input.aggregateOnly, limit: 200 }),
    scoreAutonomyReadiness({ schoolId: input.schoolId }),
    getDetectorPrecisionMetrics({ schoolId: input.schoolId }),
  ]);
  const byStatus = recommendations.reduce((acc: Record<string, number>, recommendation: any) => {
    acc[recommendation.reviewStatus] = (acc[recommendation.reviewStatus] ?? 0) + 1;
    return acc;
  }, {});
  const byCategory = recommendations.reduce((acc: Record<string, number>, recommendation: any) => {
    acc[recommendation.category] = (acc[recommendation.category] ?? 0) + 1;
    return acc;
  }, {});
  return {
    recommendations,
    byStatus,
    byCategory,
    readiness,
    precision,
    policySafety: {
      recommendationOnly: true,
      autonomousPolicyMutation: false,
      autoDetectorModification: false,
      autoRiskAdjustment: false,
    },
  };
}
