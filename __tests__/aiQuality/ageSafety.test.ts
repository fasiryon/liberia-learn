import { beforeEach, describe, expect, it, vi } from "vitest";

const mockReviewCount = vi.hoisted(() => vi.fn());
const mockIsAgentEnabled = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    contentQaReview: { count: mockReviewCount },
  },
}));

vi.mock("@/lib/agents/flags", () => ({
  isAgentEnabled: mockIsAgentEnabled,
}));

describe("getAgeSafetyMetric", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports infrastructure-exists-but-inactive when the agent flag is off", async () => {
    mockIsAgentEnabled.mockReturnValue(false);
    mockReviewCount.mockResolvedValue(0);
    const { getAgeSafetyMetric } = await import("@/lib/aiQuality/ageSafety");

    const result = await getAgeSafetyMetric();

    expect(result.measurable).toBe(false);
    expect(result.agentEnabled).toBe(false);
    expect(result.reason).toMatch(/AGENT_CONTENT_QA_ENABLED is off/);
  });

  it("still reports not-measurable but reflects real review count when enabled with too little data", async () => {
    mockIsAgentEnabled.mockReturnValue(true);
    mockReviewCount.mockResolvedValue(3);
    const { getAgeSafetyMetric } = await import("@/lib/aiQuality/ageSafety");

    const result = await getAgeSafetyMetric();

    expect(result.agentEnabled).toBe(true);
    expect(result.realReviewCount).toBe(3);
    expect(result.reason).toContain("3 real reviews");
  });
});
