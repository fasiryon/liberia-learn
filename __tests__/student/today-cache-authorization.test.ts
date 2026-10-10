// PR #179 P1: cache is not authority on GET /api/student/today. Every response must be gated by the
// learner's CURRENT enrollment scope (lib/student/enrollmentReadModel.ts). A Redis-like key store backs
// the route's caches so a stale entry could actually be replayed if any layer were keyed by user alone.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({ map: new Map<string, unknown>(), down: false }));
const mocks = vi.hoisted(() => ({ role: vi.fn(), student: vi.fn(), work: vi.fn(), assignment: vi.fn(), timetable: vi.fn(), teachers: vi.fn() }));

vi.mock("@/lib/cache/redisCache", () => ({
  FALLBACK_LIMIT_EXCEEDED: "FALLBACK_LIMIT_EXCEEDED",
  withRedisCache: async (key: string, _ttl: number, fn: () => Promise<unknown>) => {
    if (store.down) return fn();
    if (store.map.has(key)) return store.map.get(key);
    const value = await fn(); store.map.set(key, value); return value;
  },
  getCachedValue: async (key: string) => (store.down ? null : store.map.get(key) ?? null),
  setCachedValue: async (key: string, value: unknown) => { if (!store.down) store.map.set(key, value); },
}));
vi.mock("@/lib/auth", () => ({ requireRole: mocks.role }));
vi.mock("@/lib/student/learningIntelligence", () => ({ buildStudentLearningIntelligence: vi.fn(async () => ({ generatedAt: "", masteryBySubject: [], weaknesses: [], recommendedNextActions: [] })) }));
vi.mock("@/lib/student/adaptiveRecommendations", () => ({ getAdaptiveRecommendations: vi.fn(async () => ({ recommendation: null, masteryAlerts: [], contentGap: false })) }));
vi.mock("@/lib/intelligence/actionEngine", () => ({ generateStudentActions: vi.fn(async () => []), getActiveStudentAction: vi.fn(async () => null) }));
vi.mock("@/lib/timetable/timetableService", () => ({ getTimetableForStudent: mocks.timetable }));
vi.mock("@/lib/lessons/labLinks", () => ({ getLessonLabLinks: () => [] }));
vi.mock("@/lib/db", () => ({ prisma: { student: { findUnique: mocks.student }, scheduledWork: { findMany: mocks.work }, assignment: { findMany: mocks.assignment }, user: { findMany: mocks.teachers } } }));

import { GET } from "@/app/api/student/today/route";
import { enrollmentScopeFingerprint } from "@/lib/student/enrollmentReadModel";

type Klass = { id: string; schoolId: string; teacherId: string | null };
type Teacher = { name: string; schoolId: string };
const state = {
  userSchool: "school-a",
  studentSchool: "school-a",
  classes: [] as Klass[],
  // Teachers are their own records, referenced by id, exactly as in the database.
  teachers: {} as Record<string, Teacher>,
  academic: [] as Array<{ schoolId: string; status: string; academicYear: { isActive: boolean; startDate: Date; endDate: Date } }>,
};
const dateStr = () => new Date().toISOString().slice(0, 10);
const call = async () => (await GET()).json();
const text = (body: unknown) => JSON.stringify(body);

