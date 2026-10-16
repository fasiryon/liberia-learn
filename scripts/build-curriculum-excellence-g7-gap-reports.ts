/**
 * Builds the Grade 7 v0.2.0 excellence gap reports (CANDIDATE ONLY).
 *
 *   npx tsx scripts/build-curriculum-excellence-g7-gap-reports.ts          write reports
 *   npx tsx scripts/build-curriculum-excellence-g7-gap-reports.ts --check  fail if reports are stale
 *
 * Reads the candidates from the commit pinned in curriculum/excellence/g7-v0.2.0/source.json with
 * `git show`, so it needs that commit locally (`git fetch origin feat/g7-native-curriculum-v1`).
 * Writes only under curriculum/excellence/g7-v0.2.0/. Touches no database, candidate or release.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { G7_EXCELLENCE_DIR, loadG7LessonInputs, pinnedCommitAvailable, readSourcePin } from "@/lib/curriculum/excellence/g7GapReportSources";
import { buildG7GapReport, renderG7GapReportMarkdown, renderG7IndexMarkdown } from "@/lib/curriculum/excellence/g7GapReport";

const root = process.cwd();
const check = process.argv.includes("--check");
const pin = readSourcePin(root);
if (!pinnedCommitAvailable(pin, root)) {
  console.error(`Pinned commit ${pin.gitCommit} is not available locally. Run: git fetch origin feat/g7-native-curriculum-v1`);
  process.exit(2);
}

const reports = loadG7LessonInputs(root).map((inputs) => buildG7GapReport(pin, inputs));
const outputs = new Map<string, string>();
for (const report of reports) {
  outputs.set(`${G7_EXCELLENCE_DIR}/${report.lessonKey}/gap-report.json`, `${JSON.stringify(report, null, 2)}\n`);
  outputs.set(`${G7_EXCELLENCE_DIR}/${report.lessonKey}/gap-report.md`, renderG7GapReportMarkdown(report));
}
outputs.set(`${G7_EXCELLENCE_DIR}/README.md`, renderG7IndexMarkdown(pin, reports));

const stale: string[] = [];
for (const [file, content] of outputs) {
  const target = path.join(root, file);
  if (!path.resolve(target).startsWith(path.resolve(root, G7_EXCELLENCE_DIR))) throw new Error(`refusing to write outside ${G7_EXCELLENCE_DIR}: ${file}`);
  const current = existsSync(target) ? readFileSync(target, "utf8").replace(/\r\n/g, "\n") : null;
  if (check) {
    if (current !== content) stale.push(file);
    continue;
  }
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content, "utf8");
  console.log(`wrote ${file}`);
}
if (check && stale.length) {
  console.error(`Stale excellence gap reports:\n${stale.join("\n")}\nRegenerate with: npx tsx scripts/build-curriculum-excellence-g7-gap-reports.ts`);
  process.exit(1);
}
for (const report of reports) {
  const n = (severity: string) => report.review.findings.filter((item) => item.severity === severity).length;
  console.log(`${report.lessonKey}: ${report.review.outcome}; ${n("BLOCKING")} blocking, ${n("MAJOR")} major, ${n("MINOR")} minor; blueprint gaps ${report.review.blueprint.blockingGaps.join(", ")} -> ${report.review.projectedBlueprintWithPlan?.evaluation.blockingGaps.join(", ") || "none"}`);
}
