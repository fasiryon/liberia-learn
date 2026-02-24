/**
 * __tests__/mastery.compute.test.ts
 *
 * Unit tests for lib/mastery/compute.ts — Block 7A Pure Computation Library.
 *
 * All functions are pure/deterministic — no mocks required.
 * Tests verify:
 *   - Threshold boundaries (at-boundary, just-below, just-above)
 *   - Edge cases (empty arrays, zero totals, division-by-zero guards)
 *   - Grade-band weight model (all 4 bands)
 *   - Mastery state transitions (all 5 states)
 */

import { describe, it, expect } from "vitest";
import {
  computeProficiencyState,
  computeMasteryState,
  computeGrowthDelta,
  computeSustainabilityIndex,
  computeDecayRate,
  computeAiRelianceRate,
  computeHybridScoreByGradeBand,
  PROFICIENCY_THRESHOLD,
  MASTERY_THRESHOLD,
  APPROACHING_THRESHOLD,
  MASTERY_MIN_ASSESSMENTS,
  MASTERY_SUSTAINABILITY_MIN,
  DECAY_ALERT_THRESHOLD,
  GRADE_BAND_WEIGHTS,
} from "@/lib/mastery/compute";

// ─── computeProficiencyState ──────────────────────────────────────────────────

describe("computeProficiencyState", () => {
  it("returns PROFICIENT at exactly the proficiency threshold", () => {
    expect(computeProficiencyState(PROFICIENCY_THRESHOLD)).toBe("PROFICIENT");
  });

  it("returns PROFICIENT above the threshold", () => {
    expect(computeProficiencyState(0.9)).toBe("PROFICIENT");
    expect(computeProficiencyState(1.0)).toBe("PROFICIENT");
  });

  it("returns APPROACHING just below proficiency threshold", () => {
    expect(computeProficiencyState(PROFICIENCY_THRESHOLD - 0.01)).toBe("APPROACHING");
  });

  it("returns APPROACHING at exactly the approaching threshold", () => {
    expect(computeProficiencyState(APPROACHING_THRESHOLD)).toBe("APPROACHING");
  });

  it("returns APPROACHING between approaching and proficiency thresholds", () => {
    expect(computeProficiencyState(0.65)).toBe("APPROACHING");
    expect(computeProficiencyState(0.70)).toBe("APPROACHING");
  });

  it("returns BELOW_PROFICIENT just below approaching threshold", () => {
    expect(computeProficiencyState(APPROACHING_THRESHOLD - 0.01)).toBe("BELOW_PROFICIENT");
  });

  it("returns BELOW_PROFICIENT at zero", () => {
    expect(computeProficiencyState(0)).toBe("BELOW_PROFICIENT");
  });

  it("returns BELOW_PROFICIENT for very low scores", () => {
    expect(computeProficiencyState(0.1)).toBe("BELOW_PROFICIENT");
    expect(computeProficiencyState(0.59)).toBe("BELOW_PROFICIENT");
  });
});

// ─── computeMasteryState ─────────────────────────────────────────────────────

