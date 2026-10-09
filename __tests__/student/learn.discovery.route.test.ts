import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

type Row = Record<string, any>;
const state = vi.hoisted(() => ({ contents: [] as Row[], assignments: [] as Row[], scheduled: [] as Row[], targeting: [] as Row[],
  exams: [] as Row[], years: [] as Row[], passes: [] as Row[], checksEnabled: false, stalled: false,
  student: null as Row | null, fail: false, targetingFail: false, enrolled: true, writes: vi.fn() }));
const requireRole = vi.hoisted(() => vi.fn());

function matches(row: any, where: any): boolean {
  return Object.entries(where ?? {}).every(([key, test]: [string, any]) => {
    if (key === "AND") return test.every((part: any) => matches(row, part));
    if (key === "OR") return test.some((part: any) => matches(row, part));
    const value = row?.[key];
    if (test === null) return value == null;
    if (typeof test !== "object") return value === test;
    if ("in" in test) return test.in.includes(value);
    if ("not" in test) return value !== test.not;
    if ("is" in test) return test.is === null ? value == null : value != null && matches(value, test.is);
    if ("some" in test) return Array.isArray(value) && value.some((entry: any) => matches(entry, test.some));
    if ("gte" in test || "lte" in test) return (!test.gte || value >= test.gte) && (!test.lte || value <= test.lte);
    return value != null && matches(value, test);
  });
}

vi.mock("@/lib/auth", () => ({ requireRole, requireUser: requireRole }));
vi.mock("@/lib/autonomous/signals/productSignalService", () => ({ logProductSignal: vi.fn() }));
vi.mock("@/lib/media/blobStorage", () => ({ signHero: async () => null, signInlineIllustrations: async () => [] }));
vi.mock("@/lib/serverFlags", async (original) => ({ ...await original<any>(), isExamSystemEnabled: () => state.checksEnabled }));
vi.mock("@/lib/db", () => {
  const client: any = {
    exam: { findMany: async ({ where }: any) => state.exams.filter((row) => matches(row, where)), findFirst: async ({ where }: any) => state.exams.find((row) => matches(row, where)) ?? null },
    academicEnrollment: { findMany: async ({ where }: any) => state.years.filter((row) => matches(row, where)), findFirst: async ({ where }: any) => state.years.find((row) => matches(row, where)) ?? null },
    examAttempt: { findMany: async ({ where }: any) => state.passes.filter((row) => matches(row, where)), findFirst: async ({ where }: any) => where.passed ? state.passes.find((row) => matches(row, where)) ?? null : { id: "existing-attempt", startedAt: new Date() }, create: state.writes },
    student: { findUnique: async () => { if (state.fail) throw new Error("PRIVATE_DATABASE_ERROR"); if (state.stalled) return new Promise(() => {}); return state.student; } },
    curriculumContent: {
      findMany: async ({ where, take, skip = 0 }: any) => state.contents.filter((row) => matches(row, where)).slice(skip, skip + take),
      findFirst: async ({ where }: any) => state.contents.find((row) => matches(row, where)) ?? null,
    },
    assignment: { findMany: async ({ where, take }: any) => state.assignments.filter((row) => matches(row, where)).slice(0, take) },
    teacherAction: { findMany: async ({ where }: any) => {
      if (state.targetingFail) throw new Error("targeting unavailable");
      return state.targeting.filter((row) => where.targetId.in.includes(row.targetId));
    } },
    scheduledWork: {
      findMany: async ({ where, take }: any) => state.scheduled.filter((row) => matches(row, where)).slice(0, take),
      findFirst: async ({ where }: any) => state.scheduled.find((row) => matches(row, where)) ?? null,
      findUnique: async ({ where }: any) => state.scheduled.find((row) => row.id === where.id) ?? null,
      create: state.writes,
    },
    teacherLessonAssignment: { findFirst: async () => null },
    curriculumUnit: { findFirst: async () => null },
    studentProgress: { findMany: async () => [], create: state.writes },
    lessonPrerequisite: { findMany: async () => [] },
    enrollment: { findUnique: async () => state.enrolled ? { id: "enrollment" } : null, findFirst: async ({ where }: any) => state.student?.enrollments.some((row: Row) => row.classId === where.classId && row.Class.schoolId === where.Class.schoolId && where.studentId === state.student!.id) ? { id: "enrollment" } : null },
    timetableAssignment: { findFirst: async () => null },
    curriculumGovernanceEvent: { findFirst: async () => null },
    curriculumContentRevision: { findFirst: async () => null },
  };
  return { prisma: { ...client, $transaction: async (callback: (tx: unknown) => unknown) => callback(client) } };
});

