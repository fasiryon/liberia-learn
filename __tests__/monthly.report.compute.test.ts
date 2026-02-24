/**
 * __tests__/monthly.report.compute.test.ts
 *
 * Unit tests for lib/reporting/monthly/compute.ts — Block 8.
 *
 * Covers:
 *   1. aggregateByStrand — grouping, metric computation, empty input, sort order.
 *   2. classifyStrandTier — all 4 tiers + unclassified, boundary conditions.
 *   3. computeHeadlineMetrics — weighted averages, empty/zero-weight inputs.
 *   4. computeTierCounts — counts per tier.
 *   5. getMonthBounds — correct UTC start/end dates.
 *   6. formatReportMonth / getPreviousMonth — month string helpers.
 *   7. isValidReportMonth — validation rules.
 *
 * All functions are pure — no mocks needed.
 */

import { describe, it, expect } from "vitest";
import {
  aggregateByStrand,
  classifyStrandTier,
  computeHeadlineMetrics,
  computeTierCounts,
  getMonthBounds,
  formatReportMonth,
  getPreviousMonth,
  isValidReportMonth,
  TIER_HIGH_PROFICIENCY,
  TIER_LOW_PROFICIENCY,
  TIER_HIGH_GROWTH,
  TIER_STAGNANT_GROWTH,
  TIER_HIGH_BASELINE,
  TIER_LOW_BASELINE,
  type MasteryProfileRow,
  type StrandAggregate,
} from "@/lib/reporting/monthly/compute";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<MasteryProfileRow> = {}): MasteryProfileRow {
  return {
    subject: "MATH",
    strandKey: "algebra_basics",
    currentScore: 0.80,
    baselineScore: 0.60,
    growthDelta: 0.20,
    sustainabilityIndex: 0.75,
    aiRelianceRate: 0.10,
    proficiencyState: "PROFICIENT",
    masteryState: "DEVELOPING",
    ...overrides,
  };
}

function makeStrandAggregate(
  overrides: Partial<Omit<StrandAggregate, "tier">> = {}
): Omit<StrandAggregate, "tier"> {
  return {
    subject: "MATH",
    strandKey: "algebra_basics",
    proficiencyRate: 0.80,
    masteryRate: 0.40,
    avgGrowthDelta: 0.15,
    avgSustainabilityIndex: 0.75,
    avgAiRelianceRate: 0.10,
    avgBaselineScore: 0.55,
    studentCount: 20,
    ...overrides,
  };
}

// ─── 1. aggregateByStrand ─────────────────────────────────────────────────────

