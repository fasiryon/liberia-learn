import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  curriculumContentFindMany,
  curriculumContentUpdate,
  runFindMany,
  runGroupBy,
  jobGroupBy,
  jobFindMany,
  auditFindMany,
  logAuditMock,
} = vi.hoisted(() => ({
  curriculumContentFindMany: vi.fn(),
  curriculumContentUpdate: vi.fn(),
  runFindMany: vi.fn(),
  runGroupBy: vi.fn(),
  jobGroupBy: vi.fn(),
  jobFindMany: vi.fn(),
  auditFindMany: vi.fn(),
  logAuditMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    curriculumContent: { findMany: curriculumContentFindMany, update: curriculumContentUpdate },
    curriculumRegenerationRun: { findMany: runFindMany, groupBy: runGroupBy },
    curriculumRegenerationJob: { groupBy: jobGroupBy, findMany: jobFindMany },
    auditLog: { findMany: auditFindMany },
  },
}));
vi.mock("@/lib/audit", () => ({ logAudit: logAuditMock }));

function passingPayload() {
  return {
    title: "Water Cycle",
    learningObjectives: ["Explain evaporation"],
    assessmentQuestions: [{ question: "What is evaporation?" }],
    lessonContent:
      "Objectives: Explain evaporation and condensation. Introduction: Students discuss rain in Liberia. Guided practice: Teacher models the water cycle with a cup and sunlight. Independent practice: Students draw and label each step. Assessment: Exit ticket asks students to explain evaporation. ".repeat(4),
  };
}

describe("curriculum regeneration admin helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SQS_QUEUE_URL = "";
  });

  it("aggregates QA analytics by grade and subject", async () => {
    const { getCurriculumRegenerationOpsData } = await import("@/lib/curriculum/regenerationAdmin");
    runFindMany.mockResolvedValue([]);
    runGroupBy.mockResolvedValue([{ status: "completed", _count: { _all: 2 } }]);
    jobGroupBy.mockResolvedValue([{ status: "approved", _count: { _all: 3 } }]);
    jobFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { gradeLevel: 3, subject: "SCIENCE", status: "failed", attempt: 2, provider: "openai", lastErrorCode: "quality_gate_failure" },
        { gradeLevel: 3, subject: "SCIENCE", status: "approved", attempt: 1, provider: "openai", lastErrorCode: null },
      ]);
    auditFindMany.mockResolvedValue([]);
    curriculumContentFindMany.mockResolvedValue([
      { contentId: "draft-1", grade: 3, subject: "SCIENCE", status: "DRAFT", payload: passingPayload() },
      { contentId: "needs-1", grade: 3, subject: "SCIENCE", status: "NEEDS_REVIEW", payload: { body: "TODO" } },
      { contentId: "thin-1", grade: 4, subject: "MATH", status: "published", payload: { lessonContent: "short" } },
    ]);

    const data = await getCurriculumRegenerationOpsData();

    expect(data.qa.approvedThinCount).toBe(1);
    expect(data.qa.placeholderOrMojibakeCount).toBe(1);
    expect(data.qa.gradeSubject.find((row) => row.grade === 3 && row.subject === "SCIENCE")).toMatchObject({
      needsReview: 1,
      draft: 1,
      failures: 1,
      attempted: 2,
      failureRate: 0.5,
    });
    expect(data.qa.retryRateByProvider[0]).toMatchObject({ provider: "openai", retryRate: 0.5 });
  });

  it("blocks approving thin drafts", async () => {
    const { reviewCurriculumDraft } = await import("@/lib/curriculum/regenerationAdmin");
    curriculumContentFindMany.mockResolvedValue([
      { contentId: "thin", contentType: "lesson", payload: { lessonContent: "short" } },
    ]);

    const result = await reviewCurriculumDraft({
      action: "approve",
      contentId: "thin",
      actor: { id: "platform-1" },
    });

    expect(result.ok).toBe(false);
    expect(result.results[0].error).toBe("content_under_800_chars");
    expect(curriculumContentUpdate).not.toHaveBeenCalled();
  });

  it("bulk approves only quality-passing drafts", async () => {
    const { reviewCurriculumDraft } = await import("@/lib/curriculum/regenerationAdmin");
    curriculumContentFindMany.mockResolvedValue([
      { contentId: "good", contentType: "lesson", payload: passingPayload() },
      { contentId: "bad", contentType: "lesson", payload: { lessonContent: "placeholder" } },
    ]);
    curriculumContentUpdate.mockResolvedValue({});

    const result = await reviewCurriculumDraft({
      action: "bulk_approve",
      contentIds: ["good", "bad"],
      actor: { id: "platform-1" },
    });

    expect(result.ok).toBe(false);
    expect(result.results).toEqual([
      expect.objectContaining({ contentId: "good", ok: true, status: "published" }),
      expect.objectContaining({ contentId: "bad", ok: false }),
    ]);
    expect(curriculumContentUpdate).toHaveBeenCalledTimes(1);
    expect(logAuditMock).toHaveBeenCalledWith(expect.objectContaining({ action: "curriculum.review.approve" }));
  });

  it("rejects weak drafts with an audit event", async () => {
    const { reviewCurriculumDraft } = await import("@/lib/curriculum/regenerationAdmin");
    curriculumContentFindMany.mockResolvedValue([
      { contentId: "weak", contentType: "lesson", payload: { lessonContent: "weak draft" } },
    ]);
    curriculumContentUpdate.mockResolvedValue({});

    const result = await reviewCurriculumDraft({
      action: "reject",
      contentId: "weak",
      reason: "Too thin",
      actor: { id: "platform-1", schoolId: null },
    });

    expect(result.ok).toBe(true);
    expect(curriculumContentUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { contentId: "weak" },
      data: expect.objectContaining({ status: "rejected" }),
    }));
    expect(logAuditMock).toHaveBeenCalledWith(expect.objectContaining({ action: "curriculum.review.reject" }));
  });
});

