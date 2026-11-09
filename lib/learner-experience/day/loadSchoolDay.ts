/**
 * Server loader for the school day shell. Reads the Chief of Staff resolved days (read-only) and resolves each bound
 * period against the exact factory package on disk. A period links to a player route only when that route can
 * actually play the pinned version; otherwise the learner is told why it cannot open. Never a substitute lesson.
 */
import fs from "node:fs";
import path from "node:path";
import { schoolDayFromResolved, type SchoolDay } from "./schoolDay";
import type { LessonLink } from "@/components/experience/day/SchoolDayJourney";

const PROGRAM = path.join(process.cwd(), "curriculum/program/stem-v1");
const DRAFTS = path.join(process.cwd(), "curriculum/factory-v4/drafts");
const read = (file: string) => JSON.parse(fs.readFileSync(file, "utf8"));

/** Day 1 for a grade, from the CoS resolved day only (resolved-days/g{grade}-day1.json) and its period-matrix stages. */
export function schoolDayForGrade(grade: number): SchoolDay {
  if (!Number.isInteger(grade) || grade < 0 || grade > 12) throw Error("grade_out_of_range");
  const plan = read(path.join(PROGRAM, "resolved-days", `g${grade}-day1.json`));
  if (plan.grade !== grade) throw Error("resolved_day_grade_mismatch");
  return schoolDayFromResolved(plan, read(path.join(PROGRAM, "period-matrix.json")).rows);
}

/** The exact package on disk must carry the pinned hash; a missing or different package is never played. */
function packageMatches(version: string, key: string, packageHash: string) {
  const file = path.join(DRAFTS, version, key, "manifest.json");
  if (!/^[a-z0-9.-]+$/.test(version) || !/^[a-z0-9-]+$/.test(key) || !fs.existsSync(file)) return "missing" as const;
  return read(file).packageHash === packageHash ? "match" as const : "different" as const;
}

/**
 * Links for every lesson period. `canPlay(selection)` says whether the target player route can serve that exact
 * selection (it is the route's own loader, never a guess from the version string).
 */
export function resolveLessonLinks(day: SchoolDay, basePath: string, canPlay: (selection: string) => boolean): Record<string, LessonLink> {
  const out: Record<string, LessonLink> = {};
  for (const block of day.blocks) {
    const b = block.binding;
    if (b.kind !== "LESSON") continue;
    const onDisk = packageMatches(b.version, b.key, b.packageHash);
    out[block.id] = onDisk === "missing" ? { href: null, unavailable: "This lesson's package is not in this build yet." }
      : onDisk === "different" ? { href: null, unavailable: "The package here does not match the pinned version, so it will not open." }
      : canPlay(b.selection) ? { href: `${basePath}/${b.selection}`, unavailable: null }
      : { href: null, unavailable: `The lesson exists (version ${b.version}), but this player route cannot open that version yet.` };
  }
  return out;
}
