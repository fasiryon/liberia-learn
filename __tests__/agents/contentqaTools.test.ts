import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockEnqueueEscalation, mockCreateInboxNotification, mockAlignContentToMOE } = vi.hoisted(() => ({
  mockPrisma: {
    curriculumContent: { findUnique: vi.fn() },
    lessonVideo: { findUnique: vi.fn() },
    gradedSubmission: { findUnique: vi.fn() },
    contentQaReview: { create: vi.fn() },
    user: { findFirst: vi.fn() },
  },
  mockEnqueueEscalation: vi.fn(),
  mockCreateInboxNotification: vi.fn(),
  mockAlignContentToMOE: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/agents/escalation", () => ({ enqueueEscalation: mockEnqueueEscalation }));
vi.mock("@/lib/notifications/inboxService", () => ({ createInboxNotification: mockCreateInboxNotification }));
vi.mock("@/lib/moe/alignment-engine", () => ({ alignContentToMOE: mockAlignContentToMOE }));

import {
  contentqaGetSubmissionTool,
  contentqaGetRubricTool,
  contentqaFlagForReviewTool,
  contentqaWriteAdvisoryGradeTool,
  contentqaMatchAgainstCurriculumTool,
} from "@/lib/agents/tools/contentqa.tools";

const CTX = { agentName: "content-qa", userId: null, userRole: "system" as const, traceId: "trace-1" };

function resetAll() {
  Object.values(mockPrisma).forEach((delegate) =>
    Object.values(delegate).forEach((fn) => (fn as ReturnType<typeof vi.fn>).mockReset())
  );
  mockEnqueueEscalation.mockReset();
  mockCreateInboxNotification.mockReset();
  mockAlignContentToMOE.mockReset();
  mockEnqueueEscalation.mockResolvedValue({ id: "esc-1" });
  mockPrisma.contentQaReview.create.mockResolvedValue({ id: "review-1" });
}

describe("contentqa.getSubmission", () => {
  beforeEach(resetAll);

  it("loads a lesson by contentId and reads body from payload.body", async () => {
    mockPrisma.curriculumContent.findUnique.mockResolvedValue({
      title: "Fractions",
      payload: { body: "Lesson body text" },
      grade: 5,
      subject: "MATH",
      schoolId: "school-1",
      editReviewStatus: "PENDING",
      waecSyllabusTopics: [],
    });

    const result = await contentqaGetSubmissionTool.handler({ submissionId: "content-1", submissionType: "lesson" }, CTX);

    expect(mockPrisma.curriculumContent.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { contentId: "content-1" } })
    );
    expect(result.bodyText).toBe("Lesson body text");
    expect(result.title).toBe("Fractions");
    expect(result.metadata?.schoolId).toBe("school-1");
  });

  it("throws when the lesson does not exist", async () => {
    mockPrisma.curriculumContent.findUnique.mockResolvedValue(null);
    await expect(
      contentqaGetSubmissionTool.handler({ submissionId: "ghost", submissionType: "lesson" }, CTX)
    ).rejects.toThrow(/not found/);
  });

  it("loads a video and reports hasTranscript: false", async () => {
    mockPrisma.lessonVideo.findUnique.mockResolvedValue({
      title: "Cell Division",
      description: "A short video",
      durationSeconds: 300,
      schoolId: "school-2",
      status: "PENDING",
      lesson: { grade: 9, subject: "SCIENCE" },
    });

    const result = await contentqaGetSubmissionTool.handler({ submissionId: "video-1", submissionType: "video" }, CTX);

    expect(result.bodyText).toBe("A short video");
    expect(result.grade).toBe(9);
    expect(result.metadata?.hasTranscript).toBe(false);
  });

  it("loads an essay submission and includes the existing (already-computed) score in metadata", async () => {
    mockPrisma.gradedSubmission.findUnique.mockResolvedValue({
      submissionText: "My essay...",
      lessonId: "content-9",
      exerciseType: "essay",
      score: 0.82,
      feedback: "Nice work",
      rubricBreakdown: { content: { score: 0.8, comment: "ok" } },
      status: "graded",
      student: { user: { schoolId: "school-3" } },
    });
    mockPrisma.curriculumContent.findUnique.mockResolvedValue({ grade: 7, subject: "ENGLISH" });

    const result = await contentqaGetSubmissionTool.handler({ submissionId: "sub-1", submissionType: "essay" }, CTX);

    expect(result.metadata?.existingScore).toBe(0.82);
    expect(result.metadata?.schoolId).toBe("school-3");
    expect(result.grade).toBe(7);
  });

  it("throws when the essay/code submission does not exist", async () => {
    mockPrisma.gradedSubmission.findUnique.mockResolvedValue(null);
    await expect(
      contentqaGetSubmissionTool.handler({ submissionId: "ghost", submissionType: "code" }, CTX)
    ).rejects.toThrow(/not found/);
  });
});

describe("contentqa.getRubric", () => {
  beforeEach(resetAll);

  it("returns the existing WAEC-aligned essay rubric verbatim, not a reinvented one", async () => {
    const result = await contentqaGetRubricTool.handler({ subject: "ENGLISH", gradeLevel: 9, submissionType: "essay" }, CTX);
    expect(result.source).toBe("lib/grading/gradeEssay.DEFAULT_RUBRIC");
    expect(result.criteria.map((c) => c.key)).toEqual(["content", "structure", "language", "mechanics"]);
  });

  it("returns lesson quality criteria that sum to weight 1", async () => {
    const result = await contentqaGetRubricTool.handler({ subject: "MATH", gradeLevel: 5, submissionType: "lesson" }, CTX);
    const totalWeight = result.criteria.reduce((sum, c) => sum + c.weight, 0);
    expect(totalWeight).toBeCloseTo(1);
  });

  it("returns video metadata criteria", async () => {
    const result = await contentqaGetRubricTool.handler({ subject: "SCIENCE", gradeLevel: 9, submissionType: "video" }, CTX);
    expect(result.criteria.length).toBeGreaterThan(0);
  });

  it("returns code QA criteria distinct from Judge0's pass/fail", async () => {
    const result = await contentqaGetRubricTool.handler({ subject: "COMPUTER_SCIENCE", gradeLevel: 10, submissionType: "code" }, CTX);
    expect(result.criteria.some((c) => c.key === "pattern_concern")).toBe(true);
  });
});

describe("contentqa.flagForReview", () => {
  beforeEach(resetAll);

  it("always creates a ContentQaReview audit row regardless of type", async () => {
    mockPrisma.curriculumContent.findUnique.mockResolvedValue({ schoolId: null, title: "X" });
    await contentqaFlagForReviewTool.handler(
      { submissionId: "content-1", submissionType: "lesson", reason: "unclear objective", severity: "LOW", confidence: 0.5 },
      CTX
    );
    expect(mockPrisma.contentQaReview.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ submissionId: "content-1", submissionType: "lesson", status: "PENDING_TEACHER_REVIEW" }),
      })
    );
  });

  it("routes a lesson flag to the existing content-review queue via school admin notification, not a new queue", async () => {
    mockPrisma.curriculumContent.findUnique.mockResolvedValue({ schoolId: "school-1", title: "Fractions" });
    mockPrisma.user.findFirst.mockResolvedValue({ id: "admin-1" });

    await contentqaFlagForReviewTool.handler(
      { submissionId: "content-1", submissionType: "lesson", reason: "factual concern", severity: "HIGH", confidence: 0.9 },
      CTX
    );

    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { role: "ADMIN", schoolId: "school-1" } }));
    expect(mockCreateInboxNotification).toHaveBeenCalledWith(
      "admin-1",
      expect.objectContaining({ url: "/admin/content-review" })
    );
    expect(mockEnqueueEscalation).not.toHaveBeenCalled();
  });

  it("routes a video flag to the existing video-moderation queue, not EscalationQueue", async () => {
    mockPrisma.lessonVideo.findUnique.mockResolvedValue({ schoolId: "school-2", title: "Cell Division" });
    mockPrisma.user.findFirst.mockResolvedValue({ id: "admin-2" });

    await contentqaFlagForReviewTool.handler(
      { submissionId: "video-1", submissionType: "video", reason: "description mismatch", severity: "MEDIUM", confidence: 0.6 },
      CTX
    );

    expect(mockCreateInboxNotification).toHaveBeenCalledWith("admin-2", expect.objectContaining({ url: "/admin/videos" }));
    expect(mockEnqueueEscalation).not.toHaveBeenCalled();
  });

  it("routes an essay/code flag to EscalationQueue since no dedicated queue exists for them", async () => {
    mockPrisma.gradedSubmission.findUnique.mockResolvedValue({ student: { user: { schoolId: "school-3" } } });

    await contentqaFlagForReviewTool.handler(
      { submissionId: "sub-1", submissionType: "essay", reason: "score/feedback mismatch", severity: "MEDIUM", confidence: 0.5 },
      CTX
    );

    expect(mockEnqueueEscalation).toHaveBeenCalledWith(
      expect.objectContaining({ priority: "MEDIUM", schoolId: "school-3", agentName: "content-qa" })
    );
    expect(mockCreateInboxNotification).not.toHaveBeenCalled();
  });

  it("does not notify when a lesson has no schoolId", async () => {
    mockPrisma.curriculumContent.findUnique.mockResolvedValue({ schoolId: null, title: "X" });
    await contentqaFlagForReviewTool.handler(
      { submissionId: "content-1", submissionType: "lesson", reason: "concern", severity: "LOW", confidence: 0.5 },
      CTX
    );
    expect(mockCreateInboxNotification).not.toHaveBeenCalled();
  });

  it("returns the flagId from the created ContentQaReview row", async () => {
    mockPrisma.curriculumContent.findUnique.mockResolvedValue({ schoolId: null, title: "X" });
    const result = await contentqaFlagForReviewTool.handler(
      { submissionId: "content-1", submissionType: "lesson", reason: "concern", severity: "LOW", confidence: 0.5 },
      CTX
    );
    expect(result).toEqual({ flagId: "review-1" });
  });
});

