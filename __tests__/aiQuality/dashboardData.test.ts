import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEvalRunFindMany = vi.hoisted(() => vi.fn());
const mockQueryRaw = vi.hoisted(() => vi.fn());
const mockAuditLogFindMany = vi.hoisted(() => vi.fn());
const mockContentQaReviewCount = vi.hoisted(() => vi.fn());
const mockPerformanceEventCount = vi.hoisted(() => vi.fn());
const mockGradedSubmissionCount = vi.hoisted(() => vi.fn());
const mockIsAgentEnabled = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    evalRun: { findMany: mockEvalRunFindMany },
    $queryRaw: mockQueryRaw,
    auditLog: { findMany: mockAuditLogFindMany },
    contentQaReview: { count: mockContentQaReviewCount },
    studentPerformanceEvent: { count: mockPerformanceEventCount },
    gradedSubmission: { count: mockGradedSubmissionCount },
  },
}));

vi.mock("@/lib/agents/flags", () => ({
  isAgentEnabled: mockIsAgentEnabled,
}));

describe("getAiQualityDashboardData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEvalRunFindMany.mockResolvedValue([]);
    mockQueryRaw.mockResolvedValue([{ total: 0n, checked: 0n }]);
    mockAuditLogFindMany.mockResolvedValue([]);
    mockContentQaReviewCount.mockResolvedValue(0);
    mockPerformanceEventCount.mockResolvedValue(0);
    mockGradedSubmissionCount.mockResolvedValue(0);
    mockIsAgentEnabled.mockReturnValue(false);
  });

  it("distinguishes real-measured metrics from honest gap states", async () => {
    mockEvalRunFindMany.mockResolvedValue([
      {
        runAt: new Date("2026-07-15T15:25:03.167Z"),
        datasetSize: 21,
        avgGrounding: 0.93,
        avgRecallAt5: 0.79,
        fallbackRate: 0.05,
        passed: true,
      },
    ]);
    mockQueryRaw.mockResolvedValue([{ total: 6192n, checked: 491n }]);

    const { getAiQualityDashboardData } = await import("@/lib/aiQuality/dashboardData");
    const data = await getAiQualityDashboardData();

    // Real, measured metrics
    expect(data.groundedness.status).toBe("measurable");
    expect(data.curriculumGrounding.measurable).toBe(true);
    expect(data.curriculumGrounding.coveragePct).toBeCloseTo((491 / 6192) * 100, 6);

    // Honest gaps -- never silently rendered as a fake current number
    expect(data.citationCoverage.status).toBe("gap");
    expect(data.ageSafety.measurable).toBe(false);
    expect(data.biasCheck.measurable).toBe(false);
    expect(data.learningCorrelation.measurable).toBe(false);
  });

  it("never marks groundedness measurable when EvalRun has no rows", async () => {
    const { getAiQualityDashboardData } = await import("@/lib/aiQuality/dashboardData");
    const data = await getAiQualityDashboardData();

    expect(data.groundedness.status).toBe("gap");
  });
});