describe("aggregateByStrand", () => {
  it("returns empty array for empty input", () => {
    expect(aggregateByStrand([])).toEqual([]);
  });

  it("groups rows by subject × strandKey", () => {
    const rows = [
      makeRow({ subject: "MATH",    strandKey: "algebra" }),
      makeRow({ subject: "MATH",    strandKey: "algebra" }),
      makeRow({ subject: "SCIENCE", strandKey: "biology" }),
    ];
    const result = aggregateByStrand(rows);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.strandKey).sort()).toEqual(["algebra", "biology"].sort());
  });

  it("computes proficiencyRate as fraction of PROFICIENT students", () => {
    const rows = [
      makeRow({ proficiencyState: "PROFICIENT" }),
      makeRow({ proficiencyState: "PROFICIENT" }),
      makeRow({ proficiencyState: "APPROACHING" }),
      makeRow({ proficiencyState: "BELOW_PROFICIENT" }),
    ];
    const [strand] = aggregateByStrand(rows);
    expect(strand.proficiencyRate).toBeCloseTo(0.5);
  });

  it("computes masteryRate as fraction of MASTERED students", () => {
    const rows = [
      makeRow({ masteryState: "MASTERED" }),
      makeRow({ masteryState: "DEVELOPING" }),
      makeRow({ masteryState: "DEVELOPING" }),
    ];
    const [strand] = aggregateByStrand(rows);
    expect(strand.masteryRate).toBeCloseTo(1 / 3);
  });

  it("computes avgGrowthDelta as mean of growthDelta across students", () => {
    const rows = [
      makeRow({ growthDelta: 0.10 }),
      makeRow({ growthDelta: 0.20 }),
      makeRow({ growthDelta: 0.30 }),
    ];
    const [strand] = aggregateByStrand(rows);
    expect(strand.avgGrowthDelta).toBeCloseTo(0.20);
  });

  it("computes avgBaselineScore as mean of baselineScore across students", () => {
    const rows = [
      makeRow({ baselineScore: 0.40 }),
      makeRow({ baselineScore: 0.60 }),
    ];
    const [strand] = aggregateByStrand(rows);
    expect(strand.avgBaselineScore).toBeCloseTo(0.50);
  });

  it("sets studentCount to number of rows in the group", () => {
    const rows = [makeRow(), makeRow(), makeRow()];
    const [strand] = aggregateByStrand(rows);
    expect(strand.studentCount).toBe(3);
  });

  it("sorts output by subject ASC, then strandKey ASC", () => {
    const rows = [
      makeRow({ subject: "SCIENCE", strandKey: "biology" }),
      makeRow({ subject: "MATH",    strandKey: "numbers" }),
      makeRow({ subject: "MATH",    strandKey: "algebra" }),
    ];
    const result = aggregateByStrand(rows);
    expect(result[0].subject).toBe("MATH");
    expect(result[0].strandKey).toBe("algebra");
    expect(result[1].strandKey).toBe("numbers");
    expect(result[2].subject).toBe("SCIENCE");
  });

  it("single row produces an aggregate with studentCount = 1", () => {
    const rows = [makeRow({ proficiencyState: "PROFICIENT", masteryState: "MASTERED" })];
    const [strand] = aggregateByStrand(rows);
    expect(strand.studentCount).toBe(1);
    expect(strand.proficiencyRate).toBe(1);
    expect(strand.masteryRate).toBe(1);
  });
});

// ─── 2. classifyStrandTier ────────────────────────────────────────────────────

