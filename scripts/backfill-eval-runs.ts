/**
 * Sprint 6.8: one-time backfill of the 17 real historical eval runs
 * (evals/results/*.json, produced by scripts/run-evals.ts over past weeks)
 * into the EvalRun table, which existed but was never populated because
 * ENABLE_EVAL_DB_LOGGING defaulted off. Idempotent -- skips any runAt
 * timestamp already present in EvalRun.
 */
import { readdir, readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import type { EvalRunResult } from "@/lib/evals/types";

async function main() {
  const resultsDir = path.join(process.cwd(), "evals", "results");
  const files = (await readdir(resultsDir)).filter((f) => f.endsWith(".json"));

  let inserted = 0;
  let skipped = 0;

  for (const file of files) {
    const raw = await readFile(path.join(resultsDir, file), "utf8");
    const result = JSON.parse(raw) as EvalRunResult;
    const runAt = new Date(result.runAt);

    const existing = await prisma.evalRun.findFirst({ where: { runAt } });
    if (existing) {
      skipped += 1;
      continue;
    }

    await prisma.evalRun.create({
      data: {
        runAt,
        datasetSize: result.datasetSize,
        avgRecallAt5: result.aggregate.avgRecallAt5,
        avgPrecisionAt5: result.aggregate.avgPrecisionAt5,
        avgGrounding: result.aggregate.avgGrounding,
        fallbackRate: result.aggregate.fallbackRate,
        passed: result.passed,
        resultJson: result as any,
      },
    });
    inserted += 1;
  }

  console.log(JSON.stringify({ filesFound: files.length, inserted, skipped }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[backfill-eval-runs]", error);
    process.exit(1);
  });
