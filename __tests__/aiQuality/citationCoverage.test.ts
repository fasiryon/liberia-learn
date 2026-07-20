import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    auditLog: { findMany: mockFindMany },
  },
}));

describe("getCitationCoverageMetric", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports not-measurable when there are no recent real interactions", async () => {
    mockFindMany.mockResolvedValue([]);
    const { getCitationCoverageMetric } = await import("@/lib/aiQuality/citationCoverage");

    const result = await getCitationCoverageMetric();

    expect(result.status).toBe("gap");
  });

  it("computes real coverage and avg grounding from AuditLog details", async () => {
    mockFindMany.mockResolvedValue([
      { details: { sourceCount: 3, groundingScore: 0.9 } },
      { details: { sourceCount: 0, groundingScore: 0.2 } },
      { details: { sourceCount: 2 } }, // legacy row, no groundingScore logged yet
    ]);
    const { getCitationCoverageMetric } = await import("@/lib/aiQuality/citationCoverage");

    const result = await getCitationCoverageMetric();

    expect(result.status).toBe("measurable");
    if (result.status === "measurable") {
      expect(result.totalInteractions).toBe(3);
      expect(result.interactionsWithSources).toBe(2);
      expect(result.coveragePct).toBeCloseTo((2 / 3) * 100, 6);
      expect(result.avgGroundingScore).toBeCloseTo((0.9 + 0.2) / 2, 8);
    }
  });

  it("never treats a missing groundingScore as zero when averaging", async () => {
    mockFindMany.mockResolvedValue([{ details: { sourceCount: 1 } }]);
    const { getCitationCoverageMetric } = await import("@/lib/aiQuality/citationCoverage");

    const result = await getCitationCoverageMetric();

    expect(result.status).toBe("measurable");
    if (result.status === "measurable") {
      expect(result.avgGroundingScore).toBeNull();
    }
  });
});
