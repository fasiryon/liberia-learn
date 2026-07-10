import { describe, it, expect } from "vitest";
import { summarizeComparison, type EvalRow } from "@/lib/finetune/evalCompare";

const rows: EvalRow[] = [
  { contentId: "a", baseScore: 80, ftScore: 82, baseCostUSD: 0.004, ftCostUSD: 0.001, baseLatencyMs: 3000, ftLatencyMs: 1500 },
  { contentId: "b", baseScore: 70, ftScore: 68, baseCostUSD: 0.006, ftCostUSD: 0.001, baseLatencyMs: 4000, ftLatencyMs: 1500 },
];

describe("summarizeComparison", () => {
  it("aggregates quality, cost, latency and win rate", () => {
    const s = summarizeComparison(rows);
    expect(s.n).toBe(2);
    expect(s.avgBaseScore).toBe(75);
    expect(s.avgFtScore).toBe(75);
    expect(s.scoreDelta).toBe(0);
    expect(s.avgBaseCostUSD).toBeCloseTo(0.005, 6);
    expect(s.avgFtCostUSD).toBeCloseTo(0.001, 6);
    // (0.005 - 0.001)/0.005 = 80% cost reduction
    expect(s.costReductionPct).toBeCloseTo(80, 1);
    // ft won/tied on a (82>=80), lost on b (68<70) -> 50%
    expect(s.ftWinRate).toBeCloseTo(0.5, 2);
  });

  it("handles an empty comparison without dividing by zero", () => {
    const s = summarizeComparison([]);
    expect(s.n).toBe(0);
    expect(s.costReductionPct).toBe(0);
    expect(s.ftWinRate).toBe(0);
  });
});
