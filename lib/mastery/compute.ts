/**
 * lib/mastery/compute.ts — Block 7A: Pure Mastery Computation Library
 *
 * All functions are:
 *   - Deterministic: same inputs always produce the same output.
 *   - Pure: no DB access, no side effects, no randomness.
 *   - Tenant-safe: no PII accepted or returned; inputs are scores/counts only.
 *   - Unit-tested: see __tests__/mastery.compute.test.ts
 *
 * Official Definitions (from product spec):
 *
 *   Proficiency:    Independently apply concept with ≥75% accuracy across
 *                   varied question types without AI assistance.
 *
 *   Mastery:        Sustain ≥85% accuracy across spaced assessments and correct
 *                   application in cumulative/cross-topic problems over time.
 *
 *   Growth:         Improvement relative to baseline via score delta, retention
 *                   stability, and reduced reliance on guided support.
 *
 *   Statistically Meaningful Improvement:
 *                   Gains exceed normal variation, sustained across multiple
 *                   assessments, with ≥60% of students showing measurable growth.
 *
 * Grade-Band Weighting:
 *   G1–3:   50% Growth / 50% Absolute
 *   G4–6:   45% Growth / 55% Absolute
 *   G7–9:   40% Growth / 60% Absolute
 *   G10–12: 30% Growth / 70% Absolute
 */

import type { GradeBand, ProficiencyState, MasteryState } from "@prisma/client";

// ─── Thresholds ───────────────────────────────────────────────────────────────

/** Minimum accuracy (0–1) for independent proficiency without AI assistance. */
export const PROFICIENCY_THRESHOLD = 0.75;

/** Minimum accuracy (0–1) required to sustain mastery across spaced assessments. */
export const MASTERY_THRESHOLD = 0.85;

/**
 * Minimum accuracy (0–1) to be considered "approaching" proficiency.
 * Below this → BELOW_PROFICIENT / DEVELOPING.
 */
export const APPROACHING_THRESHOLD = 0.60;

/**
 * Minimum sustainability index (0–1) required to confirm MASTERED state.
 * Prevents noisy high scores from triggering mastery on a single good day.
 */
export const MASTERY_SUSTAINABILITY_MIN = 0.65;

/**
 * Minimum number of spaced assessment events before MASTERED can be awarded.
 * Enforces "across spaced assessments" from the mastery definition.
 */
export const MASTERY_MIN_ASSESSMENTS = 3;

/**
 * Decay rate threshold (per day) above which DECAYING state is triggered.
 * A decay rate of 0.01 means roughly 1% score drop per day of no assessment.
 */
export const DECAY_ALERT_THRESHOLD = 0.005;

// ─── Grade-band weighting model ───────────────────────────────────────────────

type GradeBandWeights = { growth: number; absolute: number };

/**
 * Official grade-band weighting model.
 * Earlier grades weight growth more heavily (formative focus).
 * Later grades weight absolute proficiency more heavily (summative focus).
 */
export const GRADE_BAND_WEIGHTS: Record<GradeBand, GradeBandWeights> = {
  G1_3:  { growth: 0.50, absolute: 0.50 },
  G4_6:  { growth: 0.45, absolute: 0.55 },
  G7_9:  { growth: 0.40, absolute: 0.60 },
  G10_12:{ growth: 0.30, absolute: 0.70 },
};

// ─── Pure computation functions ───────────────────────────────────────────────

/**
 * Derives the ProficiencyState from a current score (0–1).
 *
 * Thresholds:
 *   score ≥ 0.75 → PROFICIENT
 *   score ≥ 0.60 → APPROACHING
 *   score  < 0.60 → BELOW_PROFICIENT
 *
 * The score should reflect unaided accuracy (AI-assisted attempts excluded
 * or down-weighted by the caller before passing in).
 */
export function computeProficiencyState(currentScore: number): ProficiencyState {
  if (currentScore >= PROFICIENCY_THRESHOLD) return "PROFICIENT";
  if (currentScore >= APPROACHING_THRESHOLD)  return "APPROACHING";
  return "BELOW_PROFICIENT";
}

/**
 * Derives the MasteryState from sustained performance indicators.
 *
 * Rules (applied in order):
 *   1. If assessmentCount < MASTERY_MIN_ASSESSMENTS → DEVELOPING
 *      (insufficient evidence; "sustained" cannot be proven yet)
 *   2. If currentScore ≥ MASTERY_THRESHOLD AND sustainabilityIndex ≥ MASTERY_SUSTAINABILITY_MIN
 *      AND decayRate ≤ DECAY_ALERT_THRESHOLD → MASTERED
 *   3. If decayRate > DECAY_ALERT_THRESHOLD AND prior state was MASTERED → DECAYING
 *   4. If currentScore ≥ PROFICIENCY_THRESHOLD → APPROACHING
 *   5. Otherwise → DEVELOPING
 *
 * @param currentScore       Most recent assessment score (0–1).
 * @param sustainabilityIndex Stability of scores over time (0–1). See computeSustainabilityIndex.
 * @param assessmentCount    Total number of spaced assessment events for this strand.
 * @param decayRate          Per-day score decay rate. See computeDecayRate.
 * @param priorMasteryState  Previous state (used to detect DECAYING from MASTERED).
 */