import { GET } from "@/app/api/student/learn/route";
import { GET as unitActive } from "@/app/api/student/units/active/route";
import { POST as startCheck } from "@/app/api/student/exams/[examId]/start/route";
import { GET as detail } from "@/app/api/curriculum/[contentId]/route";
import { GET as workDetail } from "@/app/api/student/work/[scheduledWorkId]/route";
import { GET as unitByContent } from "@/app/api/student/units/by-content/[contentId]/route";
import { GET as lessonList } from "@/app/api/student/lessons/route";

const user = { id: "user-a", role: "STUDENT", schoolId: "school-a" };
function content(contentId = "lesson-a", changes: Row = {}): Row {
  return { id: `row-${contentId}`, contentId, title: "Fractions", grade: 4, subject: "MATH", contentType: "lesson",
    status: "published", visibility: "public", schoolId: null, teacherCreated: false, versionId: null,
    provenance: null, unitId: "math-g4-fractions", orderInUnit: 1, lessonType: "core", version: "1",
    payload: { body: "Learner content", answerKey: "SECRET_ANSWER", teacherNotes: "SECRET_NOTES", rawModel: "SECRET_MODEL" },
    audioAssets: [], videoSupplements: [], createdAt: new Date(), updatedAt: new Date(), ...changes };
}
function assignment(id = "assignment-a", changes: Row = {}): Row {
  return { id, title: "Practice fractions", classId: "class-a", contentId: "lesson-a", scheduledWorkId: null,
    Class: { schoolId: "school-a", subject: "MATH" }, dueAt: null, ...changes };
}
function schedule(id = "schedule-a", changes: Row = {}): Row {
  return { id, contentId: "lesson-a", classId: "class-a", scheduledDate: new Date(),
    class: { schoolId: "school-a", id: "class-a", name: "Class", Teacher: { name: "Teacher" }, School: { name: "School" } },
    content: state.contents[0], progress: [{ startedAt: new Date() }], ...changes };
}
async function model() { return (await GET()).json(); }
async function open(contentId: string) { return detail(new Request(`http://localhost/api/curriculum/${contentId}`), { params: { contentId } }); }
async function openWork(id = "schedule-a") { return workDetail(new NextRequest(`http://localhost/api/student/work/${id}`), { params: Promise.resolve({ scheduledWorkId: id }) }); }

beforeEach(() => {
  state.exams = []; state.years = []; state.passes = []; state.checksEnabled = false; state.stalled = false;
  state.contents = [content()]; state.assignments = []; state.scheduled = []; state.targeting = [];
  state.fail = false; state.targetingFail = false; state.enrolled = true; state.writes.mockReset();
  state.student = { id: "student-a", currentGrade: 4, deletedAt: null, user: { schoolId: "school-a" },
    enrollments: [{ classId: "class-a", Class: { schoolId: "school-a", subject: "MATH" } },
      { classId: "class-b", Class: { schoolId: "school-b", subject: "SCIENCE" } }] };
  requireRole.mockReset(); requireRole.mockResolvedValue(user);
});

