// Student My Classes, class detail and class schedule: membership comes only from the learner's
// own enrollments at their own school, class content is scoped to that class, and the schedule
// uses real timetable rows. The fake database evaluates the Prisma `where` filters each query sends.
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, any>;
const db = vi.hoisted(() => ({ tables: {} as Record<string, Row[]> }));
const requireRole = vi.hoisted(() => vi.fn());
const authorized = vi.hoisted(() => ({ ids: new Set<string>() }));

function matches(row: any, where: any): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, condition]: [string, any]) => {
    if (key === "AND") return condition.every((part: any) => matches(row, part));
    if (key === "OR") return condition.some((part: any) => matches(row, part));
    const value = row?.[key];
    if (condition === null || typeof condition !== "object" || condition instanceof Date) return value instanceof Date ? value.getTime() === (condition as Date).getTime() : value === condition;
    if ("in" in condition) return condition.in.includes(value);
    if ("not" in condition) return condition.not === null ? value != null : value !== condition.not;
    if ("gte" in condition || "lt" in condition || "lte" in condition) {
      const time = value instanceof Date ? value.getTime() : NaN;
      return (!condition.gte || time >= condition.gte.getTime()) && (!condition.lt || time < condition.lt.getTime()) && (!condition.lte || time <= condition.lte.getTime());
    }
    return value != null && matches(value, condition);
  });
}
const table = (name: string) => ({
  findMany: async ({ where }: any = {}) => (db.tables[name] ?? []).filter((row) => matches(row, where)),
  findUnique: async ({ where }: any) => (db.tables[name] ?? []).find((row) => matches(row, where)) ?? null,
});

vi.mock("@/lib/db", () => ({ prisma: new Proxy({}, { get: (_target, name: string) => table(name) }) }));
vi.mock("@/lib/auth", () => ({ requireRole }));
vi.mock("@/lib/assignments/targeting", () => ({
  listAssignmentTargeting: async (ids: string[]) => new Map(ids.map((id) => [id, (db.tables.targeting ?? []).filter((t) => t.assignmentId === id).map((t) => t.studentId)])),
  isAssignmentVisibleToStudent: (id: string, studentId: string, targeting: Map<string, string[]>) => { const ids = targeting.get(id); return !ids || ids.length === 0 || ids.includes(studentId); },
}));
// The shared learner eligibility gates are covered by their own suite; here a content id is
// either eligible for this learner or not, and the read model must honour that answer.
vi.mock("@/lib/student/learnDiscovery.server", () => ({
  DISCOVERY_LIMIT: 100,
  listAuthorizedLearnerContent: async (_user: unknown, where: any) => (db.tables.content ?? []).filter((row) => authorized.ids.has(row.contentId) && matches(row, where)),
  displayLesson: (row: Row) => ({ contentId: row.contentId, title: row.title, href: `/student/lesson/${encodeURIComponent(row.contentId)}` }),
}));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));

import { clockMinutes, loadClassDetail, loadMyClasses, loadStudentSchedule, periodState, schoolClock } from "@/lib/student/classes.server";
import { GET as classesRoute } from "@/app/api/student/classes/route";
import { GET as classRoute } from "@/app/api/student/classes/[classId]/route";
import { GET as scheduleRoute } from "@/app/api/student/schedule/route";
import StudentClassPage from "@/app/student/classes/[classId]/page";

const learner = { id: "user-1", schoolId: "school-a", role: "STUDENT" };
// Friday 9 October 2026, 08:30 school time (Africa/Monrovia is UTC+0).
const NOW = new Date("2026-10-09T08:30:00Z");
const day = (date: string) => new Date(`${date}T00:00:00Z`);
const cls = (id: string, schoolId: string, name: string, subject = "MATH") => ({ id, schoolId, name, subject, gradeLevel: 4, Teacher: { name: `Teacher of ${name}` }, teacherAssignments: [] });
const slot = (id: string, classId: string, schoolId: string, dayOfWeek: string, periodLabel: string, startTime: string | null, endTime: string | null) =>
  ({ id, classId, schoolId, subject: "MATH", dayOfWeek, periodLabel, startTime, endTime, room: null, teacher: { name: "Mr. Kollie" }, class: { schoolId } });
const work = (id: string, classId: string, schoolId: string, contentId: string, date: string, periodNumber: number | null = null, startTime: string | null = null) =>
  ({ id, classId, contentId, scheduledDate: day(date), startTime, endTime: null, periodNumber, status: "confirmed", class: { schoolId } });