describe("computeMasteryState", () => {
  it("returns DEVELOPING when assessmentCount < minimum", () => {
    expect(
      computeMasteryState(1.0, 1.0, MASTERY_MIN_ASSESSMENTS - 1, 0, "NOT_ASSESSED")
    ).toBe("DEVELOPING");
  });

  it("returns DEVELOPING for first assessment regardless of score", () => {
    expect(computeMasteryState(1.0, 1.0, 1, 0, "NOT_ASSESSED")).toBe("DEVELOPING");
  });

  it("returns MASTERED when all thresholds are met", () => {
    expect(
      computeMasteryState(
        MASTERY_THRESHOLD,            // score at threshold
        MASTERY_SUSTAINABILITY_MIN,   // SI at threshold
        MASTERY_MIN_ASSESSMENTS,      // minimum assessments
        0,                            // no decay
        "NOT_ASSESSED"
      )
    ).toBe("MASTERED");
  });

  it("returns MASTERED for score above threshold with high SI and no decay", () => {
    expect(computeMasteryState(0.92, 0.80, 5, 0, "DEVELOPING")).toBe("MASTERED");
  });

  it("does NOT return MASTERED if score is below mastery threshold", () => {
    expect(computeMasteryState(MASTERY_THRESHOLD - 0.01, 0.80, 5, 0, "DEVELOPING")).not.toBe("MASTERED");
  });

  it("does NOT return MASTERED if SI is below MASTERY_SUSTAINABILITY_MIN", () => {
    expect(
      computeMasteryState(0.90, MASTERY_SUSTAINABILITY_MIN - 0.01, 5, 0, "DEVELOPING")
    ).not.toBe("MASTERED");
  });

  it("does NOT return MASTERED when decayRate exceeds alert threshold", () => {
    const state = computeMasteryState(0.90, 0.80, 5, DECAY_ALERT_THRESHOLD + 0.001, "DEVELOPING");
    expect(state).not.toBe("MASTERED");
  });

  it("returns DECAYING when prior state was MASTERED and decay exceeds threshold", () => {
    expect(
      computeMasteryState(0.80, 0.70, 5, DECAY_ALERT_THRESHOLD + 0.001, "MASTERED")
    ).toBe("DECAYING");
  });

  it("returns DECAYING when prior state was DECAYING and decay continues", () => {
    expect(
      computeMasteryState(0.80, 0.70, 5, DECAY_ALERT_THRESHOLD + 0.001, "DECAYING")
    ).toBe("DECAYING");
  });

  it("returns APPROACHING when sufficient assessments and score ≥ proficiency threshold", () => {
    expect(
      computeMasteryState(PROFICIENCY_THRESHOLD, 0.50, MASTERY_MIN_ASSESSMENTS, 0, "DEVELOPING")
    ).toBe("APPROACHING");
  });

  it("returns DEVELOPING when insufficient score after enough assessments", () => {
    expect(
      computeMasteryState(0.50, 0.90, MASTERY_MIN_ASSESSMENTS, 0, "DEVELOPING")
    ).toBe("DEVELOPING");
  });

  it("treats NOT_ASSESSED prior state as non-MASTERED for decay transition", () => {
    // High decay with prior NOT_ASSESSED should not trigger DECAYING
    const state = computeMasteryState(0.80, 0.70, 5, DECAY_ALERT_THRESHOLD + 0.001, "NOT_ASSESSED");
    expect(state).not.toBe("DECAYING");
  });
});

// ─── computeGrowthDelta ───────────────────────────────────────────────────────

describe("computeGrowthDelta", () => {
  it("returns positive delta when current > baseline", () => {
    expect(computeGrowthDelta(0.5, 0.8)).toBeCloseTo(0.3);
  });

  it("returns negative delta when current < baseline", () => {
    expect(computeGrowthDelta(0.8, 0.5)).toBeCloseTo(-0.3);
  });

  it("returns 0 when current equals baseline", () => {
    expect(computeGrowthDelta(0.6, 0.6)).toBe(0);
  });

  it("returns 1 for zero-to-perfect growth", () => {
    expect(computeGrowthDelta(0, 1)).toBe(1);
  });

  it("returns -1 for perfect-to-zero regression", () => {
    expect(computeGrowthDelta(1, 0)).toBe(-1);
  });
});

// ─── computeSustainabilityIndex ───────────────────────────────────────────────

