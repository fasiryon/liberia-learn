/**
 * lib/mastery/baseline.ts — Block 7B: Adaptive Baseline Computation Library
 *
 * Implements a simple, explainable EMA (Exponential Moving Average) algorithm
 * to estimate a student's ability level per strand.
 *
 * Design principles:
 *   - Pure: no DB access, no side effects, no randomness.
 *   - Deterministic: same inputs always produce the same output.
 *   - Explainable: every number can be traced back to a formula.
 *   - Bounded: ability stays within [ABILITY_MIN, ABILITY_MAX].
 *   - Not IRT: this is NOT a full Item Response Theory implementation.
 *     Full IRT requires calibrated item parameters. This is a pragmatic
 *     approximation suitable for formative assessment at this stage.
 *     IRT is deferred to Block 7C when item calibration data exists.
 *
 * Ability Scale:
 *   -2.0 → far below grade level
 *    0.0 → at grade level
 *   +2.0 → well above grade level
 *
 * The ability score maps to a 0–1 score via normalizeAbilityToScore()
 * for use in StudentMasteryProfile.baselineScore.
 *
 * See docs/product/ADAPTIVE_BASELINE.md for the full product reference.
 */

// ─── Bounds and constants ────────────────────────────────────────────────────

/** Minimum ability value. Below this: far below grade level. */
export const ABILITY_MIN = -2;

/** Maximum ability value. Above this: well above grade level. */
export const ABILITY_MAX = 2;

/**
 * Base learning rate for the EMA update.
 * Scaled by assessmentWeight and dampened by attemptCount.
 */
export const BASE_ALPHA = 0.5;

/**
 * Maximum single-step ability change (guardrail against wild jumps).
 * Even a perfect exam on the hardest item cannot move ability by more than this.
 */
export const MAX_ABILITY_DELTA = 0.8;

// ─── Evidence type ───────────────────────────────────────────────────────────

/**
 * Assessment evidence used to update a student's baseline ability.
 *
 * All fields are about the item/session being evaluated — no PII.
 */
export type BaselineEvidence = {
  /**
   * Student's correctness on this attempt: 0.0 (all wrong) to 1.0 (all correct).
   * For a single MCQ: 0 or 1. For a multi-part problem: fraction correct.
   */
  correctness: number;
  /**
   * Difficulty level of the item(s): 1 (easiest) to 5 (hardest).
   * Maps to ability parameter values defined by DIFFICULTY_PARAMS.
   */
  difficulty: 1 | 2 | 3 | 4 | 5;
  /**
   * Time spent on this attempt in seconds (optional).
   * Currently unused in ability calculation but stored for future analytics.
   */
  timeSpentSec?: number;
  /**
   * Total number of attempts on this strand so far (including this one).
   * Used to dampen alpha as evidence accumulates (stability over time).
   */
  attemptCount: number;
  /**
   * Weight of this evidence type relative to other types.
   * practice < quiz < exam
   * Use the ASSESSMENT_WEIGHTS constants for canonical values.
   */
  assessmentWeight: number;
};

/** Canonical evidence weights by assessment type. */
export const ASSESSMENT_WEIGHTS = {
  practice:   0.4,
  quiz:       0.6,
  exam:       1.0,
} as const;

// ─── Difficulty → ability parameter mapping ──────────────────────────────────

/**
 * Maps Difficulty levels (1–5) to ability parameters on the [-2, +2] scale.
 *
 * Interpretation:
 *   A student with ability = difficultyParam[d] has ~50% expected correctness on items of difficulty d.
 *   Students above that ability level are expected to get more than 50% correct.
 *   Students below that level are expected to get less than 50% correct.
 */
export const DIFFICULTY_PARAMS: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: -1.5,   // Very easy: a grade-level student should get ~95% correct
  2: -0.75,  // Easy: a grade-level student should get ~68% correct
  3:  0.0,   // Medium: a grade-level student should get ~50% correct
  4:  0.75,  // Hard: a grade-level student should get ~32% correct
  5:  1.5,   // Very hard: a grade-level student should get ~18% correct
};

// ─── Pure mathematical helpers ────────────────────────────────────────────────

/**
 * Standard logistic sigmoid function.
 * sigmoid(0) = 0.5 — at grade level with D3, expected 50% correctness.
 */
export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Clamps a value to [min, max] (inclusive).
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ─── Core computation functions ───────────────────────────────────────────────

/**
 * Computes a student's expected correctness given their current ability and item difficulty.
 *
 * Uses a simplified Item Characteristic Curve (ICC):
 *   P(correct) = sigmoid(ability - difficultyParam)
 *
 * Returns a value in (0, 1). This is the "baseline prediction" used to compute
 * the error signal for EMA updates.
 *
 * @param ability     Current ability estimate (ABILITY_MIN to ABILITY_MAX).
 * @param difficulty  Item difficulty (1–5).
 */
