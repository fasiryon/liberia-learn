// Student My Classes, class detail and class schedule composition over the Codex enrollment and
// schedule authorities (lib/student/enrollmentReadModel.ts, lib/student/scheduleReadModel.ts).
// The real authorities and learner eligibility gates run against a fake database that evaluates
// the Prisma `where` filters each query sends.
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, any>;
const db = vi.hoisted(() => ({ tables: {} as Record<string, Row[]> }));
const requireRole = vi.hoisted(() => vi.fn());

function matches(row: any, where: any): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, condition]: [string, any]) => {
    if (key === "AND") return condition.every((part: any) => matches(row, part));
    if (key === "OR") return condition.some((part: any) => matches(row, part));
    const value = row?.[key];
    if (condition === null) return value == null;
    if (typeof condition !== "object" || condition instanceof Date) return value instanceof Date ? value.getTime() === (condition as Date).getTime() : value === condition;
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
  findFirst: async ({ where }: any) => (db.tables[name] ?? []).find((row) => matches(row, where)) ?? null,
});

vi.mock("@/lib/db", () => ({ prisma: new Proxy({}, { get: (_target, name: string) => table(name) }) }));
vi.mock("@/lib/auth", () => ({ requireRole }));
vi.mock("@/lib/assignments/targeting", () => ({
  listAssignmentTargeting: async (ids: string[]) => new Map(ids.map((id) => [id, (db.tables.targeting ?? []).filter((t) => t.assignmentId === id).map((t) => t.studentId)])),
  isAssignmentVisibleToStudent: (id: string, studentId: string, targeting: Map<string, string[]>) => { const ids = targeting.get(id); return !ids || ids.length === 0 || ids.includes(studentId); },
}));
// Class-detail content reads use the shared learner listing; here it applies the same real row gates.
vi.mock("@/lib/student/learnDiscovery.server", async () => {
  const { learnerRowAllowed } = await import("@/lib/curriculum/learnerEligibility");
  return {
    DISCOVERY_LIMIT: 100, learnerDiscoverySelect: {},
    listAuthorizedLearnerContent: async (_user: unknown, where: any) => (db.tables.curriculumContent ?? []).filter((row) => ["published", "APPROVED"].includes(row.status) && learnerRowAllowed(row as any) && matches(row, where)),
    displayLesson: (row: Row) => ({ contentId: row.contentId, title: row.title, href: `/student/lesson/${encodeURIComponent(row.contentId)}` }),
  };
});
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));

import { clockMinutes, loadClassDetail, loadClassSchedule, loadMyClasses, matchPeriod, periodNumberOf, periodState, schoolClock } from "@/lib/student/classes.server";
import { GET as classesRoute } from "@/app/api/student/classes/route";
import { GET as classRoute } from "@/app/api/student/classes/[classId]/route";
import { GET as scheduleRoute } from "@/app/api/student/schedule/route";
import StudentClassPage from "@/app/student/classes/[classId]/page";

const learner = { id: "user-1", schoolId: "school-a", role: "STUDENT" };
// Friday 9 October 2026, 08:30 school time (Africa/Monrovia is UTC+0).
const NOW = new Date("2026-10-09T08:30:00Z");
const day = (date: string) => new Date(`${date}T00:00:00Z`);
const cls = (id: string, schoolId: string, name: string, teacher: { name: string; schoolId: string } | null = { name: `Teacher of ${name}`, schoolId }) =>
  ({ id, schoolId, name, subject: "MATH", gradeLevel: 4, Teacher: teacher, School: { name: schoolId === "school-a" ? "Monrovia Central" : "Foreign School" } });
const slot = (id: string, classId: string, schoolId: string, dayOfWeek: string, periodLabel: string, startTime: string | null, endTime: string | null) =>
  // `teacher` is present on the raw row to prove the composition never projects slot teacher identity.
  ({ id, classId, schoolId, subject: "MATH", dayOfWeek, periodLabel, startTime, endTime, room: null, teacher: { name: "SLOT-TEACHER", schoolId: "school-b" }, class: { schoolId } });
