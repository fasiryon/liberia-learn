/**
 * __tests__/grading.essay.test.ts  — NR-14C Phase 1
 *
 * Tests for:
 *   1. gradeEssay — weighted rubric scoring, malformed JSON, too-short guard
 *   2. POST /api/grading/essay — idempotency, mastery wiring, advisory flag
 *   3. PATCH /api/grading/[submissionId]/override — teacher override path
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    student: { findFirst: vi.fn() },
    curriculumContent: { findUnique: vi.fn() },
    gradedSubmission: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn().mockResolvedValue({ id: "user-1", role: "STUDENT" }),
}));

vi.mock("@/lib/ai/router", () => ({
  routedCompletion: vi.fn(),
}));

vi.mock("@/lib/adaptive/updateMastery", () => ({
  recordAnswer: vi.fn().mockResolvedValue({ score: 0.8, mastered: false }),
  buildSkillKey: vi
    .fn()
    .mockReturnValue("ENGLISH:G8:unit-essay"),
}));

// NR-9.6: moderateText internally calls routedCompletion too (a different
// module, @/lib/ai/routedCompletion, but mocking it separately avoids any
// ambiguity and keeps existing call-count assertions on mockRouted accurate.
const mockModerateText = vi.hoisted(() =>
  vi.fn(async (): Promise<{ verdict: "SAFE" | "UNSAFE" | "UNCERTAIN"; reason?: string }> => ({
    verdict: "SAFE",
  }))
);
const mockEnqueueEscalation = vi.hoisted(() => vi.fn(async () => ({ id: "escalation-1" })));
vi.mock("@/lib/agents/moderation", () => ({ moderateText: mockModerateText }));
vi.mock("@/lib/agents/escalation", () => ({ enqueueEscalation: mockEnqueueEscalation }));

import { gradeEssay, isEssayGradeResult, DEFAULT_RUBRIC, MIN_WORDS_TO_GRADE } from "@/lib/grading/gradeEssay";
import { prisma } from "@/lib/db";
import { routedCompletion } from "@/lib/ai/router";
import { requireRole } from "@/lib/auth";

const mockPrisma = prisma as any;
const mockRouted = routedCompletion as any;
const mockRequireRole = requireRole as any;

// ── gradeEssay unit tests ─────────────────────────────────────────────────────

describe("gradeEssay", () => {
  beforeEach(() => vi.clearAllMocks());

  const goodEssay = "The ".repeat(100) + "end."; // ~101 words
  const baseInput = {
    essayText: goodEssay,
    grade: 8,
    subject: "ENGLISH",
    prompt: "Write about the importance of education in Liberia.",
  };

  it("returns weighted score from criterion scores", async () => {
    mockRouted.mockResolvedValueOnce({
      content: JSON.stringify({
        criteria: {
          content:   { score: 0.9, comment: "Strong ideas." },
          structure: { score: 0.8, comment: "Well organized." },
          language:  { score: 0.7, comment: "Good vocabulary." },
          mechanics: { score: 1.0, comment: "No errors." },
        },
        feedback: "Excellent essay! Keep it up.",
      }),
    });

    const raw = await gradeEssay(baseInput);
    expect(raw.tooShort).toBe(false);
    expect(isEssayGradeResult(raw)).toBe(true);
    const result = raw as import("@/lib/grading/gradeEssay").EssayGradeResult;

    // Weighted: 0.9*0.35 + 0.8*0.25 + 0.7*0.25 + 1.0*0.15
    const expected = 0.9 * 0.35 + 0.8 * 0.25 + 0.7 * 0.25 + 1.0 * 0.15;
    expect(result.score).toBeCloseTo(expected, 4);
    expect(result.feedback).toBe("Excellent essay! Keep it up.");
    expect(Object.keys(result.breakdown)).toHaveLength(DEFAULT_RUBRIC.criteria.length);
  });

  it("handles malformed LLM JSON gracefully — returns neutral score", async () => {
    mockRouted.mockResolvedValueOnce({ content: "not-valid-json-at-all" });

    const raw = await gradeEssay(baseInput);
    expect(raw.tooShort).toBe(false);
    const result = raw as import("@/lib/grading/gradeEssay").EssayGradeResult;

    // Neutral fallback: 0.5 per criterion × weight = 0.5 overall
    expect(result.score).toBeCloseTo(0.5, 2);
    expect(result.breakdown).toBeDefined();
  });

  it("handles JSON wrapped in code fences", async () => {
    const json = JSON.stringify({
      criteria: {
        content:   { score: 1.0, comment: "Perfect." },
        structure: { score: 1.0, comment: "Perfect." },
        language:  { score: 1.0, comment: "Perfect." },
        mechanics: { score: 1.0, comment: "Perfect." },
      },
      feedback: "Outstanding!",
    });
    mockRouted.mockResolvedValueOnce({ content: "```json\n" + json + "\n```" });

    const raw = await gradeEssay(baseInput);
    expect(raw.tooShort).toBe(false);
    const result = raw as import("@/lib/grading/gradeEssay").EssayGradeResult;
    expect(result.score).toBeCloseTo(1.0, 2);
  });

  it(`returns tooShort when essay is under ${MIN_WORDS_TO_GRADE} words`, async () => {
    const shortEssay = "This is short."; // 3 words
    const result = await gradeEssay({ ...baseInput, essayText: shortEssay });
    expect(result.tooShort).toBe(true);
    if (!result.tooShort) return;
    expect(result.wordCount).toBe(3);
    expect(result.minWords).toBe(MIN_WORDS_TO_GRADE);
    // AI must NOT be called for too-short essays
    expect(mockRouted).not.toHaveBeenCalled();
  });

  it(`accepts an essay at exactly ${MIN_WORDS_TO_GRADE} words`, async () => {
    const borderlineEssay = "Word ".repeat(MIN_WORDS_TO_GRADE).trim();
    mockRouted.mockResolvedValueOnce({
      content: JSON.stringify({
        criteria: {
          content:   { score: 0.6, comment: "OK." },
          structure: { score: 0.6, comment: "OK." },
          language:  { score: 0.6, comment: "OK." },
          mechanics: { score: 0.6, comment: "OK." },
        },
        feedback: "Good attempt.",
      }),
    });

    const raw = await gradeEssay({ ...baseInput, essayText: borderlineEssay });
    expect(raw.tooShort).toBe(false);
    expect(isEssayGradeResult(raw)).toBe(true);
    expect(mockRouted).toHaveBeenCalledTimes(1);
  });

  it("returns neutral advisory score when routedCompletion throws", async () => {
    mockRouted.mockRejectedValueOnce(new Error("AI unavailable"));

    const raw = await gradeEssay(baseInput);
    expect(raw.tooShort).toBe(false);
    const result = raw as import("@/lib/grading/gradeEssay").EssayGradeResult;
    // Neutral: does not throw, returns 0.5 + fallback feedback
    expect(result.score).toBeCloseTo(0.5, 2);
    expect(result.feedback).toContain("teacher will review");
  });

  it("NR-9.6: blocks unsafe essay input before calling the LLM and escalates", async () => {
    mockModerateText.mockResolvedValueOnce({ verdict: "UNSAFE", reason: "unsafe_input" });

    const raw = await gradeEssay(baseInput);
    expect(raw.tooShort).toBe(false);
    const result = raw as import("@/lib/grading/gradeEssay").EssayGradeResult;
    expect(result.feedback).toContain("teacher will review");
    expect(mockRouted).not.toHaveBeenCalled();
    expect(mockEnqueueEscalation).toHaveBeenCalledWith(expect.objectContaining({ priority: "HIGH" }));
  });

  it("NR-9.6: blocks unsafe grading output and escalates", async () => {
    mockRouted.mockResolvedValueOnce({
      content: JSON.stringify({
        criteria: {
          content:   { score: 0.9, comment: "unsafe comment" },
          structure: { score: 0.8, comment: "ok" },
          language:  { score: 0.7, comment: "ok" },
          mechanics: { score: 1.0, comment: "ok" },
        },
        feedback: "unsafe feedback",
      }),
    });
    mockModerateText
      .mockResolvedValueOnce({ verdict: "SAFE" }) // input
      .mockResolvedValueOnce({ verdict: "UNSAFE" }); // output

    const raw = await gradeEssay(baseInput);
    const result = raw as import("@/lib/grading/gradeEssay").EssayGradeResult;
    expect(result.feedback).toContain("teacher will review");
    expect(mockEnqueueEscalation).toHaveBeenCalledWith(expect.objectContaining({ priority: "HIGH" }));
  });
});

// ── POST /api/grading/essay ───────────────────────────────────────────────────

describe("POST /api/grading/essay", () => {
  beforeEach(() => vi.clearAllMocks());

  const mockStudent = { id: "student-1" };
  const mockLesson = {
    grade: 8,
    subject: "ENGLISH",
    title: "Essay Writing",
    unitId: "unit-essay",
    contentId: "content-essay",
  };
  const goodEssayBody = "Word ".repeat(80);

  beforeEach(() => {
    mockPrisma.student.findFirst.mockResolvedValue(mockStudent);
    mockPrisma.curriculumContent.findUnique.mockResolvedValue(mockLesson);
    mockPrisma.gradedSubmission.findUnique.mockResolvedValue(null);
    mockPrisma.gradedSubmission.create.mockResolvedValue({ id: "sub-1", status: "pending" });
    mockPrisma.gradedSubmission.update.mockResolvedValue({
      id: "sub-1",
      score: 0.75,
      feedback: "Great work!",
      rubricBreakdown: {},
      gradedAt: new Date(),
    });
    mockRouted.mockResolvedValue({
      content: JSON.stringify({
        criteria: {
          content:   { score: 0.8, comment: "Good." },
          structure: { score: 0.7, comment: "Good." },
          language:  { score: 0.7, comment: "Good." },
          mechanics: { score: 0.7, comment: "Good." },
        },
        feedback: "Great work!",
      }),
    });
  });

  it("returns 200 with advisory flag and score on success", async () => {
    const { POST } = await import("@/app/api/grading/essay/route");
    const req = new Request("http://localhost/api/grading/essay", {
      method: "POST",
      body: JSON.stringify({
        lessonId: "lesson-1",
        essayText: goodEssayBody,
        clientSubmissionId: "client-uuid-1",
      }),
    });
    const res = await POST(req as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.advisory).toBe(true);
    expect(typeof data.score).toBe("number");
  });

  it("idempotency: same clientSubmissionId returns existing submission", async () => {
    const existingSubmission = { id: "sub-existing", score: 0.8, status: "graded" };
    mockPrisma.gradedSubmission.findUnique.mockResolvedValue(existingSubmission);

    const { POST } = await import("@/app/api/grading/essay/route");
    const req = new Request("http://localhost/api/grading/essay", {
      method: "POST",
      body: JSON.stringify({
        lessonId: "lesson-1",
        essayText: goodEssayBody,
        clientSubmissionId: "already-submitted",
      }),
    });
    const res = await POST(req as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.submission.id).toBe("sub-existing");
    // AI must NOT be called for duplicate submissions
    expect(mockRouted).not.toHaveBeenCalled();
  });

  it("returns tooShort signal without a score for short essays", async () => {
    mockPrisma.gradedSubmission.update.mockResolvedValue({
      id: "sub-1", status: "graded", gradedAt: new Date(), feedback: "too short",
    });

    const { POST } = await import("@/app/api/grading/essay/route");
    const req = new Request("http://localhost/api/grading/essay", {
      method: "POST",
      body: JSON.stringify({ lessonId: "lesson-1", essayText: "Too short." }),
    });
    const res = await POST(req as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.tooShort).toBe(true);
    expect(data.score).toBeUndefined();
  });

  it("returns 400 when essayText is missing", async () => {
    const { POST } = await import("@/app/api/grading/essay/route");
    const req = new Request("http://localhost/api/grading/essay", {
      method: "POST",
      body: JSON.stringify({ lessonId: "lesson-1" }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });
});

// ── PATCH /api/grading/[submissionId]/override ────────────────────────────────

describe("PATCH /api/grading/[submissionId]/override — teacher override", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue({ id: "teacher-1", role: "TEACHER", schoolId: "school-a", isPlatformAdmin: false });
    mockPrisma.gradedSubmission.findUnique.mockResolvedValue({
      id: "sub-1",
      exerciseType: "essay",
      student: { user: { schoolId: "school-a" } },
    });
    mockPrisma.gradedSubmission.update.mockResolvedValue({
      id: "sub-1",
      score: 0.9,
      feedback: "Teacher override: excellent.",
      status: "graded",
    });
  });

  it("allows TEACHER to override score", async () => {
    const { PATCH } = await import(
      "@/app/api/grading/[submissionId]/override/route"
    );
    const req = new Request("http://localhost/api/grading/sub-1/override", {
      method: "PATCH",
      body: JSON.stringify({ score: 0.9, feedback: "Teacher override: excellent." }),
    });
    const res = await PATCH(req as any, { params: { submissionId: "sub-1" } });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.submission.score).toBe(0.9);
  });

  it("rejects a TEACHER overriding a submission from a different school (cross-school IDOR)", async () => {
    mockRequireRole.mockResolvedValue({ id: "teacher-1", role: "TEACHER", schoolId: "school-a", isPlatformAdmin: false });
    mockPrisma.gradedSubmission.findUnique.mockResolvedValue({
      id: "sub-2",
      exerciseType: "essay",
      student: { user: { schoolId: "school-b" } },
    });

    const { PATCH } = await import(
      "@/app/api/grading/[submissionId]/override/route"
    );
    const req = new Request("http://localhost/api/grading/sub-2/override", {
      method: "PATCH",
      body: JSON.stringify({ score: 0.9 }),
    });
    const res = await PATCH(req as any, { params: { submissionId: "sub-2" } });

    expect(res.status).toBe(403);
    expect(mockPrisma.gradedSubmission.update).not.toHaveBeenCalled();
  });

  it("allows a platform admin to override a submission at any school", async () => {
    mockRequireRole.mockResolvedValue({ id: "platform-admin-1", role: "ADMIN", schoolId: null, isPlatformAdmin: true });
    mockPrisma.gradedSubmission.findUnique.mockResolvedValue({
      id: "sub-3",
      exerciseType: "essay",
      student: { user: { schoolId: "school-b" } },
    });
    mockPrisma.gradedSubmission.update.mockResolvedValue({
      id: "sub-3",
      score: 0.85,
      status: "graded",
    });

    const { PATCH } = await import(
      "@/app/api/grading/[submissionId]/override/route"
    );
    const req = new Request("http://localhost/api/grading/sub-3/override", {
      method: "PATCH",
      body: JSON.stringify({ score: 0.85 }),
    });
    const res = await PATCH(req as any, { params: { submissionId: "sub-3" } });

    expect(res.status).toBe(200);
  });

  it("rejects invalid score (> 1)", async () => {
    const { PATCH } = await import(
      "@/app/api/grading/[submissionId]/override/route"
    );
    const req = new Request("http://localhost/api/grading/sub-1/override", {
      method: "PATCH",
      body: JSON.stringify({ score: 1.5 }),
    });
    const res = await PATCH(req as any, { params: { submissionId: "sub-1" } });
    expect(res.status).toBe(400);
  });

  it("returns 404 when submission not found", async () => {
    mockPrisma.gradedSubmission.findUnique.mockResolvedValue(null);

    const { PATCH } = await import(
      "@/app/api/grading/[submissionId]/override/route"
    );
    const req = new Request("http://localhost/api/grading/missing/override", {
      method: "PATCH",
      body: JSON.stringify({ score: 0.8 }),
    });
    const res = await PATCH(req as any, { params: { submissionId: "missing" } });
    expect(res.status).toBe(404);
  });
});