beforeEach(() => {
  store.map.clear(); store.down = false;
  Object.assign(state, { userSchool: "school-a", studentSchool: "school-a", academic: [],
    classes: [{ id: "class-a", schoolId: "school-a", teacherId: "t-a" }], teachers: { "t-a": { name: "TEACHER-A", schoolId: "school-a" } } });
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.role.mockImplementation(async () => ({ id: "user-1", role: "STUDENT", schoolId: state.userSchool }));
  // The enrollment authority's single read, honouring its own-school enrollment filter.
  mocks.student.mockImplementation(async ({ where, select }: any) => where.userId !== "user-1" ? null : {
    id: "student-1", currentGrade: null, deletedAt: null, user: { schoolId: state.studentSchool }, academicEnrollments: state.academic,
    enrollments: state.classes.filter((c) => !select.enrollments.where || c.schoolId === select.enrollments.where.Class.schoolId)
      .map((c) => ({ classId: c.id, Class: { id: c.id, name: `NAME-${c.id}`, subject: "MATH", gradeLevel: 4, schoolId: c.schoolId, Teacher: c.teacherId && state.teachers[c.teacherId] ? { ...state.teachers[c.teacherId] } : null, School: { name: `SCHOOL-${c.schoolId}` } } })),
  });
  const inScope = (where: any, c: { classId: string; schoolId: string }) => where.classId.in.includes(c.classId) && ((where.class ?? where.Class)?.schoolId ?? c.schoolId) === c.schoolId;
  mocks.work.mockImplementation(async ({ where }: any) => where.scheduledDate?.lt && where.scheduledDate.gte && !where.scheduledDate.gte.toISOString().startsWith(dateStr()) ? [] :
    state.classes.map((c) => ({ classId: c.id, schoolId: c.schoolId })).filter((c) => inScope(where, c)).map(({ classId }, i) => ({
      id: `sw-${classId}`, classId, contentId: `content-${classId}`, periodNumber: i + 1, startTime: null, endTime: null, scheduledDate: new Date(),
      content: { contentId: `content-${classId}`, grade: 4, subject: "MATH", contentType: "lesson", payload: { title: `LESSON-${classId}` } }, progress: [] })));
  mocks.assignment.mockImplementation(async ({ where }: any) => where.dueAt?.gte ? state.classes.map((c) => ({ classId: c.id, schoolId: c.schoolId })).filter((c) => inScope(where, c))
    .map(({ classId }) => ({ id: `as-${classId}`, title: `ASSIGNMENT-${classId}`, dueAt: new Date(), scheduledWorkId: `sw-${classId}`, submissions: [] })) : []);
  // Fresh timetable projection for the learner's current own-school classes (the real service is tested separately).
  mocks.timetable.mockImplementation(async (_studentId: string, _date: Date, schoolId: string) => ({ configured: true, date: dateStr(), dayName: "Today",
    periods: state.classes.filter((c) => c.schoolId === schoolId).map((c, i) => ({ id: `slot-${c.id}`, classId: c.id, periodLabel: `Period ${i + 1}`, subject: "MATH", startTime: null, endTime: null,
      teacherId: c.teacherId, teacherName: c.teacherId && state.teachers[c.teacherId]?.schoolId === schoolId ? state.teachers[c.teacherId].name : null, assignment: null })) }));
  // Current teacher authority: one bounded lookup by id within the learner's school.
  mocks.teachers.mockImplementation(async ({ where }: any) => Object.entries(state.teachers)
    .filter(([id, t]) => where.id.in.includes(id) && t.schoolId === where.schoolId).map(([id, t]) => ({ id, ...t })));
});
afterEach(() => { vi.useRealTimers(); });

describe("A/G. current enrollment: the cache still works for the same scope", () => {
  it("serves allowed data, then a cache hit without recomputing", async () => {
    const first = await call();
    expect(text(first)).toContain("LESSON-class-a");
    expect(text(first)).toContain("TEACHER-A");
    const queries = mocks.work.mock.calls.length;
    const second = await call();
    expect(second).toEqual(first);
    expect(mocks.work.mock.calls.length).toBe(queries);
    // Authority itself is never cached: it is read on every request.
    expect(mocks.student).toHaveBeenCalledTimes(2);
    expect([...store.map.keys()].some((key) => key.startsWith("cache:student-meta"))).toBe(false);
  });
});

describe("B/E. enrollment changes take effect on the next request", () => {
  it("B: removing Class A drops its cached data immediately", async () => {
    expect(text(await call())).toContain("LESSON-class-a");
    state.classes = [];
    const body = await call();
    expect(text(body)).not.toMatch(/class-a|LESSON-class-a|ASSIGNMENT-class-a|TEACHER-A/);
    expect(body).toMatchObject({ availability: "current", items: [] });
  });
  it("E: a different class in the same school never reads the old class payload", async () => {
    expect(text(await call())).toContain("LESSON-class-a");
    state.classes = [{ id: "class-c", schoolId: "school-a", teacherId: null }];
    const body = await call();
    expect(text(body)).toContain("LESSON-class-c");
    expect(text(body)).not.toMatch(/class-a|TEACHER-A/);
  });
});