const content = (contentId: string, title: string, unitId: string | null = "unit-fractions", contentType = "lesson") => ({ contentId, title, unitId, contentType, subject: "MATH", grade: 4 });

function seed() {
  authorized.ids = new Set(["c-fractions", "c-decimals", "c-other-class", "c-catalog-only", "c-reader"]);
  db.tables = {
    student: [{ id: "student-1", userId: "user-1", deletedAt: null, user: { schoolId: "school-a", school: { name: "Monrovia Central", timezone: "Africa/Monrovia" } } }],
    enrollment: [
      { studentId: "student-1", classId: "class-a1", Class: cls("class-a1", "school-a", "Grade 4A Mathematics") },
      // A stale cross-school enrollment must never become a membership.
      { studentId: "student-1", classId: "class-b1", Class: cls("class-b1", "school-b", "Foreign Mathematics") },
      { studentId: "student-2", classId: "class-a2", Class: cls("class-a2", "school-a", "Grade 4B Mathematics") },
    ],
    timetable: [
      slot("t-mon-1", "class-a1", "school-a", "MONDAY", "Period 1", "08:00", "08:45"),
      slot("t-fri-1", "class-a1", "school-a", "FRIDAY", "Period 1", "08:00", "08:45"),
      slot("t-fri-2", "class-a1", "school-a", "FRIDAY", "Period 2", "09:00", "09:45"),
      slot("t-a2", "class-a2", "school-a", "FRIDAY", "Period 3", "10:00", "10:45"),
      slot("t-b1", "class-b1", "school-b", "FRIDAY", "Period 1", "08:00", "08:45"),
    ],
    scheduledWork: [
      work("sw-mon", "class-a1", "school-a", "c-fractions", "2026-10-05", 1),
      work("sw-fri", "class-a1", "school-a", "c-decimals", "2026-10-09", 2),
      work("sw-denied", "class-a1", "school-a", "c-denied", "2026-10-09", 1),
      work("sw-reader", "class-a1", "school-a", "c-reader", "2026-10-08"),
      work("sw-a2", "class-a2", "school-a", "c-other-class", "2026-10-09", 3),
      work("sw-b1", "class-b1", "school-b", "c-other-class", "2026-10-09", 1),
    ],
    content: [content("c-fractions", "Comparing fractions"), content("c-decimals", "Tenths and hundredths"), content("c-denied", "Withdrawn lesson"),
      content("c-other-class", "Another class's lesson"), content("c-catalog-only", "Same grade, same subject, never scheduled"), content("c-reader", "Fractions reader", "unit-fractions", "full_pack")],
    assignment: [
      { id: "as-open", classId: "class-a1", title: "Fraction practice", contentId: "c-fractions", scheduledWorkId: null, dueAt: new Date("2026-10-12T09:00:00Z"), Class: { schoolId: "school-a" }, submissions: [] },
      { id: "as-fri", classId: "class-a1", title: "Decimals worksheet", contentId: "c-decimals", scheduledWorkId: "sw-fri", dueAt: null, Class: { schoolId: "school-a" }, submissions: [] },
      { id: "as-done", classId: "class-a1", title: "Turned in work", contentId: null, scheduledWorkId: null, dueAt: null, Class: { schoolId: "school-a" }, submissions: [{ studentId: "student-1", turnedInAt: new Date("2026-10-01T00:00:00Z") }] },
      { id: "as-targeted-away", classId: "class-a1", title: "For another learner", contentId: null, scheduledWorkId: null, dueAt: null, Class: { schoolId: "school-a" }, submissions: [] },
      { id: "as-a2", classId: "class-a2", title: "Other class work", contentId: null, scheduledWorkId: null, dueAt: null, Class: { schoolId: "school-a" }, submissions: [] },
    ].map((row) => ({ ...row, submissions: row.submissions.filter((s: any) => s.studentId === "student-1") })),
    targeting: [{ assignmentId: "as-targeted-away", studentId: "student-2" }],
    studentProgress: [{ studentId: "user-1", scheduledWorkId: "sw-mon", completedAt: new Date("2026-10-05T10:00:00Z") }],
    timetableAssignment: [
      // A teacher plan on today's Period 1 whose lesson is not eligible for this learner.
      { timetableId: "t-fri-1", assignedDate: day("2026-10-09"), title: "Withdrawn lesson plan", curriculumContentId: "c-denied", timetable: { schoolId: "school-a", classId: "class-a1" } },
      { timetableId: "t-b1", assignedDate: day("2026-10-09"), title: "Foreign plan", curriculumContentId: "c-fractions", timetable: { schoolId: "school-b", classId: "class-b1" } },
    ],
  };
}
beforeEach(() => { seed(); requireRole.mockReset(); requireRole.mockResolvedValue(learner); vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(NOW); });