describe("contentqa.writeAdvisoryGrade", () => {
  beforeEach(resetAll);

  it("writes only to ContentQaReview, never to GradedSubmission or CurriculumContent", async () => {
    await contentqaWriteAdvisoryGradeTool.handler(
      { submissionId: "sub-1", submissionType: "essay", score: 0.9, feedback: "consistent with rubric", confidence: 0.85, rubricUsed: "DEFAULT_RUBRIC" },
      CTX
    );

    expect(mockPrisma.contentQaReview.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ score: 0.9, confidence: 0.85, status: "PENDING_TEACHER_REVIEW" }),
      })
    );
    expect(mockPrisma.gradedSubmission.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.curriculumContent.findUnique).not.toHaveBeenCalled();
  });

  it("accepts a null score for video (metadata-only) review", async () => {
    await contentqaWriteAdvisoryGradeTool.handler(
      { submissionId: "video-1", submissionType: "video", score: null, feedback: "description matches topic", confidence: 0.7 },
      CTX
    );
    expect(mockPrisma.contentQaReview.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ score: null }) })
    );
  });

  it("returns the gradeId from the created row", async () => {
    const result = await contentqaWriteAdvisoryGradeTool.handler(
      { submissionId: "sub-1", submissionType: "essay", score: 0.5, feedback: "ok", confidence: 0.5 },
      CTX
    );
    expect(result).toEqual({ gradeId: "review-1" });
  });
});