describe("C. school change", () => {
  it("never returns School A data after the learner moves to School B, though School A entries remain", async () => {
    expect(text(await call())).toContain("LESSON-class-a");
    const cachedBefore = store.map.size;
    Object.assign(state, { userSchool: "school-b", studentSchool: "school-b", classes: [...state.classes, { id: "class-b", schoolId: "school-b", teacherId: "t-b" }], teachers: { ...state.teachers, "t-b": { name: "TEACHER-B", schoolId: "school-b" } } });
    const body = await call();
    expect(store.map.size).toBeGreaterThan(cachedBefore);
    expect(text(body)).toContain("LESSON-class-b");
    expect(text(body)).not.toMatch(/class-a|TEACHER-A|school-a|SCHOOL-school-a/);
  });
  it("fails closed when the session school and the student record disagree", async () => {
    await call();
    state.userSchool = "school-b";
    const body = await call();
    expect(body).toMatchObject({ availability: "unavailable", items: [] });
    expect(text(body)).not.toMatch(/class-a|TEACHER-A/);
  });
});

describe("D. foreign teacher identity cached before the teacher-scope fix", () => {
  it("pre-fix entries in every legacy Today namespace can never be addressed", async () => {
    const poisoned = { availability: "current", items: [{ id: "x", title: "LEGACY-LESSON" }], timetable: { periods: [{ teacherName: "FOREIGN-TEACHER" }] }, schoolId: "school-a" };
    store.map.set(`cache:today:user-1:${dateStr()}`, poisoned);
    store.map.set("cache:today:lastgood:user-1", poisoned);
    store.map.set(`cache:timetable:v2:school-a:student-1:${dateStr()}`, poisoned.timetable);
    store.map.set(`cache:timetable:student-1:${dateStr()}`, poisoned.timetable);
    store.map.set("cache:student-meta:user-1", { id: "student-1", classIds: ["class-foreign"], currentGrade: null });
    state.teachers = { "t-a": { name: "FOREIGN-TEACHER", schoolId: "school-b" } };
    const body = await call();
    expect(text(body)).toContain("LESSON-class-a");
    expect(text(body)).not.toMatch(/FOREIGN-TEACHER|LEGACY-LESSON|class-foreign/);
  });
});

describe("F. academic enrollment invalidation", () => {
  it("hides prior class data once the active academic enrollment ends", async () => {
    expect(text(await call())).toContain("LESSON-class-a");
    state.academic = [{ schoolId: "school-a", status: "TRANSFERRED", academicYear: { isActive: true, startDate: new Date(0), endDate: new Date("2099-01-01") } }];
    const body = await call();
    expect(text(body)).not.toMatch(/class-a|TEACHER-A/);
    expect(body).toMatchObject({ availability: "current", items: [] });
  });
});

describe("H. Redis unavailable with working authority", () => {
  it("computes fresh, correctly scoped data", async () => {
    store.down = true;
    const body = await call();
    expect(text(body)).toContain("LESSON-class-a");
    state.classes = [];
    expect(text(await call())).not.toContain("class-a");
  });
});

describe("I. authority unavailable", () => {
  it("fails closed even when a lastgood snapshot for the previous scope exists", async () => {
    await call();
    expect([...store.map.keys()].some((key) => key.startsWith("cache:today:lastgood:v4:"))).toBe(true);
    mocks.student.mockRejectedValue(new Error("database down"));
    const body = await call();
    expect(body).toMatchObject({ availability: "unavailable", items: [] });
    expect(text(body)).not.toMatch(/class-a|TEACHER-A/);
  });
  it("returns the auth status without reading data when signed out", async () => {
    mocks.role.mockRejectedValue(Object.assign(new Error("Unauthorized"), { status: 401 }));
    expect((await GET()).status).toBe(401);
    expect(mocks.student).not.toHaveBeenCalled();
  });
});

