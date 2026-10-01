/**
 * Rewrites lib/interactive-labs/v2/production/budget-baseline.json from the current labs.
 * Run only when a budget change is intended and reviewed; CI fails on any unrecorded regression.
 *
 *   npx tsx scripts/labs/update-lab-budget-baseline.ts
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { LAB_REVIEW_SCENARIO_SETS } from "../../lib/interactive-labs/v2/review/referenceScenarios";
import { measureRegisteredLab } from "../../lib/interactive-labs/v2/production/measure";
import { checkLabBudget } from "../../lib/interactive-labs/v2/production/budgets";
import type { LabProductionRecord } from "../../lib/interactive-labs/v2/production/record";

const baseline: Record<string, unknown> = {};
for (const labId of Object.keys(LAB_REVIEW_SCENARIO_SETS).sort()) {
  const recordPath = path.join("docs", "labs", labId, "production.json");
  const assets = existsSync(recordPath) ? (JSON.parse(readFileSync(recordPath, "utf8")) as LabProductionRecord).assets.filter((asset) => asset.kind !== "procedural").map((asset) => ({ id: asset.id, bytes: asset.bytes ?? 0, profiles: asset.profiles ?? [], maxTexturePx: asset.maxTexturePx })) : [];
  const measured = measureRegisteredLab(labId, assets);
  const problems = checkLabBudget(labId, measured);
  if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
  baseline[labId] = measured;
}
writeFileSync(path.join("lib", "interactive-labs", "v2", "production", "budget-baseline.json"), JSON.stringify(baseline, null, 2) + "\n");
console.log(`Baseline written for ${Object.keys(baseline).length} labs.`);
