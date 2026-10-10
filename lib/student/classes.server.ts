import type { Weekday } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isAssignmentVisibleToStudent, listAssignmentTargeting } from "@/lib/assignments/targeting";
import { displayLesson, DISCOVERY_LIMIT, listAuthorizedLearnerContent } from "@/lib/student/learnDiscovery.server";
import { deriveUnitName } from "@/lib/student/unitSequence";

/**
 * Student classes and class schedule read models. Class membership comes only
 * from the learner's own enrollments in classes of their own school; lessons,
 * resources and linked work are limited to content attached to those classes
 * and still pass the shared learner eligibility gates. Display-only: nothing
 * here writes learning state, ranks, or decides access beyond what it hides.
 */

type Learner = { id: string; schoolId?: string | null };
type Authorized = Awaited<ReturnType<typeof listAuthorizedLearnerContent>>[number];

const WEEKDAYS: Weekday[] = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DEFAULT_TIMEZONE = "Africa/Monrovia";
const DAY_MS = 86_400_000;

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

const dayIndex = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
const dateOf = (value: Date) => value.toISOString().slice(0, 10);

export function clockMinutes(value: string | null | undefined) {
  const match = typeof value === "string" ? /^(\d{1,2}):(\d{2})$/.exec(value.trim()) : null;
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return Number(match[1]) < 24 && Number(match[2]) < 60 ? minutes : null;
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

const periodNumber = (label: string) => {
  const match = /(?:period|p)\s*(\d+)/i.exec(label) ?? /^\s*(\d+)\s*$/.exec(label);
  return match ? Number(match[1]) : null;
};

// ---------------------------------------------------------------------------
// Enrollment context: the only source of class membership.

async function loadEnrollmentContext(user: Learner) {
  if (!user.schoolId) return null;
  const student = await prisma.student.findUnique({
    where: { userId: user.id },
    select: { id: true, deletedAt: true, user: { select: { schoolId: true, school: { select: { name: true, timezone: true } } } } },
  });
  if (!student || student.deletedAt || student.user.schoolId !== user.schoolId) return null;
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId: student.id, Class: { schoolId: user.schoolId } },
    select: { classId: true, Class: { select: {
      id: true, name: true, subject: true, gradeLevel: true, schoolId: true, Teacher: { select: { name: true } },
      teacherAssignments: { where: { schoolId: user.schoolId, isPrimary: true }, select: { teacher: { select: { name: true } } }, take: 1 },
    } } },
    orderBy: [{ Class: { name: "asc" } }, { classId: "asc" }],
  });
  // Defense in depth: a class from another school is never a membership, whatever the filter returned.
  const classes = enrollments.filter((row) => row.Class.schoolId === user.schoolId).map((row) => ({
    classId: row.Class.id, name: row.Class.name, subject: String(row.Class.subject), grade: row.Class.gradeLevel ?? null,
    teacherName: row.Class.Teacher?.name?.trim() || row.Class.teacherAssignments[0]?.teacher.name?.trim() || null,
  }));
  return { studentId: student.id, userId: user.id, schoolId: user.schoolId, schoolName: student.user.school?.name ?? null,
    timeZone: student.user.school?.timezone ?? DEFAULT_TIMEZONE, classes };
}
type EnrollmentContext = NonNullable<Awaited<ReturnType<typeof loadEnrollmentContext>>>;
type EnrolledClass = EnrollmentContext["classes"][number];

