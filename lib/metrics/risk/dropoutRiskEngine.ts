/**
 * lib/metrics/risk/dropoutRiskEngine.ts
 * Deterministic dropout risk scoring from indicator inputs.
 */

import {
  computeRiskIndicatorBreakdown,
  type AttendanceIndicatorInput,
  type EvidenceVelocityIndicatorInput,
  type MasteryDeclineIndicatorInput,
  type AiRelianceIndicatorInput,
  type AssignmentCompletionIndicatorInput,
  type RiskIndicatorBreakdown,
} from "./riskIndicators";

export type DropoutRiskBand = "LOW" | "MEDIUM" | "HIGH";

export type DropoutRiskInput = {
  attendance: AttendanceIndicatorInput;
  evidenceVelocity: EvidenceVelocityIndicatorInput;
  masteryDecline: MasteryDeclineIndicatorInput;
  aiRelianceIncrease: AiRelianceIndicatorInput;
  assignmentCompletion: AssignmentCompletionIndicatorInput;
  includeBreakdown?: boolean;
  allowAiSignal?: boolean;
  aiSignal?: { score: number; reason: string } | null;
};

export type DropoutRiskResult = {
  totalRiskScore: number; // 0..100
  riskBand: DropoutRiskBand;
  reasons: string[];
  indicatorBreakdown?: RiskIndicatorBreakdown;
};

const WEIGHTS = {
  attendanceRisk: 0.22,
  evidenceVelocityRisk: 0.2,
  masteryDeclineRisk: 0.26,
  aiRelianceIncreaseRisk: 0.14,
  assignmentCompletionRisk: 0.18,
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function roundRiskScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function classifyRiskBand(score: number): DropoutRiskBand {
  if (score >= 65) return "HIGH";
  if (score >= 35) return "MEDIUM";
  return "LOW";
}

export function computeDropoutRisk(input: DropoutRiskInput): DropoutRiskResult {
  const breakdown = computeRiskIndicatorBreakdown({
    attendance: input.attendance,
    evidenceVelocity: input.evidenceVelocity,
    masteryDecline: input.masteryDecline,
    aiRelianceIncrease: input.aiRelianceIncrease,
    assignmentCompletion: input.assignmentCompletion,
  });

  const weightedScore =
    breakdown.attendanceRisk * WEIGHTS.attendanceRisk +
    breakdown.evidenceVelocityRisk * WEIGHTS.evidenceVelocityRisk +
    breakdown.masteryDeclineRisk * WEIGHTS.masteryDeclineRisk +
    breakdown.aiRelianceIncreaseRisk * WEIGHTS.aiRelianceIncreaseRisk +
    breakdown.assignmentCompletionRisk * WEIGHTS.assignmentCompletionRisk;

  let totalRiskScore = weightedScore * 100;
  const reasons: string[] = [];

  const attendanceRate = input.attendance.recentAttendanceRate;
  if (attendanceRate !== undefined && attendanceRate < 0.75) {
    reasons.push("Attendance proxy below 75% in the recent window");
  }

  const evidencePrior = input.evidenceVelocity.priorEvidenceCount;
  const evidenceRecent = input.evidenceVelocity.recentEvidenceCount ?? 0;
  if (evidencePrior !== undefined && evidencePrior >= 2) {
    const drop = (evidencePrior - evidenceRecent) / Math.max(evidencePrior, 1);
    if (drop >= 0.3) reasons.push("Evidence submission slowed by 30%+");
  }

  const masteryBaseline = input.masteryDecline.baselineAvgMastery;
  const masteryCurrent = input.masteryDecline.currentAvgMastery;
  if (masteryBaseline !== undefined && masteryCurrent !== undefined) {
    const delta = masteryCurrent - masteryBaseline;
    if (delta <= -0.1) reasons.push("Mastery signals are declining");
  }
  if ((input.masteryDecline.decayingFraction ?? 0) >= 0.2) {
    reasons.push("Multiple strands show decay risk");
  }

  const aiRecent = input.aiRelianceIncrease.recentAiRelianceRate;
  const aiPrior = input.aiRelianceIncrease.priorAiRelianceRate;
  if (aiRecent !== undefined && aiPrior !== undefined) {
    if (aiRecent - aiPrior >= 0.15) reasons.push("AI reliance increased sharply");
  }

  const completionRate = input.assignmentCompletion.recentCompletionRate;
  if (completionRate !== undefined && completionRate < 0.7) {
    reasons.push("Assignment completion below 70% in the recent window");
  }

  if (input.allowAiSignal && input.aiSignal) {
    const aiScore = clamp01(input.aiSignal.score);
    totalRiskScore = Math.min(100, totalRiskScore + aiScore * 10);
    if (input.aiSignal.reason) reasons.push(input.aiSignal.reason);
  }

  const score = roundRiskScore(totalRiskScore);
  const riskBand = classifyRiskBand(score);

  return {
    totalRiskScore: score,
    riskBand,
    reasons,
    indicatorBreakdown: input.includeBreakdown ? breakdown : undefined,
  };
}
