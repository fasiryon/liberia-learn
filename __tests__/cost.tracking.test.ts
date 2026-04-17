import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockAggregate = vi.hoisted(() => vi.fn());
const mockGroupBy = vi.hoisted(() => vi.fn());
const mockCount = vi.hoisted(() => vi.fn());
const mockSchoolFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/db", () => ({
  prisma: {
    aiInteractionLog: {
      aggregate: mockAggregate,
      groupBy: mockGroupBy,
      count: mockCount,
    },
    school: {
      findMany: mockSchoolFindMany,
    },
  },
}));

vi.mock("@/lib/serverFlags", () => ({
  getAiBudgetDailyCap: () => 25,
  getAiBudgetMonthlyCap: () => 100,
  getAiTutorDailyBudgetUsd: () => 5,
  getAiTeacherAssistDailyBudgetUsd: () => 10,
  getAiGradingDailyBudgetUsd: () => 8,
  getAiCurriculumDailyBudgetUsd: () => 20,
  getAiLabsDailyBudgetUsd: () => 5,
}));

import { getAiUsageMetrics } from "@/lib/ai/interactionLog";
import { GET as adminAiCostsGet } from "@/app/api/admin/ai-costs/route";

describe("AI cost tracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      schoolId: null,
      isPlatformAdmin: true,
    });
    mockAggregate
      .mockResolvedValueOnce({
        _sum: {
          tokensUsed: 450,
          estimatedCostUSD: 1.75,
        },
      })
      .mockResolvedValueOnce({
        _sum: {
          estimatedCostUSD: 12.5,
        },
      });
    mockCount
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);
    mockGroupBy
      .mockResolvedValueOnce([
        {
          feature: "tutor",
          _sum: { tokensUsed: 300, estimatedCostUSD: 1.2 },
          _count: { _all: 3 },
        },
        {
          feature: "teacherAssist",
          _sum: { tokensUsed: 150, estimatedCostUSD: 0.55 },
          _count: { _all: 2 },
        },
      ])
      .mockResolvedValueOnce([
        {
          schoolId: "school-1",
          _sum: { estimatedCostUSD: 1.2 },
        },
      ]);
    mockSchoolFindMany.mockResolvedValue([{ id: "school-1", name: "Buchanan Central" }]);
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

  it("returns the Sprint 2 AI cost dashboard payload on the admin surface", async () => {
    const response = await adminAiCostsGet();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      today: {
        totalCostUsd: 1.75,
        totalTokens: 450,
        requestCount: 5,
        fallbackCount: 4,
        byFeature: {
          tutor: {
            costUsd: 1.2,
            tokensUsed: 300,
            requestCount: 3,
            fallbackCount: 1,
          },
          teacherAssist: {
            costUsd: 0.55,
            tokensUsed: 150,
            requestCount: 2,
            fallbackCount: 2,
          },
        },
        topSchoolsBySpend: [
          {
            schoolId: "school-1",
            name: "Buchanan Central",
            costUsd: 1.2,
          },
        ],
      },
      thisMonth: {
        totalCostUsd: 12.5,
        budgetCapUsd: 100,
      },
      alerts: expect.any(Array),
    });
  });
});
