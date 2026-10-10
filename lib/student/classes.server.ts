import type { Weekday } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isAssignmentVisibleToStudent, listAssignmentTargeting } from "@/lib/assignments/targeting";
import { displayLesson, DISCOVERY_LIMIT, listAuthorizedLearnerContent } from "@/lib/student/learnDiscovery.server";
import { loadStudentClasses, type StudentReaderUser } from "@/lib/student/enrollmentReadModel";
import { loadStudentSchedule } from "@/lib/student/scheduleReadModel";
import { deriveUnitName } from "@/lib/student/unitSequence";

/**
 * Bounded presentation composition for the student My Classes, class detail and
 * class schedule pages. It never decides membership itself:
 *
 * - Membership, own-school scope, academic-year status and teacher identity come
 *   from `loadStudentClasses` (enrollmentReadModel). A teacher name is projected
 *   only when the authority returned it for the learner's own school.
 * - Recurring periods and dated scheduled work come from `loadStudentSchedule`
 *   (scheduleReadModel), including its lesson-action authorization.
 * - Class lessons, resources and assignments are read per exact enrolled class
 *   and each still passes the shared learner content gates and assignment
 *   targeting. Grade and subject never authorize content.
 *
 * Display-only: nothing here writes learning state.
 */

type Authorized = Awaited<ReturnType<typeof listAuthorizedLearnerContent>>[number];

const WEEKDAYS: Weekday[] = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DEFAULT_TIMEZONE = "Africa/Monrovia";
const DAY_MS = 86_400_000;
// Same rule as the schedule authority: suggested or dismissed work is not on a learner's plan.
const CONFIRMED_WORK = [{ status: null }, { status: "confirmed" }];

// ---------------------------------------------------------------------------
// School-local time. The timetable is weekly and its times are school-local.

/** Today's date (YYYY-MM-DD) and minutes since midnight in the school's timezone. */
export function schoolClock(now: Date, timeZone: string) {
  let zone = timeZone;
  try { new Intl.DateTimeFormat("en-CA", { timeZone: zone }); } catch { zone = DEFAULT_TIMEZONE; }
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(now).map((part) => [part.type, part.value]));
  return { timeZone: zone, date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}
type Clock = ReturnType<typeof schoolClock>;

const dayIndex = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
const dateOf = (value: Date | string) => new Date(value).toISOString().slice(0, 10);