describe("Learn discovery authorization and display contract", () => {
  it("a discovery deadline is unavailable, never a confirmed empty lesson catalog", async () => {
    vi.useFakeTimers();
    try {
      state.stalled = true;
      const pending = lessonList(new NextRequest("http://localhost/api/student/lessons"));
      await vi.advanceTimersByTimeAsync(8_001);
      const response = await pending; expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ availability: "unavailable" });
    } finally { vi.useRealTimers(); }
  });
  it("counts final eligible lessons across candidate pages and paginates the same set", async () => {
    state.contents = Array.from({ length: 125 }, (_, index) => content(`lesson-${index}`, index % 5 === 0 ? { payload: { teacherOnly: true } } : {}));
    const response = await lessonList(new NextRequest("http://localhost/api/student/lessons?page=9"));
    const body = await response.json(); expect(body.total).toBe(100); expect(body.count).toBe(4); expect(body.availability).toBe("current");
    for (const item of body.items) expect((await open(item.contentId)).status).toBe(200);
    expect((await model()).lessons.total).toBe(100);
  });
  it("does not mistake a candidate batch of denied content for an empty authorized resource catalog", async () => {
    state.contents = [...Array.from({ length: 100 }, (_, index) => content(`hidden-${index}`, { payload: { teacherOnly: true } })), content("visible-last")];
    const body = await model(); expect(body.lessons.total).toBe(1);
    expect(body.resources.items.map((item: Row) => item.id)).toEqual(["visible-last"]);
    expect((await open(body.resources.items[0].id)).status).toBe(200);
  });
  it("confirms genuinely empty lessons and preserves enrolled subjects without scheduled work", async () => {
    state.contents = []; const body = await (await lessonList(new NextRequest("http://localhost/api/student/lessons"))).json();
    expect(body).toMatchObject({ availability: "current", total: 0, items: [] });
    expect((await model()).subjects).toEqual([{ subject: "MATH", label: "MATH" }]);
  });
  it("keeps an authorized assignment visible with an explicit non-openable lesson state", async () => {
    state.contents = [content("lesson-a", { provenance: { lifecycleState: "REVOKED" } })]; state.assignments = [assignment()];
    const body = await model(); expect(body.assignedWork.items[0]).toMatchObject({ state: "unavailable", locked: true, reason: "This activity is not available", href: null, lessonHref: null, content: null });
    expect((await open("lesson-a")).status).toBe(410);
    expect(JSON.stringify(body)).not.toContain("REVOKED");
  });
  it("distinguishes no active units, no enrollment and unavailable dependency", async () => {
    expect(await (await unitActive()).json()).toMatchObject({ availability: "empty", eligibility: "eligible", items: [] });
    state.student!.enrollments = [];
    expect(await (await unitActive()).json()).toMatchObject({ availability: "empty", eligibility: "not_enrolled", items: [] });
    state.fail = true; const response = await unitActive(); expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ availability: "unavailable", items: [] });
  });
  it("truthfully defers compiled resources and never fabricates offline/project availability", async () => {
    state.contents = []; const body = await model();
    expect(body.resources).toMatchObject({ availability: "empty", items: [], compiledBooks: "deferred", destinations: [{ title: "Textbooks", href: "/student/textbooks" }] });
    expect(body.checks).toMatchObject({ availability: "unavailable", items: [] });
  });
  it("checks are bounded display summaries with direct start authorization parity", async () => {
    state.checksEnabled = true;
    const exam = { id: "exam-a", title: "Fractions check", subject: "MATH", schoolId: "school-a", grade: 4, status: "PUBLISHED", deletedAt: null, classId: "class-a", academicYearId: "year-a", class: { schoolId: "school-a" }, questions: [{ correctIndex: 1, prompt: "SECRET_QUESTION", explanation: "SECRET_EXPLANATION" }], readiness: "SECRET_READINESS", passingScore: 70 };
    state.years = [{ studentId: "student-a", schoolId: "school-a", academicYearId: "year-a" }];
    state.exams = [exam, { ...exam, id: "foreign-school", schoolId: "school-b" }, { ...exam, id: "foreign-class", classId: "other" }, { ...exam, id: "foreign-year", academicYearId: "year-b" }, { ...exam, id: "draft", status: "DRAFT" }, { ...exam, id: "deleted", deletedAt: new Date() }];
    const body = await model(); expect(body.checks).toMatchObject({ availability: "current", total: 1 }); expect(body.checks.items.map((item: Row) => item.id)).toEqual(["exam-a"]);
    expect(body.checks.items[0]).toMatchObject({ state: "open", locked: false, href: "/student/exams/exam-a" });
    expect((await startCheck(new NextRequest("http://localhost/api/student/exams/exam-a/start"), { params: { examId: "exam-a" } })).status).toBe(200);
    for (const [id, status] of [["foreign-school", 404], ["foreign-class", 403], ["foreign-year", 403], ["unknown", 404]] as const) expect((await startCheck(new NextRequest(`http://localhost/api/student/exams/${id}/start`), { params: { examId: id } })).status).toBe(status);
    for (const secret of ["SECRET_QUESTION", "SECRET_EXPLANATION", "SECRET_READINESS", "questions", "correctIndex", "passingScore", "rubric", "governance", "provenance", "teacherNotes"]) expect(JSON.stringify(body)).not.toContain(secret);
    expect(state.writes).not.toHaveBeenCalled();
  });
  it("already-passed checks cannot appear as openable new attempts", async () => {
    state.checksEnabled = true; state.exams = [{ id: "exam-a", title: "Check", subject: "MATH", schoolId: "school-a", grade: 4, status: "PUBLISHED", deletedAt: null, classId: null, academicYearId: null }];
    state.passes = [{ examId: "exam-a", studentId: "student-a", passed: true }];
    expect((await model()).checks.items[0]).toMatchObject({ state: "unavailable", locked: true, href: null, reason: "This check is already completed" });
  });
  it.each([401, 403])("preserves authentication/role denial %s before database access", async (status) => {
    requireRole.mockRejectedValue(Object.assign(new Error("private auth error"), { status }));
    const response = await GET(); expect(response.status).toBe(status);
    expect(requireRole).toHaveBeenCalledWith("STUDENT");
    expect(await response.text()).not.toContain("private auth error");
  });
  it("only lists openable lessons/readings and preserves the separate authority boundary", async () => {
    state.scheduled = [schedule()]; state.assignments = [assignment()];
    const response = await GET(); const body = await response.json();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(body).toMatchObject({ availability: "current", freshness: "current", currentLearning: {
      availability: "separate", endpoint: "/api/student/learning-authority/next-action" }, search: { availability: "deferred" } });
    expect(body.activeUnits.items).toHaveLength(1); expect(body.assignedWork.items).toHaveLength(1);
    for (const lesson of [...body.lessons.items, ...body.resources.items, ...body.activeUnits.items[0].lessons]) expect((await open(lesson.contentId)).status).toBe(200);
    expect((await openWork()).status).toBe(200);
    expect(state.writes).not.toHaveBeenCalled();
    for (const secret of ["SECRET_ANSWER", "SECRET_NOTES", "SECRET_MODEL", "payload", "provenance", "schoolId", "teacherCreated", "answerKey", "scoringKey", "governance", "savedOffline", "synced"]) expect(JSON.stringify(body)).not.toContain(secret);
  });
  it("includes targeted work only for the actual learner and never foreign-class/school assignments", async () => {
    state.assignments = [assignment(), assignment("foreign-learner"), assignment("foreign-class", { classId: "class-other" }),
      assignment("foreign-school", { classId: "class-b", Class: { schoolId: "school-b", subject: "MATH" } })];
    state.targeting = [{ targetId: "foreign-learner", metadata: { targetStudentIds: ["student-other"] } }];
    expect((await model()).assignedWork.items.map((a: Row) => a.id)).toEqual(["assignment-a"]);
  });
  it("fails closed when assignment audience cannot be read", async () => {
    state.assignments = [assignment()]; state.targetingFail = true;
    const response = await GET(); expect(response.status).toBe(503);
    expect((await response.json()).assignedWork.items).toEqual([]);
  });
  it("malformed targeting cannot broaden a private assignment to the whole class", async () => {
    state.assignments = [assignment()];
    state.targeting = [{ targetId: "assignment-a", metadata: { targetStudentIds: "student-other" } }];
    const response = await GET(); expect(response.status).toBe(503);
    expect((await response.json()).assignedWork.items).toEqual([]);
  });
  it("supports standalone authorized assignments without inventing a lesson", async () => {
    state.contents = []; state.assignments = [assignment("standalone", { contentId: null })];
    const body = await model(); expect(body.assignedWork.items[0].content).toBeNull(); expect(body.lessons.items).toEqual([]);
  });
  it("resolves past assigned schedules safely without treating them as active units", async () => {
    state.scheduled = [schedule("old", { scheduledDate: new Date("2020-01-01") })];
    state.assignments = [assignment("old-assignment", { scheduledWorkId: "old" })];
    const body = await model(); expect(body.assignedWork.items).toHaveLength(1); expect(body.activeUnits.items).toEqual([]);
  });
  it.each([
    ["foreign-school", { schoolId: "school-b", visibility: "school_wide" }],
    ["unenrolled school-class", { schoolId: "school-a", teacherCreated: true, visibility: "class_only" }],
    ["teacher-only", { visibility: "teacher_only" }],
    ["teacher audience", { payload: { audience: "teacher" } }],
    ["pending", { status: "pending_approval" }], ["rejected", { status: "rejected" }],
    ["revoked", { provenance: { lifecycleState: "REVOKED" } }],
    ["pending lifecycle", { provenance: { lifecycleState: "PENDING_REVIEW" } }],
    ["inactive version", { versionId: "v1", curriculumVersion: { status: "ARCHIVED" } }],
    ["unreleased native", { payload: { curriculumV2: { contractVersion: "broken" } } }],
  ] as Array<[string, Row]>)("excludes %s from all discovery and scheduled detail", async (name, changes) => {
    state.contents = [content("lesson-a", changes)]; state.assignments = [assignment()]; state.scheduled = [schedule()];
    if (name === "unenrolled school-class") { state.scheduled[0].classId = "other-class"; state.enrolled = false; }
    const body = await model();
    expect(body.lessons.items).toEqual([]); expect(body.resources.items).toEqual([]); expect(body.activeUnits.items).toEqual([]); expect(body.assignedWork.items.every((item: Row) => item.locked && item.content === null)).toBe(true);
    expect((await open("lesson-a")).status).not.toBe(200);
    expect((await openWork()).status).not.toBe(200); expect(state.writes).not.toHaveBeenCalled();
  });
  it("unknown resources and foreign lessons have no public fallback", async () => {
    expect((await open("unknown-resource")).status).toBe(404);
    state.contents = [content("foreign", { schoolId: "school-b" })];
    expect((await open("foreign")).status).toBe(404); expect((await model()).resources.items).toEqual([]);
  });
  it("foreign and unenrolled schedules cannot become active units or assignment lesson links", async () => {
    state.scheduled = [schedule("foreign", { classId: "class-b", class: { schoolId: "school-b" } }), schedule("unenrolled", { classId: "other" })];
    state.assignments = [assignment("foreign-link", { scheduledWorkId: "foreign" }), assignment("unenrolled-link", { scheduledWorkId: "unenrolled" })];
    const body = await model(); expect(body.assignedWork.items).toEqual([]); expect(body.activeUnits.items).toEqual([]);
    expect((await openWork("foreign")).status).toBe(403);
    state.enrolled = false; expect((await openWork("unenrolled")).status).toBe(403);
  });
  it("does not allow a forged unit delivery link or foreign current content", async () => {
    const response = await unitByContent(new Request("http://localhost/api/student/units/by-content/lesson-a?sw=foreign"), { params: { contentId: "lesson-a" } });
    const body = await response.json(); expect(body.lessons[0].href).toBe("/student/lesson/lesson-a");
    expect(body.lessons[0].scheduledWorkId).toBeNull();
    state.contents.push(content("foreign", { schoolId: "school-b" }));
    expect((await unitByContent(new Request("http://localhost/api/student/units/by-content/foreign"), { params: { contentId: "foreign" } })).status).toBe(404);
  });
  it.each([null, 0])("no placement grade %s has no broad catalog fallback or fabricated plan", async (grade) => {
    state.student!.currentGrade = grade;
    const body = await model(); expect(body.lessons.items).toEqual([]); expect(body.resources.items).toEqual([]); expect(body.availability).toBe("empty");
    expect(body.currentLearning.availability).toBe("separate");
  });
  it("an unenrolled student gets empty discovery without all-subject fallback", async () => {
    state.student!.enrollments = []; state.assignments = [assignment()]; state.scheduled = [schedule()];
    const body = await model(); expect(body).toMatchObject({ availability: "empty", subjects: [], lessons: { items: [] }, activeUnits: { items: [], eligibility: "not_enrolled" }, assignedWork: { items: [] }, resources: { items: [] } });
  });
  it("empty is a successful current read, distinct from unavailable", async () => {
    state.contents = []; const response = await GET(); expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ availability: "empty", freshness: "current" });
  });
  it.each(["missing", "deleted", "changed-school"])("%s student context fails closed", async (reason) => {
    if (reason === "missing") state.student = null;
    if (reason === "deleted") state.student!.deletedAt = new Date();
    if (reason === "changed-school") state.student!.user.schoolId = "school-b";
    expect(await model()).toMatchObject({ availability: "unavailable", lessons: { items: [] }, resources: { items: [] } });
  });
  it("does not replay stale authorization after revocation or a dependency failure", async () => {
    expect((await model()).lessons.items).toHaveLength(1);
    state.contents[0].provenance = { lifecycleState: "REVOKED" };
    expect((await model()).lessons.items).toEqual([]);
    state.fail = true; const response = await GET(); expect(response.status).toBe(503);
    const body = await response.json(); expect(body).toMatchObject({ availability: "unavailable", freshness: "unavailable", lessons: { items: [] } });
    expect(JSON.stringify(body)).not.toContain("PRIVATE_DATABASE_ERROR");
    expect((await lessonList(new NextRequest("http://localhost/api/student/lessons"))).status).toBe(503);
  });
});
