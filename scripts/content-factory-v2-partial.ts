import fs from "fs";
import { parseArgs } from "util";
import { spawnSync } from "child_process";
import { FIRST_TEN_BASELINE } from "../lib/content-factory/v2/firstTen";
import { loadPinnedAuthoringCohort, processAuthoredSubset } from "../lib/content-factory/v2/partialBatch";

async function main() {
  if (process.env.CONTENT_FACTORY_TEN_CANDIDATES !== "1") throw new Error("content_factory_ten_disabled");
  const { values, positionals } = parseArgs({ options: { select: { type: "string" }, extract: { type: "string" }, output: { type: "string" }, spec: { type: "string" } }, allowPositionals: true, strict: true });
  if (!values.select || !values.extract || !values.output || !positionals.length) throw new Error("Usage: --select <comma-separated-pinned-IDs> --extract <existing-read-only-extract-dir> --output <restricted-dir> [--spec <exact-spec-file>] <authored-input.json> [...]");
  const git = values.spec ? null : spawnSync("git", ["show", `${FIRST_TEN_BASELINE.sourceCommit}:${FIRST_TEN_BASELINE.specPath}`]);
  if (git?.status) throw new Error("pinned_spec_git_object_unavailable_supply_exact_spec_file");
  const specBytes = values.spec ? fs.readFileSync(values.spec) : git!.stdout;
  const cohort = loadPinnedAuthoringCohort(specBytes, values.extract);
  const receipt = await processAuthoredSubset({ enabled: true, cohort, selectedIds: values.select.split(","), authoringInputs: positionals.map(file => fs.readFileSync(file)), outputRoot: values.output });
  process.stdout.write(JSON.stringify(receipt, null, 2) + "\n");
}
main().catch(error => { process.stderr.write(`${error instanceof Error ? error.message : "partial_batch_failed"}\n`); process.exitCode = 1; });