describe("My classes", () => {
  it("shows only the learner's own enrolled classes at their school", async () => {
    const model = await loadMyClasses(learner, NOW);
    expect(model.classes.map((row) => row.classId)).toEqual(["class-a1"]);
    expect(JSON.stringify(model)).not.toMatch(/class-b1|class-a2|Foreign|Grade 4B/);
  });
  it("shows only authorized class facts: teacher, school, current unit, next class, next work, open assignments", async () => {
    const [row] = (await loadMyClasses(learner, NOW)).classes;
    expect(row).toMatchObject({ name: "Grade 4A Mathematics", subject: "MATH", grade: 4, teacherName: "Teacher of Grade 4A Mathematics", schoolName: "Monrovia Central", href: "/student/classes/class-a1" });
    expect(row.currentUnit?.unitId).toBe("unit-fractions");
    // At 08:30 Period 1 (08:00–08:45) is in session, so it is the next class, reported as current.
    expect(row.nextClass).toMatchObject({ periodLabel: "Period 1", date: "2026-10-09", isToday: true, state: "current" });
    expect(row.nextWork).toMatchObject({ date: "2026-10-09", title: "Tenths and hundredths" });
    // Open and overdue count; turned-in work and work targeted at another learner do not.
    expect(row.openAssignmentCount).toBe(2);
  });
  it("is empty, not invented, for a learner with no enrollments", async () => {
    db.tables.enrollment = [];
    const model = await loadMyClasses(learner, NOW);
    expect(model).toMatchObject({ availability: "empty", enrolled: false, classes: [] });
  });
  it("is restricted for a deleted learner or a learner from another school", async () => {
    db.tables.student[0].deletedAt = new Date();
    expect((await loadMyClasses(learner, NOW)).availability).toBe("restricted");
    seed();
    expect((await loadMyClasses({ ...learner, schoolId: "school-b" }, NOW)).availability).toBe("restricted");
  });
});

describe("Class detail authorization", () => {
  it.each([["class-b1", "foreign school class, even with a stale enrollment row"], ["class-a2", "same-school class the learner is not enrolled in"], ["missing", "unknown class id"]])("denies %s (%s)", async (classId) => {
    expect(await loadClassDetail(learner, classId, NOW)).toBeNull();
    const response = await classRoute(new Request(`http://test/api/student/classes/${classId}`), { params: { classId } });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "class_not_found" });
  });
  it("denies the direct class URL with not-found", async () => {
    await expect(StudentClassPage({ params: { classId: "class-a2" } })).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(StudentClassPage({ params: { classId: "class-b1" } })).rejects.toThrow("NEXT_NOT_FOUND");
  });
  it("answers 401 without reading anything when signed out", async () => {
    requireRole.mockRejectedValue(Object.assign(new Error("no"), { status: 401 }));
    expect((await classRoute(new Request("http://test"), { params: { classId: "class-a1" } })).status).toBe(401);
    expect((await classesRoute()).status).toBe(401);
    expect((await scheduleRoute()).status).toBe(401);
  });
  it("scopes class lessons to this class: no catalog, other-class or ineligible content", async () => {
    const model = (await loadClassDetail(learner, "class-a1", NOW))!;
    expect(model.lessons.map((row) => row.contentId)).toEqual(["c-fractions", "c-decimals"]);
    expect(model.lessons.find((row) => row.contentId === "c-fractions")?.status).toBe("completed");
    expect(model.resources.map((row) => row.contentId)).toEqual(["c-reader"]);
    expect(JSON.stringify(model)).not.toMatch(/c-catalog-only|c-other-class|c-denied|Withdrawn/);
    expect(model.assignedWork.map((row) => row.id)).toEqual(["as-open", "as-fri", "as-done"]);
    expect(model.assignedWork.find((row) => row.id === "as-done")?.status).toBe("submitted");
    expect(model.schedule.slots.map((row) => row.id)).toEqual(["t-mon-1", "t-fri-1", "t-fri-2"]);
    expect(model.progress).toEqual({ scheduledToDate: 3, completed: 1 });
  });
  it("locks an assignment whose linked lesson is no longer eligible", async () => {
    authorized.ids.delete("c-fractions");
    const model = (await loadClassDetail(learner, "class-a1", NOW))!;
    expect(model.assignedWork.find((row) => row.id === "as-open")).toMatchObject({ state: "unavailable", locked: true, href: null });
  });
});