describe("classifyStrandTier", () => {
  it("returns Tier A when proficiency ≥ threshold AND growth ≥ threshold", () => {
    const strand = makeStrandAggregate({
      proficiencyRate: TIER_HIGH_PROFICIENCY,
      avgGrowthDelta:  TIER_HIGH_GROWTH,
    });
    expect(classifyStrandTier(strand)).toBe("A");
  });

  it("returns Tier A at exact thresholds (boundary inclusive)", () => {
    const strand = makeStrandAggregate({
      proficiencyRate: 0.75,  // exactly TIER_HIGH_PROFICIENCY
      avgGrowthDelta:  0.10,  // exactly TIER_HIGH_GROWTH
    });
    expect(classifyStrandTier(strand)).toBe("A");
  });

  it("returns Tier B when growth ≥ threshold AND baseline < threshold", () => {
    const strand = makeStrandAggregate({
      proficiencyRate:  0.50, // not high enough for Tier A
      avgGrowthDelta:   TIER_HIGH_GROWTH,
      avgBaselineScore: TIER_LOW_BASELINE - 0.01,
    });
    expect(classifyStrandTier(strand)).toBe("B");
  });

  it("returns Tier C when proficiency < threshold AND growth < threshold", () => {
    const strand = makeStrandAggregate({
      proficiencyRate:  TIER_LOW_PROFICIENCY - 0.01,
      avgGrowthDelta:   TIER_STAGNANT_GROWTH - 0.01,
      avgBaselineScore: 0.55, // not high enough for Tier D
    });
    expect(classifyStrandTier(strand)).toBe("C");
  });

  it("returns Tier D when baseline ≥ threshold AND growth < threshold", () => {
    const strand = makeStrandAggregate({
      proficiencyRate:  0.65, // between low and high (not Tier A, not Tier C)
      avgGrowthDelta:   TIER_STAGNANT_GROWTH - 0.01,
      avgBaselineScore: TIER_HIGH_BASELINE,
    });
    expect(classifyStrandTier(strand)).toBe("D");
  });

  it("returns unclassified when no tier criteria are met", () => {
    const strand = makeStrandAggregate({
      proficiencyRate:  0.68, // between LOW (0.60) and HIGH (0.75)
      avgGrowthDelta:   0.07, // between STAGNANT (0.05) and HIGH (0.10)
      avgBaselineScore: 0.55, // between LOW (0.50) and HIGH (0.70)
    });
    expect(classifyStrandTier(strand)).toBe("unclassified");
  });

  it("Tier A takes priority over Tier B (high growth, high proficiency, low baseline)", () => {
    // Both Tier A and Tier B conditions are met — Tier A wins (checked first)
    const strand = makeStrandAggregate({
      proficiencyRate:  TIER_HIGH_PROFICIENCY,
      avgGrowthDelta:   TIER_HIGH_GROWTH,
      avgBaselineScore: TIER_LOW_BASELINE - 0.05, // would qualify for Tier B
    });
    expect(classifyStrandTier(strand)).toBe("A");
  });

  it("Tier B takes priority over Tier D (high growth, low baseline, high baseline is irrelevant)", () => {
    // Tier B: high growth + low baseline. Growth suppresses Tier D check.
    const strand = makeStrandAggregate({
      proficiencyRate:  0.50,
      avgGrowthDelta:   TIER_HIGH_GROWTH,         // ≥ 0.10 → qualifies Tier B
      avgBaselineScore: TIER_LOW_BASELINE - 0.01, // < 0.50
    });
    expect(classifyStrandTier(strand)).toBe("B");
  });
});

// ─── 3. computeHeadlineMetrics ────────────────────────────────────────────────

describe("computeHeadlineMetrics", () => {
  it("returns all-zero metrics for empty strands array", () => {
    const result = computeHeadlineMetrics([]);
    expect(result).toEqual({
      proficiencyRate: 0,
      masteryRate: 0,
      avgGrowthDelta: 0,
      sustainabilityIndex: 0,
      aiRelianceRate: 0,
    });
  });

  it("returns all-zero metrics when total student weight = 0", () => {
    const strands = [
      { ...makeStrandAggregate(), tier: "unclassified" as const, studentCount: 0 },
    ];
    const result = computeHeadlineMetrics(strands);
    expect(result.proficiencyRate).toBe(0);
  });

  it("computes weighted averages across strands", () => {
    // Strand A: 10 students, proficiency 0.80
    // Strand B: 30 students, proficiency 0.40
    // Weighted avg = (0.80 * 10 + 0.40 * 30) / 40 = (8 + 12) / 40 = 0.50
    const strands: StrandAggregate[] = [
      {
        ...makeStrandAggregate({ strandKey: "strand_a", proficiencyRate: 0.80, studentCount: 10 }),
        tier: "A",
      },
      {
        ...makeStrandAggregate({ strandKey: "strand_b", proficiencyRate: 0.40, studentCount: 30 }),
        tier: "C",
      },
    ];
    const result = computeHeadlineMetrics(strands);
    expect(result.proficiencyRate).toBeCloseTo(0.50);
  });

  it("single strand headline matches that strand's metrics exactly", () => {
    const strands: StrandAggregate[] = [
      { ...makeStrandAggregate({ proficiencyRate: 0.72, masteryRate: 0.45 }), tier: "A" },
    ];
    const result = computeHeadlineMetrics(strands);
    expect(result.proficiencyRate).toBeCloseTo(0.72);
    expect(result.masteryRate).toBeCloseTo(0.45);
  });
});

// ─── 4. computeTierCounts ─────────────────────────────────────────────────────