describe("contentqa.matchAgainstCurriculum", () => {
  beforeEach(resetAll);

  it("reuses the existing MOE alignment engine rather than judging alignment itself", async () => {
    mockPrisma.curriculumContent.findUnique.mockResolvedValue({ id: "internal-cuid-1" });
    mockAlignContentToMOE.mockResolvedValue({
      contentId: "internal-cuid-1",
      standards: [
        { code: "MOE.MATH.5.1", description: "x", confidence: "high" },
        { code: "MOE.MATH.5.2", description: "y", confidence: "medium" },
      ],
      alignedAt: new Date().toISOString(),
      method: "keyword",
    });

    const result = await contentqaMatchAgainstCurriculumTool.handler({ contentId: "content-1" }, CTX);

    expect(mockAlignContentToMOE).toHaveBeenCalledWith("internal-cuid-1");
    expect(result.matchedStandards).toEqual(["MOE.MATH.5.1", "MOE.MATH.5.2"]);
    expect(result.alignmentScore).toBeCloseTo((1 + 0.6) / 2);
    expect(result.gaps).toEqual([]);
  });

  it("reports a gap when no standards match", async () => {
    mockPrisma.curriculumContent.findUnique.mockResolvedValue({ id: "internal-cuid-2" });
    mockAlignContentToMOE.mockResolvedValue({ contentId: "internal-cuid-2", standards: [], alignedAt: "", method: "keyword" });

    const result = await contentqaMatchAgainstCurriculumTool.handler({ contentId: "content-2" }, CTX);

    expect(result.alignmentScore).toBe(0);
    expect(result.gaps.length).toBe(1);
  });

  it("throws when the lesson does not exist", async () => {
    mockPrisma.curriculumContent.findUnique.mockResolvedValue(null);
    await expect(contentqaMatchAgainstCurriculumTool.handler({ contentId: "ghost" }, CTX)).rejects.toThrow(/not found/);
  });
});

describe("contentqa tools authorization", () => {
  it("all five tools require the system role only", () => {
    for (const tool of [
      contentqaGetSubmissionTool,
      contentqaGetRubricTool,
      contentqaFlagForReviewTool,
      contentqaWriteAdvisoryGradeTool,
      contentqaMatchAgainstCurriculumTool,
    ]) {
      expect(tool.requiresAuth).toEqual(["system"]);
    }
  });
});
