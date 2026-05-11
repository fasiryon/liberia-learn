import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindMany = vi.hoisted(() => vi.fn());
const mockFindUnique = vi.hoisted(() => vi.fn());
const mockCreate = vi.hoisted(() => vi.fn());
const mockUpsert = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockUpdateMany = vi.hoisted(() => vi.fn());
const mockGroupBy = vi.hoisted(() => vi.fn());
const mockCount = vi.hoisted(() => vi.fn());
const mockTransaction = vi.hoisted(() => vi.fn());
const mockUserFindUnique = vi.hoisted(() => vi.fn());
const mockGenerateCurriculumPayload = vi.hoisted(() => vi.fn());
const mockEnqueueJob = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockRegenFlag = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    curriculumContent: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      update: mockUpdate,
      create: mockCreate,
    },
    curriculumRegenerationRun: {
      create: mockCreate,
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
    curriculumRegenerationCheckpoint: {
      upsert: mockUpsert,
      update: mockUpdate,
      findMany: mockFindMany,
    },
    curriculumRegenerationJob: {
      upsert: mockUpsert,
      findUnique: mockFindUnique,
      update: mockUpdate,
      updateMany: mockUpdateMany,
      findMany: mockFindMany,
      count: mockCount,
      groupBy: mockGroupBy,
    },
    user: {
      findUnique: mockUserFindUnique,
    },
    $transaction: mockTransaction,
  },
}));

vi.mock("@/lib/ai/curriculum-factory", () => ({
  generateCurriculumPayload: mockGenerateCurriculumPayload,
}));

vi.mock("@/lib/queue", async () => {
  const actual = await vi.importActual<typeof import("@/lib/queue")>("@/lib/queue");
  return { ...actual, enqueueJob: mockEnqueueJob };
});

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
}));