describe("J. shield timeout", () => {
  const hangCompute = () => mocks.work.mockImplementation(() => new Promise(() => {}));
  const timedOut = async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    const pending = GET();
    await vi.advanceTimersByTimeAsync(8_001);
    return (await pending).json();
  };
  it("does not replay an old-scope lastgood after enrollment changed", async () => {
    await call();
    state.classes = [{ id: "class-c", schoolId: "school-a", teacherId: null }];
    hangCompute();
    const body = await timedOut();
    expect(body).toMatchObject({ availability: "unavailable", items: [] });
    expect(text(body)).not.toMatch(/class-a|TEACHER-A/);
  });
  it("does not replay anything when the authority itself does not answer in time", async () => {
    await call();
    mocks.student.mockImplementation(() => new Promise(() => {}));
    const body = await timedOut();
    expect(body).toMatchObject({ availability: "unavailable", items: [] });
    expect(text(body)).not.toMatch(/class-a/);
  });
  it("serves lastgood only for the same, freshly revalidated scope, marked stale", async () => {
    await call();
    // The 15-minute presentation entry has expired; only the scope-bound lastgood remains.
    for (const key of [...store.map.keys()]) if (!key.startsWith("cache:today:lastgood:")) store.map.delete(key);
    hangCompute();
    const body = await timedOut();
    expect(body.availability).toBe("stale");
    expect(text(body)).toContain("LESSON-class-a");
  });
  it("does not replay a lastgood from another school after a school change", async () => {
    await call();
    Object.assign(state, { userSchool: "school-b", studentSchool: "school-b", classes: [{ id: "class-b", schoolId: "school-b", teacherId: null }] });
    hangCompute();
    const body = await timedOut();
    expect(body).toMatchObject({ availability: "unavailable" });
    expect(text(body)).not.toMatch(/class-a|school-a/);
  });
});

