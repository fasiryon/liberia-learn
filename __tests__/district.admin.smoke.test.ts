import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockAssertPermission = vi.hoisted(() => vi.fn());
const mockIsDistrictIntelligenceEnabled = vi.hoisted(() => vi.fn());
const mockIsAiInterventionsEnabled = vi.hoisted(() => vi.fn());
const mockResolveDistrictContext = vi.hoisted(() => vi.fn());
const mockComputeDistrictDashboard = vi.hoisted(() => vi.fn());
const mockComputeDistrictTrends = vi.hoisted(() => vi.fn());
const mockComputeRecommendations = vi.hoisted(() => vi.fn());
const mockComputeSchoolDashboard = vi.hoisted(() => vi.fn());
const mockComputeSchoolTrends = vi.hoisted(() => vi.fn());
const mockFetchLatestImpactSnapshot = vi.hoisted(() => vi.fn());
const mockRecordIntervention = vi.hoisted(() => vi.fn());
const mockSchoolFindMany = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
}));

vi.mock("@/lib/permissions", () => ({
  PERMISSIONS: { VIEW_DISTRICT_DASHBOARD: "view:district:dashboard" },
  assertPermission: mockAssertPermission,
}));

vi.mock("@/lib/serverFlags", () => ({
  isDistrictIntelligenceEnabled: mockIsDistrictIntelligenceEnabled,
  isAiInterventionsEnabled: mockIsAiInterventionsEnabled,
  isAiInterventionsAiEnhanced: () => false,
}));

vi.mock("@/lib/reporting/districtScope", () => ({
  resolveDistrictContext: mockResolveDistrictContext,
}));

vi.mock("@/lib/reporting/dashboard/districtAggregator", () => ({
  computeDistrictDashboard: mockComputeDistrictDashboard,
}));

vi.mock("@/lib/reporting/trends/districtTrendAggregator", () => ({
  computeDistrictTrends: mockComputeDistrictTrends,
}));

vi.mock("@/lib/ai/interventions/recommendationEngine", () => ({
  computeRecommendations: mockComputeRecommendations,
}));

vi.mock("@/lib/reporting/dashboard/dashboardAggregator", () => ({
  computeSchoolDashboard: mockComputeSchoolDashboard,
}));

vi.mock("@/lib/reporting/trends/trendAggregator", () => ({
  computeSchoolTrends: mockComputeSchoolTrends,
}));

vi.mock("@/lib/metrics/impact/impactSnapshotRepo", () => ({
  fetchLatestImpactSnapshot: mockFetchLatestImpactSnapshot,
}));

vi.mock("@/lib/ai/interventions/outcomeTracker", () => ({
  recordIntervention: mockRecordIntervention,
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    school: { findMany: mockSchoolFindMany },
  },
}));

import { GET as districtDashboardGET } from "@/app/api/admin/dashboard/district/route";
import { GET as districtInterventionsGET } from "@/app/api/admin/dashboard/district/interventions/route";
import { GET as districtTrendsGET } from "@/app/api/admin/dashboard/district/trends/route";

const districtAdmin = {
  id: "district-admin-1",
  role: "DISTRICT_ADMIN" as const,
  schoolId: "school-1",
  isPlatformAdmin: false,
};

function makeRequest(path: string, params: Record<string, string> = {}) {
  const url = new URL(`http://localhost${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new Request(url.toString()) as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsDistrictIntelligenceEnabled.mockReturnValue(true);
  mockIsAiInterventionsEnabled.mockReturnValue(true);
  mockRequireRole.mockResolvedValue(districtAdmin);
  mockAssertPermission.mockReturnValue(undefined);
  mockResolveDistrictContext.mockResolvedValue({
    districtId: "district-1",
    tenantId: "tenant-1",
  });
  mockComputeDistrictDashboard.mockResolvedValue({
    districtId: "district-1",
    schoolCount: 2,
    schoolsAtRisk: 1,
  });
  mockComputeDistrictTrends.mockResolvedValue({
    districtId: "district-1",
    period: "monthly",
    masteryTrend: [],
    evidenceVelocityTrend: [],
  });
  mockSchoolFindMany.mockResolvedValue([{ id: "school-1" }, { id: "school-2" }]);
  mockComputeSchoolDashboard.mockResolvedValue({
    avgMasteryScore: 0.62,
    trainingAdoptionRate: 0.53,
    evidenceSubmissionRate: 0.47,
  });
  mockComputeSchoolTrends.mockResolvedValue({
    period: "monthly",
    masteryTrend: [],
    evidenceVelocityTrend: [],
  });
  mockFetchLatestImpactSnapshot.mockResolvedValue(null);
  mockComputeRecommendations.mockResolvedValue({
    interventionPriorityScore: 70,
    growthRiskFlag: "medium",
    recommendedActions: [],
    dataConfidence: "medium",
    generatedAt: "2026-04-03T00:00:00.000Z",
  });
  mockRecordIntervention.mockResolvedValue(undefined);
  mockLogAudit.mockResolvedValue(undefined);
});

describe("district admin smoke coverage", () => {
  it("DISTRICT_ADMIN can access /api/admin/dashboard/district", async () => {
    const response = await districtDashboardGET(makeRequest("/api/admin/dashboard/district"));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      districtId: "district-1",
      schoolCount: 2,
    });
  });

  it("DISTRICT_ADMIN can access /api/admin/dashboard/district/interventions", async () => {
    const response = await districtInterventionsGET(
      makeRequest("/api/admin/dashboard/district/interventions")
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      expect.objectContaining({ schoolId: "school-1" }),
      expect.objectContaining({ schoolId: "school-2" }),
    ]);
  });

  it("DISTRICT_ADMIN can access /api/admin/dashboard/district/trends", async () => {
    const response = await districtTrendsGET(
      makeRequest("/api/admin/dashboard/district/trends", { period: "monthly" })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      districtId: "district-1",
      period: "monthly",
    });
  });

  it("TEACHER gets 403 on district routes", async () => {
    mockRequireRole.mockRejectedValue(Object.assign(new Error("Forbidden"), { status: 403 }));

    const [dashboard, interventions, trends] = await Promise.all([
      districtDashboardGET(makeRequest("/api/admin/dashboard/district")),
      districtInterventionsGET(makeRequest("/api/admin/dashboard/district/interventions")),
      districtTrendsGET(makeRequest("/api/admin/dashboard/district/trends")),
    ]);

    expect(dashboard.status).toBe(403);
    expect(interventions.status).toBe(403);
    expect(trends.status).toBe(403);
  });

  it("responses remain district-scoped", async () => {
    await districtDashboardGET(makeRequest("/api/admin/dashboard/district"));
    await districtInterventionsGET(makeRequest("/api/admin/dashboard/district/interventions"));
    await districtTrendsGET(makeRequest("/api/admin/dashboard/district/trends"));

    expect(mockResolveDistrictContext).toHaveBeenCalledTimes(3);
    for (const call of mockResolveDistrictContext.mock.results) {
      expect(call.type).toBe("return");
    }
  });
});
