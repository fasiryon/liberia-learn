/**
 * December assurance — BOLA via idempotency keys on in-lesson grading.
 *
 * A client-supplied clientSubmissionId must only replay the caller's own
 * submission. Before the fix, /api/grading/code and /api/grading/ai-literacy
 * returned any learner's stored submission (text, score, feedback) for a
 * reused key.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockStudentFindFirst = vi.hoisted(() => vi.fn());
const mockGradedFindUnique = vi.hoisted(() => vi.fn());
const mockGradedCreate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    student: { findFirst: mockStudentFindFirst },
    gradedSubmission: { findUnique: mockGradedFindUnique, create: mockGradedCreate, update: vi.fn() },
    aILiteracyExercise: { findUnique: vi.fn() },
    curriculumContent: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn().mockResolvedValue({ id: "user-attacker", role: "STUDENT", schoolId: "school-1" }),
}));
vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  rateLimitExceededResponse: vi.fn(),
}));
vi.mock("@/lib/adaptive/updateMastery", () => ({ recordAnswer: vi.fn(), buildSkillKey: vi.fn() }));
vi.mock("@/lib/grading/gradeCode", () => ({ gradeCode: vi.fn(), ALLOWED_LANGUAGE_ID_SET: new Set([71]) }));
vi.mock("@/lib/grading/gradeAILiteracy", () => ({ gradeAILiteracy: vi.fn(), isAILiteracyGradeResult: vi.fn() }));

const victimSubmission = {
  id: "gs-victim",
  studentId: "student-victim",
  submissionText: "victim private answer",
  feedback: "victim feedback",
  score: 0.4,
};

function post(url: string, body: unknown) {
  return new Request(url, { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
}

describe("grading idempotency keys are bound to the submitting learner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStudentFindFirst.mockResolvedValue({ id: "student-attacker" });
  });

  it("code grading refuses to replay another learner's submission", async () => {
    mockGradedFindUnique.mockResolvedValue(victimSubmission);
    const { POST } = await import("@/app/api/grading/code/route");
    const res = await POST(post("http://localhost/api/grading/code", {
      lessonId: "lesson-1", promptId: "p-1", sourceCode: "print(1)", languageId: 71, clientSubmissionId: "shared-key",
    }));
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(JSON.stringify(json)).not.toContain("victim");
    expect(mockGradedCreate).not.toHaveBeenCalled();
  });

  it("code grading still replays the caller's own submission", async () => {
    mockGradedFindUnique.mockResolvedValue({ ...victimSubmission, studentId: "student-attacker" });
    const { POST } = await import("@/app/api/grading/code/route");
    const res = await POST(post("http://localhost/api/grading/code", {
      lessonId: "lesson-1", promptId: "p-1", sourceCode: "print(1)", languageId: 71, clientSubmissionId: "own-key",
    }));
    expect(res.status).toBe(200);
    expect((await res.json()).submission.id).toBe("gs-victim");
  });

  it("AI-literacy grading refuses to replay another learner's submission", async () => {
    mockGradedFindUnique.mockResolvedValue(victimSubmission);
    const { POST } = await import("@/app/api/grading/ai-literacy/route");
    const res = await POST(post("http://localhost/api/grading/ai-literacy", {
      lessonId: "lesson-1", exerciseId: "ex-1", promptId: "p-1", exerciseType: "ethics_scenario",
      studentResponse: "my answer", clientSubmissionId: "shared-key",
    }));
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(JSON.stringify(json)).not.toContain("victim");
    expect(mockGradedCreate).not.toHaveBeenCalled();
  });
});
