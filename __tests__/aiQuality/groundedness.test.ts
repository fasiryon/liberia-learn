import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    evalRun: { findMany: mockFindMany },
  },
}));

describe("getGroundednessMetric", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports not-measurable when EvalRun is empty", async () => {
    mockFindMany.mockResolvedValue([]);
    const { getGroundednessMetric } = await import("@/lib/aiQuality/groundedness");

    const result = await getGroundednessMetric();

    expect(result.status).toBe("gap");
    if (result.status === "gap") {
      expect(result.reason).toMatch(/no rag eval runs/i);
    }
  });

  it("surfaces the latest real run's numbers when EvalRun has data", async () => {
    mockFindMany.mockResolvedValue([
      {
        runAt: new Date("2026-07-15T15:25:03.167Z"),
        datasetSize: 21,
        avgGrounding: 0.9285714285714286,
        avgRecallAt5: 0.7857142857142857,
        fallbackRate: 0.047619047619047616,
        passed: true,
      },
      {
        runAt: new Date("2026-07-08T15:25:03.167Z"),
        datasetSize: 21,
        avgGrounding: 0.9,
        avgRecallAt5: 0.75,
        fallbackRate: 0.05,
        passed: true,
      },
    ]);
    const { getGroundednessMetric } = await import("@/lib/aiQuality/groundedness");

    const result = await getGroundednessMetric();

    expect(result.status).toBe("measurable");
    if (result.status === "measurable") {
      expect(result.datasetSize).toBe(21);
      expect(result.avgGroundingScore).toBeCloseTo(0.9285714285714286, 8);
      expect(result.passed).toBe(true);
      expect(result.recentRuns).toHaveLength(2);
    }
  });
});
