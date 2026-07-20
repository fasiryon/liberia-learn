/**
 * Sprint 6.8: wires the existing RAG eval harness (evals/dataset.ts,
 * scripts/run-evals.ts, lib/evals/runner.ts) into the AI quality dashboard.
 * Builds no new grounding logic — reads EvalRun rows the harness already
 * produces every week.
 */
import { prisma } from "@/lib/db";

// Discriminant is a string literal (not boolean true/false) because this
// project's tsconfig has "strict": false, under which TypeScript does not
// reliably narrow discriminated unions on a boolean literal field.
export type GroundednessMetric =
  | {
      status: "measurable";
      lastRunAt: string;
      datasetSize: number;
      avgGroundingScore: number;
      avgRecallAt5: number;
      fallbackRate: number;
      passed: boolean;
      recentRuns: Array<{ runAt: string; avgGroundingScore: number; passed: boolean }>;
      source: string;
    }
  | {
      status: "gap";
      reason: string;
    };

const SOURCE = "RAG eval harness (evals/dataset.ts + scripts/run-evals.ts, weekly cron)";

export async function getGroundednessMetric(): Promise<GroundednessMetric> {
  const runs = await prisma.evalRun.findMany({
    orderBy: { runAt: "desc" },
    take: 5,
    select: {
      runAt: true,
      datasetSize: true,
      avgGrounding: true,
      avgRecallAt5: true,
      fallbackRate: true,
      passed: true,
    },
  });

  if (runs.length === 0) {
    return {
      status: "gap",
      reason:
        "No RAG eval runs recorded in EvalRun yet. The weekly eval workflow has real historical results as JSON files (evals/results/), but DB persistence was off until this sprint — it will populate after the next scheduled run or a manual backfill.",
    };
  }

  const [latest] = runs;
  return {
    status: "measurable",
    lastRunAt: latest.runAt.toISOString(),
    datasetSize: latest.datasetSize,
    avgGroundingScore: latest.avgGrounding,
    avgRecallAt5: latest.avgRecallAt5,
    fallbackRate: latest.fallbackRate,
    passed: latest.passed,
    recentRuns: runs.map((run) => ({
      runAt: run.runAt.toISOString(),
      avgGroundingScore: run.avgGrounding,
      passed: run.passed,
    })),
    source: SOURCE,
  };
}
