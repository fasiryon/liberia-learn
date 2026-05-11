import { scoreImplementationEffectiveness } from "@/lib/autonomous/optimization/implementationEffectivenessService";
import type { PostChangeMetricSet } from "@/lib/autonomous/optimization/postChangeOutcomeAggregator";

export type ImplementationFinding =
  | "improvement_confirmed"
  | "no_measurable_improvement"
  | "regression_detected"
  | "insufficient_evidence"
  | "rollback_recommended"
  | "rollout_pause_recommended";

export function generateImplementationFindings(input: {
  baselineMetrics: Record<string, any> | null | undefined;
  actualMetrics: PostChangeMetricSet | null | undefined;
}) {
  if (!input.baselineMetrics || !input.actualMetrics) {
    throw Object.assign(new Error("Findings require baseline and actual metrics"), { status: 422, code: "baseline_actual_required" });
  }
  const effectiveness = scoreImplementationEffectiveness({
    baselineMetrics: input.baselineMetrics,
    actualMetrics: input.actualMetrics,
  });
  const findings: ImplementationFinding[] = [];
  if (input.actualMetrics.sparseData) findings.push("insufficient_evidence");
  if (input.actualMetrics.tenantSafetyIncidents > 0 || input.actualMetrics.rollbackOccurrence > 0) findings.push("rollback_recommended");
  if ((effectiveness.movements.rolloutStability ?? 0) < -0.1 || (effectiveness.movements.workflowStability ?? 0) < -0.1) {
    findings.push("rollout_pause_recommended");
  }
  if (effectiveness.effectivenessScore >= 0.58 && findings.length === 0) findings.push("improvement_confirmed");
  if (effectiveness.effectivenessScore < 0.42) findings.push("regression_detected");
  if (findings.length === 0) findings.push("no_measurable_improvement");
  return {
    generatedAt: new Date().toISOString(),
    findings,
    effectiveness,
    advisoryOnly: true,
    policyMutation: false,
  };
}
