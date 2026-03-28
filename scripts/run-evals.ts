import { EVAL_DATASET } from "@/evals/dataset";
import { printEvalSummary, runEvalCases } from "@/lib/evals/runner";
import type { EvalRole } from "@/lib/evals/types";

const REQUIRED_ENV_VARS = ["OPENAI_API_KEY"] as const;

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

function assertEvalPreflight() {
  const missing = REQUIRED_ENV_VARS.filter((name) => {
    const value = process.env[name];
    return typeof value !== "string" || value.trim().length === 0;
  });

  if (missing.length === 0) {
    return;
  }

  console.error(
    [
      "Eval runner requires OpenAI/provider credentials because it exercises the live retrieval pipeline.",
      `Missing required env var${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}`,
      "Set the missing value locally or provide it through CI secrets before running scripts/run-evals.ts.",
    ].join("\n")
  );
  process.exit(1);
}

async function main() {
  assertEvalPreflight();

  const subject = readArg("--subject");
  const role = readArg("--role") as EvalRole | undefined;
  const gradeArg = readArg("--grade");
  const grade = gradeArg ? Number.parseInt(gradeArg, 10) : undefined;

  const result = await runEvalCases(EVAL_DATASET, {
    subject,
    grade: Number.isFinite(grade) ? grade : undefined,
    role,
  });

  printEvalSummary(result);
  console.log(
    JSON.stringify(
      {
        runAt: result.runAt,
        outputDirectory: "evals/results",
        passed: result.passed,
      },
      null,
      2
    )
  );

  if (!result.passed) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("[EVAL_RUNNER]", error);
  process.exit(1);
});