const content = (contentId: string, title: string, extra: Row = {}) => ({ contentId, title, unitId: "unit-fractions", contentType: "lesson", subject: "MATH", grade: 4,
  status: "published", visibility: "public", payload: {}, schoolId: null, teacherCreated: false, versionId: null, curriculumVersion: null, provenance: null, ...extra });
const work = (id: string, classId: string, schoolId: string, contentId: string, date: string, periodNumber: number | null = null, startTime: string | null = null) =>
  ({ id, classId, contentId, scheduledDate: day(date), startTime, endTime: null, periodNumber, status: "confirmed", class: { schoolId } });

function seed() {
  db.tables = {
    school: [{ id: "school-a", timezone: "Africa/Monrovia" }],
    student: [{ id: "student-1", userId: "user-1", deletedAt: null, user: { schoolId: "school-a" }, academicEnrollments: [], enrollments: [
      { classId: "class-a1", Class: cls("class-a1", "school-a", "Grade 4A Mathematics") },
      // A stale cross-school roster row must never become a membership.
      { classId: "class-b1", Class: cls("class-b1", "school-b", "Foreign Mathematics") },
    ] }],
    timetable: [
      slot("t-mon-1", "class-a1", "school-a", "MONDAY", "Period 1", "08:00", "08:45"),
      slot("t-fri-1", "class-a1", "school-a", "FRIDAY", "Period 1", "08:00", "08:45"),
      slot("t-fri-2", "class-a1", "school-a", "FRIDAY", "Period 2", "09:00", "09:45"),
      slot("t-a2", "class-a2", "school-a", "FRIDAY", "Period 3", "10:00", "10:45"),
      slot("t-b1", "class-b1", "school-b", "FRIDAY", "Period 1", "08:00", "08:45"),
    ],
    curriculumContent: [content("c-fractions", "Comparing fractions"), content("c-decimals", "Tenths and hundredths"), content("c-denied", "Withdrawn lesson", { status: "draft" }),
      content("c-other-class", "Another class's lesson"), content("c-catalog-only", "Same grade, same subject, never scheduled"), content("c-reader", "Fractions reader", { contentType: "full_pack" })],
    scheduledWork: [
      work("sw-mon", "class-a1", "school-a", "c-fractions", "2026-10-05", 1),
      work("sw-fri", "class-a1", "school-a", "c-decimals", "2026-10-09", 2),
      work("sw-denied", "class-a1", "school-a", "c-denied", "2026-10-09", 1),
      work("sw-reader", "class-a1", "school-a", "c-reader", "2026-10-08"),
      { ...work("sw-suggested", "class-a1", "school-a", "c-fractions", "2026-10-09", 1), status: "suggested" },
      work("sw-a2", "class-a2", "school-a", "c-other-class", "2026-10-09", 3),
      work("sw-b1", "class-b1", "school-b", "c-other-class", "2026-10-09", 1),
    ],
    assignment: [
      { id: "as-open", classId: "class-a1", title: "Fraction practice", contentId: "c-fractions", scheduledWorkId: null, dueAt: new Date("2026-10-12T09:00:00Z"), Class: { schoolId: "school-a" }, submissions: [] },
      { id: "as-fri", classId: "class-a1", title: "Decimals worksheet", contentId: "c-decimals", scheduledWorkId: "sw-fri", dueAt: null, Class: { schoolId: "school-a" }, submissions: [] },
      { id: "as-done", classId: "class-a1", title: "Turned in work", contentId: null, scheduledWorkId: null, dueAt: null, Class: { schoolId: "school-a" }, submissions: [{ turnedInAt: new Date("2026-10-01T00:00:00Z") }] },
      { id: "as-targeted-away", classId: "class-a1", title: "For another learner", contentId: null, scheduledWorkId: null, dueAt: null, Class: { schoolId: "school-a" }, submissions: [] },
      { id: "as-a2", classId: "class-a2", title: "Other class work", contentId: null, scheduledWorkId: null, dueAt: null, Class: { schoolId: "school-a" }, submissions: [] },
    ],
    targeting: [{ assignmentId: "as-targeted-away", studentId: "student-2" }],
    studentProgress: [{ studentId: "user-1", scheduledWorkId: "sw-mon", completedAt: new Date("2026-10-05T10:00:00Z") }],
  };
  // The schedule authority reads each row's content relation; share the same objects so test edits apply.
  for (const row of db.tables.scheduledWork) row.content = db.tables.curriculumContent.find((c) => c.contentId === row.contentId);
}
beforeEach(() => { seed(); requireRole.mockReset(); requireRole.mockResolvedValue(learner); vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(NOW); });
const setTeacher = (teacher: { name: string; schoolId: string } | null) => { db.tables.student[0].enrollments[0].Class.Teacher = teacher; };

