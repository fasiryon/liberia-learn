import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindMany = vi.hoisted(() => vi.fn());
const mockFindUnique = vi.hoisted(() => vi.fn());
const mockCreate = vi.hoisted(() => vi.fn());
const mockUpsert = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockUpdateMany = vi.hoisted(() => vi.fn());
const mockGroupBy = vi.hoisted(() => vi.fn());
const mockTransaction = vi.hoisted(() => vi.fn());
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
      groupBy: mockGroupBy,
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
    mockGenerateCurriculumPayload.mockResolvedValueOnce({
      title: "Plants Need Light",
      objectives: ["Explain what plants need"],
      body: [
        "Objective: Students explain that plants need light, water, air, and soil nutrients.",
        "Introduction: The teacher asks learners to describe cassava and pepper plants near their homes.",
        "Guided Practice: The class studies examples and predicts what happens when plants lack sunlight.",
        "Independent Practice: Students complete examples and explain their reasoning in full sentences.",
        "Assessment: Exit ticket asks learners to name two plant needs and justify one answer.",
        "Liberian classroom example ".repeat(80),
      ].join("\n\n"),
      body_standard: "Objective Introduction Guided Practice Independent Practice Assessment " + "content ".repeat(180),
      metadata: {},
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
});
