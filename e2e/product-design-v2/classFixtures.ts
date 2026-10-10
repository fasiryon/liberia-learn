/**
 * Explicit fixtures for the My Classes, class detail and class schedule pages, shaped like the
 * server composition in lib/student/classes.server.ts. They certify layout and presentation
 * only; enrollment, tenant and content authorization are covered by server tests.
 */
import type { ClassDetailReadModel, ScheduleDay, ScheduleReadModel } from "../../lib/student/classes.server";
import type { MyClasses } from "../../components/student/classes/classesPresentation";

const TODAY = "2026-10-09";
const next = (periodLabel: string, timeRange: string, date = TODAY, dayName = "Friday", state = "upcoming" as const) => ({ date, dayName, periodLabel, timeRange, isToday: date === TODAY, state });
const klass = (classId: string, name: string, subject: string, teacherName: string | null, extra: Partial<MyClasses["classes"][number]> = {}) => ({
  classId, name, subject, grade: 6, teacherName, schoolName: "Monrovia Central Public School", href: `/student/classes/${classId}`,
  currentUnit: null, nextClass: null, nextWork: null, timetableConfigured: true, openAssignmentCount: 0, ...extra });

export const myClassesFixture: MyClasses & { today: string } = { schemaVersion: "student-classes/1", availability: "current", enrolled: true, today: TODAY, classes: [
  klass("fixture-math", "Grade 6A Mathematics", "MATH", "Mr. Joseph Kollie", { currentUnit: { unitId: "u-frac", title: "Fractions and decimals", href: "/student/units/u-frac" }, nextClass: next("Period 2", "9:00 AM – 9:45 AM"), nextWork: { date: TODAY, title: "Tenths and hundredths", href: "/student/lesson/c-2" }, openAssignmentCount: 2 }),
  klass("fixture-english", "Grade 6A English", "ENGLISH", "Mrs. Musu Flomo", { currentUnit: { unitId: "u-read", title: "Reading for meaning", href: "/student/units/u-read" }, nextClass: next("Period 3", "10:00 AM – 10:45 AM"), openAssignmentCount: 1 }),
  klass("fixture-science", "Grade 6A General Science", "SCIENCE", "Mr. Emmanuel Doe", { nextClass: next("Period 1", "8:00 AM – 8:45 AM", "2026-10-12", "Monday"), nextWork: { date: "2026-10-12", title: "States of matter", href: "/student/lesson/c-9" } }),
  // The authority withheld this class's teacher (no own-school teacher); the page states it as missing.
  klass("fixture-social", "Grade 6A Social Studies", "SOCIAL_STUDIES", null, { timetableConfigured: false }),
] };

const slot = (id: string, dayOfWeek: "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY", dayName: string, periodLabel: string, startTime: string, endTime: string, timeRange: string) =>
  ({ id, classId: "fixture-math", dayOfWeek, dayName, periodLabel, startTime, endTime, timeRange, room: "6A" });
