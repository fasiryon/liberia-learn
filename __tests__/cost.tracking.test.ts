import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockAggregate = vi.hoisted(() => vi.fn());
const mockGroupBy = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/db", () => ({
  prisma: {
    aiInteractionLog: {
      aggregate: mockAggregate,
      groupBy: mockGroupBy,
    },
  },
}));

import { getAiUsageMetrics } from "@/lib/ai/interactionLog";
import { GET as adminAiCostsGet } from "@/app/api/admin/ai-costs/route";

describe("AI cost tracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      schoolId: "school-1",
      isPlatformAdmin: false,
    });
    mockAggregate.mockResolvedValue({
      _sum: {
        tokensUsed: 450,
        estimatedCostUSD: 1.75,
      },
    });
    mockGroupBy.mockResolvedValue([
      {
        endpoint: "/api/student/tutor",
        _sum: { tokensUsed: 300, estimatedCostUSD: 1.2 },
        _count: { endpoint: 12 },
      },
      {
        endpoint: "/api/teacher/assist",
        _sum: { tokensUsed: 150, estimatedCostUSD: 0.55 },
        _count: { endpoint: 5 },
      },
    ]);
  });

  it("derives tokensUsed and estimatedCost from actual provider usage fields", () => {
    expect(
      getAiUsageMetrics({
        inputTokens: 120,
        outputTokens: 30,
        estimatedCostUSD: 0.42,
      })
    ).toEqual({
      tokensUsed: 150,
      estimatedCostUSD: 0.42,
      model: null,
    });
  });

  it("aggregates totalTokens, totalCost, and costPerEndpoint on the admin surface", async () => {
    const response = await adminAiCostsGet();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      totalTokens: 450,
      totalCost: 1.75,
      costPerEndpoint: [
        {
          endpoint: "/api/student/tutor",
          totalTokens: 300,
          totalCost: 1.2,
          requestCount: 12,
        },
        {
          endpoint: "/api/teacher/assist",
          totalTokens: 150,
          totalCost: 0.55,
          requestCount: 5,
        },
      ],
    });
  });
});