describe("My classes", () => {
  it("shows only the learner's own enrolled classes at their school", async () => {
    const model = await loadMyClasses(learner, NOW);
    expect(model.classes.map((row) => row.classId)).toEqual(["class-a1"]);
    expect(JSON.stringify(model)).not.toMatch(/class-b1|class-a2|Foreign/);
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
  it("is empty, not invented, with no enrollments, a deleted learner, another school or a stale academic year", async () => {
    db.tables.student[0].enrollments = [];
    expect(await loadMyClasses(learner, NOW)).toMatchObject({ availability: "empty", enrolled: false, classes: [] });
    seed(); db.tables.student[0].deletedAt = new Date();
    expect((await loadMyClasses(learner, NOW)).classes).toEqual([]);
    seed();
    expect((await loadMyClasses({ ...learner, schoolId: "school-b" }, NOW)).classes).toEqual([]);
    seed(); db.tables.student[0].academicEnrollments = [{ schoolId: "school-a", status: "TRANSFERRED", academicYear: { isActive: true, startDate: new Date(0), endDate: new Date("2099-01-01") } }];
    expect((await loadMyClasses(learner, NOW)).classes).toEqual([]);
  });
});

describe("Foreign teacher identity (cross-builder P1)", () => {
  it("never projects a teacher from another school on the class list, detail, schedule or API", async () => {
    setTeacher({ name: "FOREIGN-TEACHER", schoolId: "school-b" });
    const list = await loadMyClasses(learner, NOW);
    const detail = (await loadClassDetail(learner, "class-a1", NOW))!;
    const schedule = await loadClassSchedule(learner, NOW);
    const api = await (await classesRoute()).json();
    const one = await (await classRoute(new Request("http://test"), { params: { classId: "class-a1" } })).json();
    for (const payload of [list, detail, schedule, api, one]) expect(JSON.stringify(payload)).not.toMatch(/FOREIGN-TEACHER|SLOT-TEACHER/);
    expect(list.classes[0].teacherName).toBeNull();
    expect(detail.class.teacherName).toBeNull();
    expect(schedule.days.flatMap((d) => d.periods).every((p) => p.teacherName === null)).toBe(true);
  });
  it("shows a same-school teacher, and states a missing one as missing", async () => {
    expect((await loadClassSchedule(learner, NOW)).days.find((d) => d.isToday)!.periods[0].teacherName).toBe("Teacher of Grade 4A Mathematics");
    setTeacher(null);
    expect((await loadMyClasses(learner, NOW)).classes[0].teacherName).toBeNull();
  });
});

describe("Class detail authorization", () => {
  it.each([["class-b1", "foreign school class, even with a stale roster row"], ["class-a2", "same-school class the learner is not enrolled in"], ["missing", "unknown class id"]])("denies %s (%s)", async (classId) => {
    expect(await loadClassDetail(learner, classId, NOW)).toBeNull();
    const response = await classRoute(new Request(`http://test/api/student/classes/${classId}`), { params: { classId } });
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it("denies the direct class URL with not-found", async () => {
    await expect(StudentClassPage({ params: { classId: "class-a2" } })).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(StudentClassPage({ params: { classId: "class-b1" } })).rejects.toThrow("NEXT_NOT_FOUND");
  });
  it("revoking the roster row revokes the detail page", async () => {
    expect(await loadClassDetail(learner, "class-a1", NOW)).not.toBeNull();
    db.tables.student[0].enrollments = [];
    expect(await loadClassDetail(learner, "class-a1", NOW)).toBeNull();
  });
  it("answers 401 before reading anything when signed out, with no-store", async () => {
    requireRole.mockRejectedValue(Object.assign(new Error("no"), { status: 401 }));
    for (const response of [await classRoute(new Request("http://test"), { params: { classId: "class-a1" } }), await classesRoute(), await scheduleRoute()]) {
      expect(response.status).toBe(401);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    }
  });
  it("scopes class lessons to this class: no catalog, other-class, ineligible or suggested content", async () => {
    const model = (await loadClassDetail(learner, "class-a1", NOW))!;
    expect(model.lessons.map((row) => row.contentId)).toEqual(["c-fractions", "c-decimals"]);
    expect(model.lessons.find((row) => row.contentId === "c-fractions")?.status).toBe("completed");
    expect(model.resources.map((row) => row.contentId)).toEqual(["c-reader"]);
    expect(JSON.stringify(model)).not.toMatch(/c-catalog-only|c-other-class|c-denied|Withdrawn|sw-suggested/);
    expect(model.assignedWork.map((row) => row.id)).toEqual(["as-open", "as-fri", "as-done"]);
    expect(model.assignedWork.find((row) => row.id === "as-done")?.status).toBe("submitted");
    expect(model.schedule.slots.map((row) => row.id)).toEqual(["t-mon-1", "t-fri-1", "t-fri-2"]);
    expect(model.progress).toEqual({ scheduledToDate: 3, completed: 1 });
  });
  it("locks an assignment whose linked lesson is no longer eligible", async () => {
    db.tables.curriculumContent.find((row) => row.contentId === "c-fractions")!.status = "draft";
    const model = (await loadClassDetail(learner, "class-a1", NOW))!;
    expect(model.assignedWork.find((row) => row.id === "as-open")).toMatchObject({ state: "unavailable", locked: true, href: null });
  });
});

describe("Class schedule", () => {
  it("uses the actual timetable for today with current, upcoming and ended periods", async () => {
    const at = new Date("2026-10-09T08:15:00Z"); vi.setSystemTime(at);
    const model = await loadClassSchedule(learner, at);
    expect(model).toMatchObject({ availability: "current", timetableConfigured: true, today: "2026-10-09", timeZone: "Africa/Monrovia" });
    const today = model.days.find((d) => d.isToday)!;
    expect(today.periods.map((p) => [p.id, p.state])).toEqual([["t-fri-1", "current"], ["t-fri-2", "upcoming"]]);
    expect(JSON.stringify(model)).not.toMatch(/t-b1|t-a2|class-a2|class-b1/);
  });
  it("links only lessons the schedule authority granted, through its work route", async () => {
    const today = (await loadClassSchedule(learner, NOW)).days.find((d) => d.isToday)!;
    const [first, second] = today.periods;
    expect(first.links).toEqual([]);
    expect(second.links).toEqual([{ kind: "lesson", title: "Tenths and hundredths", href: "/student/work/sw-fri" }]);
    expect(JSON.stringify(today)).not.toMatch(/Withdrawn|sw-denied|sw-suggested/);
  });
  it("shows the real week: only days with timetable periods or dated work, never padded", async () => {
    const model = await loadClassSchedule(learner, NOW);
    expect(model.days.map((d) => d.dayName)).toEqual(["Monday", "Thursday", "Friday"]);
    expect(model.days[0].periods.map((p) => [p.id, p.state, p.links.length])).toEqual([["t-mon-1", "completed", 1]]);
    expect(model.days[1].otherWork.map((w) => w.scheduledWorkId)).toEqual(["sw-reader"]);
  });
  it("is honest when no timetable is configured: no periods, only real dated work", async () => {
    db.tables.timetable = [];
    const model = await loadClassSchedule(learner, NOW);
    expect(model.timetableConfigured).toBe(false);
    expect(model.days.flatMap((d) => d.periods)).toEqual([]);
    expect(model.days.find((d) => d.isToday)!.otherWork.map((w) => w.scheduledWorkId)).toEqual(["sw-fri"]);
    db.tables.scheduledWork = [];
    expect((await loadClassSchedule(learner, NOW)).days).toEqual([{ date: "2026-10-09", dayName: "Friday", isToday: true, periods: [], otherWork: [] }]);
  });
  it("reports not enrolled instead of an empty timetable", async () => {
    db.tables.student[0].enrollments = [];
    expect(await loadClassSchedule(learner, NOW)).toMatchObject({ enrolled: false, timetableConfigured: false, days: [] });
  });
  it("keeps the authority routes private and uncached", async () => {
    for (const response of [await classesRoute(), await scheduleRoute(), await classRoute(new Request("http://test"), { params: { classId: "class-a1" } })]) {
      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    }
  });
});

describe("Period matching (cross-builder P2): attach only when unambiguous", () => {
  const p = (id: string, classId: string, periodLabel: string, startTime: string | null) => ({ id, classId, periodLabel, startTime });
  const w = (classId: string, periodNumber: number | null, startTime: string | null) => ({ classId, periodNumber, startTime });
  const day = [p("p1", "A", "Period 1", "08:00"), p("p2", "A", "Period 2", "09:00"), p("b2", "B", "Period 2", "09:00")];
  it("attaches an exact valid match by number, by time, or by both agreeing", () => {
    expect(matchPeriod(w("A", 2, null), day)).toBe("p2");
    expect(matchPeriod(w("A", null, "09:00"), day)).toBe("p2");
    expect(matchPeriod(w("A", 2, "9:00"), day)).toBe("p2");
  });
  it("same start time in a different class never attaches across classes", () => {
    expect(matchPeriod(w("B", null, "09:00"), day)).toBe("b2");
    expect(matchPeriod(w("C", 2, "09:00"), day)).toBeNull();
  });
  it("does not choose when period number and start time disagree", () => {
    expect(matchPeriod(w("A", 1, "09:00"), day)).toBeNull();
    expect(matchPeriod(w("A", 2, "10:00"), day)).toBeNull();
  });
  it("does not attach to duplicate period labels or overlapping periods", () => {
    expect(matchPeriod(w("A", 2, null), [...day, p("p2b", "A", "Period 2", "11:00")])).toBeNull();
    expect(matchPeriod(w("A", null, "09:00"), [...day, p("p2c", "A", "Period 5", "09:00")])).toBeNull();
    expect(matchPeriod(w("A", 2, "09:00"), [...day, p("p2c", "A", "Period 5", "09:00")])).toBeNull();
  });
  it("does not attach when the timetable changed and the period is gone, or nothing identifies it", () => {
    expect(matchPeriod(w("A", 4, null), day)).toBeNull();
    expect(matchPeriod(w("A", null, null), day)).toBeNull();
    expect(matchPeriod(w("A", null, "nine"), day)).toBeNull();
    expect(matchPeriod(w("A", 1, null), [p("x", "A", "Morning block", "08:00")])).toBeNull();
  });
  it("places ambiguous work under other scheduled work in the composed schedule", async () => {
    db.tables.timetable.push(slot("t-fri-2-dup", "class-a1", "school-a", "FRIDAY", "Period 2", "11:00", "11:45"));
    const today = (await loadClassSchedule(learner, NOW)).days.find((d) => d.isToday)!;
    expect(today.periods.flatMap((period) => period.links)).toEqual([]);
    expect(today.otherWork.map((row) => [row.scheduledWorkId, row.links[0].href])).toEqual([["sw-fri", "/student/work/sw-fri"]]);
  });
  it("reads period numbers only from reliable labels", () => {
    expect([periodNumberOf("Period 3"), periodNumberOf("P3"), periodNumberOf("3"), periodNumberOf("Period 3 (double)"), periodNumberOf("Break")]).toEqual([3, 3, 3, null, null]);
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
