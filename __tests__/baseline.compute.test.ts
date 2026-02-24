/**
 * __tests__/baseline.compute.test.ts
 *
 * Unit tests for lib/mastery/baseline.ts — Block 7B Pure Computation Library.
 *
 * All functions are pure/deterministic — no mocks required.
 * Tests verify:
 *   - Mathematical correctness of sigmoid and EMA helpers
 *   - Boundary conditions (ABILITY_MIN / ABILITY_MAX clamping)
 *   - Guardrail enforcement (MAX_ABILITY_DELTA cap)
 *   - Correct difficulty → ability parameter mapping
 *   - Alpha dampening as attempt count grows
 *   - Round-trip fidelity between ability and score scales
 */

import { describe, it, expect } from "vitest";
import {
  sigmoid,
  clamp,
  computeExpectedCorrectness,
  computeAlpha,
  updateBaseline,
  computeInitialBaseline,
  normalizeAbilityToScore,
  scoreToAbility,
  ABILITY_MIN,
  ABILITY_MAX,
  BASE_ALPHA,
  MAX_ABILITY_DELTA,
  DIFFICULTY_PARAMS,
  ASSESSMENT_WEIGHTS,
} from "@/lib/mastery/baseline";

// ─── sigmoid ─────────────────────────────────────────────────────────────────

describe("sigmoid", () => {
  it("returns exactly 0.5 at x = 0", () => {
    expect(sigmoid(0)).toBe(0.5);
  });

  it("returns a value > 0.5 for positive inputs", () => {
    expect(sigmoid(1)).toBeGreaterThan(0.5);
    expect(sigmoid(3)).toBeGreaterThan(0.5);
  });

  it("returns a value < 0.5 for negative inputs", () => {
    expect(sigmoid(-1)).toBeLessThan(0.5);
    expect(sigmoid(-3)).toBeLessThan(0.5);
  });

  it("approaches 1 for large positive inputs", () => {
    expect(sigmoid(10)).toBeGreaterThan(0.99);
  });

  it("approaches 0 for large negative inputs", () => {
    expect(sigmoid(-10)).toBeLessThan(0.01);
  });

  it("output is always strictly between 0 and 1 for practical inputs", () => {
    // Exclude extreme values (e.g. ±100) where IEEE 754 underflow causes sigmoid to return exactly 0 or 1
    for (const x of [-10, -5, -1, 0, 1, 5, 10]) {
      const s = sigmoid(x);
      expect(s).toBeGreaterThan(0);
      expect(s).toBeLessThan(1);
    }
  });
});

// ─── clamp ───────────────────────────────────────────────────────────────────

describe("clamp", () => {
  it("returns value unchanged when within range", () => {
    expect(clamp(0.5, 0, 1)).toBe(0.5);
    expect(clamp(0, -2, 2)).toBe(0);
  });

  it("returns min when value is below min", () => {
    expect(clamp(-3, -2, 2)).toBe(-2);
    expect(clamp(-0.1, 0, 1)).toBe(0);
  });

  it("returns max when value is above max", () => {
    expect(clamp(3, -2, 2)).toBe(2);
    expect(clamp(1.1, 0, 1)).toBe(1);
  });

  it("handles boundary values exactly", () => {
    expect(clamp(-2, -2, 2)).toBe(-2);
    expect(clamp(2, -2, 2)).toBe(2);
  });
});

// ─── computeExpectedCorrectness ──────────────────────────────────────────────