describe("Teacher identity revalidation: cached structure, current identity", () => {
  const teacherNames = (body: any) => [...(body.timetable?.periods ?? []), ...(body.schoolDay?.items ?? [])].map((row: any) => row.teacherName);
  const fingerprint = () => enrollmentScopeFingerprint("user-1", { schoolId: "school-a", studentId: "student-1", classes: [{ classId: "class-a" }] });
  it("A: same-school teacher stays visible across a cache hit; identity is re-read each response", async () => {
    expect(teacherNames(await call())).toEqual(["TEACHER-A", "TEACHER-A"]);
    const queries = mocks.work.mock.calls.length;
    expect(teacherNames(await call())).toEqual(["TEACHER-A", "TEACHER-A"]);
    expect(mocks.work.mock.calls.length).toBe(queries);
    expect(mocks.teachers).toHaveBeenCalledTimes(2);
    expect(mocks.teachers.mock.calls[0][0]).toEqual({ where: { id: { in: ["t-a"] }, schoolId: "school-a" }, select: { id: true, schoolId: true, name: true } });
  });
  it("B: teacher moves to another school: next request drops the name, cached structure still served", async () => {
    await call();
    const queries = mocks.work.mock.calls.length;
    state.teachers["t-a"].schoolId = "school-b";
    const body = await call();
    expect(mocks.work.mock.calls.length).toBe(queries);
    expect(text(body)).toContain("LESSON-class-a");
    expect(teacherNames(body)).toEqual([null, null]);
    expect(text(body)).not.toContain("TEACHER-A");
  });
  it("C: teacher deleted or unavailable: no name", async () => {
    await call();
    delete state.teachers["t-a"];
    expect(teacherNames(await call())).toEqual([null, null]);
    state.teachers["t-a"] = { name: "TEACHER-A", schoolId: "school-a" };
    mocks.teachers.mockRejectedValueOnce(new Error("database down"));
    const body = await call();
    expect(text(body)).toContain("LESSON-class-a");
    expect(teacherNames(body)).toEqual([null, null]);
  });
  it("D: names cached in earlier namespaces (v3 and before) are never addressed", async () => {
    const poisoned = { availability: "current", items: [{ id: "x", title: "LEGACY-LESSON" }], schoolDay: { items: [{ teacherName: "FOREIGN-TEACHER" }] }, timetable: { periods: [{ teacherName: "FOREIGN-TEACHER" }] }, schoolId: "school-a" };
    store.map.set(`cache:today:v3:user-1:school-a:${fingerprint()}:${dateStr()}`, poisoned);
    store.map.set(`cache:timetable:v3:school-a:student-1:${fingerprint()}:${dateStr()}`, poisoned.timetable);
    store.map.set(`cache:today:lastgood:v3:user-1:school-a:${fingerprint()}`, { version: "v3", userId: "user-1", schoolId: "school-a", fingerprint: fingerprint(), data: poisoned });
    const body = await call();
    expect(text(body)).toContain("LESSON-class-a");
    expect(text(body)).not.toMatch(/FOREIGN-TEACHER|LEGACY-LESSON/);
  });
  it("E: teacher moves away, then returns: the name reappears after revalidation", async () => {
    await call();
    state.teachers["t-a"].schoolId = "school-b";
    expect(teacherNames(await call())).toEqual([null, null]);
    state.teachers["t-a"].schoolId = "school-a";
    expect(teacherNames(await call())).toEqual(["TEACHER-A", "TEACHER-A"]);
  });
  it("F: multiple teachers: only current-school names, in one lookup", async () => {
    state.classes = [...state.classes, { id: "class-x", schoolId: "school-a", teacherId: "t-x" }];
    state.teachers["t-x"] = { name: "TEACHER-X", schoolId: "school-a" };
    await call();
    state.teachers["t-x"].schoolId = "school-b";
    const body = await call();
    const periods = body.timetable.periods.map((p: any) => [p.classId, p.teacherName]);
    expect(periods).toEqual([["class-a", "TEACHER-A"], ["class-x", null]]);
    expect(text(body)).not.toContain("TEACHER-X");
    expect(mocks.teachers.mock.calls.at(-1)![0].where.id.in.sort()).toEqual(["t-a", "t-x"]);
  });
  it("G: same-scope lastgood after the teacher moved: stale structure returned without the name", async () => {
    await call();
    for (const key of [...store.map.keys()]) if (!key.startsWith("cache:today:lastgood:")) store.map.delete(key);
    state.teachers["t-a"].schoolId = "school-b";
    mocks.work.mockImplementation(() => new Promise(() => {}));
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    const pending = GET();
    await vi.advanceTimersByTimeAsync(8_001);
    const body = await (await pending).json();
    expect(body.availability).toBe("stale");
    expect(text(body)).toContain("LESSON-class-a");
    expect(teacherNames(body)).toEqual([null, null]);
    expect(text(body)).not.toContain("TEACHER-A");
  });
  it("H: timetable cache hit after the teacher moved: structure reused, identity removed", async () => {
    await call();
    for (const key of [...store.map.keys()]) if (key.startsWith("cache:today:v4:")) store.map.delete(key);
    const timetableReads = mocks.timetable.mock.calls.length;
    state.teachers["t-a"].schoolId = "school-b";
    const body = await call();
    expect(mocks.timetable.mock.calls.length).toBe(timetableReads);
    expect(body.timetable.periods.map((p: any) => p.id)).toEqual(["slot-class-a"]);
    expect(teacherNames(body)).toEqual([null, null]);
  });
  it("stores teacher ids, never names, in every Today cache layer", async () => {
    await call();
    const cached = [...store.map.entries()].filter(([key]) => key.includes(":v4:"));
    expect(cached.length).toBe(3);
    for (const [, value] of cached) {
      expect(text(value)).not.toContain("TEACHER-A");
      expect(text(value)).toContain("t-a");
    }
  });
});

