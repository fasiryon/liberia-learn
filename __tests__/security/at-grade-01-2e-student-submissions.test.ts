/**
 * AT-GRADE-01 batch 2e: student essay, code and AI-literacy submissions (founder rules, 2026-10-27).
 * Covers each of Atlas's 12 REDs (daa9c40fc, grading-authority.test.ts: teacher role denial, idempotency-key reuse for a
 * different lesson / prompt / response, AI exercise/lesson mismatch) with fixtures that model the real availability
 * policy, plus:
 * - availability (AT-SUBMIT-02, founder): the exact lesson must reach the learner through one of their own-school
 *   enrolled classes: a ScheduledWork whose status is "confirmed" or null (legacy; CoS ruling
 *   COS-AT-SUBMIT-02-AVAILABILITY-RULING.md: "suggested", "dismissed" and any other value refused), an ACTIVE TeacherLessonAssignment (released: scheduledFor null or not in the
 *   future, the student listing's rule) or an Assignment of that lesson. School-wide or platform availability alone is
 *   a self-directed path and needs separate authorization, so it is refused. The lesson's own restrictions
 *   (learnerEligibility.learnerRowAllowed) still apply. Unavailable and unknown lessons answer the same 404;
 * - exercise identity: an AI-literacy exercise must belong to the lesson and match the request's promptId and type;
 * - idempotency: a key replays only the same learner's exact canonical request (lesson, prompt, exercise type, exact
 *   answer bytes; no whitespace normalization exists in the documented contract), compared field by field so JSON
 *   property order never creates a conflict; another learner's key gets 409 with none of that learner's data;
 * - non-student callers get 403, never 500;
 * - every refusal happens before any grading provider call, submission write or mastery update.
 * Synthetic identities and mocks only.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Lesson = Record<string, unknown>;
const m = vi.hoisted(() => ({
  actor: { id: "user-A", role: "STUDENT", schoolId: "school-A" } as { id: string; role: string; schoolId: string | null },
  lesson: null as null | Record<string, unknown>,
  existing: null as null | Record<string, unknown>,
  scheduled: true, workStatus: "confirmed" as string | null, assigned: false, assignedFor: null as Date | null, homework: false,
  exercise: null as null | Record<string, unknown>, codeExercise: null as null | Record<string, unknown>,
  create: vi.fn(), update: vi.fn(), essay: vi.fn(), code: vi.fn(), literacy: vi.fn(), answer: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  requireRole: async (...roles: string[]) => {
    if (!roles.includes(m.actor.role)) throw Object.assign(new Error("Forbidden"), { status: 403 });
    return m.actor;
  },
}));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: async () => ({ allowed: true }), rateLimitExceededResponse: () => new Response(null, { status: 429 }) }));
vi.mock("@/lib/grading/gradeEssay", () => ({ gradeEssay: m.essay, isEssayGradeResult: (v: { score?: unknown }) => typeof v.score === "number" }));
vi.mock("@/lib/grading/gradeAILiteracy", () => ({ gradeAILiteracy: m.literacy, isAILiteracyGradeResult: (v: { score?: unknown }) => typeof v.score === "number" }));
vi.mock("@/lib/grading/gradeCode", () => ({ gradeCode: m.code, ALLOWED_LANGUAGE_ID_SET: new Set([71]) }));
vi.mock("@/lib/adaptive/updateMastery", () => ({ recordAnswer: m.answer, buildSkillKey: () => "SCIENCE:G4:unit-A" }));
vi.mock("@/lib/db", () => ({ prisma: {
  student: {
    findFirst: async () => ({ id: "student-A" }),
    findUnique: async () => ({ id: "student-A", enrollments: [{ classId: "class-A", Class: { schoolId: "school-A" } }] }),
  },
  curriculumContent: { findUnique: async () => m.lesson },
  // Honors a status predicate when one is given (OR of { status: value }).
  scheduledWork: { findFirst: async ({ where }: { where: { OR?: Array<{ status?: string | null }> } }) => {
    if (!m.scheduled) return null;
    if (where.OR && !where.OR.some((c) => "status" in c && c.status === m.workStatus)) return null;
    return { id: "work-A" };
  } },
  // Honors an active-assignment predicate when one is given: released means scheduledFor null or not after "now".
  teacherLessonAssignment: { findFirst: async ({ where }: { where: { OR?: Array<{ scheduledFor: null | { lte: Date } }> } }) => {
    if (!m.assigned) return null;
    if (!where.OR) return { id: "tla-A" };
    const released = where.OR.some((c) => (c.scheduledFor === null ? m.assignedFor === null : m.assignedFor !== null && m.assignedFor <= c.scheduledFor.lte));
    return released ? { id: "tla-A" } : null;
  } },
  assignment: { findFirst: async () => (m.homework ? { id: "hw-A" } : null) },
  aILiteracyExercise: { findUnique: async () => m.exercise },
  codeExercise: { findUnique: async () => m.codeExercise },
  gradedSubmission: { findUnique: async () => m.existing, findFirst: async () => m.existing, create: m.create, update: m.update },
} }));

import { POST as essay } from "@/app/api/grading/essay/route";
import { POST as code } from "@/app/api/grading/code/route";
import { POST as literacy } from "@/app/api/grading/ai-literacy/route";

const LESSON: Lesson = { id: "lesson-A", contentId: "content-A", grade: 4, subject: "SCIENCE", title: "Circuits", unitId: "unit-A",
  schoolId: "school-A", teacherCreated: true, visibility: "class_only", versionId: null, curriculumVersion: null, payload: {}, provenance: null };
const ENDPOINTS = [
  { name: "essay", handler: essay, body: { lessonId: "lesson-A", promptId: "essay-prompt", essayText: "My circuit explanation.", clientSubmissionId: "key-1" },
    stored: { exerciseType: "essay", promptId: "essay-prompt", submissionText: "My circuit explanation." }, answerField: "essayText", provider: () => m.essay },
  { name: "code", handler: code, body: { lessonId: "lesson-A", promptId: "code-prompt", sourceCode: "print(1)", languageId: 71, clientSubmissionId: "key-1" },
    stored: { exerciseType: "code", promptId: "code-prompt", submissionText: "print(1)" }, answerField: "sourceCode", provider: () => m.code },
  { name: "AI literacy", handler: literacy, body: { lessonId: "lesson-A", exerciseId: "exercise-A", promptId: "lit-prompt", exerciseType: "ethics_scenario", studentResponse: "Bias can enter through data.", clientSubmissionId: "key-1" },
    stored: { exerciseType: "ai_literacy_ethics_scenario", promptId: "lit-prompt", submissionText: "Bias can enter through data." }, answerField: "studentResponse", provider: () => m.literacy },
] as const;
const post = (handler: (r: Request) => Promise<Response>, body: Record<string, unknown>) =>
  handler(new Request("http://localhost/api/grading", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
const nothingHappened = () => {
  expect(m.create).not.toHaveBeenCalled(); expect(m.update).not.toHaveBeenCalled(); expect(m.answer).not.toHaveBeenCalled();
  expect(m.essay).not.toHaveBeenCalled(); expect(m.code).not.toHaveBeenCalled(); expect(m.literacy).not.toHaveBeenCalled();
};

beforeEach(() => {
  vi.clearAllMocks();
  m.actor = { id: "user-A", role: "STUDENT", schoolId: "school-A" };
  m.lesson = { ...LESSON }; m.existing = null; m.scheduled = true; m.workStatus = "confirmed"; m.assigned = false; m.assignedFor = null; m.homework = false;
  m.exercise = { lessonId: "lesson-A", promptId: "lit-prompt", type: "ethics_scenario", scenario: "Synthetic", studentPromptInstruction: null, rubric: { criteria: [] } };
  m.codeExercise = { lessonId: "lesson-A", languageId: 71, testCases: [{ stdin: "", expectedStdout: "1" }], validatedAt: new Date("2026-01-01") };
  m.create.mockResolvedValue({ id: "new-submission" });
  m.update.mockResolvedValue({ id: "new-submission", score: 0.8, feedback: "ok", gradedAt: new Date(0) });
  m.essay.mockResolvedValue({ score: 0.8, feedback: "ok", breakdown: {} });
  m.code.mockResolvedValue({ score: 1, passed: 1, total: 1, results: [{ passed: true }] });
  m.literacy.mockResolvedValue({ score: 0.8, feedback: "ok", breakdown: {}, tooShort: false });
});

describe.each(ENDPOINTS)("$name", ({ handler, body, stored, answerField, provider }) => {
  const own = (over: Record<string, unknown> = {}) => ({ id: "old-submission", studentId: "student-A", lessonId: "lesson-A", ...stored, score: 0.4, ...over });

  it.each(["TEACHER", "ADMIN", "GUARDIAN"])("a %s gets 403 (not 500) before anything happens", async (role) => {
    m.actor = { ...m.actor, role };
    expect((await post(handler, body)).status).toBe(403);
    nothingHappened();
  });
  it("the learner's own valid submission is graded once and stored for that learner", async () => {
    expect((await post(handler, body)).status).toBe(200);
    expect(m.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ studentId: "student-A", lessonId: "lesson-A", ...stored }) }));
    expect(provider()).toHaveBeenCalledTimes(1);
  });

  describe("idempotency key", () => {
    it.each([["lesson", { lessonId: "other-lesson" }], ["prompt", { promptId: "other-prompt" }], ["response", { submissionText: "other response" }],
      ["exercise type", { exerciseType: "some_other_type" }]])("reused for a different %s: 409, no replay, nothing written", async (_, over) => {
      m.existing = own(over);
      const res = await post(handler, body);
      expect(res.status).toBe(409);
      expect(JSON.stringify(await res.json())).not.toContain("old-submission");
      nothingHappened();
    });
    it("a whitespace-only difference in the answer is a different request (no normalization)", async () => {
      m.existing = own({ submissionText: `${stored.submissionText} ` });
      expect((await post(handler, body)).status).toBe(409);
      nothingHappened();
    });
    it("the same learner's exact request replays the stored submission without grading again", async () => {
      m.existing = own();
      const res = await post(handler, body);
      expect(res.status).toBe(200);
      expect((await res.json()).submission.id).toBe("old-submission");
      nothingHappened();
    });
    it("the same request with its JSON properties in another order still replays (fields, not serialization)", async () => {
      m.existing = own();
      const reordered = Object.fromEntries(Object.entries(body).reverse());
      const res = await post(handler, reordered);
      expect(res.status).toBe(200);
      expect((await res.json()).submission.id).toBe("old-submission");
      nothingHappened();
    });
    it("another learner's key is refused with 409 and none of that learner's data", async () => {
      m.existing = own({ studentId: "student-B", submissionText: "Student B private answer" });
      const res = await post(handler, { ...body, [answerField]: "Student B private answer" });
      expect(res.status).toBe(409);
      const text = JSON.stringify(await res.json());
      expect(text).not.toContain("Student B private answer");
      expect(text).not.toContain("old-submission");
      nothingHappened();
    });
  });

  describe("lesson availability (learnerEligibility)", () => {
    it("refuses a lesson not assigned to any of the learner's classes with the non-disclosing 404", async () => {
      m.scheduled = false;
      const res = await post(handler, body);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "lesson_not_found" });
      nothingHappened();
    });
    it("an unknown lesson answers exactly the same", async () => {
      m.lesson = null;
      const res = await post(handler, body);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "lesson_not_found" });
      nothingHappened();
    });
    it.each([["another school's lesson", { schoolId: "school-B" }], ["a teacher-only lesson", { visibility: "teacher_only" }],
      ["a lesson whose payload is restricted", { payload: { teacherOnly: true } }], ["a revoked governed lesson", { provenance: { lifecycleState: "REVOKED" } }]])("refuses %s", async (_, over) => {
      m.lesson = { ...LESSON, ...over };
      expect((await post(handler, body)).status).toBe(404);
      nothingHappened();
    });
    it("a lesson replay is refused once the lesson is no longer available", async () => {
      m.scheduled = false; m.existing = own();
      expect((await post(handler, body)).status).toBe(404);
      nothingHappened();
    });
    it.each([["an active teacher lesson assignment (no release time)", () => { m.scheduled = false; m.assigned = true; }],
      ["an active teacher lesson assignment (released in the past)", () => { m.scheduled = false; m.assigned = true; m.assignedFor = new Date(Date.now() - 86_400_000); }],
      ["an assignment (homework) of that lesson to the class", () => { m.scheduled = false; m.homework = true; }],
      ["a platform lesson scheduled for the learner's class", () => { m.lesson = { ...LESSON, schoolId: null, teacherCreated: false, visibility: "public" }; }]])("allows %s", async (_, arrange) => {
      arrange();
      expect((await post(handler, body)).status).toBe(200);
    });
    it("allows confirmed scheduled work, and legacy scheduled work with no status", async () => {
      m.workStatus = "confirmed";
      expect((await post(handler, body)).status).toBe(200);
      vi.clearAllMocks();
      m.workStatus = null;
      expect((await post(handler, body)).status).toBe(200);
    });
    it.each(["suggested", "dismissed", "archived"])("refuses %s scheduled work with the non-disclosing 404", async (status) => {
      m.workStatus = status;
      const res = await post(handler, body);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "lesson_not_found" });
      nothingHappened();
    });
    it.each([["an inactive (not yet released) teacher lesson assignment", () => { m.scheduled = false; m.assigned = true; m.assignedFor = new Date(Date.now() + 86_400_000); }],
      ["a school-wide lesson with no class path (self-directed needs separate authorization)", () => { m.scheduled = false; m.lesson = { ...LESSON, visibility: "school_wide" }; }],
      ["a platform lesson with no class path (self-directed needs separate authorization)", () => { m.scheduled = false; m.lesson = { ...LESSON, schoolId: null, teacherCreated: false, visibility: "public" }; }]])("refuses %s with the non-disclosing 404", async (_, arrange) => {
      arrange();
      const res = await post(handler, body);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "lesson_not_found" });
      nothingHappened();
    });
  });
});

describe("exercise identity", () => {
  const body = ENDPOINTS[2].body;
  it.each([["belongs to another lesson", { lessonId: "other-lesson" }], ["has another promptId", { promptId: "other-prompt" }],
    ["is of another type", { type: "bias_detection" }]])("an AI-literacy exercise that %s is refused before grading", async (_, over) => {
    m.exercise = { ...m.exercise, ...over };
    expect((await post(literacy, body)).status).toBe(404);
    nothingHappened();
  });
  it("a code exercise of another lesson stays refused (existing server-held check)", async () => {
    m.codeExercise = { ...m.codeExercise, lessonId: "other-lesson" };
    expect((await post(code, ENDPOINTS[1].body)).status).toBe(404);
    nothingHappened();
  });
});
