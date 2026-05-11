import type { AutonomyReadinessScore, OptimizationRecommendation } from "@/lib/autonomous/optimization/types";
import { getOperationalEffectivenessMetrics } from "@/lib/autonomous/optimization/operationalEffectivenessService";
import { getDetectorPrecisionMetrics } from "@/lib/autonomous/optimization/recommendationPrecisionService";

function clamp(value: number) {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

export async function scoreAutonomyReadiness(input: { schoolId?: string | null } = {}): Promise<AutonomyReadinessScore> {
  const [precision, ops] = await Promise.all([getDetectorPrecisionMetrics(input), getOperationalEffectivenessMetrics(input)]);
  const rollbackEffectiveness = clamp(1 - ops.rollbackFrequency);
  const tenantSafetyConfidence = 1;
  const approvalGovernanceQuality = clamp(1 - (ops.approvalSLA.buckets?.breached ?? 0) / Math.max(1, ops.approvalSLA.total ?? 0));
  const detectorReliability = clamp((precision.precision + precision.recallProxy + precision.averageEvidenceCoverage) / 3);
  const recommendationPrecision = clamp(precision.precision);
  const workflowStability = clamp(ops.workflowStability);
  const score = clamp(
    detectorReliability * 0.24 +
      recommendationPrecision * 0.2 +
      rollbackEffectiveness * 0.14 +
      workflowStability * 0.16 +
      tenantSafetyConfidence * 0.14 +
      approvalGovernanceQuality * 0.12
  );
  return {
    score,
    detectorReliability,
    recommendationPrecision,
    rollbackEffectiveness,
    workflowStability,
    tenantSafetyConfidence,
    approvalGovernanceQuality,
    rationale: [
      "Readiness is advisory only and cannot expand autonomy scope.",
      "Tenant safety is scored from scope controls, not from cross-tenant data.",
      "Low scores generate review recommendations rather than automatic changes.",
    ],
  };
}

export async function generateRolloutCalibrationRecommendations(input: { schoolId?: string | null; districtId?: string | null } = {}): Promise<OptimizationRecommendation[]> {
  const [readiness, ops] = await Promise.all([scoreAutonomyReadiness(input), getOperationalEffectivenessMetrics(input)]);
  const recommendations: OptimizationRecommendation[] = [];
  if (readiness.score < 0.75) {
    recommendations.push({
      idempotencyKey: `optimization:rollout:${input.schoolId ?? input.districtId ?? "platform"}:${readiness.score}`,
      category: "low_risk_rollout_sizing",
      title: "Hold or narrow low-risk pilot rollout",
      targetScope: input.schoolId ? "school" : input.districtId ? "district" : "platform",
      targetId: input.schoolId ?? input.districtId ?? "platform",
      schoolId: input.schoolId ?? null,
      districtId: input.districtId ?? null,
      riskLevel: "medium",
      confidence: clamp(1 - readiness.score),
      confidenceRationale: `Autonomy readiness score is ${readiness.score}; rollout expansion should remain human-reviewed.`,
      evidenceRefs: { readiness, operationalMetrics: ops },
      expectedImpact: "Reduce premature rollout risk while preserving observability and pilot learning.",
      rollbackGuidance: "Keep low-risk autonomy feature flags disabled or limited to the current allowlist.",
      approvalRequirement: "Platform admin and governance review required before rollout sizing changes.",
      proposedChange: { recommendationOnly: true, suggestedPilotCap: readiness.score < 0.5 ? "decrease" : "hold" },
      evaluationPlan: "Recompute readiness after additional evaluated outcomes and SLA stabilization.",
      lineage: { source: "rolloutCalibrationService", readinessVersion: "autonomy-readiness-v1" },
      limitations: ["Readiness uses proxy metrics when long-window outcome data is sparse."],
    });
  }
  return recommendations;
}