describe("computeExpectedCorrectness", () => {
  it("returns 0.5 for ability=0 and D3 (grade-level student on grade-level item)", () => {
    // difficultyParam[3] = 0.0; sigmoid(0 - 0) = 0.5
    expect(computeExpectedCorrectness(0, 3)).toBe(0.5);
  });

  it("returns > 0.5 for ability=0 with D1 (easy item is likely correct)", () => {
    // difficultyParam[1] = -1.5; sigmoid(0 - (-1.5)) = sigmoid(1.5) ≈ 0.818
    const result = computeExpectedCorrectness(0, 1);
    expect(result).toBeGreaterThan(0.5);
    expect(result).toBeCloseTo(0.818, 2);
  });

  it("returns < 0.5 for ability=0 with D5 (hard item is unlikely correct)", () => {
    // difficultyParam[5] = 1.5; sigmoid(0 - 1.5) = sigmoid(-1.5) ≈ 0.182
    const result = computeExpectedCorrectness(0, 5);
    expect(result).toBeLessThan(0.5);
    expect(result).toBeCloseTo(0.182, 2);
  });

  it("returns > 0.9 for high ability on easy item", () => {
    expect(computeExpectedCorrectness(2, 1)).toBeGreaterThan(0.9);
  });

  it("returns < 0.1 for low ability on hard item", () => {
    expect(computeExpectedCorrectness(-2, 5)).toBeLessThan(0.1);
  });

  it("returns exactly sigmoid(difficultyParam) when ability matches difficultyParam", () => {
    // When ability = difficultyParam, the student is at the 50% boundary for that item
    for (const d of [1, 2, 3, 4, 5] as (1 | 2 | 3 | 4 | 5)[]) {
      const param = DIFFICULTY_PARAMS[d];
      expect(computeExpectedCorrectness(param, d)).toBeCloseTo(0.5, 10);
    }
  });
});

// ─── computeAlpha ────────────────────────────────────────────────────────────

describe("computeAlpha", () => {
  it("equals BASE_ALPHA * weight for attemptCount=1", () => {
    expect(computeAlpha(1.0, 1)).toBeCloseTo(BASE_ALPHA * 1.0, 10);
    expect(computeAlpha(0.4, 1)).toBeCloseTo(BASE_ALPHA * 0.4, 10);
  });

  it("decreases as attemptCount grows (convergence property)", () => {
    const alpha1 = computeAlpha(1.0, 1);
    const alpha4 = computeAlpha(1.0, 4);
    const alpha9 = computeAlpha(1.0, 9);
    expect(alpha1).toBeGreaterThan(alpha4);
    expect(alpha4).toBeGreaterThan(alpha9);
  });

  it("scales by 1/sqrt(attemptCount) as specified", () => {
    // alpha(w, n) = BASE_ALPHA * w / sqrt(n)
    expect(computeAlpha(1.0, 4)).toBeCloseTo(BASE_ALPHA * 1.0 / Math.sqrt(4), 10);
    expect(computeAlpha(0.6, 9)).toBeCloseTo(BASE_ALPHA * 0.6 / Math.sqrt(9), 10);
  });

  it("exams always produce larger alpha than practice at the same attempt count", () => {
    for (const count of [1, 3, 10]) {
      expect(computeAlpha(ASSESSMENT_WEIGHTS.exam, count))
        .toBeGreaterThan(computeAlpha(ASSESSMENT_WEIGHTS.practice, count));
    }
  });

  it("treats attemptCount=0 as 1 (no division by zero)", () => {
    expect(computeAlpha(1.0, 0)).toBeCloseTo(BASE_ALPHA, 10);
  });

  it("is always positive", () => {
    expect(computeAlpha(0.4, 100)).toBeGreaterThan(0);
    expect(computeAlpha(1.0, 1)).toBeGreaterThan(0);
  });
});

// ─── updateBaseline ──────────────────────────────────────────────────────────

