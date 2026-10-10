/**
 * Display contracts for My Classes and Class Schedule. Membership, links and
 * availability come from the server read models in lib/student/classes.server.ts;
 * nothing here decides access. Rows keep the server's order.
 */
import type { PeriodState } from "@/lib/student/classes.server";

export type ClassNext = { date: string; dayName: string; periodLabel: string; timeRange: string | null; isToday: boolean; state: PeriodState };
export type ClassSummary = {
  classId: string; name: string; subject: string; grade: number | null; teacherName: string | null; schoolName: string | null; href: string;
  currentUnit: { unitId: string; title: string; href: string } | null;
  nextClass: ClassNext | null;
  nextWork: { date: string; title: string; href: string } | null;
  timetableConfigured: boolean; openAssignmentCount: number;
};
export type MyClasses = { schemaVersion: "student-classes/1"; availability: "current" | "empty" | "unavailable"; enrolled: boolean; today?: string; classes: ClassSummary[] };

/** Same-origin learner destinations only; never an arbitrary or external URL. */
export function classTarget(value: unknown): value is string {
  return typeof value === "string" && !/[\\\u0000-\u001f]/.test(value) &&
    /^\/student\/(?:(?:lesson|units|assignments|classes)\/[^/?#]+|schedule)$/.test(value);
}

const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const nullableText = (value: unknown) => value == null || typeof value === "string";

export function validMyClasses(data: any): data is MyClasses {
  return !!data && data.schemaVersion === "student-classes/1" && ["current", "empty", "unavailable"].includes(data.availability) && typeof data.enrolled === "boolean" && (data.today == null || /^\d{4}-\d{2}-\d{2}$/.test(data.today)) &&
    Array.isArray(data.classes) && data.classes.every((row: any) => row && text(row.classId) && text(row.name) && text(row.subject) && classTarget(row.href) &&
      (row.grade == null || Number.isInteger(row.grade)) && nullableText(row.teacherName) && nullableText(row.schoolName) &&
      Number.isInteger(row.openAssignmentCount) && row.openAssignmentCount >= 0 && typeof row.timetableConfigured === "boolean" &&
      (row.currentUnit == null || text(row.currentUnit.title) && typeof row.currentUnit.href === "string") &&
      (row.nextClass == null || text(row.nextClass.dayName) && text(row.nextClass.periodLabel)) &&
      (row.nextWork == null || text(row.nextWork.title) && typeof row.nextWork.href === "string"));
}

export function subjectLabel(subject: string) {
  return subject.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

export const PERIOD_STATE_LABEL: Record<PeriodState, string> = { current: "Now", upcoming: "Upcoming", completed: "Ended", time_unknown: "Time not set" };

/** "Today", "Tomorrow" or a short weekday date, from the school-local date the server sent. */
export function dayLabel(date: string, today: string, dayName?: string) {
  if (date === today) return "Today";
  const next = new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  if (date === next) return "Tomorrow";
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleDateString("en-LR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }) : dayName ?? date;
}

export function nextClassLabel(next: ClassNext, today: string) {
  const when = next.state === "current" ? "Now" : dayLabel(next.date, today, next.dayName);
  return `${when} · ${next.periodLabel}${next.timeRange ? ` · ${next.timeRange}` : ""}`;
}

export function classMeta(row: { subject: string; grade: number | null }) {
  return [subjectLabel(row.subject), row.grade != null ? `Grade ${row.grade}` : null].filter(Boolean).join(" · ");
}