export function computeExpectedCorrectness(
  ability: number,
  difficulty: 1 | 2 | 3 | 4 | 5
): number {
  const difficultyParam = DIFFICULTY_PARAMS[difficulty];
  return sigmoid(ability - difficultyParam);
}

/**
 * Computes the learning rate (alpha) for an EMA update.
 *
 * Alpha is scaled by:
 *   1. assessmentWeight — exams update ability more than practice
 *   2. attemptCount     — more history → smaller updates (convergence)
 *
 * Formula: alpha = BASE_ALPHA * assessmentWeight / sqrt(attemptCount + 1)
 *
 * Properties:
 *   - Decreases as evidence accumulates (prevents runaway updates)
 *   - Exams always produce larger updates than practice at the same attempt count
 *   - Always positive (ability always moves in the direction of error)
 *
 * @param assessmentWeight  Weight of this evidence (use ASSESSMENT_WEIGHTS constants).
 * @param attemptCount      Total attempts so far, including this one. Must be ≥ 1.
 */
export function computeAlpha(assessmentWeight: number, attemptCount: number): number {
  const safeCount = Math.max(1, attemptCount);
  return BASE_ALPHA * assessmentWeight / Math.sqrt(safeCount);
}

/**
 * Updates a student's ability estimate from a single piece of assessment evidence.
 *
 * Algorithm:
 *   1. Compute expected correctness from current ability + difficulty (ICC).
 *   2. Compute error signal = actual correctness − expected correctness.
 *   3. Compute alpha (learning rate) from evidence weight + attempt history.
 *   4. Update: newAbility = prevAbility + alpha × error.
 *   5. Guardrail: cap the single-step change at MAX_ABILITY_DELTA.
 *   6. Clamp result to [ABILITY_MIN, ABILITY_MAX].
 *
 * @param prevAbility  Current ability estimate (ABILITY_MIN to ABILITY_MAX).
 * @param evidence     Assessment evidence for this update.
 * @returns            Updated ability estimate, clamped to [ABILITY_MIN, ABILITY_MAX].
 */
export function updateBaseline(prevAbility: number, evidence: BaselineEvidence): number {
  const { correctness, difficulty, attemptCount, assessmentWeight } = evidence;

  const expected = computeExpectedCorrectness(prevAbility, difficulty);
  const error    = correctness - expected;
  const alpha    = computeAlpha(assessmentWeight, attemptCount);

  // Unclamped delta before the guardrail
  const rawDelta = alpha * error;

  // Guardrail: cap the single-step change to prevent wild jumps
  const delta = clamp(rawDelta, -MAX_ABILITY_DELTA, MAX_ABILITY_DELTA);

  return clamp(prevAbility + delta, ABILITY_MIN, ABILITY_MAX);
}

/**
 * Computes an initial baseline from a history of evidence items.
 *
 * Used when a student's first session produces multiple evidence items
 * that should be incorporated into a starting estimate.
 *
 * Algorithm: sequentially applies updateBaseline() to each evidence item
 * in order, starting from ability = 0.
 *
 * Rules:
 *   - Empty history → ability = 0 (at-grade-level default)
 *   - Each item is applied using attemptCount = i+1 (1-indexed position in history)
 *
 * @param studentHistory  Ordered list of evidence items (oldest first).
 * @returns               Final ability estimate after incorporating all evidence.
 */
export function computeInitialBaseline(studentHistory: BaselineEvidence[]): number {
  if (studentHistory.length === 0) return 0;

  let ability = 0;
  for (let i = 0; i < studentHistory.length; i++) {
    // Override attemptCount to maintain correct dampening across the history
    const evidence: BaselineEvidence = {
      ...studentHistory[i],
      attemptCount: i + 1,
    };
    ability = updateBaseline(ability, evidence);
  }
  return ability;
}

/**
 * Normalises an ability score from the [-2, +2] scale to the [0, 1] scale.
 *
 * Used to populate StudentMasteryProfile.baselineScore, which operates on [0, 1].
 *
 * Formula: (ability - ABILITY_MIN) / (ABILITY_MAX - ABILITY_MIN)
 *   -2.0 → 0.0
 *    0.0 → 0.5
 *   +2.0 → 1.0
 */
export function normalizeAbilityToScore(ability: number): number {
  const range = ABILITY_MAX - ABILITY_MIN;
  return clamp((ability - ABILITY_MIN) / range, 0, 1);
}

/**
 * Converts a [0, 1] score back to the [-2, +2] ability scale.
 *
 * Inverse of normalizeAbilityToScore(). Useful when initialising ability
 * from an existing baselineScore.
 */
export function scoreToAbility(score: number): number {
  const range = ABILITY_MAX - ABILITY_MIN;
  return clamp(score * range + ABILITY_MIN, ABILITY_MIN, ABILITY_MAX);
}
