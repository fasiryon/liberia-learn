/**
 * Builds the Grade 7 excellence gap reports (CANDIDATE ONLY).
 *
 *   npx tsx scripts/build-curriculum-excellence-g7-gap-reports.ts          write reports
 *   npx tsx scripts/build-curriculum-excellence-g7-gap-reports.ts --check  fail if reports are stale
 *
 * Report sets:
 *   curriculum/excellence/g7-v0.2.0  AI review of v0.2.0, read from the pinned PR #191 commit with
 *                                    `git show` (skipped, with a notice, if that commit is not local).
 *   curriculum/excellence/g7-v0.3.0  automated checks of the v0.3.0 candidates in this tree; the AI
 *                                    judgment review is refused because its agent wrote the corrections.
 * Writes only under curriculum/excellence/. Touches no database, candidate or release.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { G7_EXCELLENCE_DIRS, loadG7LessonInputs, pinnedCommitAvailable, readSourcePin } from "@/lib/curriculum/excellence/g7GapReportSources";
import { buildG7GapReport, renderG7GapReportMarkdown, renderG7IndexMarkdown } from "@/lib/curriculum/excellence/g7GapReport";

const root = process.cwd();
const check = process.argv.includes("--check");
const outputs = new Map<string, string>();
const summaries: string[] = [];

for (const dir of G7_EXCELLENCE_DIRS) {
  const pin = readSourcePin(root, dir);
  if (!pinnedCommitAvailable(pin, root)) {
    console.warn(`${dir}: pinned commit ${pin.gitCommit} is not available locally; skipped. Run: git fetch origin feat/g7-native-curriculum-v1`);
    continue;
  }
  const reports = loadG7LessonInputs(root, dir).map((inputs) => {
    const priorFile = pin.priorReportDir ? path.join(root, pin.priorReportDir, inputs.source.lessonKey, "gap-report.json") : null;
    const prior = priorFile ? JSON.parse(readFileSync(priorFile, "utf8")) : null;
    return buildG7GapReport(pin, inputs, prior);
  });
  for (const report of reports) {
    outputs.set(`${dir}/${report.lessonKey}/gap-report.json`, `${JSON.stringify(report, null, 2)}\n`);
    outputs.set(`${dir}/${report.lessonKey}/gap-report.md`, renderG7GapReportMarkdown(report));
    const n = (severity: string) => report.review.findings.filter((item) => item.severity === severity).length;
    summaries.push(`${pin.revisionLabel} ${report.lessonKey}: ${report.review.outcome}; ${n("BLOCKING")} blocking, ${n("MAJOR")} major, ${n("MINOR")} minor; blueprint gaps ${report.review.blueprint.blockingGaps.join(", ") || "none"}`);
  }
  outputs.set(`${dir}/README.md`, renderG7IndexMarkdown(pin, reports));
}

const stale: string[] = [];
for (const [file, content] of outputs) {
  const target = path.join(root, file);
  if (!path.resolve(target).startsWith(path.resolve(root, "curriculum/excellence"))) throw new Error(`refusing to write outside curriculum/excellence: ${file}`);
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
for (const line of summaries) console.log(line);
