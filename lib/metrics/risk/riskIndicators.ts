/**
 * lib/metrics/risk/riskIndicators.ts
 * Pure indicator computations (no DB access).
 */

export type AttendanceIndicatorInput = {
  recentAttendanceRate?: number;
  priorAttendanceRate?: number;
  recentSessions?: number;
};

export type EvidenceVelocityIndicatorInput = {
  recentEvidenceCount?: number;
  priorEvidenceCount?: number;
};

export type MasteryDeclineIndicatorInput = {
  currentAvgMastery?: number;
  baselineAvgMastery?: number;
  decayingFraction?: number;
};

export type AiRelianceIndicatorInput = {
  recentAiRelianceRate?: number;
  priorAiRelianceRate?: number;
};

export type AssignmentCompletionIndicatorInput = {
  recentCompletionRate?: number;
  priorCompletionRate?: number;
};

export type RiskIndicatorBreakdown = {
  attendanceRisk: number;
  evidenceVelocityRisk: number;
  masteryDeclineRisk: number;
  aiRelianceIncreaseRisk: number;
  assignmentCompletionRisk: number;
};

const DEFAULT_ATTENDANCE_TARGET = 0.85;
const DEFAULT_COMPLETION_TARGET = 0.8;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function computeAttendanceRisk(input: AttendanceIndicatorInput): number {
  const rate = input.recentAttendanceRate;
  if (rate === undefined || rate === null) return 0;
  if (typeof input.recentSessions === "number" && input.recentSessions < 3) {
    return 0;
  }
  const deficit = DEFAULT_ATTENDANCE_TARGET - rate;
  return clamp01(deficit / DEFAULT_ATTENDANCE_TARGET);
}

export function computeEvidenceVelocityRisk(input: EvidenceVelocityIndicatorInput): number {
  const prior = input.priorEvidenceCount;
  const recent = input.recentEvidenceCount ?? 0;
  if (prior === undefined || prior === null || prior < 2) return 0;
  const drop = (prior - recent) / Math.max(prior, 1);
  return clamp01(drop);
}

export function computeMasteryDeclineRisk(input: MasteryDeclineIndicatorInput): number {
  const current = input.currentAvgMastery;
  const baseline = input.baselineAvgMastery;
  if (current === undefined || baseline === undefined) return 0;
  const delta = current - baseline;
  const deltaRisk = clamp01((-delta) / 0.2);
  const decaying = input.decayingFraction ?? 0;
  const decayRisk = clamp01(decaying / 0.4) * 0.6;
  return clamp01(Math.max(deltaRisk, decayRisk));
}

export function computeAiRelianceIncreaseRisk(input: AiRelianceIndicatorInput): number {
  const recent = input.recentAiRelianceRate;
  const prior = input.priorAiRelianceRate;
  if (recent === undefined || prior === undefined) return 0;
  const delta = recent - prior;
  return clamp01(delta / 0.2);
}

export function computeAssignmentCompletionRisk(
  input: AssignmentCompletionIndicatorInput
): number {
  const rate = input.recentCompletionRate;
  if (rate === undefined || rate === null) return 0;
  const deficit = DEFAULT_COMPLETION_TARGET - rate;
  return clamp01(deficit / DEFAULT_COMPLETION_TARGET);
}

export function computeRiskIndicatorBreakdown(input: {
  attendance: AttendanceIndicatorInput;
  evidenceVelocity: EvidenceVelocityIndicatorInput;
  masteryDecline: MasteryDeclineIndicatorInput;
  aiRelianceIncrease: AiRelianceIndicatorInput;
  assignmentCompletion: AssignmentCompletionIndicatorInput;
}): RiskIndicatorBreakdown {
  return {
    attendanceRisk: computeAttendanceRisk(input.attendance),
    evidenceVelocityRisk: computeEvidenceVelocityRisk(input.evidenceVelocity),
    masteryDeclineRisk: computeMasteryDeclineRisk(input.masteryDecline),
    aiRelianceIncreaseRisk: computeAiRelianceIncreaseRisk(input.aiRelianceIncrease),
    assignmentCompletionRisk: computeAssignmentCompletionRisk(input.assignmentCompletion),
  };
}