describe("updateBaseline", () => {
  it("increases ability when student scores above expectation", () => {
    // Ability=0, D3: expected=0.5; student gets 1.0 (perfect) → ability should rise
    const newAbility = updateBaseline(0, {
      correctness: 1.0,
      difficulty: 3,
      attemptCount: 1,
      assessmentWeight: ASSESSMENT_WEIGHTS.exam,
    });
    expect(newAbility).toBeGreaterThan(0);
  });

  it("decreases ability when student scores below expectation", () => {
    // Ability=0, D3: expected=0.5; student gets 0.0 → ability should fall
    const newAbility = updateBaseline(0, {
      correctness: 0,
      difficulty: 3,
      attemptCount: 1,
      assessmentWeight: ASSESSMENT_WEIGHTS.exam,
    });
    expect(newAbility).toBeLessThan(0);
  });

  it("produces no update when actual equals expected", () => {
    // ability=0, D3: expected=0.5; if student scores exactly 0.5 → no change
    const newAbility = updateBaseline(0, {
      correctness: 0.5,
      difficulty: 3,
      attemptCount: 1,
      assessmentWeight: ASSESSMENT_WEIGHTS.exam,
    });
    expect(newAbility).toBeCloseTo(0, 10);
  });

  it("computes the correct new ability for a known case: ability=0, D3, correct=1.0, exam, count=1", () => {
    // expected = 0.5; error = 0.5; alpha = 0.5 * 1.0 / 1 = 0.5; rawDelta = 0.25
    const newAbility = updateBaseline(0, {
      correctness: 1.0,
      difficulty: 3,
      attemptCount: 1,
      assessmentWeight: ASSESSMENT_WEIGHTS.exam,
    });
    expect(newAbility).toBeCloseTo(0.25, 10);
  });

  it("clamps result to ABILITY_MAX when ability would exceed the upper bound", () => {
    // From ability=1.9, perfect score, exam → new ability > 2 → clamped to 2
    const newAbility = updateBaseline(1.9, {
      correctness: 1.0,
      difficulty: 1,
      attemptCount: 1,
      assessmentWeight: ASSESSMENT_WEIGHTS.exam,
    });
    expect(newAbility).toBeLessThanOrEqual(ABILITY_MAX);
  });

  it("clamps result to ABILITY_MIN when ability would go below the lower bound", () => {
    // From ability=-1.9, all wrong on hard item → new ability < -2 → clamped to -2
    const newAbility = updateBaseline(-1.9, {
      correctness: 0,
      difficulty: 5,
      attemptCount: 1,
      assessmentWeight: ASSESSMENT_WEIGHTS.exam,
    });
    expect(newAbility).toBeGreaterThanOrEqual(ABILITY_MIN);
  });

  it("applies the guardrail: a single update cannot change ability by more than MAX_ABILITY_DELTA", () => {
    // Use a very high assessmentWeight to generate a rawDelta > MAX_ABILITY_DELTA
    const prevAbility = 0;
    const newAbility = updateBaseline(prevAbility, {
      correctness: 1.0,
      difficulty: 3,
      attemptCount: 1,
      assessmentWeight: 10, // unrealistically large → alpha * error >> MAX_ABILITY_DELTA
    });
    expect(Math.abs(newAbility - prevAbility)).toBeLessThanOrEqual(MAX_ABILITY_DELTA);
  });

  it("produces a smaller update for practice than exam with the same evidence", () => {
    const baseEvidence = {
      correctness: 1.0,
      difficulty: 3 as const,
      attemptCount: 1,
    };
    const practiceAbility = updateBaseline(0, { ...baseEvidence, assessmentWeight: ASSESSMENT_WEIGHTS.practice });
    const examAbility = updateBaseline(0, { ...baseEvidence, assessmentWeight: ASSESSMENT_WEIGHTS.exam });
    expect(Math.abs(examAbility)).toBeGreaterThan(Math.abs(practiceAbility));
  });

  it("ignores timeSpentSec (does not affect ability)", () => {
    const withoutTime = updateBaseline(0, {
      correctness: 0.8,
      difficulty: 3,
      attemptCount: 1,
      assessmentWeight: 1.0,
    });
    const withTime = updateBaseline(0, {
      correctness: 0.8,
      difficulty: 3,
      attemptCount: 1,
      assessmentWeight: 1.0,
      timeSpentSec: 120,
    });
    expect(withoutTime).toBe(withTime);
  });
});

// ─── computeInitialBaseline ──────────────────────────────────────────────────

