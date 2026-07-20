import { beforeEach, describe, expect, it, vi } from "vitest";

const mockQueryRaw = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
  },
}));

describe("getCurriculumGroundingMetric", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("computes coverage from real total/checked counts", async () => {
    mockQueryRaw.mockResolvedValue([{ total: 6192n, checked: 491n }]);
    const { getCurriculumGroundingMetric } = await import("@/lib/aiQuality/curriculumGrounding");

    const result = await getCurriculumGroundingMetric();

    expect(result.totalLessons).toBe(6192);
    expect(result.checkedLessons).toBe(491);
    expect(result.coveragePct).toBeCloseTo((491 / 6192) * 100, 6);
  });

  it("does not divide by zero when there is no content", async () => {
    mockQueryRaw.mockResolvedValue([{ total: 0n, checked: 0n }]);
    const { getCurriculumGroundingMetric } = await import("@/lib/aiQuality/curriculumGrounding");

    const result = await getCurriculumGroundingMetric();

    expect(result.totalLessons).toBe(0);
    expect(result.coveragePct).toBe(0);
  });
});
