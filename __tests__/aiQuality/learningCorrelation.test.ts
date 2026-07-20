import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPerformanceEventCount = vi.hoisted(() => vi.fn());
const mockGradedSubmissionCount = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    studentPerformanceEvent: { count: mockPerformanceEventCount },
    gradedSubmission: { count: mockGradedSubmissionCount },
  },
}));

describe("getLearningCorrelationMetric", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("always reports not-measurable and includes the real current counts", async () => {
    mockPerformanceEventCount.mockResolvedValue(6);
    mockGradedSubmissionCount.mockResolvedValue(0);
    const { getLearningCorrelationMetric } = await import("@/lib/aiQuality/learningCorrelation");

    const result = await getLearningCorrelationMetric();

    expect(result.measurable).toBe(false);
    expect(result.currentPerformanceEventCount).toBe(6);
    expect(result.currentGradedSubmissionCount).toBe(0);
    expect(result.reason).toContain("6 performance events");
    expect(result.reason).toContain("0 graded submissions");
  });

  it("stays not-measurable even when counts are well below the real thresholds but nonzero", async () => {
    mockPerformanceEventCount.mockResolvedValue(50);
    mockGradedSubmissionCount.mockResolvedValue(10);
    const { getLearningCorrelationMetric } = await import("@/lib/aiQuality/learningCorrelation");

    const result = await getLearningCorrelationMetric();

    expect(result.measurable).toBe(false);
    expect(result.currentPerformanceEventCount).toBe(50);
    expect(result.requiredMinimumPerformanceEvents).toBeGreaterThan(50);
  });
});