export function clockMinutes(value: string | null | undefined) {
  const match = typeof value === "string" ? /^(\d{1,2}):(\d{2})$/.exec(value.trim()) : null;
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function timeRange(start: string | null, end: string | null) {
  const label = (value: string | null) => {
    const minutes = clockMinutes(value);
    if (minutes == null) return null;
    const hours = Math.floor(minutes / 60);
    return `${hours % 12 === 0 ? 12 : hours % 12}:${String(minutes % 60).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
  };
  const [from, to] = [label(start), label(end)];
  return from && to ? `${from} – ${to}` : from ?? null;
}

export type PeriodState = "completed" | "current" | "upcoming" | "time_unknown";

/** Whether a period has ended, is happening, or is still ahead — never whether work was done. */
export function periodState(date: string, today: string, nowMinutes: number, start: string | null, end: string | null): PeriodState {
  if (date < today) return "completed";
  if (date > today) return "upcoming";
  const [from, to] = [clockMinutes(start), clockMinutes(end)];
  if (from == null) return "time_unknown";
  if (nowMinutes < from) return "upcoming";
  if (to == null) return nowMinutes === from ? "current" : "time_unknown";
  return nowMinutes < to ? "current" : "completed";
}

/** "Period 3", "P3" or "3" → 3. Anything else has no reliable period number. */
export function periodNumberOf(label: string) {
  const match = /^\s*(?:period|p)?\s*(\d{1,2})\s*$/i.exec(label);
  return match ? Number(match[1]) : null;
}

type MatchablePeriod = { id: string; classId: string; periodLabel: string; startTime: string | null };
type MatchableWork = { classId: string; periodNumber: number | null; startTime: string | null };

/**
 * Attaches dated work to one timetable period only when the match is unambiguous.
 * `periods` must already be the periods of the work's own calendar day. There is no
 * stored timetable relation on scheduled work, so identity is the exact class plus
 * a unique period number and/or a unique normalized start time. When both are given
 * they must name the same single period. Anything else stays unattached.
 */
export function matchPeriod(work: MatchableWork, periods: MatchablePeriod[]): string | null {
  const candidates = periods.filter((period) => period.classId === work.classId);
  const start = clockMinutes(work.startTime);
  const byNumber = work.periodNumber != null ? candidates.filter((period) => periodNumberOf(period.periodLabel) === work.periodNumber) : null;
  const byStart = start != null ? candidates.filter((period) => clockMinutes(period.startTime) === start) : null;
  if (!byNumber && !byStart) return null;
  if ((byNumber && byNumber.length !== 1) || (byStart && byStart.length !== 1)) return null;
  if (byNumber && byStart && byNumber[0].id !== byStart[0].id) return null;
  return (byNumber ?? byStart)![0].id;
}

// ---------------------------------------------------------------------------
// Enrollment context: membership and teacher identity from the authority only.

async function loadContext(user: StudentReaderUser, classId?: string) {
  if (!user.schoolId) return null;
  const [classes, school, student] = await Promise.all([
    loadStudentClasses(user, classId),
    prisma.school.findUnique({ where: { id: user.schoolId }, select: { timezone: true } }),
    prisma.student.findUnique({ where: { userId: user.id }, select: { id: true } }),
  ]);
  if (!student) return null;
  return {
    studentId: student.id, userId: user.id, schoolId: user.schoolId, timeZone: school?.timezone ?? DEFAULT_TIMEZONE,
    classes: classes.map((row) => ({ classId: row.classId, name: row.className, subject: row.subject, grade: row.grade ?? null,
      // Null unless the authority confirmed the teacher belongs to this learner's school.
      teacherName: row.teacher?.trim() || null, schoolName: row.school ?? null })),
  };
}
type Context = NonNullable<Awaited<ReturnType<typeof loadContext>>>;
type EnrolledClass = Context["classes"][number];

/** Timetable, confirmed scheduled work and visible assignments for exact enrolled classes only. */
async function loadClassWork(user: StudentReaderUser, ctx: Context, classIds: string[], today: string) {
  if (!classIds.length) return { slots: [], scheduled: [], assignments: [], byId: new Map<string, Authorized>(), completed: new Set<string>() };
  const school = ctx.schoolId;
  const day = Date.parse(`${today}T00:00:00Z`);
  const workSelect = { id: true, contentId: true, classId: true, scheduledDate: true, startTime: true, endTime: true, periodNumber: true, class: { select: { schoolId: true } } } as const;
  const [slots, scheduled, assignments] = await Promise.all([
    prisma.timetable.findMany({
      where: { schoolId: school, classId: { in: classIds }, class: { schoolId: school } },
      select: { id: true, classId: true, dayOfWeek: true, periodLabel: true, startTime: true, endTime: true, room: true },
      take: DISCOVERY_LIMIT * 2,
    }),
    prisma.scheduledWork.findMany({
      where: { classId: { in: classIds }, class: { schoolId: school }, OR: CONFIRMED_WORK, scheduledDate: { gte: new Date(day - 120 * DAY_MS), lt: new Date(day + 60 * DAY_MS) } },
      select: workSelect, orderBy: [{ scheduledDate: "asc" }, { periodNumber: "asc" }, { id: "asc" }], take: DISCOVERY_LIMIT * 3,
    }),
    prisma.assignment.findMany({
      where: { classId: { in: classIds }, Class: { schoolId: school } },
      select: { id: true, title: true, classId: true, contentId: true, scheduledWorkId: true, dueAt: true, Class: { select: { schoolId: true } },
        submissions: { where: { studentId: ctx.studentId }, select: { turnedInAt: true } } },
      orderBy: [{ dueAt: "asc" }, { id: "asc" }], take: DISCOVERY_LIMIT * 2,
    }),
  ]);
  const inClass = (classId: string) => classIds.includes(classId);
  const targeting = await listAssignmentTargeting(assignments.map((a) => a.id), { failClosed: true });
  const visible = assignments.filter((a) => inClass(a.classId) && a.Class.schoolId === school && isAssignmentVisibleToStudent(a.id, ctx.studentId, targeting));
  const linkedIds = visible.flatMap((a) => a.scheduledWorkId && !scheduled.some((s) => s.id === a.scheduledWorkId) ? [a.scheduledWorkId] : []);
  const linked = linkedIds.length ? await prisma.scheduledWork.findMany({
    where: { id: { in: linkedIds }, classId: { in: classIds }, class: { schoolId: school }, OR: CONFIRMED_WORK }, select: workSelect, take: DISCOVERY_LIMIT,
  }) : [];
  const own = [...scheduled, ...linked].filter((s) => inClass(s.classId) && s.class.schoolId === school);
  const contentIds = [...new Set([...own.map((s) => s.contentId), ...visible.flatMap((a) => a.contentId ? [a.contentId] : [])])];
  const authorized = contentIds.length ? await listAuthorizedLearnerContent(user, { contentId: { in: contentIds } }, Math.min(contentIds.length, DISCOVERY_LIMIT * 3)) : [];
  const byId = new Map(authorized.map((row) => [row.contentId, row]));
  const safe = own.filter((s) => byId.has(s.contentId));
  const progress = safe.length ? await prisma.studentProgress.findMany({
    where: { studentId: ctx.userId, scheduledWorkId: { in: safe.map((s) => s.id) }, completedAt: { not: null } },
    select: { scheduledWorkId: true },
  }) : [];
  return {
    slots: slots.filter((slot) => inClass(slot.classId)), scheduled: safe, byId,
    completed: new Set(progress.map((row) => row.scheduledWorkId)),
    assignments: visible.flatMap((a) => {
      // A linked schedule must still be accessible, in this assignment's class, with the same content.
      if (a.scheduledWorkId && !safe.some((s) => s.id === a.scheduledWorkId && s.classId === a.classId && (!a.contentId || s.contentId === a.contentId))) return [];
      const denied = Boolean(a.contentId && !byId.has(a.contentId));
      const turnedIn = a.submissions[0]?.turnedInAt ?? null;
      const overdue = !turnedIn && a.dueAt != null && a.dueAt.getTime() < Date.now();
      return [{ id: a.id, classId: a.classId, contentId: a.contentId, title: a.title, dueAt: a.dueAt?.toISOString() ?? null,
        status: turnedIn ? "submitted" as const : overdue ? "overdue" as const : "open" as const,
        state: denied ? "unavailable" as const : "open" as const, locked: denied,
        href: denied ? null : `/student/assignments/${encodeURIComponent(a.id)}`,
        ...(denied ? { reason: "This activity is not available" } : {}) }];
    }),
  };
}
type ClassWork = Awaited<ReturnType<typeof loadClassWork>>;
type Slot = { id: string; classId: string; dayOfWeek: Weekday; periodLabel: string; startTime: string | null; endTime: string | null; room: string | null };

function slotView(slot: Slot) {
  return { id: slot.id, classId: slot.classId, dayOfWeek: slot.dayOfWeek, dayName: DAY_NAMES[WEEKDAYS.indexOf(slot.dayOfWeek)],
    periodLabel: slot.periodLabel, startTime: slot.startTime ?? null, endTime: slot.endTime ?? null,
    timeRange: timeRange(slot.startTime ?? null, slot.endTime ?? null), room: slot.room ?? null };
}

const byStart = <T extends { startTime: string | null; periodLabel?: string }>(a: T, b: T) =>
  (clockMinutes(a.startTime) ?? 24 * 60) - (clockMinutes(b.startTime) ?? 24 * 60) || (a.periodLabel ?? "").localeCompare(b.periodLabel ?? "", undefined, { numeric: true });

/** The next timetable occurrence for one class, from the school's current time, within one week. */
function nextSlot(slots: Slot[], clock: Clock) {
  for (let offset = 0; offset < 8; offset++) {
    const date = addDays(clock.date, offset);
    for (const slot of slots.filter((row) => row.dayOfWeek === WEEKDAYS[dayIndex(date)]).sort(byStart)) {
      const state = periodState(date, clock.date, clock.minutes, slot.startTime, slot.endTime);
      if (offset === 0 && state !== "upcoming" && state !== "current") continue;
      return { ...slotView(slot), date, isToday: offset === 0, state };
    }
  }
  return null;
}

function nextWork(work: ClassWork, classId: string, today: string) {
  const row = work.scheduled.find((s) => s.classId === classId && dateOf(s.scheduledDate) >= today && !work.completed.has(s.id));
  if (!row) return null;
  const lesson = displayLesson(work.byId.get(row.contentId)!);
  return { scheduledWorkId: row.id, date: dateOf(row.scheduledDate), title: lesson.title, href: lesson.href };
}

/** Most recent scheduled unit up to today, else the next one. Lessons outside this class never count. */
function currentUnit(work: ClassWork, classId: string, today: string) {
  const rows = work.scheduled.filter((s) => s.classId === classId && work.byId.get(s.contentId)?.unitId);
  const pick = [...rows].reverse().find((s) => dateOf(s.scheduledDate) <= today) ?? rows.find((s) => dateOf(s.scheduledDate) > today);
  if (!pick) return null;
  const unitId = work.byId.get(pick.contentId)!.unitId!;
  const titles = rows.map((s) => work.byId.get(s.contentId)!).filter((row) => row.unitId === unitId).map((row) => displayLesson(row).title);
  return { unitId, title: deriveUnitName(unitId, null, titles), href: `/student/units/${encodeURIComponent(unitId)}` };
}

function classSummary(cls: EnrolledClass, work: ClassWork, clock: Clock) {
  const slots = work.slots.filter((slot) => slot.classId === cls.classId);
  return { ...cls, href: `/student/classes/${encodeURIComponent(cls.classId)}`,
    currentUnit: currentUnit(work, cls.classId, clock.date),
    nextClass: nextSlot(slots, clock), nextWork: nextWork(work, cls.classId, clock.date),
    timetableConfigured: slots.length > 0,
    openAssignmentCount: work.assignments.filter((a) => a.classId === cls.classId && a.status !== "submitted").length };
}

// ---------------------------------------------------------------------------
// Page read models.

export async function loadMyClasses(user: StudentReaderUser, now = new Date()) {
  const ctx = await loadContext(user);
  const clock = schoolClock(now, ctx?.timeZone ?? DEFAULT_TIMEZONE);
  const base = { schemaVersion: "student-classes/1" as const, generatedAt: now.toISOString(), timeZone: clock.timeZone, today: clock.date };
  if (!ctx || !ctx.classes.length) return { ...base, availability: "empty" as const, enrolled: false, classes: [] };
  const work = await loadClassWork(user, ctx, ctx.classes.map((c) => c.classId), clock.date);
  return { ...base, availability: "current" as const, enrolled: true, classes: ctx.classes.map((cls) => classSummary(cls, work, clock)) };
}

/** Null unless the authority confirms exact enrollment in this class. Callers answer not-found either way. */
export async function loadClassDetail(user: StudentReaderUser, classId: string, now = new Date()) {
  if (typeof classId !== "string" || !classId || classId.length > 64) return null;
  const ctx = await loadContext(user, classId);
  const cls = ctx?.classes.find((row) => row.classId === classId);
  if (!ctx || !cls) return null;
  const clock = schoolClock(now, ctx.timeZone);
  const work = await loadClassWork(user, ctx, [cls.classId], clock.date);
  const summary = classSummary(cls, work, clock);
  const slots = work.slots.map(slotView).sort((a, b) => WEEKDAYS.indexOf(a.dayOfWeek) - WEEKDAYS.indexOf(b.dayOfWeek) || byStart(a, b));
  const seen = new Set<string>();
  const entries = [...work.scheduled.map((s) => ({ contentId: s.contentId, date: dateOf(s.scheduledDate) as string | null })),
    ...work.assignments.flatMap((a) => a.contentId && !a.locked ? [{ contentId: a.contentId, date: null }] : [])];
  const linked = entries.flatMap((entry) => {
    const row = work.byId.get(entry.contentId);
    if (!row || seen.has(row.contentId)) return [];
    seen.add(row.contentId);
    const lesson = displayLesson(row);
    const completed = work.scheduled.some((s) => s.contentId === row.contentId && work.completed.has(s.id));
    return [{ contentId: row.contentId, title: lesson.title, contentType: row.contentType, unitId: row.unitId, href: lesson.href, state: "open" as const, locked: false,
      scheduledDate: entry.date, status: completed ? "completed" as const : "not_started" as const }];
  });
  const toDate = work.scheduled.filter((s) => dateOf(s.scheduledDate) <= clock.date);
  return {
    schemaVersion: "student-class/1" as const, availability: "current" as const, generatedAt: now.toISOString(), timeZone: clock.timeZone, today: clock.date,
    class: { classId: cls.classId, name: cls.name, subject: cls.subject, grade: cls.grade, teacherName: cls.teacherName, schoolName: cls.schoolName },
    currentUnit: summary.currentUnit, nextClass: summary.nextClass, nextWork: summary.nextWork,
    schedule: { configured: slots.length > 0, slots },
    assignedWork: work.assignments.map(({ classId: _c, contentId: _id, ...row }) => row),
    lessons: linked.filter((row) => row.contentType === "lesson").slice(0, DISCOVERY_LIMIT),
    resources: linked.filter((row) => row.contentType !== "lesson").slice(0, DISCOVERY_LIMIT),
    progress: { scheduledToDate: new Set(toDate.map((s) => s.id)).size, completed: toDate.filter((s) => work.completed.has(s.id)).length },
  };
}

export type ScheduleLink = { kind: "lesson"; title: string; href: string };
export type SchedulePeriod = ReturnType<typeof slotView> & { className: string; subject: string; teacherName: string | null; state: PeriodState; links: ScheduleLink[] };
export type ScheduleWork = { scheduledWorkId: string; classId: string; className: string; subject: string; periodNumber: number | null; timeRange: string | null; state: PeriodState; links: ScheduleLink[] };
export type ScheduleDay = { date: string; dayName: string; isToday: boolean; periods: SchedulePeriod[]; otherWork: ScheduleWork[] };

/**
 * This week's class schedule, composed from the schedule authority. Only work whose
 * lesson action the authority granted is shown; it sits in a period only when
 * `matchPeriod` finds exactly one, otherwise under the day's other scheduled work.
 */
export async function loadClassSchedule(user: StudentReaderUser, now = new Date()) {
  const ctx = await loadContext(user);
  const clock = schoolClock(now, ctx?.timeZone ?? DEFAULT_TIMEZONE);
  const base = { schemaVersion: "student-class-schedule/1" as const, generatedAt: now.toISOString(), timeZone: clock.timeZone, today: clock.date };
  if (!ctx || !ctx.classes.length) return { ...base, availability: "current" as const, enrolled: false, timetableConfigured: false, truncated: false, days: [] as ScheduleDay[] };
  const authority = await loadStudentSchedule(user, now);
  const classes = new Map(ctx.classes.map((c) => [c.classId, c]));
  // Both reads must agree on membership; a class missing from either is not shown.
  const periods = (authority.periods as Slot[]).filter((period) => classes.has(period.classId));
  const work = authority.scheduledWork.filter((row) => classes.has(row.classId) && row.action?.href);
  const link = (row: (typeof work)[number]): ScheduleLink => ({ kind: "lesson", title: row.title ?? "Scheduled lesson", href: row.action!.href });
  const monday = addDays(clock.date, -((dayIndex(clock.date) + 6) % 7));
  const days: ScheduleDay[] = Array.from({ length: 7 }, (_, i) => addDays(monday, i)).map((date) => {
    const weekday = WEEKDAYS[dayIndex(date)];
    const dayPeriods = periods.filter((period) => period.dayOfWeek === weekday);
    const attached = new Map<string, ScheduleLink[]>();
    const otherWork: ScheduleWork[] = [];
    for (const row of work.filter((w) => dateOf(w.scheduledDate) === date)) {
      const periodId = matchPeriod(row, dayPeriods);
      if (periodId) { attached.set(periodId, [...(attached.get(periodId) ?? []), link(row)]); continue; }
      const cls = classes.get(row.classId)!;
      otherWork.push({ scheduledWorkId: row.scheduledWorkId, classId: row.classId, className: cls.name, subject: cls.subject, periodNumber: row.periodNumber ?? null,
        timeRange: timeRange(row.startTime ?? null, row.endTime ?? null), state: periodState(date, clock.date, clock.minutes, row.startTime ?? null, row.endTime ?? null), links: [link(row)] });
    }
    return { date, dayName: DAY_NAMES[dayIndex(date)], isToday: date === clock.date, otherWork,
      periods: dayPeriods.map(slotView).sort(byStart).map((slot) => {
        const cls = classes.get(slot.classId)!;
        return { ...slot, className: cls.name, subject: cls.subject, teacherName: cls.teacherName,
          state: periodState(date, clock.date, clock.minutes, slot.startTime, slot.endTime), links: attached.get(slot.id) ?? [] };
      }) };
  });
  return { ...base, availability: "current" as const, enrolled: true, timetableConfigured: periods.length > 0, truncated: Boolean(authority.limits?.truncated),
    // Days with nothing on them are dropped, except today, so the week is never padded with invented periods.
    days: days.filter((day) => day.isToday || day.periods.length || day.otherWork.length) };
}

export type MyClassesReadModel = Awaited<ReturnType<typeof loadMyClasses>>;
export type ClassDetailReadModel = NonNullable<Awaited<ReturnType<typeof loadClassDetail>>>;
export type ScheduleReadModel = Awaited<ReturnType<typeof loadClassSchedule>>;

/** A slow display read is unavailable, never a successful empty answer. */
export async function withReadTimeout<T>(read: Promise<T>, ms = 8_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([read, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Read unavailable")), ms); })]);
  } finally { if (timer) clearTimeout(timer); }
}
