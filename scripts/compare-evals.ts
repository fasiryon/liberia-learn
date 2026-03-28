import { readFile } from "fs/promises";
import path from "path";
import type { EvalRunResult } from "@/lib/evals/types";

type ComparableMetric =
  | "avgRecallAt5"
  | "avgPrecisionAt5"
  | "avgMrr"
  | "avgGrounding"
  | "avgLengthScore"
  | "fallbackRate"
  | "refusalRate";

const METRICS: Array<{
  metric: ComparableMetric;
  direction: "higher_is_better" | "lower_is_better";
}> = [
  { metric: "avgRecallAt5", direction: "higher_is_better" },
  { metric: "avgPrecisionAt5", direction: "higher_is_better" },
  { metric: "avgMrr", direction: "higher_is_better" },
  { metric: "avgGrounding", direction: "higher_is_better" },
  { metric: "avgLengthScore", direction: "higher_is_better" },
  { metric: "fallbackRate", direction: "lower_is_better" },
  { metric: "refusalRate", direction: "lower_is_better" },
];

async function readResult(filePath: string): Promise<EvalRunResult> {
  const raw = await readFile(path.resolve(filePath), "utf8");
  return JSON.parse(raw) as EvalRunResult;
}

function percentageDelta(previous: number, current: number): number {
  if (previous === 0) {
    return current === 0 ? 0 : 1;
  }

  return (current - previous) / previous;
}

function isRegression(
  direction: "higher_is_better" | "lower_is_better",
  delta: number
): boolean {
  return direction === "higher_is_better" ? delta < -0.1 : delta > 0.1;
}

async function main() {
  const [baselinePath, currentPath] = process.argv.slice(2);

  if (!baselinePath || !currentPath) {
    throw new Error("Usage: tsx scripts/compare-evals.ts <baseline.json> <current.json>");
  }

  const baseline = await readResult(baselinePath);
  const current = await readResult(currentPath);
  let hasRegression = false;

  const rows = METRICS.map(({ metric, direction }) => {
    const before = baseline.aggregate[metric];
    const after = current.aggregate[metric];
    const delta = percentageDelta(before, after);
    const regressed = isRegression(direction, delta);

    if (regressed) {
      hasRegression = true;
    }

    return {
      metric,
      baseline: before.toFixed(3),
      current: after.toFixed(3),
      deltaPct: `${(delta * 100).toFixed(1)}%`,
      direction,
      regression: regressed ? "yes" : "no",
    };
  });

  console.table(rows);

  if (hasRegression) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("[EVAL_COMPARE]", error);
  process.exit(1);
});
