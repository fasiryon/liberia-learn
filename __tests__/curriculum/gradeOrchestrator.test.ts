import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGradeUpsert = vi.hoisted(() => vi.fn());
const mockGradeFindFirst = vi.hoisted(() => vi.fn());
const mockGradeFindUnique = vi.hoisted(() => vi.fn());
const mockGradeFindMany = vi.hoisted(() => vi.fn());
const mockGradeUpdate = vi.hoisted(() => vi.fn());
const mockGradeUpdateMany = vi.hoisted(() => vi.fn());
const mockGradeCount = vi.hoisted(() => vi.fn());
const mockLockUpdateMany = vi.hoisted(() => vi.fn());
const mockLockCreate = vi.hoisted(() => vi.fn());
const mockLockDeleteMany = vi.hoisted(() => vi.fn());
const mockLockFindFirst = vi.hoisted(() => vi.fn());
const mockCurriculumCount = vi.hoisted(() => vi.fn());
const mockAudioCount = vi.hoisted(() => vi.fn());
const mockAudioAggregate = vi.hoisted(() => vi.fn());
const mockTextbookCount = vi.hoisted(() => vi.fn());
const mockTextbookAggregate = vi.hoisted(() => vi.fn());
const mockRequireUser = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    gradePipelineJob: {
      upsert: mockGradeUpsert,
      findFirst: mockGradeFindFirst,
      findUnique: mockGradeFindUnique,
      findMany: mockGradeFindMany,
      update: mockGradeUpdate,
      updateMany: mockGradeUpdateMany,
      count: mockGradeCount,
    },
    pipelineLock: {
      updateMany: mockLockUpdateMany,
      create: mockLockCreate,
      deleteMany: mockLockDeleteMany,
      findFirst: mockLockFindFirst,
    },
    curriculumContent: { count: mockCurriculumCount },
    lessonAudio: { count: mockAudioCount, aggregate: mockAudioAggregate },
    textbookGenerationJob: { count: mockTextbookCount, aggregate: mockTextbookAggregate },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireUser: mockRequireUser,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((target: string) => {
    throw new Error(`redirect:${target}`);
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockGradeCount.mockResolvedValue(0);
  mockAudioAggregate.mockResolvedValue({ _sum: { estimatedCostUsd: 0 } });
  mockTextbookAggregate.mockResolvedValue({ _sum: { estimatedCostUsd: 0 } });
  mockLockFindFirst.mockResolvedValue(null);
  mockRequireUser.mockResolvedValue({ role: "ADMIN", isPlatformAdmin: false });
});

describe("gradeOrchestrator", () => {
  it("enqueues a grade with normalized subjects", async () => {
    mockGradeUpsert.mockResolvedValue({
      grade: 5,
      subjects: ["ENGLISH", "MATH"],
      status: "NOT_STARTED",
    });
    const { enqueueGrade } = await import("@/lib/pipeline/gradeOrchestrator");

    const result = await enqueueGrade({ grade: 5, subjects: ["math", "ENGLISH", "math"] });

    expect(result.status).toBe("NOT_STARTED");
    expect(mockGradeUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { grade: 5 },
      create: expect.objectContaining({ grade: 5, subjects: ["ENGLISH", "MATH"] }),
      update: expect.objectContaining({ subjects: ["ENGLISH", "MATH"] }),
    }));
  });

  it("prevents double processing when the grade lock is already held", async () => {
    mockLockUpdateMany.mockResolvedValueOnce({ count: 0 });
    mockLockCreate.mockRejectedValueOnce(new Error("unique violation"));
    const { markGradeProcessing } = await import("@/lib/pipeline/gradeOrchestrator");

    const result = await markGradeProcessing({ grade: 6, owner: "worker-1" });

    expect(result).toBeNull();
    expect(mockGradeUpdateMany).not.toHaveBeenCalled();
  });

  it("marks one grade processing after acquiring the lock", async () => {
    mockLockUpdateMany.mockResolvedValueOnce({ count: 1 });
    mockGradeUpdateMany.mockResolvedValueOnce({ count: 1 });
    mockGradeFindUnique.mockResolvedValueOnce({ grade: 6, status: "PROCESSING" });
    const { markGradeProcessing } = await import("@/lib/pipeline/gradeOrchestrator");

    const result = await markGradeProcessing({ grade: 6, currentSubject: "science", owner: "worker-1" });

    expect(result).toMatchObject({ grade: 6, status: "PROCESSING" });
    expect(mockGradeUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { grade: 6, status: { in: ["NOT_STARTED", "BLOCKED"] } },
      data: expect.objectContaining({ status: "PROCESSING", currentSubject: "SCIENCE" }),
    }));
  });

  it("calculates progress from curriculum, audio, and textbook generated counts", async () => {
    mockCurriculumCount.mockResolvedValueOnce(10);
    mockAudioCount.mockResolvedValueOnce(5);
    mockTextbookCount.mockResolvedValueOnce(1);
    const { calculateGradeProgress } = await import("@/lib/pipeline/gradeOrchestrator");

    const progress = await calculateGradeProgress({ grade: 7, subjects: ["MATH", "SCIENCE"] });

    expect(progress).toMatchObject({
      grade: 7,
      curriculumCompletionPct: 100,
      audioCompletionPct: 50,
      textbookCompletionPct: 50,
    });
  });

  it("keeps partial completion visible as PROCESSING instead of complete", async () => {
    mockGradeFindUnique.mockResolvedValueOnce({
      grade: 8,
      subjects: ["ENGLISH"],
      status: "PROCESSING",
      currentSubject: "ENGLISH",
    });
    mockCurriculumCount.mockResolvedValueOnce(20);
    mockAudioCount.mockResolvedValueOnce(10);
    mockTextbookCount.mockResolvedValueOnce(1);
    mockGradeUpdate.mockResolvedValueOnce({ grade: 8, status: "PROCESSING" });
    const { refreshGradeStatusForQueueEvent } = await import("@/lib/pipeline/gradeOrchestrator");

    const result = await refreshGradeStatusForQueueEvent({ grade: 8, subject: "english" });

    expect(result).toMatchObject({ status: "PROCESSING" });
    expect(mockGradeUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "PROCESSING", currentSubject: "ENGLISH" }),
    }));
  });

  it("renders the admin pipeline status dashboard table", async () => {
    mockGradeFindMany.mockResolvedValueOnce([
      {
        grade: 9,
        subjects: ["MATH"],
        status: "PROCESSING",
        currentSubject: "MATH",
        errorMessage: null,
      },
    ]);
    mockCurriculumCount.mockResolvedValueOnce(4);
    mockAudioCount.mockResolvedValueOnce(2);
    mockTextbookCount.mockResolvedValueOnce(0);
    const { default: PipelineStatusPage } = await import("@/app/admin/pipeline-status/page");

    const element = await PipelineStatusPage();
    const html = renderToStaticMarkup(element as React.ReactElement);

    expect(html).toContain("Pipeline Status");
    expect(html).toContain("Grade 9");
    expect(html).toContain("50%");
    expect(html).toContain("PROCESSING");
  });
});
