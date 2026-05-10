import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  runFindFirst,
  jobFindMany,
  contentCount,
  createRunMock,
  logAuditMock,
} = vi.hoisted(() => ({
  runFindFirst: vi.fn(),
  jobFindMany: vi.fn(),
  contentCount: vi.fn(),
  createRunMock: vi.fn(),
  logAuditMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    curriculumRegenerationRun: { findFirst: runFindFirst },
    curriculumRegenerationJob: { findMany: jobFindMany },
    curriculumContent: { count: contentCount },
  },
}));
vi.mock("@/lib/audit", () => ({ logAudit: logAuditMock }));
vi.mock("@/lib/curriculum/regenerationQueue", () => ({
  createCurriculumRegenerationRun: createRunMock,
}));

describe("curriculum regeneration scheduler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ENABLE_CURRICULUM_REGEN_SCHEDULER;
    delete process.env.CURRICULUM_REGEN_SCHEDULER_MAX_FAILURE_RATE;
  });

  it("respects the feature flag", async () => {
    const { runCurriculumRegenerationScheduler } = await import("@/lib/curriculum/regenerationScheduler");

    const result = await runCurriculumRegenerationScheduler();

    expect(result).toMatchObject({ started: false, reason: "feature_flag_disabled" });
    expect(createRunMock).not.toHaveBeenCalled();
  });

  it("does not start when an active run exists", async () => {
    process.env.ENABLE_CURRICULUM_REGEN_SCHEDULER = "true";
    const { runCurriculumRegenerationScheduler } = await import("@/lib/curriculum/regenerationScheduler");
    runFindFirst.mockResolvedValueOnce({ id: "run-active", status: "running" });

    const result = await runCurriculumRegenerationScheduler();

    expect(result).toMatchObject({ started: false, reason: "active_run_exists" });
    expect(createRunMock).not.toHaveBeenCalled();
  });

  it("respects the recent failure threshold", async () => {
    process.env.ENABLE_CURRICULUM_REGEN_SCHEDULER = "true";
    process.env.CURRICULUM_REGEN_SCHEDULER_MAX_FAILURE_RATE = "0.2";
    const { runCurriculumRegenerationScheduler } = await import("@/lib/curriculum/regenerationScheduler");
    runFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    jobFindMany.mockResolvedValue([
      { status: "failed" },
      { status: "failed" },
      { status: "approved" },
    ]);

    const result = await runCurriculumRegenerationScheduler();

    expect(result).toMatchObject({ started: false, reason: "failure_rate_too_high" });
    expect(createRunMock).not.toHaveBeenCalled();
  });
});