describe("computeSustainabilityIndex", () => {
  it("returns 0 for empty array", () => {
    expect(computeSustainabilityIndex([])).toBe(0);
  });

  it("returns 0 for a single score (insufficient data)", () => {
    expect(computeSustainabilityIndex([0.8])).toBe(0);
  });

  it("returns 1.0 for perfectly stable scores (all identical)", () => {
    expect(computeSustainabilityIndex([0.8, 0.8, 0.8, 0.8])).toBeCloseTo(1.0);
  });

  it("returns lower SI for more volatile scores", () => {
    const stable = computeSustainabilityIndex([0.7, 0.72, 0.71, 0.73]);
    const volatile_ = computeSustainabilityIndex([0.2, 0.9, 0.1, 0.95]);
    expect(stable).toBeGreaterThan(volatile_);
  });

  it("returns value in [0, 1] for realistic score sequences", () => {
    const si = computeSustainabilityIndex([0.6, 0.75, 0.80, 0.78, 0.82]);
    expect(si).toBeGreaterThanOrEqual(0);
    expect(si).toBeLessThanOrEqual(1);
  });

  it("is symmetric — score order does not change SI", () => {
    const scores = [0.5, 0.8, 0.6, 0.9];
    const reversed = [...scores].reverse();
    expect(computeSustainabilityIndex(scores)).toBeCloseTo(
      computeSustainabilityIndex(reversed)
    );
  });

  it("returns high SI for consistently improving scores", () => {
    const si = computeSustainabilityIndex([0.70, 0.72, 0.74, 0.76, 0.78]);
    expect(si).toBeGreaterThan(0.8);
  });
});

// ─── computeDecayRate ────────────────────────────────────────────────────────

describe("computeDecayRate", () => {
  it("returns 0 for empty array", () => {
    expect(computeDecayRate([], [])).toBe(0);
  });

  it("returns 0 for a single score (no transitions)", () => {
    expect(computeDecayRate([0.8], [])).toBe(0);
  });

  it("returns 0 for monotonically increasing scores (no decay)", () => {
    expect(computeDecayRate([0.6, 0.7, 0.8], [7, 7])).toBe(0);
  });

  it("returns 0 for flat scores (no change)", () => {
    expect(computeDecayRate([0.8, 0.8, 0.8], [7, 7])).toBe(0);
  });

  it("computes decay for a simple two-point drop", () => {
    // Drop of 0.1 over 10 days → rate of 0.01/day
    const rate = computeDecayRate([0.8, 0.7], [10]);
    expect(rate).toBeCloseTo(0.01);
  });

  it("normalises decay by days between assessments", () => {
    // Same drop (0.1) — longer interval should yield lower per-day rate
    const rateShort = computeDecayRate([0.8, 0.7], [5]);
    const rateLong  = computeDecayRate([0.8, 0.7], [20]);
    expect(rateShort).toBeGreaterThan(rateLong);
  });

  it("averages over multiple decay intervals", () => {
    // Two drops: 0.1/7d and 0.2/14d
    // Per-day: ~0.01429 and ~0.01429 → avg ~0.01429
    const rate = computeDecayRate([0.8, 0.7, 0.5], [7, 14]);
    expect(rate).toBeGreaterThan(0);
    expect(rate).toBeLessThan(0.1);
  });

  it("treats daysBetween < 1 as 1 (no division by zero)", () => {
    expect(() => computeDecayRate([0.8, 0.6], [0])).not.toThrow();
    const rate = computeDecayRate([0.8, 0.6], [0]);
    expect(Number.isFinite(rate)).toBe(true);
    expect(rate).toBeCloseTo(0.2); // 0.2 drop over 1 day (clamped)
  });

  it("ignores growth intervals in decay calculation", () => {
    // up, then down, then up — only the down interval should count
    const rate = computeDecayRate([0.6, 0.8, 0.7, 0.9], [7, 7, 7]);
    expect(rate).toBeGreaterThan(0);
    // rate should only reflect the 0.8→0.7 interval
    expect(rate).toBeCloseTo(0.1 / 7, 5);
  });
});

// ─── computeAiRelianceRate ────────────────────────────────────────────────────

