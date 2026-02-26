/**
 * __tests__/district.access.test.ts -- Block 14
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

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

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
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
vi.mock("@/lib/db", () => ({
  prisma: {
    school: { findMany: mockSchoolFindMany },
  },
}));

import { GET as districtDashboardGET } from "@/app/api/admin/dashboard/district/route";
import { GET as districtTrendsGET } from "@/app/api/admin/dashboard/district/trends/route";
import { GET as districtInterventionsGET } from "@/app/api/admin/dashboard/district/interventions/route";

const DISTRICT_ADMIN = {
  id: "district-1",
  role: "DISTRICT_ADMIN",
  schoolId: "school-2",
  isPlatformAdmin: false,
};

const PLATFORM_ADMIN = {
  id: "platform-1",
  role: "ADMIN",
  schoolId: "school-1",
  isPlatformAdmin: true,
};

function makeReq(path: string, params: Record<string, string> = {}) {
  const url = new URL(`http://localhost${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new Request(url.toString()) as any;
}

function setupDefaults() {
  mockIsDistrictIntelligenceEnabled.mockReturnValue(true);
  mockIsAiInterventionsEnabled.mockReturnValue(true);
  mockRequireRole.mockResolvedValue(DISTRICT_ADMIN);
  mockAssertPermission.mockReturnValue(undefined);
  mockResolveDistrictContext.mockResolvedValue({ districtId: "district-1", tenantId: "tenant-1" });
  mockComputeDistrictDashboard.mockResolvedValue({
    avgMasteryScore: 0.6,
    trainingAdoptionRate: 0.5,
    evidenceSubmissionRate: 0.5,
    schoolCount: 2,
    schoolsAtRisk: 1,
    topInterventionPriority: 70,
  });
  mockComputeDistrictTrends.mockResolvedValue({
    period: "monthly",
    masteryTrend: [],
    evidenceVelocityTrend: [],
  });
  mockSchoolFindMany.mockResolvedValue([{ id: "school-1" }, { id: "school-2" }]);
  mockComputeSchoolDashboard.mockResolvedValue({
    avgMasteryScore: 0.6,
    trainingAdoptionRate: 0.5,
    evidenceSubmissionRate: 0.5,
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
    generatedAt: "2026-02-26T12:00:00Z",
  });
  mockRecordIntervention.mockResolvedValue(undefined);
}

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaults();
});

describe("District access controls", () => {
  it("district admin can access own district", async () => {
    const res = await districtDashboardGET(makeReq("/api/admin/dashboard/district"));
    expect(res.status).toBe(200);
  });

  it("district admin cannot access other district", async () => {
    mockResolveDistrictContext.mockRejectedValueOnce(
      Object.assign(new Error("Forbidden"), { status: 403 })
    );
    const res = await districtDashboardGET(
      makeReq("/api/admin/dashboard/district", { districtId: "other" })
    );
    expect(res.status).toBe(403);
  });

  it("platform admin can access any district", async () => {
    mockRequireRole.mockResolvedValue(PLATFORM_ADMIN);
    const res = await districtTrendsGET(
      makeReq("/api/admin/dashboard/district/trends", { districtId: "district-99" })
    );
    expect(res.status).toBe(200);
  });

  it("school admin denied", async () => {
    mockRequireRole.mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      schoolId: "school-1",
      isPlatformAdmin: false,
    });
    mockAssertPermission.mockImplementation(() => {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    });

    const res = await districtDashboardGET(makeReq("/api/admin/dashboard/district"));
    expect(res.status).toBe(403);
  });

  it("teacher denied", async () => {
    mockRequireRole.mockRejectedValue(Object.assign(new Error("Forbidden"), { status: 403 }));
    const res = await districtDashboardGET(makeReq("/api/admin/dashboard/district"));
    expect(res.status).toBe(403);
  });

  it("flag off returns 404", async () => {
    mockIsDistrictIntelligenceEnabled.mockReturnValue(false);
    const res = await districtDashboardGET(makeReq("/api/admin/dashboard/district"));
    expect(res.status).toBe(404);
  });

  it("cross-district data isolation verified in response", async () => {
    const res = await districtInterventionsGET(makeReq("/api/admin/dashboard/district/interventions"));
    const body = await res.json();
    const schoolIds = body.map((r: any) => r.schoolId);
    expect(schoolIds).toEqual(["school-1", "school-2"]);
  });
});