export const classDetailFixture = (timetable = true): ClassDetailReadModel => ({
  schemaVersion: "student-class/1", availability: "current", generatedAt: `${TODAY}T08:30:00Z`, timeZone: "Africa/Monrovia", today: TODAY,
  class: { classId: "fixture-math", name: "Grade 6A Mathematics", subject: "MATH", grade: 6, teacherName: "Mr. Joseph Kollie", schoolName: "Monrovia Central Public School" },
  currentUnit: { unitId: "u-frac", title: "Fractions and decimals", href: "/student/units/u-frac" },
  nextClass: timetable ? { ...slot("t5", "FRIDAY", "Friday", "Period 2", "09:00", "09:45", "9:00 AM – 9:45 AM"), date: TODAY, isToday: true, state: "upcoming" } : null,
  nextWork: { scheduledWorkId: "sw-2", date: TODAY, title: "Tenths and hundredths", href: "/student/lesson/c-2" },
  schedule: { configured: timetable, slots: timetable ? [slot("t1", "MONDAY", "Monday", "Period 1", "08:00", "08:45", "8:00 AM – 8:45 AM"), slot("t2", "TUESDAY", "Tuesday", "Period 2", "09:00", "09:45", "9:00 AM – 9:45 AM"),
    slot("t3", "WEDNESDAY", "Wednesday", "Period 1", "08:00", "08:45", "8:00 AM – 8:45 AM"), slot("t4", "THURSDAY", "Thursday", "Period 4", "11:00", "11:45", "11:00 AM – 11:45 AM"),
    slot("t5", "FRIDAY", "Friday", "Period 2", "09:00", "09:45", "9:00 AM – 9:45 AM")] : [] },
  assignedWork: [
    { id: "a-1", title: "Fraction practice set", dueAt: "2026-10-10T17:00:00Z", status: "open", state: "open", locked: false, href: "/student/assignments/a-1" },
    { id: "a-2", title: "Decimals worksheet", dueAt: "2026-10-08T17:00:00Z", status: "overdue", state: "open", locked: false, href: "/student/assignments/a-2" },
    { id: "a-3", title: "Locked practice", dueAt: null, status: "open", state: "unavailable", locked: true, href: null, reason: "This activity is not available" },
    { id: "a-0", title: "Place value quiz", dueAt: "2026-10-01T17:00:00Z", status: "submitted", state: "open", locked: false, href: "/student/assignments/a-0" }],
  lessons: [
    { contentId: "c-1", title: "Comparing fractions", contentType: "lesson", unitId: "u-frac", href: "/student/lesson/c-1", state: "open", locked: false, scheduledDate: "2026-10-05", status: "completed" },
    { contentId: "c-2", title: "Tenths and hundredths", contentType: "lesson", unitId: "u-frac", href: "/student/lesson/c-2", state: "open", locked: false, scheduledDate: TODAY, status: "not_started" },
    { contentId: "c-4", title: "Adding decimals", contentType: "lesson", unitId: "u-frac", href: "/student/lesson/c-4", state: "open", locked: false, scheduledDate: "2026-10-14", status: "not_started" }],
  resources: [{ contentId: "r-1", title: "Grade 6 Mathematics reader", contentType: "full_pack", unitId: null, href: "/student/lesson/r-1", state: "open", locked: false, scheduledDate: null, status: "not_started" }],
  progress: { scheduledToDate: 2, completed: 1 },
});

type Period = ScheduleDay["periods"][number];
const period = (id: string, periodLabel: string, startTime: string, timeRange: string, classId: string, className: string, subject: string, teacherName: string | null, state: Period["state"], links: Period["links"] = []): Period =>
  ({ id, classId, dayOfWeek: "FRIDAY", dayName: "Friday", periodLabel, startTime, endTime: null, timeRange, room: null, className, subject, teacherName, state, links });
const friday: Period[] = [
  period("f1", "Period 1", "08:00", "8:00 AM – 8:45 AM", "fixture-english", "Grade 6A English", "ENGLISH", "Mrs. Musu Flomo", "completed"),
  period("f2", "Period 2", "09:00", "9:00 AM – 9:45 AM", "fixture-math", "Grade 6A Mathematics", "MATH", "Mr. Joseph Kollie", "current", [{ kind: "lesson", title: "Tenths and hundredths", href: "/student/work/sw-2" }]),
  period("f3", "Period 3", "10:00", "10:00 AM – 10:45 AM", "fixture-science", "Grade 6A General Science", "SCIENCE", "Mr. Emmanuel Doe", "upcoming"),
  period("f4", "Period 4", "11:00", "11:00 AM – 11:45 AM", "fixture-social", "Grade 6A Social Studies", "SOCIAL_STUDIES", null, "upcoming")];
const weekDay = (date: string, dayName: string, periods: Period[]): ScheduleDay => ({ date, dayName, isToday: date === TODAY, otherWork: [],
  periods: periods.map((p) => ({ ...p, dayName, state: date < TODAY ? "completed" : date > TODAY ? "upcoming" : p.state, links: date === TODAY ? p.links : [] })) });
const base = { schemaVersion: "student-class-schedule/1" as const, generatedAt: `${TODAY}T08:30:00Z`, timeZone: "Africa/Monrovia", today: TODAY, availability: "current" as const, enrolled: true, truncated: false };
export const scheduleFixture = (timetable = true): ScheduleReadModel => timetable
  ? { ...base, timetableConfigured: true, days: [weekDay("2026-10-05", "Monday", friday.slice(0, 3)), weekDay("2026-10-06", "Tuesday", friday.slice(1, 4)), weekDay("2026-10-07", "Wednesday", friday.slice(0, 3)), weekDay("2026-10-08", "Thursday", friday), weekDay(TODAY, "Friday", friday)] }
  // Ambiguous or unmatched work is never forced into a period: it is listed as other scheduled work.
  : { ...base, timetableConfigured: false, days: [{ date: TODAY, dayName: "Friday", isToday: true, periods: [], otherWork: [{ scheduledWorkId: "sw-2", classId: "fixture-math", className: "Grade 6A Mathematics", subject: "MATH", periodNumber: null, timeRange: null, state: "time_unknown", links: [{ kind: "lesson", title: "Tenths and hundredths", href: "/student/work/sw-2" }] }] }] };