vi.mock("@/lib/serverFlags", () => ({
  isCurriculumRegenQueueEnabled: mockRegenFlag,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockRegenFlag.mockReturnValue(true);
  mockUserFindUnique.mockResolvedValue(null);
  mockTransaction.mockImplementation((fn) =>
    fn({
      curriculumContent: { update: mockUpdate, create: mockCreate },
      curriculumRegenerationRun: { update: mockUpdate },
      curriculumRegenerationJob: { update: mockUpdate },
      curriculumRegenerationCheckpoint: { update: mockUpdate },
    })
  );
});

describe("curriculum regeneration pipeline", () => {
  it("builds stable idempotency keys for queue payloads", async () => {
    const { buildCurriculumRegenerationIdempotencyKey } = await import("@/lib/curriculum/regenerationQueue");
    const first = buildCurriculumRegenerationIdempotencyKey({
      runId: "run-1",
      curriculumContentId: "lesson-1",
      gradeLevel: 3,
      subject: "science",
    });
    const second = buildCurriculumRegenerationIdempotencyKey({
      runId: "run-1",
      curriculumContentId: "lesson-1",
      gradeLevel: 3,
      subject: "SCIENCE",
    });

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  it("dry-runs planned jobs without writes or queue sends", async () => {
    mockFindMany.mockResolvedValueOnce([
      { contentId: "c1", title: "Plants", grade: 3, subject: "SCIENCE", payload: {}, moeAlignments: [] },
    ]);
    const { createCurriculumRegenerationRun } = await import("@/lib/curriculum/regenerationQueue");

    const result = await createCurriculumRegenerationRun({ dryRun: true, gradeLevel: 3, subject: "science", limit: 23 });

    expect(result.dryRun).toBe(true);
    expect(result.plan.totalPlanned).toBe(1);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockEnqueueJob).not.toHaveBeenCalled();
  });

  it("enqueues DB-backed regeneration jobs to SQS when configured", async () => {
    mockFindMany.mockResolvedValueOnce([
      { contentId: "c1", title: "Plants", grade: 3, subject: "SCIENCE", payload: {}, moeAlignments: [] },
    ]);
    mockCreate.mockResolvedValueOnce({ id: "run-1" });
    mockUpsert
      .mockResolvedValueOnce({ id: "checkpoint-1" })
      .mockResolvedValueOnce({
        id: "job-1",
        attempt: 0,
        idempotencyKey: "idem-1",
      });
    const { createCurriculumRegenerationRun, buildCurriculumRegenerationIdempotencyKey } = await import("@/lib/curriculum/regenerationQueue");

    await createCurriculumRegenerationRun({ gradeLevel: 3, subject: "science", limit: 1, requestedBy: "script" });

    const idempotencyKey = buildCurriculumRegenerationIdempotencyKey({
      runId: "run-1",
      gradeLevel: 3,
      subject: "SCIENCE",
      curriculumContentId: "c1",
    });
    expect(mockUserFindUnique).toHaveBeenCalledWith({
      where: { id: "script" },
      select: { id: true },
    });
    expect(mockEnqueueJob).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        runId: "run-1",
        curriculumContentId: "c1",
        idempotencyKey,
        requestedBy: null,
      }),
      {
        messageGroupId: "run-1",
        messageDeduplicationId: idempotencyKey,
      }
    );
  });

  it("does not use the queue/manual path when queue flag is unavailable", async () => {
    mockRegenFlag.mockReturnValue(false);
    mockFindMany.mockResolvedValueOnce([
      { contentId: "c1", title: "Plants", grade: 3, subject: "SCIENCE", payload: {}, moeAlignments: [] },
    ]);
    const { createCurriculumRegenerationRun } = await import("@/lib/curriculum/regenerationQueue");

    await expect(createCurriculumRegenerationRun({ gradeLevel: 3, subject: "science", limit: 1 })).rejects.toThrow(
      "ENABLE_CURRICULUM_REGEN_QUEUE"
    );
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockEnqueueJob).not.toHaveBeenCalled();
  });

  it("uses idempotency upserts instead of duplicate DB replacement creates", async () => {
    mockFindMany.mockResolvedValueOnce([
      { contentId: "c1", title: "Plants", grade: 3, subject: "SCIENCE", payload: {}, moeAlignments: [] },
      { contentId: "c1", title: "Plants", grade: 3, subject: "SCIENCE", payload: {}, moeAlignments: [] },
    ]);
    mockCreate.mockResolvedValueOnce({ id: "run-1" });
    mockUpsert.mockResolvedValue({ id: "job-1", attempt: 0 });
    const { createCurriculumRegenerationRun } = await import("@/lib/curriculum/regenerationQueue");

    await createCurriculumRegenerationRun({ gradeLevel: 3, subject: "science", limit: 2 });

    const jobUpserts = mockUpsert.mock.calls.filter(([arg]) => arg?.where?.idempotencyKey);
    expect(jobUpserts).toHaveLength(2);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "pending" }),
    }));
    expect(mockCreate).not.toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ contentId: "c1" }),
    }));
  });

  it("stop marks a run stopped and pending jobs skipped", async () => {
    const { stopCurriculumRegenerationRun } = await import("@/lib/curriculum/regenerationQueue");

    await stopCurriculumRegenerationRun("run-1", "operator stop");

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "run-1" },
      data: expect.objectContaining({ status: "stopped", stoppedReason: "operator stop" }),
    }));
    expect(mockUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { runId: "run-1", status: { in: ["pending", "processing"] } },
      data: expect.objectContaining({ status: "skipped", lastErrorCode: "run_stopped" }),
    }));
  });

  it("persists passing regenerated content as DRAFT via update, not duplicate create", async () => {
    mockFindUnique
      .mockResolvedValueOnce({
        id: "job-1",
        runId: "run-1",
        curriculumContentId: "c1",
        gradeLevel: 3,
        subject: "SCIENCE",
        topic: "Plants",
        status: "pending",
        attempt: 0,
        maxAttempts: 3,
        provider: null,
        requestedBy: "script",
        schoolId: null,
        tenantId: null,
        idempotencyKey: "idem-1",
      })
      .mockResolvedValueOnce({ id: "run-1", status: "pending", startedAt: null })
      .mockResolvedValueOnce({
        contentId: "c1",
        title: "Plants",
        grade: 3,
        subject: "SCIENCE",
        status: "NEEDS_REVIEW",
        payload: {},
        moeAlignments: [],
      });
    const slideWord = "Plants need sunlight water air and nutrients from the soil to grow well in Liberia cassava pepper farms. ";
    const depthPassingSlides = [
      `## 1. Welcome and Hook\n\n${slideWord.repeat(12)}`,
      `## 2. Learning Objective\n\nObjective: Students will explain what plants need to grow. ${slideWord.repeat(10)}`,
      `## 3. Prior Knowledge Check\n\nIntroduction: What plants do you see near your home? ${slideWord.repeat(10)}`,
      `## 4. Concept Introduction\n\nGuided Practice: The class discusses what plants need. ${slideWord.repeat(10)}`,
      `## 5. Key Vocabulary\n\n${slideWord.repeat(10)}`,
      `## 6. Worked Example 1\n\n${slideWord.repeat(10)}`,
      `## 7. Worked Example 2\n\n${slideWord.repeat(10)}`,
      `## 8. Common Mistakes\n\n${slideWord.repeat(10)}`,
      `## 9. Guided Practice Problem 1\n\n${slideWord.repeat(10)}`,
      `## 10. Guided Practice Problem 2\n\n${slideWord.repeat(10)}`,
      `## 11. Guided Practice Problem 3\n\n${slideWord.repeat(10)}`,
      `## 12. Independent Practice Easy\n\nIndependent Practice: complete the tasks below. ${slideWord.repeat(10)}`,
      `## 13. Independent Practice Medium\n\n${slideWord.repeat(10)}`,
      `## 14. Independent Practice Challenge\n\n${slideWord.repeat(10)}`,
      `## 15. Assessment and Exit Ticket\n\nAssessment: Answer the exit ticket questions. ${slideWord.repeat(10)}`,
    ].join("\n\n");
    mockGenerateCurriculumPayload.mockResolvedValueOnce({
      title: "Plants Need Light",
      objectives: ["Explain what plants need"],
      body: depthPassingSlides,
      body_standard: depthPassingSlides,
      metadata: {},
      assessmentQuestions: [{ question: "What do plants need?", expectedAnswer: "Light and water" }],
    });
    const { processCurriculumRegenerationLessonJob } = await import("@/lib/curriculum/regenerationQueue");

    const result = await processCurriculumRegenerationLessonJob({
      runId: "run-1",
      gradeLevel: 3,
      subject: "SCIENCE",
      curriculumContentId: "c1",
      idempotencyKey: "idem-1",
    });

    expect(result.status).toBe("approved");
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { contentId: "c1" },
      data: expect.objectContaining({ status: "DRAFT" }),
    }));
    expect(mockCreate).not.toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ contentId: "c1" }),
    }));
  });

  it("does not approve thin regenerated content", async () => {
    const { validateRegeneratedLesson } = await import("@/lib/curriculum/regenerationQualityGate");
    const result = validateRegeneratedLesson({
      title: "Thin",
      objectives: ["Learn"],
      body: "Objective Assessment",
      assessmentQuestions: [{ question: "Q", expectedAnswer: "A" }],
    });

    expect(result.passed).toBe(false);
    expect(result.reason).toBe("content_under_800_chars");
  });

  it("finalizes a run when all jobs are approved", async () => {
    mockFindUnique.mockResolvedValueOnce({ id: "run-1", status: "running", completedAt: null });
    mockCount.mockResolvedValueOnce(0);
    mockGroupBy.mockResolvedValueOnce([{ status: "approved", _count: { _all: 2 } }]);
    mockFindMany.mockResolvedValueOnce([
      { id: "checkpoint-1", status: "running", processedCount: 2, plannedCount: 2 },
    ]);
    const { finalizeCurriculumRegenerationRun } = await import("@/lib/curriculum/regenerationQueue");

    const result = await finalizeCurriculumRegenerationRun("run-1");

    expect(result).toMatchObject({ finalized: true, status: "completed", failedCount: 0, totalJobs: 2 });
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "checkpoint-1" },
      data: { status: "completed" },
    }));
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "run-1" },
      data: expect.objectContaining({ status: "completed", stoppedReason: null }),
    }));
  });

  it("finalizes a run with failed jobs recorded", async () => {
    mockFindUnique.mockResolvedValueOnce({ id: "run-1", status: "running", completedAt: null });
    mockCount.mockResolvedValueOnce(0);
    mockGroupBy.mockResolvedValueOnce([
      { status: "approved", _count: { _all: 1 } },
      { status: "failed", _count: { _all: 1 } },
    ]);
    mockFindMany.mockResolvedValueOnce([
      { id: "checkpoint-1", status: "running", processedCount: 2, plannedCount: 2 },
    ]);
    const { finalizeCurriculumRegenerationRun } = await import("@/lib/curriculum/regenerationQueue");

    const result = await finalizeCurriculumRegenerationRun("run-1");

    expect(result).toMatchObject({ finalized: true, status: "completed_with_errors", failedCount: 1 });
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "run-1" },
      data: expect.objectContaining({
        status: "completed_with_errors",
        stoppedReason: "Completed with 1 failed regeneration job.",
      }),
    }));
  });

  it("does not finalize while pending jobs remain", async () => {
    mockFindUnique.mockResolvedValueOnce({ id: "run-1", status: "running", completedAt: null });
    mockCount.mockResolvedValueOnce(1);
    mockGroupBy.mockResolvedValueOnce([
      { status: "approved", _count: { _all: 1 } },
      { status: "pending", _count: { _all: 1 } },
    ]);
    mockFindMany.mockResolvedValueOnce([
      { id: "checkpoint-1", status: "running", processedCount: 1, plannedCount: 2 },
    ]);
    const { finalizeCurriculumRegenerationRun } = await import("@/lib/curriculum/regenerationQueue");

    const result = await finalizeCurriculumRegenerationRun("run-1");

    expect(result).toMatchObject({ finalized: false, reason: "active_jobs_remaining", activeJobs: 1 });
    expect(mockUpdate).not.toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "run-1" },
      data: expect.objectContaining({ status: "completed" }),
    }));
  });

  it("does not finalize while processing jobs remain", async () => {
    mockFindUnique.mockResolvedValueOnce({ id: "run-1", status: "running", completedAt: null });
    mockCount.mockResolvedValueOnce(1);
    mockGroupBy.mockResolvedValueOnce([
      { status: "approved", _count: { _all: 1 } },
      { status: "processing", _count: { _all: 1 } },
    ]);
    mockFindMany.mockResolvedValueOnce([
      { id: "checkpoint-1", status: "running", processedCount: 1, plannedCount: 2 },
    ]);
    const { finalizeCurriculumRegenerationRun } = await import("@/lib/curriculum/regenerationQueue");

    const result = await finalizeCurriculumRegenerationRun("run-1");

    expect(result).toMatchObject({ finalized: false, reason: "active_jobs_remaining", activeJobs: 1 });
    expect(mockUpdate).not.toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "run-1" },
      data: expect.objectContaining({ status: "completed" }),
    }));
  });

  it("resume handling does not duplicate completed jobs", async () => {
    mockFindUnique.mockResolvedValueOnce({ id: "run-1", status: "completed", completedAt: new Date() });
    const { enqueuePendingCurriculumRegenerationJobs } = await import("@/lib/curriculum/regenerationQueue");

    const result = await enqueuePendingCurriculumRegenerationJobs({
      runId: "run-1",
      gradeLevel: 3,
      subject: "SCIENCE",
    });

    expect(result).toMatchObject({ enqueued: 0, skipped: true });
    expect(mockFindMany).not.toHaveBeenCalled();
    expect(mockEnqueueJob).not.toHaveBeenCalled();
  });

  it("finalization is idempotent", async () => {
    mockFindUnique.mockResolvedValueOnce({ id: "run-1", status: "completed", completedAt: new Date() });
    mockCount.mockResolvedValueOnce(0);
    mockGroupBy.mockResolvedValueOnce([{ status: "approved", _count: { _all: 2 } }]);
    mockFindMany.mockResolvedValueOnce([
      { id: "checkpoint-1", status: "completed", processedCount: 2, plannedCount: 2 },
    ]);
    const { finalizeCurriculumRegenerationRun } = await import("@/lib/curriculum/regenerationQueue");

    const result = await finalizeCurriculumRegenerationRun("run-1");

    expect(result).toMatchObject({ finalized: false, reason: "already_finalized" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