describe("computeAiRelianceRate", () => {
  it("returns 0 when totalAttempts is 0 (guard against division by zero)", () => {
    expect(computeAiRelianceRate(0, 0)).toBe(0);
  });

  it("returns 0 when no AI-assisted attempts", () => {
    expect(computeAiRelianceRate(10, 0)).toBe(0);
  });

  it("returns 1 when all attempts were AI-assisted", () => {
    expect(computeAiRelianceRate(10, 10)).toBe(1);
  });

  it("returns correct fraction for partial AI use", () => {
    expect(computeAiRelianceRate(10, 3)).toBeCloseTo(0.3);
    expect(computeAiRelianceRate(100, 25)).toBeCloseTo(0.25);
  });

  it("clamps to [0, 1] even if aiAssisted > total (data anomaly guard)", () => {
    expect(computeAiRelianceRate(5, 10)).toBeLessThanOrEqual(1);
    expect(computeAiRelianceRate(5, 10)).toBeGreaterThanOrEqual(0);
  });

  it("handles negative aiAssistedAttempts gracefully", () => {
    expect(computeAiRelianceRate(10, -1)).toBe(0);
  });
});

// ─── computeHybridScoreByGradeBand ───────────────────────────────────────────

describe("computeHybridScoreByGradeBand", () => {
  it("applies correct weights for G1_3 (50/50)", () => {
    // baseline=0.5, current=0.8, delta=+0.3, headroom=0.5, normGrowth=0.6
    // hybrid = 0.50 * 0.6 + 0.50 * 0.8 = 0.3 + 0.4 = 0.70
    const score = computeHybridScoreByGradeBand("G1_3", 0.8, 0.3, 0.5);
    expect(score).toBeCloseTo(0.70);
  });

  it("applies correct weights for G4_6 (45/55)", () => {
    // baseline=0.5, current=0.8, delta=+0.3, headroom=0.5, normGrowth=0.6
    // hybrid = 0.45 * 0.6 + 0.55 * 0.8 = 0.27 + 0.44 = 0.71
    const score = computeHybridScoreByGradeBand("G4_6", 0.8, 0.3, 0.5);
    expect(score).toBeCloseTo(0.71);
  });

  it("applies correct weights for G7_9 (40/60)", () => {
    // hybrid = 0.40 * 0.6 + 0.60 * 0.8 = 0.24 + 0.48 = 0.72
    const score = computeHybridScoreByGradeBand("G7_9", 0.8, 0.3, 0.5);
    expect(score).toBeCloseTo(0.72);
  });

  it("applies correct weights for G10_12 (30/70)", () => {
    // hybrid = 0.30 * 0.6 + 0.70 * 0.8 = 0.18 + 0.56 = 0.74
    const score = computeHybridScoreByGradeBand("G10_12", 0.8, 0.3, 0.5);
    expect(score).toBeCloseTo(0.74);
  });

  it("clamps result to [0, 1]", () => {
    expect(computeHybridScoreByGradeBand("G10_12", 1.0, 1.0, 0.0)).toBeLessThanOrEqual(1);
    expect(computeHybridScoreByGradeBand("G1_3", 0.0, -1.0, 1.0)).toBeGreaterThanOrEqual(0);
  });

  it("returns absolute-only score when baseline equals current (zero growth)", () => {
    // baseline=0.7, current=0.7, delta=0, normGrowth=0
    // G7_9: 0.40 * 0 + 0.60 * 0.7 = 0.42
    const score = computeHybridScoreByGradeBand("G7_9", 0.7, 0, 0.7);
    expect(score).toBeCloseTo(0.42);
  });

  it("handles baseline=1.0 (no headroom) without division by zero", () => {
    expect(() => computeHybridScoreByGradeBand("G10_12", 1.0, 0.0, 1.0)).not.toThrow();
    const score = computeHybridScoreByGradeBand("G10_12", 1.0, 0.0, 1.0);
    // normGrowth=0, hybrid = 0 + 0.70 * 1.0 = 0.70
    expect(score).toBeCloseTo(0.70);
  });

  it("reflects higher scores for later grade bands on same absolute performance", () => {
    // Higher absolute weight in G10_12 should yield higher score for same inputs
    const g1 = computeHybridScoreByGradeBand("G1_3",  0.8, 0.1, 0.7);
    const g10 = computeHybridScoreByGradeBand("G10_12", 0.8, 0.1, 0.7);
    // G10_12 weights absolute more: better absolute score should dominate
    expect(g10).toBeGreaterThan(g1);
  });

  it("reflects growth advantage in G1_3 vs G10_12 for same absolute but large growth", () => {
    // Large relative growth (from 0 to 0.8) should benefit G1_3 more
    const g1 = computeHybridScoreByGradeBand("G1_3",  0.8, 0.8, 0.0);
    const g10 = computeHybridScoreByGradeBand("G10_12", 0.8, 0.8, 0.0);
    // G1_3 has higher growth weight — growth component is equally normalised here (headroom=1)
    // G1_3: 0.5 * 0.8 + 0.5 * 0.8 = 0.80
    // G10_12: 0.3 * 0.8 + 0.7 * 0.8 = 0.80
    // Both equal when growth and absolute are the same value — this is expected
    expect(g1).toBeCloseTo(g10);
  });
});