describe("One request-level teacher lookup (select structure first, rehydrate identity once)", () => {
  const lookups = async (run: () => Promise<any>) => { const before = mocks.teachers.mock.calls.length; const body = await run(); return { body, count: mocks.teachers.mock.calls.length - before }; };
  const names = (body: any) => [...(body.timetable?.periods ?? []), ...(body.schoolDay?.items ?? [])].map((row: any) => row.teacherName);
  const expireOuter = () => { for (const key of [...store.map.keys()]) if (!key.startsWith("cache:today:lastgood:")) store.map.delete(key); };
  const withClock = async (steps: number[]) => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    const pending = GET();
    for (const ms of steps) await vi.advanceTimersByTimeAsync(ms);
    return (await pending).json();
  };
  it("A: fresh compute with teachers: 1", async () => {
    const { body, count } = await lookups(call);
    expect(count).toBe(1);
    expect(names(body)).toEqual(["TEACHER-A", "TEACHER-A"]);
  });
  it("B: outer cache hit with teachers: 1", async () => {
    await call();
    const reads = mocks.work.mock.calls.length;
    const { count } = await lookups(call);
    expect(mocks.work.mock.calls.length).toBe(reads);
    expect(count).toBe(1);
  });
  it("C: same-scope lastgood with teachers: 1", async () => {
    await call(); expireOuter();
    mocks.work.mockImplementation(() => new Promise(() => {}));
    const { body, count } = await lookups(() => withClock([8_001]));
    expect(body.availability).toBe("stale");
    expect(count).toBe(1);
    expect(names(body)).toEqual(["TEACHER-A", "TEACHER-A"]);
  });
  it("D: no teachers (or no classes): 0", async () => {
    state.classes = [{ id: "class-a", schoolId: "school-a", teacherId: null }];
    expect((await lookups(call)).count).toBe(0);
    state.classes = [];
    expect((await lookups(call)).count).toBe(0);
  });
  it("E: Codex shield boundary: compute delayed ~7.2s and the lookup hangs: 1 attempt, names null", async () => {
    await call(); expireOuter();
    const realWork = mocks.work.getMockImplementation()!;
    mocks.work.mockImplementation((args: any) => new Promise((resolve) => setTimeout(() => resolve(realWork(args)), 7_200)));
    mocks.teachers.mockImplementation(() => new Promise(() => {}));
    const { body, count } = await lookups(() => withClock([7_200, 800, 1_500]));
    expect(count).toBe(1);
    expect(text(body)).toContain("LESSON-class-a");
    expect(names(body)).toEqual([null, null]);
  });
  it("E2: compute loses the shield, lastgood selected, the lookup hangs: still exactly 1 attempt", async () => {
    await call(); expireOuter();
    mocks.work.mockImplementation(() => new Promise(() => {}));
    mocks.teachers.mockImplementation(() => new Promise(() => {}));
    const { body, count } = await lookups(() => withClock([8_001, 1_500]));
    expect(body.availability).toBe("stale");
    expect(count).toBe(1);
    expect(names(body)).toEqual([null, null]);
  });
  it("F: lookup fails: 1 attempted, structure returned with null names", async () => {
    mocks.teachers.mockRejectedValueOnce(new Error("database down"));
    const { body, count } = await lookups(call);
    expect(count).toBe(1);
    expect(text(body)).toContain("LESSON-class-a");
    expect(names(body)).toEqual([null, null]);
  });
  it("G: multiple teachers: 1 bulk lookup", async () => {
    state.classes = [...state.classes, { id: "class-x", schoolId: "school-a", teacherId: "t-x" }];
    state.teachers["t-x"] = { name: "TEACHER-X", schoolId: "school-a" };
    const { count } = await lookups(call);
    expect(count).toBe(1);
    expect(mocks.teachers.mock.calls.at(-1)![0].where.id.in.sort()).toEqual(["t-a", "t-x"]);
  });
  it("H: teacher moves school: 1 lookup and the name is removed", async () => {
    await call();
    state.teachers["t-a"].schoolId = "school-b";
    const { body, count } = await lookups(call);
    expect(count).toBe(1);
    expect(names(body)).toEqual([null, null]);
  });
});