describe("computeTierCounts", () => {
  it("returns all-zero counts for empty array", () => {
    expect(computeTierCounts([])).toEqual({ A: 0, B: 0, C: 0, D: 0, unclassified: 0 });
  });

  it("counts each tier correctly", () => {
    const tiers = ["A", "A", "B", "C", "C", "C", "D", "unclassified"] as const;
    const strands: StrandAggregate[] = tiers.map((tier, i) => ({
      ...makeStrandAggregate({ strandKey: `strand_${i}` }),
      tier,
    }));
    expect(computeTierCounts(strands)).toEqual({
      A: 2,
      B: 1,
      C: 3,
      D: 1,
      unclassified: 1,
    });
  });
});

// ─── 5. getMonthBounds ────────────────────────────────────────────────────────

describe("getMonthBounds", () => {
  it("returns correct UTC start and end for January 2026", () => {
    const { start, end } = getMonthBounds("2026-01");
    expect(start).toEqual(new Date(Date.UTC(2026, 0, 1, 0, 0, 0, 0)));
    expect(end).toEqual(new Date(Date.UTC(2026, 0, 31, 23, 59, 59, 999)));
  });

  it("handles February in a leap year (2024-02 has 29 days)", () => {
    const { end } = getMonthBounds("2024-02");
    expect(end.getUTCDate()).toBe(29);
  });

  it("handles February in a non-leap year (2026-02 has 28 days)", () => {
    const { end } = getMonthBounds("2026-02");
    expect(end.getUTCDate()).toBe(28);
  });

  it("returns last millisecond of the last day as end", () => {
    const { end } = getMonthBounds("2026-03");
    expect(end.getUTCHours()).toBe(23);
    expect(end.getUTCMinutes()).toBe(59);
    expect(end.getUTCSeconds()).toBe(59);
    expect(end.getUTCMilliseconds()).toBe(999);
  });
});

// ─── 6. Month string helpers ──────────────────────────────────────────────────

describe("formatReportMonth", () => {
  it("pads single-digit months with a leading zero", () => {
    expect(formatReportMonth(2026, 1)).toBe("2026-01");
    expect(formatReportMonth(2026, 9)).toBe("2026-09");
  });

  it("does not pad double-digit months", () => {
    expect(formatReportMonth(2026, 12)).toBe("2026-12");
    expect(formatReportMonth(2026, 10)).toBe("2026-10");
  });
});

describe("getPreviousMonth", () => {
  it("returns the previous calendar month for a given date", () => {
    const march1 = new Date(Date.UTC(2026, 2, 1)); // 2026-03-01
    expect(getPreviousMonth(march1)).toBe("2026-02");
  });

  it("wraps correctly from January to December of the previous year", () => {
    const jan1 = new Date(Date.UTC(2026, 0, 1)); // 2026-01-01
    expect(getPreviousMonth(jan1)).toBe("2025-12");
  });
});

// ─── 7. isValidReportMonth ────────────────────────────────────────────────────

describe("isValidReportMonth", () => {
  it("accepts valid YYYY-MM strings", () => {
    expect(isValidReportMonth("2026-01")).toBe(true);
    expect(isValidReportMonth("2026-12")).toBe(true);
    expect(isValidReportMonth("2020-06")).toBe(true);
  });

  it("rejects invalid format strings", () => {
    expect(isValidReportMonth("2026-1")).toBe(false);   // no leading zero
    expect(isValidReportMonth("26-01")).toBe(false);    // 2-digit year
    expect(isValidReportMonth("2026/01")).toBe(false);  // wrong separator
    expect(isValidReportMonth("January 2026")).toBe(false);
  });

  it("rejects out-of-range months", () => {
    expect(isValidReportMonth("2026-00")).toBe(false); // month 0
    expect(isValidReportMonth("2026-13")).toBe(false); // month 13
  });

  it("rejects years before 2020", () => {
    expect(isValidReportMonth("2019-12")).toBe(false);
  });
});
