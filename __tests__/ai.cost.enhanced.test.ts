import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockGetAiCostDashboardData = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/serverFlags", () => ({
  isAiCostDashboardEnabled: () => true,
}));
vi.mock("@/lib/ai/costSummary", () => ({
  getAiCostDashboardData: mockGetAiCostDashboardData,
}));

import { GET } from "@/app/api/admin/ai-costs/route";

const MOCK_ADMIN = {
  id: "user-admin-1",
  role: "ADMIN",
  schoolId: "school-aaa",
  isPlatformAdmin: false,
};

const EMPTY_DASHBOARD = {
  today: {
    totalCostUsd: 0,
    totalTokens: 0,
    requestCount: 0,
    fallbackCount: 0,
    fallbackRate: 0,
    costPerInteraction: 0,
    byFeature: {
      tutor: { costUsd: 0, tokensUsed: 0, requestCount: 0, fallbackCount: 0 },
      teacherAssist: { costUsd: 0, tokensUsed: 0, requestCount: 0, fallbackCount: 0 },
      grading: { costUsd: 0, tokensUsed: 0, requestCount: 0, fallbackCount: 0 },
      curriculum: { costUsd: 0, tokensUsed: 0, requestCount: 0, fallbackCount: 0 },
      labs: { costUsd: 0, tokensUsed: 0, requestCount: 0, fallbackCount: 0 },
    },
    topSchoolsBySpend: [],
  },
  thisMonth: { totalCostUsd: 0, budgetCapUsd: 100, percentUsed: 0, projectedMonthEndUsd: 0 },
  sevenDayTrend: [],
  recommendations: ["Use the fast (Groq) tier for simple student questions where available."],
  alerts: [],
};

describe("GET /api/admin/ai-costs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue(MOCK_ADMIN);
    mockGetAiCostDashboardData.mockResolvedValue(EMPTY_DASHBOARD);
  });

  it("returns 200 with dashboard data for ADMIN role", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.today).toBeDefined();
    expect(body.sevenDayTrend).toBeDefined();
    expect(body.recommendations).toBeDefined();
    expect(Array.isArray(body.recommendations)).toBe(true);
  });

  it("scopes data call to admin's schoolId", async () => {
    await GET();
    expect(mockGetAiCostDashboardData).toHaveBeenCalledWith({
      schoolId: "school-aaa",
      isPlatformAdmin: false,
    });
  });

  it("missing token data does not crash — all zero values returned", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.today.costPerInteraction).toBe(0);
    expect(body.today.requestCount).toBe(0);
  });

  it("platform admin receives isPlatformAdmin=true in scoping", async () => {
    mockRequireRole.mockResolvedValue({
      ...MOCK_ADMIN,
      schoolId: null,
      isPlatformAdmin: true,
    });
    await GET();
    expect(mockGetAiCostDashboardData).toHaveBeenCalledWith({
      schoolId: null,
      isPlatformAdmin: true,
    });
  });

  it("tenant scoping: non-platform admin without schoolId is rejected with 400", async () => {
    mockRequireRole.mockResolvedValue({
      ...MOCK_ADMIN,
      schoolId: null,
      isPlatformAdmin: false,
    });
    const res = await GET();
    expect(res.status).toBe(400);
  });

  it("recommendations array is always present in response", async () => {
    const res = await GET();
    const body = await res.json();
    expect(Array.isArray(body.recommendations)).toBe(true);
    expect(body.recommendations.length).toBeGreaterThan(0);
  });
});
