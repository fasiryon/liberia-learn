import type { OptimizationRecommendation } from "@/lib/autonomous/optimization/types";
import { getDetectorPrecisionMetrics } from "@/lib/autonomous/optimization/recommendationPrecisionService";

function clamp(value: number) {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

export async function generateDetectorTuningRecommendations(input: { schoolId?: string | null; detectorId?: string | null } = {}): Promise<OptimizationRecommendation[]> {
  const metrics = await getDetectorPrecisionMetrics(input);
  const scopeId = input.schoolId ?? input.detectorId ?? "platform";
  const recommendations: OptimizationRecommendation[] = [];
  if (metrics.falsePositiveRate >= 0.25 || metrics.precision < 0.6) {
    recommendations.push({
      idempotencyKey: `optimization:detector-threshold:${scopeId}:${metrics.precision}:${metrics.falsePositiveRate}`,
      category: "detector_threshold",
      title: "Review detector threshold before next rollout stage",
      targetScope: input.schoolId ? "school" : "platform",
      targetId: input.detectorId ?? scopeId,
      schoolId: input.schoolId ?? null,
      riskLevel: "medium",
      confidence: clamp(Math.max(1 - metrics.precision, metrics.falsePositiveRate)),
      confidenceRationale: `Precision ${metrics.precision} and false-positive rate ${metrics.falsePositiveRate} indicate threshold review is warranted.`,
      evidenceRefs: { metrics },
      expectedImpact: "Reduce unnecessary recommendations and repeated review burden.",
      rollbackGuidance: "Do not activate threshold changes until reviewed; revert by restoring the previous detector config.",
      approvalRequirement: "Optimization review approval required; detector code/config must be changed separately by an authorized human.",
      proposedChange: { recommendationOnly: true, suggestedDirection: "raise_threshold", estimatedDelta: 0.05 },
      evaluationPlan: "Compare precision and false-positive rate over the next evaluated recommendation window.",
      lineage: { source: "detectorTuningService", metricsVersion: "detector-precision-v1" },
      limitations: ["Recall is estimated from observed false-negative events and may be incomplete."],
    });
  }
  if (metrics.averageEvidenceCoverage < 0.7 && metrics.total > 0) {
    recommendations.push({
      idempotencyKey: `optimization:evidence-weighting:${scopeId}:${metrics.averageEvidenceCoverage}`,
      category: "evidence_weighting",
      title: "Increase evidence coverage requirements for recommendations",
      targetScope: input.schoolId ? "school" : "platform",
      targetId: input.detectorId ?? scopeId,
      schoolId: input.schoolId ?? null,
      riskLevel: "medium",
      confidence: clamp(1 - metrics.averageEvidenceCoverage),
      confidenceRationale: `Average evidence coverage is ${metrics.averageEvidenceCoverage}, below the governance target.`,
      evidenceRefs: { metrics },
      expectedImpact: "Improve explainability and reviewer confidence in generated recommendations.",
      rollbackGuidance: "Restore prior evidence weighting if recommendation volume drops without precision gains.",
      approvalRequirement: "Human optimization review required before any evidence weighting change.",
      proposedChange: { recommendationOnly: true, suggestedDirection: "require_more_primary_evidence" },
      evaluationPlan: "Track evidence coverage, acceptance rate, and false positives after review-approved tuning.",
      lineage: { source: "detectorTuningService", metricsVersion: "detector-precision-v1" },
      limitations: ["Sparse evaluated outcomes may understate detector quality."],
    });
  }
  return recommendations;
}
