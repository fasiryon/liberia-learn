/**
 * __tests__/impact.engine.test.ts — Block 12A
 *
 * Tests for:
 *   1. statRules.ts pure functions (mean, variance, effectSize, significance)
 *   2. impactEngine.ts computeImpact (via mocked prisma)
 *      - masteryDelta + growthDelta computed correctly
 *      - effectSize computed only when sufficient sample size
 *      - statisticallyMeaningful follows deterministic rule thresholds
 *      - idempotency: same inputs → same outputs
 *      - tenant isolation: query is scoped to tenantId
 *      - empty dataset returns zeroed result, no crash
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockMasteryProfileFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    studentMasteryProfile: { findMany: mockMasteryProfileFindMany },
  },
}));

import {
  mean,
  populationVariance,
  computeEffectSize,
  classifyConfidence,
  isStatisticallyMeaningful,
  MIN_SAMPLE_SIZE,
  MEDIUM_CONFIDENCE_THRESHOLD,
  HIGH_CONFIDENCE_THRESHOLD,
  MEANINGFUL_DELTA_THRESHOLD,
  MEANINGFUL_EFFECT_SIZE_MIN,
  MEANINGFUL_GROWTH_FRACTION,
} from "@/lib/metrics/impact/statRules";

import { computeImpact } from "@/lib/metrics/impact/impactEngine";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeProfile(
  baselineScore: number,
  currentScore: number,
  proficiencyState: string = "PROFICIENT",
  masteryState: string = "MASTERED"
) {
  return {
    baselineScore,
    currentScore,
    proficiencyState,
    masteryState,
    student: { enrollments: [] },
  };
}

function makeProfiles(count: number, baseline: number, current: number) {
  return Array.from({ length: count }, () =>
    makeProfile(baseline, current)
  );
}

const VALID_INPUT = {
  tenantId: "school-abc",
  schoolId: "school-abc",
  periodRange: { from: "2026-01", to: "2026-03" },
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── statRules: mean ──────────────────────────────────────────────────────────

describe("mean()", () => {
  it("returns 0 for empty array", () => {
    expect(mean([])).toBe(0);
  });

  it("returns value for single element", () => {
    expect(mean([0.8])).toBe(0.8);
  });

  it("computes correct mean", () => {
    expect(mean([0.6, 0.8, 1.0])).toBeCloseTo(0.8, 6);
  });
});

// ─── statRules: populationVariance ────────────────────────────────────────────

describe("populationVariance()", () => {
  it("returns 0 for single element", () => {
    expect(populationVariance([0.5])).toBe(0);
  });

  it("returns 0 for empty array", () => {
    expect(populationVariance([])).toBe(0);
  });

  it("computes variance of [0, 1]", () => {
    // mean=0.5, variance = ((0-0.5)² + (1-0.5)²) / 2 = 0.25
    expect(populationVariance([0, 1])).toBeCloseTo(0.25, 6);
  });

  it("returns 0 for identical values", () => {
    expect(populationVariance([0.7, 0.7, 0.7])).toBeCloseTo(0, 6);
  });
});

// ─── statRules: computeEffectSize ─────────────────────────────────────────────

describe("computeEffectSize()", () => {
  it("returns null for baseline with fewer than 2 values", () => {
    expect(computeEffectSize([0.5], [0.6, 0.7])).toBeNull();
  });

  it("returns null for comparison with fewer than 2 values", () => {
    expect(computeEffectSize([0.5, 0.6], [0.8])).toBeNull();
  });

  it("returns null when pooledSD is 0 (identical constant scores)", () => {
    expect(computeEffectSize([0.7, 0.7], [0.7, 0.7])).toBeNull();
  });

  it("returns positive d when comparison > baseline", () => {
    const d = computeEffectSize([0.4, 0.5], [0.7, 0.8]);
    expect(d).not.toBeNull();
    expect(d!).toBeGreaterThan(0);
  });

  it("returns negative d when comparison < baseline", () => {
    const d = computeEffectSize([0.7, 0.8], [0.4, 0.5]);
    expect(d).not.toBeNull();
    expect(d!).toBeLessThan(0);
  });

  it("is symmetric: |d(A,B)| = |d(B,A)|", () => {
    const d1 = computeEffectSize([0.4, 0.5, 0.6], [0.7, 0.8, 0.9]);
    const d2 = computeEffectSize([0.7, 0.8, 0.9], [0.4, 0.5, 0.6]);
    expect(Math.abs(d1!)).toBeCloseTo(Math.abs(d2!), 6);
  });
});

// ─── statRules: classifyConfidence ────────────────────────────────────────────

describe("classifyConfidence()", () => {
  it("returns 'low' below MEDIUM_CONFIDENCE_THRESHOLD", () => {
    for (let n = 0; n < MEDIUM_CONFIDENCE_THRESHOLD; n++) {
      expect(classifyConfidence(n)).toBe("low");
    }
  });

  it("returns 'medium' at MEDIUM_CONFIDENCE_THRESHOLD", () => {
    expect(classifyConfidence(MEDIUM_CONFIDENCE_THRESHOLD)).toBe("medium");
  });

  it("returns 'medium' below HIGH_CONFIDENCE_THRESHOLD", () => {
    expect(classifyConfidence(HIGH_CONFIDENCE_THRESHOLD - 1)).toBe("medium");
  });

  it("returns 'high' at HIGH_CONFIDENCE_THRESHOLD", () => {
    expect(classifyConfidence(HIGH_CONFIDENCE_THRESHOLD)).toBe("high");
  });

  it("returns 'high' above HIGH_CONFIDENCE_THRESHOLD", () => {
    expect(classifyConfidence(100)).toBe("high");
  });
});

// ─── statRules: isStatisticallyMeaningful ─────────────────────────────────────

describe("isStatisticallyMeaningful()", () => {
  const PASSING = {
    sampleSize: HIGH_CONFIDENCE_THRESHOLD,
    masteryDelta: MEANINGFUL_DELTA_THRESHOLD + 0.01,
    effectSize: MEANINGFUL_EFFECT_SIZE_MIN + 0.01,
    growthFraction: MEANINGFUL_GROWTH_FRACTION + 0.01,
  };

  it("returns true when all thresholds are met", () => {
    expect(isStatisticallyMeaningful(PASSING)).toBe(true);
  });

  it("returns false when sampleSize < MIN_SAMPLE_SIZE", () => {
    expect(
      isStatisticallyMeaningful({ ...PASSING, sampleSize: MIN_SAMPLE_SIZE - 1 })
    ).toBe(false);
  });

  it("returns false when masteryDelta < threshold", () => {
    expect(
      isStatisticallyMeaningful({
        ...PASSING,
        masteryDelta: MEANINGFUL_DELTA_THRESHOLD - 0.001,
      })
    ).toBe(false);
  });

  it("returns false when growthFraction < threshold", () => {
    expect(
      isStatisticallyMeaningful({
        ...PASSING,
        growthFraction: MEANINGFUL_GROWTH_FRACTION - 0.001,
      })
    ).toBe(false);
  });

  it("returns false when effectSize < minimum", () => {
    expect(
      isStatisticallyMeaningful({
        ...PASSING,
        effectSize: MEANINGFUL_EFFECT_SIZE_MIN - 0.001,
      })
    ).toBe(false);
  });

  it("returns false when effectSize is null and sample size is insufficient for override", () => {
    expect(
      isStatisticallyMeaningful({
        ...PASSING,
        effectSize: null,
        sampleSize: MEDIUM_CONFIDENCE_THRESHOLD,
      })
    ).toBe(false);
  });

  it("returns true when effectSize is null but sample is high-confidence with strong delta", () => {
    expect(
      isStatisticallyMeaningful({
        ...PASSING,
        effectSize: null,
        sampleSize: HIGH_CONFIDENCE_THRESHOLD,
        masteryDelta: MEANINGFUL_DELTA_THRESHOLD * 2 + 0.001,
      })
    ).toBe(true);
  });

  it("is deterministic: same inputs → same output", () => {
    const r1 = isStatisticallyMeaningful(PASSING);
    const r2 = isStatisticallyMeaningful(PASSING);
    expect(r1).toBe(r2);
  });
});

// ─── computeImpact: basic computation ────────────────────────────────────────

describe("computeImpact() — basic computation", () => {
  it("computes masteryDelta = mean(current) - mean(baseline)", async () => {
    // 10 profiles: baseline=0.5, current=0.7
    mockMasteryProfileFindMany.mockResolvedValue(makeProfiles(10, 0.5, 0.7));

    const result = await computeImpact(VALID_INPUT);
    expect(result.masteryDelta).toBeCloseTo(0.2, 4);
  });

  it("computes growthDelta = mean(current - baseline) per profile", async () => {
    // Mixed: 5 profiles with +0.3 growth, 5 with +0.1 growth
    const profiles = [
      ...makeProfiles(5, 0.5, 0.8), // delta = 0.3
      ...makeProfiles(5, 0.6, 0.7), // delta = 0.1
    ];
    mockMasteryProfileFindMany.mockResolvedValue(profiles);

    const result = await computeImpact(VALID_INPUT);
    expect(result.growthDelta).toBeCloseTo(0.2, 4);
  });

  it("computes proficiencyRate as fraction of PROFICIENT profiles", async () => {
    const profiles = [
      ...makeProfiles(6, 0.5, 0.8).map((p) => ({
        ...p,
        proficiencyState: "PROFICIENT",
      })),
      ...makeProfiles(4, 0.4, 0.5).map((p) => ({
        ...p,
        proficiencyState: "APPROACHING",
      })),
    ];
    mockMasteryProfileFindMany.mockResolvedValue(profiles);

    const result = await computeImpact(VALID_INPUT);
    expect(result.proficiencyRate).toBeCloseTo(0.6, 4);
  });

  it("computes effectSize only when ≥2 profiles in each group", async () => {
    // Only 1 profile — effect size should be null
    mockMasteryProfileFindMany.mockResolvedValue([makeProfile(0.5, 0.8)]);
    const result = await computeImpact(VALID_INPUT);
    expect(result.effectSize).toBeNull();
  });

  it("computes effectSize (non-null) with ≥2 profiles", async () => {
    mockMasteryProfileFindMany.mockResolvedValue(makeProfiles(10, 0.4, 0.8));
    const result = await computeImpact(VALID_INPUT);
    expect(result.effectSize).not.toBeNull();
    expect(typeof result.effectSize).toBe("number");
  });

  it("statisticallyMeaningful = false when sample is too small", async () => {
    mockMasteryProfileFindMany.mockResolvedValue(makeProfiles(2, 0.4, 0.9));
    const result = await computeImpact(VALID_INPUT);
    expect(result.statisticallyMeaningful).toBe(false);
  });

  it("statisticallyMeaningful = true with sufficient sample and strong growth", async () => {
    // 35 profiles: all show positive growth, delta >> threshold
    mockMasteryProfileFindMany.mockResolvedValue(
      makeProfiles(35, 0.3, 0.75) // delta=0.45 >> 0.05
    );
    const result = await computeImpact(VALID_INPUT);
    expect(result.statisticallyMeaningful).toBe(true);
  });
});

// ─── computeImpact: empty dataset ─────────────────────────────────────────────

describe("computeImpact() — empty dataset", () => {
  it("returns zeroed result without crashing", async () => {
    mockMasteryProfileFindMany.mockResolvedValue([]);
    const result = await computeImpact(VALID_INPUT);

    expect(result.sampleSize).toBe(0);
    expect(result.proficiencyRate).toBe(0);
    expect(result.avgMasteryScore).toBe(0);
    expect(result.masteryDelta).toBe(0);
    expect(result.growthDelta).toBe(0);
    expect(result.effectSize).toBeNull();
    expect(result.statisticallyMeaningful).toBe(false);
    expect(result.confidenceLabel).toBe("low");
  });
});

// ─── computeImpact: idempotency ───────────────────────────────────────────────

describe("computeImpact() — idempotency", () => {
  it("returns identical results for identical inputs and DB state", async () => {
    const profiles = makeProfiles(20, 0.5, 0.75);
    mockMasteryProfileFindMany.mockResolvedValue(profiles);

    const r1 = await computeImpact(VALID_INPUT);
    const r2 = await computeImpact(VALID_INPUT);

    expect(r1).toEqual(r2);
  });
});

// ─── computeImpact: tenant isolation ─────────────────────────────────────────

describe("computeImpact() — tenant isolation", () => {
  it("passes tenantId (schoolId) to the prisma where clause", async () => {
    mockMasteryProfileFindMany.mockResolvedValue([]);

    // Pass tenantId without a schoolId override so tenantId is used as the
    // effective school scope (buildWhere: effectiveSchoolId = schoolId ?? tenantId)
    await computeImpact({
      tenantId: "tenant-xyz",
      schoolId: null,
      periodRange: VALID_INPUT.periodRange,
    });

    const [callArgs] = mockMasteryProfileFindMany.mock.calls[0];
    const whereStr = JSON.stringify(callArgs.where);
    // The where clause must reference tenant-xyz
    expect(whereStr).toContain("tenant-xyz");
  });

  it("scopes by classId when classId provided", async () => {
    mockMasteryProfileFindMany.mockResolvedValue([]);

    await computeImpact({
      ...VALID_INPUT,
      classId: "class-555",
    });

    const [callArgs] = mockMasteryProfileFindMany.mock.calls[0];
    const whereStr = JSON.stringify(callArgs.where);
    expect(whereStr).toContain("class-555");
  });

  it("does not include classId in where clause for school-scoped call", async () => {
    mockMasteryProfileFindMany.mockResolvedValue([]);

    await computeImpact({ ...VALID_INPUT, classId: null });

    const [callArgs] = mockMasteryProfileFindMany.mock.calls[0];
    const whereStr = JSON.stringify(callArgs.where);
    // Should not have enrollment filter
    expect(whereStr).not.toContain("enrollments");
  });
});