describe("Class schedule", () => {
  it("uses the actual timetable for today with current, upcoming and ended periods", async () => {
    vi.setSystemTime(new Date("2026-10-09T08:15:00Z"));
    const model = await loadStudentSchedule(learner, new Date("2026-10-09T08:15:00Z"));
    expect(model).toMatchObject({ availability: "current", timetableConfigured: true, today: "2026-10-09", timeZone: "Africa/Monrovia" });
    const today = model.days.find((d) => d.isToday)!;
    expect(today.periods.map((p) => [p.id, p.state])).toEqual([["t-fri-1", "current"], ["t-fri-2", "upcoming"]]);
    expect(JSON.stringify(model)).not.toMatch(/t-b1|t-a2|Foreign plan|class-a2/);
  });
  it("links lessons and assignments only when authorized; an ineligible plan is shown as a plan only", async () => {
    const today = (await loadStudentSchedule(learner, NOW)).days.find((d) => d.isToday)!;
    const [first, second] = today.periods;
    expect(first.plannedTitle).toBe("Withdrawn lesson plan");
    expect(first.links).toEqual([]);
    expect(second.links).toEqual([
      { kind: "lesson", title: "Tenths and hundredths", href: "/student/lesson/c-decimals" },
      { kind: "assignment", title: "Decimals worksheet", href: "/student/assignments/as-fri" },
    ]);
  });
  it("shows the real week: only days with timetable periods or dated work, never padded", async () => {
    const model = await loadStudentSchedule(learner, NOW);
    expect(model.days.map((d) => d.dayName)).toEqual(["Monday", "Thursday", "Friday"]);
    const monday = model.days[0];
    expect(monday.periods.map((p) => [p.id, p.state])).toEqual([["t-mon-1", "completed"]]);
    expect(model.days[1].periods).toEqual([]);
    expect(model.days[1].otherWork.map((w) => w.scheduledWorkId)).toEqual(["sw-reader"]);
  });
  it("is honest when no timetable is configured: no periods, only real dated work", async () => {
    db.tables.timetable = [];
    db.tables.timetableAssignment = [];
    const model = await loadStudentSchedule(learner, NOW);
    expect(model.timetableConfigured).toBe(false);
    expect(model.days.flatMap((d) => d.periods)).toEqual([]);
    expect(model.days.find((d) => d.isToday)!.otherWork.map((w) => w.scheduledWorkId)).toEqual(["sw-fri"]);
    db.tables.scheduledWork = [];
    const bare = await loadStudentSchedule(learner, NOW);
    expect(bare.days).toEqual([{ date: "2026-10-09", dayName: "Friday", isToday: true, periods: [], otherWork: [] }]);
  });
  it("reports not enrolled instead of an empty timetable", async () => {
    db.tables.enrollment = [];
    expect(await loadStudentSchedule(learner, NOW)).toMatchObject({ enrolled: false, timetableConfigured: false });
  });
  it("route answers 403 for a learner without a valid school record", async () => {
    requireRole.mockResolvedValue({ ...learner, schoolId: null });
    expect((await scheduleRoute()).status).toBe(403);
    expect((await classesRoute()).status).toBe(403);
  });
});

describe("School-local time", () => {
  it("reads the date and time in the school's timezone, falling back safely", () => {
    expect(schoolClock(new Date("2026-10-09T23:30:00Z"), "Africa/Lagos")).toMatchObject({ date: "2026-10-10", minutes: 30 });
    expect(schoolClock(NOW, "Not/AZone")).toMatchObject({ timeZone: "Africa/Monrovia", date: "2026-10-09", minutes: 510 });
  });
  it("classifies periods without claiming work was done", () => {
    expect(periodState("2026-10-08", "2026-10-09", 0, "08:00", "09:00")).toBe("completed");
    expect(periodState("2026-10-10", "2026-10-09", 0, "08:00", "09:00")).toBe("upcoming");
    expect(periodState("2026-10-09", "2026-10-09", 8 * 60 + 30, "08:00", "09:00")).toBe("current");
    expect(periodState("2026-10-09", "2026-10-09", 9 * 60, "08:00", "09:00")).toBe("completed");
    expect(periodState("2026-10-09", "2026-10-09", 9 * 60, null, null)).toBe("time_unknown");
    expect(clockMinutes("25:00")).toBeNull();
  });
});
