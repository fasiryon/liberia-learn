/**
 * Offline hardening V1: one quiz attempt ID is shared by the online submit and
 * the offline outbox, so lost responses, retries after restart, and an
 * offline copy of an attempt the server already received never duplicate
 * evidence or re-run scoring side effects.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn().mockResolvedValue({ id: "student-1", role: "STUDENT", schoolId: "school-1" }),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    learningEvent: { findFirst: vi.fn() },
    student: { findUnique: vi.fn() },
    assessmentAttempt: { findUnique: vi.fn(), create: vi.fn() },
    assessmentAttemptDetail: { createMany: vi.fn() },
    curriculumContent: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/metrics/events", () => ({ recordMetricEvent: vi.fn() }));
vi.mock("@/lib/events/logLearningEvent", () => ({ logLearningEvent: vi.fn() }));
vi.mock("@/lib/ai/lessonQuiz", () => ({ generateLessonGapAnalysis: vi.fn() }));
vi.mock("@/lib/certificates/certificateService", () => ({ awardLessonQuizCertificates: vi.fn() }));
vi.mock("@/lib/intelligence/actionEngine", () => ({ resolveActionsOnQuizPass: vi.fn() }));
vi.mock("@/lib/intelligence/misconceptions", () => ({ tagMisconception: vi.fn() }));
vi.mock("@/lib/intelligence/recordPerformanceEvent", () => ({ recordPerformanceEvent: vi.fn() }));
vi.mock("@/lib/adaptive/updateMastery", () => ({ recordAnswer: vi.fn(), buildSkillKey: vi.fn() }));
vi.mock("@/lib/grading/lessonQuizSession", () => ({ openLessonQuizSession: vi.fn(() => null) }));
vi.mock("@/lib/student/resolveScheduledLessonContext", () => ({
  resolveScheduledLessonContext: vi.fn().mockResolvedValue({
    scheduledWorkId: "sw-1",
    contentId: "content-1",
    studentId: "student-rec-1",
    schoolId: "school-1",
    classId: "class-1",
    subject: "MATH",
    grade: 4,
    title: "Fractions",
    body: "",
  }),
}));

import { POST as submitQuiz } from "@/app/api/student/lessons/[id]/quiz/submit/route";
import { POST as sync } from "@/app/api/student/sync/route";
import { prisma } from "@/lib/db";
import { recordAnswer } from "@/lib/adaptive/updateMastery";

const ATTEMPT_ID = "3f2b8c1e-9a4d-4e21-b7c5-0d6e8f1a2b3c";

function submitRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/student/lessons/sw-1/quiz/submit", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const answers = ["q1", "q2", "q3", "q4", "q5"].map((questionId) => ({ questionId, selectedIndex: 0 }));

describe("quiz attempt idempotency — online submit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("replays a recorded attempt without the one-shot quiz session and without new evidence", async () => {
    (prisma.assessmentAttempt.findUnique as any).mockResolvedValue({
      id: ATTEMPT_ID,
      userId: "student-1",
      score: 0.8,
      status: "completed",
      evaluation: { questions: [{ id: "q1", question: "?", correctIndex: 0, explanation: "e" }], correctCount: 4, totalQuestions: 5 },
      rawResponse: { answers },
    });
    const response = await submitQuiz(submitRequest({ quizId: "quiz-1", clientAttemptId: ATTEMPT_ID, answers }), { params: { id: "sw-1" } });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ attemptId: ATTEMPT_ID, replayed: true, scorePercent: 80, correctCount: 4 });
    expect(prisma.assessmentAttempt.create).not.toHaveBeenCalled();
    expect(recordAnswer).not.toHaveBeenCalled();
  });

  it("reports an offline-recorded attempt as pending review, never as a score", async () => {
    (prisma.assessmentAttempt.findUnique as any).mockResolvedValue({
      id: ATTEMPT_ID, userId: "student-1", score: null, status: "offline_pending_review", evaluation: null, rawResponse: null,
    });
    const body = await (await submitQuiz(submitRequest({ quizId: "quiz-1", clientAttemptId: ATTEMPT_ID, answers }), { params: { id: "sw-1" } })).json();
    expect(body).toMatchObject({ replayed: true, pendingReview: true });
  });

  it("refuses an attempt ID that belongs to another learner", async () => {
    (prisma.assessmentAttempt.findUnique as any).mockResolvedValue({ id: ATTEMPT_ID, userId: "student-2", score: 1, status: "completed" });
    const response = await submitQuiz(submitRequest({ quizId: "quiz-1", clientAttemptId: ATTEMPT_ID, answers }), { params: { id: "sw-1" } });
    expect(response.status).toBe(409);
    expect(prisma.assessmentAttempt.create).not.toHaveBeenCalled();
  });

  it("rejects a malformed client attempt ID", async () => {
    const response = await submitQuiz(submitRequest({ quizId: "quiz-1", clientAttemptId: "'; drop", answers }), { params: { id: "sw-1" } });
    expect(response.status).toBe(400);
  });
});

describe("quiz attempt idempotency — offline sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.student.findUnique as any).mockResolvedValue({ id: "student-rec-1" });
    (prisma.learningEvent.findFirst as any).mockResolvedValue(null);
  });

  function attemptOperation() {
    return {
      protocolVersion: 1,
      operationId: ATTEMPT_ID,
      idempotencyKey: ATTEMPT_ID,
      learnerId: "student-1",
      schoolId: "school-1",
      resourceType: "assessment_attempt",
      resourceId: "quiz-1",
      operationType: "assessment_attempt.append",
      contentId: null,
      contentVersion: null,
      contentHash: null,
      manifestSequence: null,
      payload: { quizId: "quiz-1", answers: { q1: 0 } },
      clientCreatedAt: "2026-09-23T10:00:00.000Z",
      baseServerVersion: null,
      dependencyIds: [],
    };
  }

  async function syncOnce() {
    const response = await sync(new NextRequest("http://localhost/api/student/sync", {
      method: "POST",
      body: JSON.stringify({ protocolVersion: 1, items: [attemptOperation()] }),
      headers: { "Content-Type": "application/json" },
    }));
    return (await response.json()).results[0];
  }

  it("acknowledges an offline copy of an attempt the online submit already recorded", async () => {
    (prisma.assessmentAttempt.findUnique as any).mockResolvedValue({ id: ATTEMPT_ID, userId: "student-1" });
    const result = await syncOnce();
    expect(result).toMatchObject({ status: "skipped", resolutionHint: "assessment_attempt_already_recorded" });
    expect(prisma.assessmentAttempt.create).not.toHaveBeenCalled();
  });

  it("records a genuinely new offline attempt as unscored evidence pending review", async () => {
    (prisma.assessmentAttempt.findUnique as any).mockResolvedValue(null);
    (prisma.assessmentAttempt.create as any).mockResolvedValue({ id: ATTEMPT_ID });
    const result = await syncOnce();
    expect(result.status).toBe("synced");
    const data = (prisma.assessmentAttempt.create as any).mock.calls[0][0].data;
    expect(data).toMatchObject({ id: ATTEMPT_ID, score: null, status: "offline_pending_review" });
  });

  it("rejects an attempt ID already used by another learner", async () => {
    (prisma.assessmentAttempt.findUnique as any).mockResolvedValue({ id: ATTEMPT_ID, userId: "student-2" });
    const result = await syncOnce();
    expect(result).toMatchObject({ status: "rejected", resolutionHint: "assessment_attempt_id_conflict" });
    expect(prisma.assessmentAttempt.create).not.toHaveBeenCalled();
  });
});
