/**
 * The student-facing pilot day (/learn/day): the real Timetable periods that T2's resolvePilotDay admitted or left as
 * gaps, shown through the school-day/1.0.0 shell. This adds no resolver, loader or record writer:
 * - which periods exist, their times and every lesson link come only from resolvePilotDay;
 * - planning context (lesson title, label, unit, segments, stage, grade band) comes only from a CoS resolved day
 *   whose LESSON bindings carry every admitted selection with the same package hash. No match, no context.
 * A gap shows the program's resolved gap label. Presentation-only: nothing here grants access or writes a record.
 */
import type { PilotDay } from "@/lib/curriculum/v4/pilotDay";
import type { LessonLink } from "@/components/experience/day/SchoolDayJourney";
import { ageBandForGrade, bandForGrade, gradeLabel, type DayBlock, type LessonBinding, type SchoolDay, SCHOOL_DAY_CONTRACT } from "./schoolDay";

/** The CoS program string for an unbound period (COS-STEM-FULL-DAY-PROGRAM; every resolved CONTENT_GAP label). */
export const PROGRAM_GAP_LABEL = "No approved lesson for this period yet - teacher-led session";
/** The CoS label for a bound pilot draft, used when no resolved day supplies the lesson's own label. */
export const PILOT_LESSON_LABEL = "Pilot draft lesson (not yet approved) - ungraded";
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const lessonBlocks = (day: SchoolDay) => day.blocks.filter((b): b is DayBlock & { binding: LessonBinding } => b.binding.kind === "LESSON");

/** The one CoS resolved day that binds every admitted (selection, packageHash), or null when none or several do. */
export function cosDayForPilot(pilot: PilotDay, cosDays: readonly SchoolDay[]): SchoolDay | null {
  const admitted = pilot.periods.flatMap((p) => (p.status === "ADMITTED" ? [p] : []));
  if (!admitted.length) return null;
  const fits = cosDays.filter((day) => admitted.every((p) => lessonBlocks(day).some((b) => b.binding.selection === p.selection && b.binding.packageHash === p.packageHash)));
  return fits.length === 1 ? fits[0] : null;
}

function fallbackLesson(selection: string, packageHash: string): LessonBinding {
  const [, version = "", key = ""] = selection.split("@");
  return { kind: "LESSON", source: "V4_DRAFT", key, version, selection, packageHash, candidateSha256: null, title: null, provisional: false,
    officialStatus: "NOT_APPROVED", studentLabel: PILOT_LESSON_LABEL, fillsOrder: null, replacementOrder: null, requiresAttachment: null };
}

/** The pilot day as a SchoolDay plus each period's link. Empty pilot days have no blocks; the route says so itself. */
export function schoolDayFromPilot(pilot: PilotDay, cos: SchoolDay | null): { day: SchoolDay; lessons: Record<string, LessonLink> } {
  const lessons: Record<string, LessonLink> = {};
  const blocks = pilot.periods.map((p, index): DayBlock => {
    const id = `pilot:${pilot.date}:${p.timetableId}`;
    const start = p.startTime && TIME.test(p.startTime) ? p.startTime : "", end = start && p.endTime && TIME.test(p.endTime) ? p.endTime : "";
    const base = { id, slot: `P${index + 1}`, label: p.periodLabel, kind: "PERIOD" as const, start, end };
    if (p.status === "GAP") return { ...base, course: p.subject, unit: null, binding: { kind: "GAP", label: PROGRAM_GAP_LABEL, teacherLed: null, order: null }, segments: [], stage: null };
    lessons[id] = { href: p.href, unavailable: null };
    const planned = cos && lessonBlocks(cos).find((b) => b.binding.selection === p.selection && b.binding.packageHash === p.packageHash);
    return planned ? { ...base, course: planned.course ?? p.subject, unit: planned.unit, binding: planned.binding, segments: planned.segments, stage: planned.stage }
      : { ...base, course: p.subject, unit: null, binding: fallbackLesson(p.selection, p.packageHash), segments: [], stage: null };
  });
  const grade = cos?.grade ?? null;
  return {
    day: { contract: SCHOOL_DAY_CONTRACT, planId: `pilot-day:${pilot.date}`, grade, gradeLabel: grade === null ? "" : gradeLabel(grade), section: "",
      // Without an exact CoS match the band is not guessed from the timetable: the plain period list (6-8 shell) is used.
      band: grade === null ? "G6_8" : bandForGrade(grade), ageBand: grade === null ? ageBandForGrade(7) : ageBandForGrade(grade),
      source: "PILOT_TIMETABLE", timetableMode: "SCHOOL_TIMETABLE", theme: cos?.theme ?? null, blocks },
    lessons,
  };
}

/** Longest selection accepted from a return link; real pinned selections are far shorter. */
const MAX_RETURN_SELECTION = 300;
export type DayReturnParams = Readonly<{ after?: unknown; at?: unknown }>;

/**
 * B1/B2: which period opens when the student comes back to /learn/day from a pilot lesson. `after` (Finish) opens the
 * next admitted lesson period, skipping gaps; `at` (Leave lesson) reopens the same one. A value counts only if it is a
 * single string naming a lesson this student's own resolved day admitted (a block with a link); anything else returns
 * null and the day opens as usual. Nothing is stored, and nothing here claims a lesson was completed or saved.
 */
/** fromBlockId: the period whose lesson the learner finished or left (display-only "opened this session" count). */
export function returnBlock(day: SchoolDay, lessons: Record<string, LessonLink>, params: DayReturnParams): { blockId: string; slot: string; announcement: string; fromBlockId: string } | null {
  const pick = (value: unknown) => (typeof value === "string" && value.length > 0 && value.length <= MAX_RETURN_SELECTION ? value : null);
  const after = pick(params.after), at = after ? null : pick(params.at);
  const wanted = after ?? at;
  if (!wanted) return null;
  const admitted = day.blocks.filter((b) => b.binding.kind === "LESSON" && lessons[b.id]?.href);
  const index = admitted.findIndex((b) => b.binding.kind === "LESSON" && b.binding.selection === wanted);
  if (index < 0) return null;
  const name = (b: DayBlock) => b.label ?? b.slot;
  const fromBlockId = admitted[index].id;
  if (at) return { blockId: admitted[index].id, slot: admitted[index].slot, announcement: `Back to ${name(admitted[index])}.`, fromBlockId };
  const next = admitted[index + 1];
  if (!next) return { blockId: admitted[index].id, slot: admitted[index].slot, announcement: "That was your last lesson period today. You can end your day.", fromBlockId };
  return { blockId: next.id, slot: next.slot, announcement: `Next: ${name(next)}.`, fromBlockId };
}

const REHEARSAL_CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;
/** A reviewer rehearsal time from ?clock=HH:MM (strict, single value), or null: the device clock is used then. */
export function parseRehearsalClock(raw: unknown): string | null {
  return typeof raw === "string" && REHEARSAL_CLOCK.test(raw) ? raw : null;
}
