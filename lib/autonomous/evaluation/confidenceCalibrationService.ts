import type { RecommendationEvaluation } from "@/lib/autonomous/evaluation/types";

export const CONFIDENCE_CALIBRATION_VERSION = "deterministic-v1";

export function scoreEvidenceCoverage(evidenceRefs: any) {
  const refs = Array.isArray(evidenceRefs?.refs) ? evidenceRefs.refs : Array.isArray(evidenceRefs) ? evidenceRefs : [];
  if (refs.length === 0) return 0;
  const scoped = refs.filter((ref: any) => ref?.id && ref?.type && (ref?.schoolId || ref?.districtId || ref?.scope === "aggregate"));
  return Number(Math.min(1, scoped.length / refs.length).toFixed(2));
}

export function precisionFromOutcome(outcome: RecommendationEvaluation["outcome"]) {
  if (outcome === "accepted" || outcome === "executed" || outcome === "improved") return 1;
  if (outcome === "rejected" || outcome === "false_positive") return 0;
  if (outcome === "no_measurable_change") return 0.35;
  return 0.5;
}

export function calibrateConfidence(input: {
  confidenceBefore?: number | null;
  outcome: RecommendationEvaluation["outcome"];
  evidenceCoverageScore: number;
  effectivenessScore?: number;
}) {
  const base = Math.max(0, Math.min(1, input.confidenceBefore ?? 0.5));
  const precision = precisionFromOutcome(input.outcome);
  const effectiveness = input.effectivenessScore ?? precision;
  const calibrated = base * 0.55 + precision * 0.25 + input.evidenceCoverageScore * 0.1 + effectiveness * 0.1;
  return Number(Math.max(0.05, Math.min(0.99, calibrated)).toFixed(2));
}

