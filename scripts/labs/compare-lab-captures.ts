/**
 * Proves the lab capture harness is deterministic: compares two capture folders PNG by PNG (sha256).
 *
 *   npx tsx scripts/labs/compare-lab-captures.ts <folderA> <folderB> [--report out.json]
 *
 * Exit 0 only when both folders hold the same set of PNGs and every pair is byte-identical. Videos, perf and
 * probe output use the real clock and are excluded by design.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

function hashes(folder: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const file of readdirSync(folder).filter((name) => name.endsWith(".png")).sort()) {
    result.set(file, createHash("sha256").update(readFileSync(path.join(folder, file))).digest("hex"));
  }
  return result;
}

const [a, b] = process.argv.slice(2).filter((value) => !value.startsWith("--"));
if (!a || !b) { console.error("Usage: compare-lab-captures.ts <folderA> <folderB> [--report out.json]"); process.exit(2); }
const left = hashes(a), right = hashes(b);
const onlyLeft = [...left.keys()].filter((file) => !right.has(file));
const onlyRight = [...right.keys()].filter((file) => !left.has(file));
const differing = [...left.keys()].filter((file) => right.has(file) && right.get(file) !== left.get(file));
const identical = [...left.keys()].filter((file) => right.get(file) === left.get(file));
const report = { a, b, compared: left.size, identical: identical.length, differing, onlyInA: onlyLeft, onlyInB: onlyRight, deterministic: left.size > 0 && differing.length === 0 && onlyLeft.length === 0 && onlyRight.length === 0 };
const reportIndex = process.argv.indexOf("--report");
if (reportIndex > 0) writeFileSync(process.argv[reportIndex + 1], JSON.stringify(report, null, 2));
console.log(`${report.identical}/${report.compared} PNGs identical; ${differing.length} differ; ${onlyLeft.length + onlyRight.length} unmatched.`);
for (const file of differing) console.log(`  DIFFERS  ${file}`);
process.exit(report.deterministic ? 0 : 1);