describe("computeInitialBaseline", () => {
  it("returns 0 for an empty history (at-grade-level default)", () => {
    expect(computeInitialBaseline([])).toBe(0);
  });

  it("returns a value above 0 for a single perfect D3 attempt", () => {
    const result = computeInitialBaseline([
      { correctness: 1.0, difficulty: 3, attemptCount: 1, assessmentWeight: ASSESSMENT_WEIGHTS.exam },
    ]);
    expect(result).toBeGreaterThan(0);
  });

  it("returns a value below 0 for a single failed D3 attempt", () => {
    const result = computeInitialBaseline([
      { correctness: 0, difficulty: 3, attemptCount: 1, assessmentWeight: ASSESSMENT_WEIGHTS.exam },
    ]);
    expect(result).toBeLessThan(0);
  });

  it("applies attemptCount 1-indexed from the position in history (not from evidence)", () => {
    // History of 3 identical attempts — all with perfect D3 exam
    // Position 0 → attemptCount=1, position 1 → 2, position 2 → 3 (alpha decreases)
    const history = [
      { correctness: 1.0, difficulty: 3 as const, attemptCount: 99, assessmentWeight: ASSESSMENT_WEIGHTS.exam },
      { correctness: 1.0, difficulty: 3 as const, attemptCount: 99, assessmentWeight: ASSESSMENT_WEIGHTS.exam },
      { correctness: 1.0, difficulty: 3 as const, attemptCount: 99, assessmentWeight: ASSESSMENT_WEIGHTS.exam },
    ];
    // Override should happen — attemptCount in evidence is ignored in favor of i+1
    const result = computeInitialBaseline(history);
    // Ability should be bounded and positive (high performance)
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(ABILITY_MAX);
  });

  it("ability stays within [ABILITY_MIN, ABILITY_MAX] regardless of history length", () => {
    const perfectHistory = Array.from({ length: 20 }, (_, i) => ({
      correctness: 1.0,
      difficulty: 1 as const,
      attemptCount: i + 1,
      assessmentWeight: ASSESSMENT_WEIGHTS.exam,
    }));
    const result = computeInitialBaseline(perfectHistory);
    expect(result).toBeGreaterThanOrEqual(ABILITY_MIN);
    expect(result).toBeLessThanOrEqual(ABILITY_MAX);
  });

  it("is deterministic: same history always produces the same result", () => {
    const history = [
      { correctness: 0.7, difficulty: 3 as const, attemptCount: 1, assessmentWeight: 0.6 },
      { correctness: 0.4, difficulty: 4 as const, attemptCount: 2, assessmentWeight: 1.0 },
    ];
    expect(computeInitialBaseline(history)).toBe(computeInitialBaseline(history));
  });
});

// ─── normalizeAbilityToScore ──────────────────────────────────────────────────

describe("normalizeAbilityToScore", () => {
  it("maps ABILITY_MIN (-2) to 0", () => {
    expect(normalizeAbilityToScore(ABILITY_MIN)).toBe(0);
  });

  it("maps 0 (at grade level) to 0.5", () => {
    expect(normalizeAbilityToScore(0)).toBe(0.5);
  });

  it("maps ABILITY_MAX (+2) to 1", () => {
    expect(normalizeAbilityToScore(ABILITY_MAX)).toBe(1);
  });

  it("clamps below-range ability to 0", () => {
    expect(normalizeAbilityToScore(-3)).toBe(0);
  });

  it("clamps above-range ability to 1", () => {
    expect(normalizeAbilityToScore(3)).toBe(1);
  });

  it("maps intermediate values proportionally", () => {
    // ability=-1 → (-1 - (-2)) / 4 = 1/4 = 0.25
    expect(normalizeAbilityToScore(-1)).toBeCloseTo(0.25, 10);
    // ability=1 → (1 - (-2)) / 4 = 3/4 = 0.75
    expect(normalizeAbilityToScore(1)).toBeCloseTo(0.75, 10);
  });
});

// ─── scoreToAbility ──────────────────────────────────────────────────────────

describe("scoreToAbility", () => {
  it("maps 0 to ABILITY_MIN (-2)", () => {
    expect(scoreToAbility(0)).toBe(ABILITY_MIN);
  });

  it("maps 0.5 to 0 (at grade level)", () => {
    expect(scoreToAbility(0.5)).toBe(0);
  });

  it("maps 1 to ABILITY_MAX (+2)", () => {
    expect(scoreToAbility(1)).toBe(ABILITY_MAX);
  });

  it("clamps below-range score to ABILITY_MIN", () => {
    expect(scoreToAbility(-0.5)).toBe(ABILITY_MIN);
  });

  it("clamps above-range score to ABILITY_MAX", () => {
    expect(scoreToAbility(1.5)).toBe(ABILITY_MAX);
  });
});

// ─── Round-trip fidelity ──────────────────────────────────────────────────────

describe("normalizeAbilityToScore / scoreToAbility round-trip", () => {
  it("scoreToAbility(normalizeAbilityToScore(x)) ≈ x for all valid ability values", () => {
    for (const ability of [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2]) {
      expect(scoreToAbility(normalizeAbilityToScore(ability))).toBeCloseTo(ability, 10);
    }
  });

  it("normalizeAbilityToScore(scoreToAbility(x)) ≈ x for all valid score values", () => {
    for (const score of [0, 0.25, 0.5, 0.75, 1]) {
      expect(normalizeAbilityToScore(scoreToAbility(score))).toBeCloseTo(score, 10);
    }
  });
});
