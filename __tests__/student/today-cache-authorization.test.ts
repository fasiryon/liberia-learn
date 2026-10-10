// PR #179 P1: cache is not authority on GET /api/student/today. Every response must be gated by the
// learner's CURRENT enrollment scope (lib/student/enrollmentReadModel.ts). A Redis-like key store backs
// the route's caches so a stale entry could actually be replayed if any layer were keyed by user alone.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({ map: new Map<string, unknown>(), down: false }));
const mocks = vi.hoisted(() => ({ role: vi.fn(), student: vi.fn(), work: vi.fn(), assignment: vi.fn(), timetable: vi.fn() }));

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
vi.mock("@/lib/db", () => ({ prisma: { student: { findUnique: mocks.student }, scheduledWork: { findMany: mocks.work }, assignment: { findMany: mocks.assignment } } }));

import { GET } from "@/app/api/student/today/route";

type Klass = { id: string; schoolId: string; teacher: { name: string; schoolId: string } | null };
const state = {
  userSchool: "school-a",
  studentSchool: "school-a",
  classes: [] as Klass[],
  academic: [] as Array<{ schoolId: string; status: string; academicYear: { isActive: boolean; startDate: Date; endDate: Date } }>,
};
const dateStr = () => new Date().toISOString().slice(0, 10);
const call = async () => (await GET()).json();
const text = (body: unknown) => JSON.stringify(body);

beforeEach(() => {
  store.map.clear(); store.down = false;
  Object.assign(state, { userSchool: "school-a", studentSchool: "school-a", academic: [],
    classes: [{ id: "class-a", schoolId: "school-a", teacher: { name: "TEACHER-A", schoolId: "school-a" } }] });
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.role.mockImplementation(async () => ({ id: "user-1", role: "STUDENT", schoolId: state.userSchool }));
  // The enrollment authority's single read, honouring its own-school enrollment filter.
  mocks.student.mockImplementation(async ({ where, select }: any) => where.userId !== "user-1" ? null : {
    id: "student-1", currentGrade: null, deletedAt: null, user: { schoolId: state.studentSchool }, academicEnrollments: state.academic,
    enrollments: state.classes.filter((c) => !select.enrollments.where || c.schoolId === select.enrollments.where.Class.schoolId)
      .map((c) => ({ classId: c.id, Class: { id: c.id, name: `NAME-${c.id}`, subject: "MATH", gradeLevel: 4, schoolId: c.schoolId, Teacher: c.teacher, School: { name: `SCHOOL-${c.schoolId}` } } })),
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
      teacherName: c.teacher?.schoolId === schoolId ? c.teacher.name : null, assignment: null })) }));
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
    state.classes = [{ id: "class-c", schoolId: "school-a", teacher: null }];
    const body = await call();
    expect(text(body)).toContain("LESSON-class-c");
    expect(text(body)).not.toMatch(/class-a|TEACHER-A/);
  });
});

describe("C. school change", () => {
  it("never returns School A data after the learner moves to School B, though School A entries remain", async () => {
    expect(text(await call())).toContain("LESSON-class-a");
    const cachedBefore = store.map.size;
    Object.assign(state, { userSchool: "school-b", studentSchool: "school-b", classes: [...state.classes, { id: "class-b", schoolId: "school-b", teacher: { name: "TEACHER-B", schoolId: "school-b" } }] });
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
    state.classes = [{ id: "class-a", schoolId: "school-a", teacher: { name: "FOREIGN-TEACHER", schoolId: "school-b" } }];
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
    expect([...store.map.keys()].some((key) => key.startsWith("cache:today:lastgood:v3:"))).toBe(true);
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
    state.classes = [{ id: "class-c", schoolId: "school-a", teacher: null }];
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
    Object.assign(state, { userSchool: "school-b", studentSchool: "school-b", classes: [{ id: "class-b", schoolId: "school-b", teacher: null }] });
    hangCompute();
    const body = await timedOut();
    expect(body).toMatchObject({ availability: "unavailable" });
    expect(text(body)).not.toMatch(/class-a|school-a/);
  });
});
