import type { PostChangeMetricSet } from "@/lib/autonomous/optimization/postChangeOutcomeAggregator";

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function movement(baseline: unknown, actual: unknown, inverse = false): number | null {
  const before = num(baseline);
  const after = num(actual);
  if (before == null || after == null) return null;
  const delta = inverse ? before - after : after - before;
  return Number(delta.toFixed(2));
}

export function scoreImplementationEffectiveness(input: {
  baselineMetrics: Record<string, any>;
  actualMetrics: PostChangeMetricSet;
}) {
  const actual = input.actualMetrics;
  const baseline = input.baselineMetrics ?? {};
  const movements = {
    detectorPrecision: movement(baseline.detectorPrecision, actual.detectorPrecision),
    falsePositiveRate: movement(baseline.falsePositiveRate, actual.falsePositiveRate, true),
    falseNegativeRate: movement(baseline.falseNegativeRate, actual.falseNegativeRate, true),
    evidenceCoverage: movement(baseline.evidenceCoverage, actual.evidenceCoverage),
    recommendationAcceptanceRate: movement(baseline.recommendationAcceptanceRate, actual.recommendationAcceptanceRate),
    approvalRejectionRate: movement(baseline.approvalRejectionRate, actual.approvalRejectionRate, true),
    rolloutStability: movement(baseline.rolloutStability, actual.rolloutStability),
    workflowStability: movement(baseline.workflowStability, actual.workflowStability),
    operationalEffectivenessDelta: movement(baseline.operationalEffectivenessDelta, actual.operationalEffectivenessDelta),
  };
  const values = Object.values(movements).filter((value): value is number => value != null);
  const rawScore = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const penalty = actual.rollbackOccurrence > 0 || actual.tenantSafetyIncidents > 0 ? 0.25 : 0;
  const confidence = Number(Math.max(0.05, Math.min(0.99, (actual.sparseData ? 0.45 : 0.8) * actual.confidenceMultiplier)).toFixed(2));
  const effectivenessScore = Number(Math.max(0, Math.min(1, 0.5 + rawScore - penalty)).toFixed(2));
  return { movements, effectivenessScore, confidence, sparseData: actual.sparseData };
}
