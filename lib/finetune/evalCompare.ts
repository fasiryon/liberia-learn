/**
 * Pure aggregation for the base-vs-fine-tuned comparison. The runner generates
 * lessons with both models, scores them through the existing quality gate, and
 * feeds the per-lesson rows here for the before/after summary.
 */
export interface EvalRow {
  contentId: string;
  baseScore: number;
  ftScore: number;
  baseCostUSD: number;
  ftCostUSD: number;
  baseLatencyMs: number;
  ftLatencyMs: number;
}

export interface EvalSummary {
  n: number;
  avgBaseScore: number;
  avgFtScore: number;
  scoreDelta: number;
  avgBaseCostUSD: number;
  avgFtCostUSD: number;
  costReductionPct: number;
  ftWinRate: number;
  avgBaseLatencyMs: number;
  avgFtLatencyMs: number;
}

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

export function summarizeComparison(rows: EvalRow[]): EvalSummary {
  const n = rows.length;
  const avgBaseScore = avg(rows.map((r) => r.baseScore));
  const avgFtScore = avg(rows.map((r) => r.ftScore));
  const avgBaseCostUSD = avg(rows.map((r) => r.baseCostUSD));
  const avgFtCostUSD = avg(rows.map((r) => r.ftCostUSD));
  const costReductionPct = avgBaseCostUSD > 0 ? ((avgBaseCostUSD - avgFtCostUSD) / avgBaseCostUSD) * 100 : 0;
  const wins = rows.filter((r) => r.ftScore >= r.baseScore).length;

  return {
    n,
    avgBaseScore,
    avgFtScore,
    scoreDelta: avgFtScore - avgBaseScore,
    avgBaseCostUSD,
    avgFtCostUSD,
    costReductionPct,
    ftWinRate: n ? wins / n : 0,
    avgBaseLatencyMs: avg(rows.map((r) => r.baseLatencyMs)),
    avgFtLatencyMs: avg(rows.map((r) => r.ftLatencyMs)),
  };
}
