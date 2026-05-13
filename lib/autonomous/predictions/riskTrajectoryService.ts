import type { ConfidenceBand, ForecastFactor, RiskBand, Trajectory } from "@/lib/autonomous/predictions/types";

export function classifyTrajectory(factors: ForecastFactor[]): Trajectory {
  const negative = factors.filter((factor) => factor.direction === "negative").reduce((sum, factor) => sum + factor.score, 0);
  const positive = factors.filter((factor) => factor.direction === "positive").reduce((sum, factor) => sum + factor.score, 0);
  const missing = factors.filter((factor) => factor.direction === "missing").length;
  if (factors.length === 0 || missing === factors.length || missing >= Math.max(3, factors.length / 2)) return "unknown";
  if (negative - positive >= 35) return "deteriorating";
  if (positive - negative >= 25) return "improving";
  return "stable";
}

export function classifyRiskBand(score: number): RiskBand {
  if (score >= 67) return "HIGH";
  if (score >= 34) return "MEDIUM";
  return "LOW";
}

export function confidenceBand(score: number): ConfidenceBand {
  if (score >= 0.75) return "HIGH";
  if (score >= 0.45) return "MEDIUM";
  return "LOW";
}

export function calculateConfidence(input: {
  evidenceCount: number;
  lastSignalAt: Date | null;
  conflictingEvidenceCount?: number;
  historicalOutcomeSupport?: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  let confidence = 0.25;
  const rationale: string[] = [];

  if (input.evidenceCount >= 20) {
    confidence += 0.3;
    rationale.push("broad recent signal base");
  } else if (input.evidenceCount >= 8) {
    confidence += 0.18;
    rationale.push("moderate recent signal base");
  } else {
    confidence -= 0.08;
    rationale.push("sparse recent signal base");
  }

  if (input.lastSignalAt) {
    const ageDays = Math.floor((now.getTime() - input.lastSignalAt.getTime()) / 86400000);
    if (ageDays <= 3) {
      confidence += 0.18;
      rationale.push("fresh product signals");
    } else if (ageDays <= 10) {
      confidence += 0.05;
      rationale.push("signals are recent but aging");
    } else {
      confidence -= 0.15;
      rationale.push("stale signal window");
    }
  } else {
    confidence -= 0.18;
    rationale.push("no recent signal timestamp");
  }

  const conflicts = input.conflictingEvidenceCount ?? 0;
  if (conflicts > 0) {
    confidence -= Math.min(0.2, conflicts * 0.05);
    rationale.push("conflicting evidence lowers certainty");
  }

  const outcomeSupport = input.historicalOutcomeSupport ?? 0;
  if (outcomeSupport > 0) {
    confidence += Math.min(0.18, outcomeSupport);
    rationale.push("historical outcomes support this pattern");
  }

  const score = Number(Math.max(0.05, Math.min(0.92, confidence)).toFixed(2));
  return { score, band: confidenceBand(score), rationale };
}