/** Timetable slots, scheduled work and visible assignments for the given enrolled classes only. */
async function loadClassWork(user: Learner, ctx: EnrollmentContext, classIds: string[], today: string) {
  if (!classIds.length) return { slots: [], scheduled: [], assignments: [], byId: new Map<string, Authorized>(), completed: new Set<string>() };
  const school = ctx.schoolId;
  const [slots, scheduled, assignments] = await Promise.all([
    prisma.timetable.findMany({
      where: { schoolId: school, classId: { in: classIds }, class: { schoolId: school } },
      select: { id: true, classId: true, subject: true, dayOfWeek: true, periodLabel: true, startTime: true, endTime: true, room: true, teacher: { select: { name: true } } },
      take: DISCOVERY_LIMIT * 2,
    }),
    prisma.scheduledWork.findMany({
      where: { classId: { in: classIds }, class: { schoolId: school }, scheduledDate: { gte: new Date(Date.parse(`${today}T00:00:00Z`) - 120 * DAY_MS), lt: new Date(Date.parse(`${today}T00:00:00Z`) + 60 * DAY_MS) } },
      select: { id: true, contentId: true, classId: true, scheduledDate: true, startTime: true, endTime: true, periodNumber: true, status: true, class: { select: { schoolId: true } } },
      orderBy: [{ scheduledDate: "asc" }, { periodNumber: "asc" }, { id: "asc" }], take: DISCOVERY_LIMIT * 3,
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
  const linkedScheduleIds = visible.flatMap((a) => a.scheduledWorkId && !scheduled.some((s) => s.id === a.scheduledWorkId) ? [a.scheduledWorkId] : []);
  const linkedSchedules = linkedScheduleIds.length ? await prisma.scheduledWork.findMany({
    where: { id: { in: linkedScheduleIds }, classId: { in: classIds }, class: { schoolId: school } },
    select: { id: true, contentId: true, classId: true, scheduledDate: true, startTime: true, endTime: true, periodNumber: true, status: true, class: { select: { schoolId: true } } },
    take: DISCOVERY_LIMIT,
  }) : [];
  const ownScheduled = [...scheduled, ...linkedSchedules].filter((s) => inClass(s.classId) && s.class.schoolId === school && s.status !== "dismissed");
  const contentIds = [...new Set([...ownScheduled.map((s) => s.contentId), ...visible.flatMap((a) => a.contentId ? [a.contentId] : [])])];
  const authorized = contentIds.length ? await listAuthorizedLearnerContent(user, { contentId: { in: contentIds } }, Math.min(contentIds.length, DISCOVERY_LIMIT * 3)) : [];
  const byId = new Map(authorized.map((row) => [row.contentId, row]));
  const safeScheduled = ownScheduled.filter((s) => byId.has(s.contentId));
  const progress = safeScheduled.length ? await prisma.studentProgress.findMany({
    where: { studentId: ctx.userId, scheduledWorkId: { in: safeScheduled.map((s) => s.id) }, completedAt: { not: null } },
    select: { scheduledWorkId: true },
  }) : [];
  return {
    slots: slots.filter((slot) => inClass(slot.classId)), scheduled: safeScheduled, byId,
    completed: new Set(progress.map((row) => row.scheduledWorkId)),
    assignments: visible.flatMap((a) => {
      // A linked schedule must still be accessible, in this assignment's class, with the same content.
      if (a.scheduledWorkId && !safeScheduled.some((s) => s.id === a.scheduledWorkId && s.classId === a.classId && (!a.contentId || s.contentId === a.contentId))) return [];
      const denied = Boolean(a.contentId && !byId.has(a.contentId));
      const turnedIn = a.submissions[0]?.turnedInAt ?? null;
      const overdue = !turnedIn && a.dueAt != null && a.dueAt.getTime() < Date.now();
      return [{ id: a.id, classId: a.classId, contentId: a.contentId, title: a.title, dueAt: a.dueAt?.toISOString() ?? null, scheduledWorkId: a.scheduledWorkId,
        status: turnedIn ? "submitted" as const : overdue ? "overdue" as const : "open" as const,
        state: denied ? "unavailable" as const : "open" as const, locked: denied,
        href: denied ? null : `/student/assignments/${encodeURIComponent(a.id)}`,
        ...(denied ? { reason: "This activity is not available" } : {}) }];
    }),
  };
}
type ClassWork = Awaited<ReturnType<typeof loadClassWork>>;
type Slot = ClassWork["slots"][number];

function slotView(slot: Slot) {
  return { id: slot.id, classId: slot.classId, dayOfWeek: slot.dayOfWeek, dayName: DAY_NAMES[WEEKDAYS.indexOf(slot.dayOfWeek)],
    periodLabel: slot.periodLabel, startTime: slot.startTime ?? null, endTime: slot.endTime ?? null,
    timeRange: timeRange(slot.startTime ?? null, slot.endTime ?? null), room: slot.room ?? null, teacherName: slot.teacher?.name?.trim() || null };
}

const byStart = <T extends { startTime: string | null; periodLabel?: string }>(a: T, b: T) =>
  (clockMinutes(a.startTime) ?? 24 * 60) - (clockMinutes(b.startTime) ?? 24 * 60) || (a.periodLabel ?? "").localeCompare(b.periodLabel ?? "", undefined, { numeric: true });

/** The next timetable occurrence for one class, from the school's current time, within one week. */
function nextSlot(slots: Slot[], clock: ReturnType<typeof schoolClock>) {
  for (let offset = 0; offset < 8; offset++) {
    const date = addDays(clock.date, offset);
    const day = slots.filter((slot) => slot.dayOfWeek === WEEKDAYS[dayIndex(date)]).sort(byStart);
    for (const slot of day) {
      const state = periodState(date, clock.date, clock.minutes, slot.startTime ?? null, slot.endTime ?? null);
      if (offset === 0 && state !== "upcoming" && state !== "current") continue;
      return { ...slotView(slot), date, isToday: offset === 0, state };
    }
  }
  return null;
}

function nextWork(work: ClassWork, classId: string, today: string) {
  const row = work.scheduled.find((s) => s.classId === classId && dateOf(s.scheduledDate) >= today && !work.completed.has(s.id));
  if (!row) return null;
  const content = work.byId.get(row.contentId)!;
  return { scheduledWorkId: row.id, date: dateOf(row.scheduledDate), title: displayLesson(content).title, href: displayLesson(content).href };
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

function classSummary(cls: EnrolledClass, ctx: EnrollmentContext, work: ClassWork, clock: ReturnType<typeof schoolClock>) {
  const slots = work.slots.filter((slot) => slot.classId === cls.classId);
  return { ...cls, schoolName: ctx.schoolName, href: `/student/classes/${encodeURIComponent(cls.classId)}`,
    currentUnit: currentUnit(work, cls.classId, clock.date),
    nextClass: nextSlot(slots, clock), nextWork: nextWork(work, cls.classId, clock.date),
    timetableConfigured: slots.length > 0,
    openAssignmentCount: work.assignments.filter((a) => a.classId === cls.classId && a.status !== "submitted").length };
}

// ---------------------------------------------------------------------------
// Public read models.

export function unavailableClasses() {
  return { schemaVersion: "student-classes/1" as const, availability: "unavailable" as const, generatedAt: new Date().toISOString(), enrolled: false, classes: [] };
}

export async function loadMyClasses(user: Learner, now = new Date()) {
  const ctx = await loadEnrollmentContext(user);
  if (!ctx) return { ...unavailableClasses(), availability: "restricted" as const };
  const clock = schoolClock(now, ctx.timeZone);
  const work = await loadClassWork(user, ctx, ctx.classes.map((c) => c.classId), clock.date);
  const classes = ctx.classes.map((cls) => classSummary(cls, ctx, work, clock));
  return { ...unavailableClasses(), availability: classes.length ? "current" as const : "empty" as const, enrolled: classes.length > 0, timeZone: clock.timeZone, today: clock.date, classes };
}

/** Null unless the learner is enrolled in this class at their own school. Callers answer 404 either way. */
export async function loadClassDetail(user: Learner, classId: string, now = new Date()) {
  if (typeof classId !== "string" || !classId || classId.length > 64) return null;
  const ctx = await loadEnrollmentContext(user);
  const cls = ctx?.classes.find((row) => row.classId === classId);
  if (!ctx || !cls) return null;
  const clock = schoolClock(now, ctx.timeZone);
  const work = await loadClassWork(user, ctx, [cls.classId], clock.date);
  const summary = classSummary(cls, ctx, work, clock);
  const slots = work.slots.map(slotView).sort((a, b) => WEEKDAYS.indexOf(a.dayOfWeek) - WEEKDAYS.indexOf(b.dayOfWeek) || byStart(a, b));
  const seen = new Set<string>();
  const entries = [...work.scheduled.map((s) => ({ contentId: s.contentId, scheduledWorkId: s.id as string | null, date: dateOf(s.scheduledDate) as string | null })),
    ...work.assignments.flatMap((a) => a.contentId && !a.locked ? [{ contentId: a.contentId, scheduledWorkId: a.scheduledWorkId, date: null }] : [])];
  const linked = entries.flatMap((entry) => {
    const row = work.byId.get(entry.contentId);
    if (!row || seen.has(row.contentId)) return [];
    seen.add(row.contentId);
    const lesson = displayLesson(row);
    const completed = work.scheduled.some((s) => s.contentId === row.contentId && work.completed.has(s.id));
    return [{ contentId: row.contentId, title: lesson.title, contentType: row.contentType, unitId: row.unitId, href: lesson.href, state: "open" as const, locked: false,
      scheduledDate: entry.date, status: completed ? "completed" as const : "not_started" as const }];
  });
  const scheduledToDate = work.scheduled.filter((s) => dateOf(s.scheduledDate) <= clock.date);
  return {
    schemaVersion: "student-class/1" as const, availability: "current" as const, generatedAt: new Date().toISOString(), timeZone: clock.timeZone, today: clock.date,
    class: { classId: cls.classId, name: cls.name, subject: cls.subject, grade: cls.grade, teacherName: cls.teacherName, schoolName: ctx.schoolName },
    currentUnit: summary.currentUnit, nextClass: summary.nextClass, nextWork: summary.nextWork,
    schedule: { configured: slots.length > 0, slots },
    assignedWork: work.assignments.map(({ classId: _c, scheduledWorkId: _s, contentId: _id, ...row }) => row),
    lessons: linked.filter((row) => row.contentType === "lesson").slice(0, DISCOVERY_LIMIT),
    resources: linked.filter((row) => row.contentType !== "lesson").slice(0, DISCOVERY_LIMIT),
    progress: { scheduledToDate: new Set(scheduledToDate.map((s) => s.id)).size, completed: scheduledToDate.filter((s) => work.completed.has(s.id)).length },
  };
}

export async function loadStudentSchedule(user: Learner, now = new Date()) {
  const ctx = await loadEnrollmentContext(user);
  if (!ctx) return { schemaVersion: "student-schedule/1" as const, availability: "restricted" as const, generatedAt: new Date().toISOString(), enrolled: false, timetableConfigured: false, days: [] as ScheduleDay[] };
  const clock = schoolClock(now, ctx.timeZone);
  const classIds = ctx.classes.map((c) => c.classId);
  const work = await loadClassWork(user, ctx, classIds, clock.date);
  const classes = new Map(ctx.classes.map((c) => [c.classId, c]));
  // Week of today (Monday first). The timetable repeats weekly; dated links are per day.
  const monday = addDays(clock.date, -((dayIndex(clock.date) + 6) % 7));
  const dates = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const slotIds = work.slots.map((slot) => slot.id);
  const dated = slotIds.length ? await prisma.timetableAssignment.findMany({
    where: { timetableId: { in: slotIds }, assignedDate: { gte: new Date(`${dates[0]}T00:00:00Z`), lte: new Date(`${dates[6]}T00:00:00Z`) }, timetable: { schoolId: ctx.schoolId, classId: { in: classIds } } },
    select: { timetableId: true, assignedDate: true, title: true, curriculumContentId: true },
  }) : [];
  const datedIds = [...new Set(dated.flatMap((row) => row.curriculumContentId ? [row.curriculumContentId] : []))].filter((id) => !work.byId.has(id));
  for (const row of datedIds.length ? await listAuthorizedLearnerContent(user, { contentId: { in: datedIds } }, datedIds.length) : []) work.byId.set(row.contentId, row);

  const days: ScheduleDay[] = dates.map((date) => {
    const weekday = WEEKDAYS[dayIndex(date)];
    const used = new Set<string>();
    const dayWork = work.scheduled.filter((s) => dateOf(s.scheduledDate) === date);
    const lessonLink = (contentId: string) => { const row = work.byId.get(contentId); return row ? { kind: "lesson" as const, title: displayLesson(row).title, href: displayLesson(row).href } : null; };
    const assignmentLinks = (scheduledWorkId: string) => work.assignments.filter((a) => a.scheduledWorkId === scheduledWorkId && a.href).map((a) => ({ kind: "assignment" as const, title: a.title, href: a.href! }));
    const periods = work.slots.filter((slot) => slot.dayOfWeek === weekday).map(slotView).sort(byStart).map((slot) => {
      const number = periodNumber(slot.periodLabel);
      const matched = dayWork.filter((s) => s.classId === slot.classId && !used.has(s.id) &&
        ((number != null && s.periodNumber === number) || (slot.startTime != null && s.startTime === slot.startTime)));
      matched.forEach((s) => used.add(s.id));
      const plan = dated.find((row) => row.timetableId === slot.id && dateOf(row.assignedDate) === date);
      const planLink = plan?.curriculumContentId ? lessonLink(plan.curriculumContentId) : null;
      const links = [...(planLink ? [planLink] : []), ...matched.flatMap((s) => [lessonLink(s.contentId)!, ...assignmentLinks(s.id)])]
        .filter((link, index, all) => all.findIndex((other) => other.href === link.href) === index);
      const cls = classes.get(slot.classId)!;
      return { ...slot, className: cls.name, subject: cls.subject, teacherName: slot.teacherName ?? cls.teacherName,
        state: periodState(date, clock.date, clock.minutes, slot.startTime, slot.endTime),
        // A planned title whose lesson is not available to this learner is shown as a plan, never linked.
        plannedTitle: plan && !planLink ? plan.title : null, links };
    });
    const otherWork = dayWork.filter((s) => !used.has(s.id)).map((s) => {
      const cls = classes.get(s.classId)!;
      return { scheduledWorkId: s.id, classId: s.classId, className: cls.name, subject: cls.subject, periodNumber: s.periodNumber ?? null,
        timeRange: timeRange(s.startTime ?? null, s.endTime ?? null),
        state: periodState(date, clock.date, clock.minutes, s.startTime ?? null, s.endTime ?? null),
        status: work.completed.has(s.id) ? "completed" as const : "not_started" as const,
        links: [lessonLink(s.contentId)!, ...assignmentLinks(s.id)] };
    });
    return { date, dayName: DAY_NAMES[dayIndex(date)], isToday: date === clock.date, periods, otherWork };
  });
  const timetableConfigured = work.slots.length > 0;
  return { schemaVersion: "student-schedule/1" as const, availability: "current" as const, generatedAt: new Date().toISOString(),
    timeZone: clock.timeZone, today: clock.date, enrolled: ctx.classes.length > 0, timetableConfigured,
    // Days with nothing on them are dropped, except today, so the week is never padded with invented periods.
    days: days.filter((day) => day.isToday || day.periods.length || day.otherWork.length) };
}

export type ScheduleLink = { kind: "lesson" | "assignment"; title: string; href: string };
export type ScheduleDay = {
  date: string; dayName: string; isToday: boolean;
  periods: Array<ReturnType<typeof slotView> & { className: string; subject: string; state: PeriodState; plannedTitle: string | null; links: ScheduleLink[] }>;
  otherWork: Array<{ scheduledWorkId: string; classId: string; className: string; subject: string; periodNumber: number | null; timeRange: string | null; state: PeriodState; status: "completed" | "not_started"; links: ScheduleLink[] }>;
};
export type MyClassesReadModel = Awaited<ReturnType<typeof loadMyClasses>>;
export type ClassDetailReadModel = NonNullable<Awaited<ReturnType<typeof loadClassDetail>>>;
export type ScheduleReadModel = Awaited<ReturnType<typeof loadStudentSchedule>>;

/** A slow display read is unavailable, never a successful empty answer. */
export async function withReadTimeout<T>(read: Promise<T>, ms = 8_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([read, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Read unavailable")), ms); })]);
  } finally { if (timer) clearTimeout(timer); }
}