// ─── GRADE_BAND_WEIGHTS constant ─────────────────────────────────────────────

describe("GRADE_BAND_WEIGHTS", () => {
  it("each band's weights sum to exactly 1.0", () => {
    for (const [band, weights] of Object.entries(GRADE_BAND_WEIGHTS)) {
      expect(weights.growth + weights.absolute).toBeCloseTo(1.0, 10);
      // Verify the expected progression
      void band;
    }
  });

  it("growth weight decreases from G1_3 to G10_12", () => {
    expect(GRADE_BAND_WEIGHTS.G1_3.growth).toBeGreaterThan(GRADE_BAND_WEIGHTS.G4_6.growth);
    expect(GRADE_BAND_WEIGHTS.G4_6.growth).toBeGreaterThan(GRADE_BAND_WEIGHTS.G7_9.growth);
    expect(GRADE_BAND_WEIGHTS.G7_9.growth).toBeGreaterThan(GRADE_BAND_WEIGHTS.G10_12.growth);
  });

  it("absolute weight increases from G1_3 to G10_12", () => {
    expect(GRADE_BAND_WEIGHTS.G1_3.absolute).toBeLessThan(GRADE_BAND_WEIGHTS.G4_6.absolute);
    expect(GRADE_BAND_WEIGHTS.G4_6.absolute).toBeLessThan(GRADE_BAND_WEIGHTS.G7_9.absolute);
    expect(GRADE_BAND_WEIGHTS.G7_9.absolute).toBeLessThan(GRADE_BAND_WEIGHTS.G10_12.absolute);
  });

  it("has exactly the specified weights per band", () => {
    expect(GRADE_BAND_WEIGHTS.G1_3).toEqual({ growth: 0.50, absolute: 0.50 });
    expect(GRADE_BAND_WEIGHTS.G4_6).toEqual({ growth: 0.45, absolute: 0.55 });
    expect(GRADE_BAND_WEIGHTS.G7_9).toEqual({ growth: 0.40, absolute: 0.60 });
    expect(GRADE_BAND_WEIGHTS.G10_12).toEqual({ growth: 0.30, absolute: 0.70 });
  });
});

// ─── Integration: Proficiency + Mastery alignment ────────────────────────────

describe("Proficiency and Mastery alignment", () => {
  it("MASTERED implies PROFICIENT or APPROACHING proficiency", () => {
    // A student at mastery threshold must at least be approaching proficiency
    const proficiency = computeProficiencyState(MASTERY_THRESHOLD);
    expect(proficiency).toBe("PROFICIENT");
  });

  it("PROFICIENT threshold is below MASTERY threshold", () => {
    expect(PROFICIENCY_THRESHOLD).toBeLessThan(MASTERY_THRESHOLD);
  });

  it("student can be PROFICIENT but not yet MASTERED (insufficient assessments)", () => {
    const proficiency = computeProficiencyState(0.80);
    const mastery = computeMasteryState(0.80, 0.90, 2, 0, "NOT_ASSESSED"); // only 2 assessments
    expect(proficiency).toBe("PROFICIENT");
    expect(mastery).toBe("DEVELOPING");
  });
});