export function computeMasteryState(
  currentScore: number,
  sustainabilityIndex: number,
  assessmentCount: number,
  decayRate: number,
  priorMasteryState: MasteryState = "NOT_ASSESSED"
): MasteryState {
  if (assessmentCount < MASTERY_MIN_ASSESSMENTS) return "DEVELOPING";

  const isDecaying = decayRate > DECAY_ALERT_THRESHOLD;

  if (
    currentScore >= MASTERY_THRESHOLD &&
    sustainabilityIndex >= MASTERY_SUSTAINABILITY_MIN &&
    !isDecaying
  ) {
    return "MASTERED";
  }

  // Detect transition from previously mastered → now decaying
  if (isDecaying && (priorMasteryState === "MASTERED" || priorMasteryState === "DECAYING")) {
    return "DECAYING";
  }

  if (currentScore >= PROFICIENCY_THRESHOLD) return "APPROACHING";
  return "DEVELOPING";
}

/**
 * Computes the raw growth delta relative to a student's baseline score.
 *
 * Growth = currentScore − baselineScore
 * Range: −1.0 to +1.0 (negative means regression, positive means improvement)
 *
 * This is the primary growth signal; use computeHybridScoreByGradeBand for
 * the weighted composite.
 */
export function computeGrowthDelta(baselineScore: number, currentScore: number): number {
  return currentScore - baselineScore;
}

/**
 * Computes the sustainability index: a measure of score stability across
 * a sequence of assessments.
 *
 * SI = 1 − (stdDev / maxPossibleStdDev)
 *
 * where maxPossibleStdDev = 0.5 (the worst-case std-dev for scores in [0,1]).
 *
 * Returns:
 *   1.0 → perfectly stable (all scores identical)
 *   0.0 → maximally volatile
 *   Clamped to [0, 1].
 *
 * Requires at least 2 scores; returns 0 for a single-point or empty series.
 *
 * @param scores Assessment scores in chronological order, each in [0, 1].
 */
export function computeSustainabilityIndex(scores: number[]): number {
  if (scores.length < 2) return 0;

  const mean = scores.reduce((acc, s) => acc + s, 0) / scores.length;
  const variance = scores.reduce((acc, s) => acc + Math.pow(s - mean, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);

  // Normalise: worst-case stdDev for values in [0,1] is 0.5 (half above, half below)
  const MAX_STD_DEV = 0.5;
  return Math.max(0, Math.min(1, 1 - stdDev / MAX_STD_DEV));
}

/**
 * Computes the average per-day decay rate from a sequence of assessment scores.
 *
 * Only negative score deltas contribute to decay (positive deltas are growth).
 * The rate is normalised by the number of days between each pair of assessments.
 *
 * Returns:
 *   0       → no decay observed
 *   > 0     → average fractional score lost per day during declining periods
 *
 * @param scores        Assessment scores in chronological order, each in [0, 1].
 * @param daysBetween   Days elapsed between consecutive assessments.
 *                      Length must be scores.length − 1.
 *                      Any value < 1 is treated as 1 to avoid division by zero.
 */
export function computeDecayRate(scores: number[], daysBetween: number[]): number {
  if (scores.length < 2) return 0;

  let totalDecay = 0;
  let decayCount = 0;

  for (let i = 1; i < scores.length; i++) {
    const delta = scores[i] - scores[i - 1];
    if (delta < 0) {
      const days = Math.max(1, daysBetween[i - 1] ?? 1);
      totalDecay += Math.abs(delta) / days;
      decayCount++;
    }
  }

  return decayCount > 0 ? totalDecay / decayCount : 0;
}

/**
 * Computes the AI reliance rate: fraction of attempts where AI assistance
 * was used.
 *
 * Returns 0 if totalAttempts is 0 (avoids division by zero).
 * Result is clamped to [0, 1].
 *
 * Interpretation:
 *   0.0 → fully independent
 *   1.0 → every attempt used AI assistance
 *
 * @param totalAttempts       Total number of question attempts for this strand.
 * @param aiAssistedAttempts  Number of attempts where AI guidance was invoked.
 */
export function computeAiRelianceRate(
  totalAttempts: number,
  aiAssistedAttempts: number
): number {
  if (totalAttempts <= 0) return 0;
  return Math.max(0, Math.min(1, aiAssistedAttempts / totalAttempts));
}

/**
 * Computes the hybrid score for a grade band using the official weighting model.
 *
 * HybridScore = (growthWeight × normalizedGrowth) + (absoluteWeight × currentScore)
 *
 * Growth is normalised relative to remaining headroom from baseline:
 *   normalizedGrowth = growthDelta / (1 − baselineScore)
 *
 * When baselineScore = 1.0 (no headroom), growth is forced to 0 to avoid
 * division by zero (the student is already at ceiling).
 *
 * Result is clamped to [0, 1].
 *
 * @param gradeBand     GradeBand enum value (drives growth/absolute weights).
 * @param currentScore  Current assessment score (0–1).
 * @param growthDelta   Raw growth relative to baseline (can be negative). See computeGrowthDelta.
 * @param baselineScore Student's baseline score (0–1).
 */
export function computeHybridScoreByGradeBand(
  gradeBand: GradeBand,
  currentScore: number,
  growthDelta: number,
  baselineScore: number
): number {
  const { growth: growthWeight, absolute: absoluteWeight } = GRADE_BAND_WEIGHTS[gradeBand];

  const headroom = 1 - baselineScore;
  const normalizedGrowth =
    headroom > 0
      ? Math.max(0, Math.min(1, growthDelta / headroom))
      : 0;

  const hybrid = growthWeight * normalizedGrowth + absoluteWeight * currentScore;
  return Math.max(0, Math.min(1, hybrid));
}

// ─── Type exports for consumers ───────────────────────────────────────────────

export type { GradeBand, ProficiencyState, MasteryState };
