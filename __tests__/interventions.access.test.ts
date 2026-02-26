/**
 * __tests__/interventions.access.test.ts -- Block 13/14
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockAssertPermission = vi.hoisted(() => vi.fn());
const mockIsAiInterventionsEnabled = vi.hoisted(() => vi.fn());
const mockIsDistrictIntelligenceEnabled = vi.hoisted(() => vi.fn());
const mockComputeRecommendations = vi.hoisted(() => vi.fn());
const mockComputeSchoolDashboard = vi.hoisted(() => vi.fn());
const mockComputeSchoolTrends = vi.hoisted(() => vi.fn());
const mockFetchLatestImpactSnapshot = vi.hoisted(() => vi.fn());
const mockRecordIntervention = vi.hoisted(() => vi.fn());
const mockComputeDistrictDashboard = vi.hoisted(() => vi.fn());
const mockComputeDistrictTrends = vi.hoisted(() => vi.fn());
const mockResolveDistrictContext = vi.hoisted(() => vi.fn());
const mockSchoolFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
}));
vi.mock("@/lib/permissions", () => ({
  PERMISSIONS: {
    VIEW_SCHOOL_DASHBOARD: "view:school:dashboard",
    VIEW_DISTRICT_DASHBOARD: "view:district:dashboard",
  },
  assertPermission: mockAssertPermission,
}));
vi.mock("@/lib/serverFlags", () => ({
  isAiInterventionsEnabled: mockIsAiInterventionsEnabled,
  isAiInterventionsAiEnhanced: () => false,
  isDistrictIntelligenceEnabled: mockIsDistrictIntelligenceEnabled,
}));
vi.mock("@/lib/ai/interventions/recommendationEngine", () => ({
  computeRecommendations: mockComputeRecommendations,
}));
vi.mock("@/lib/ai/interventions/outcomeTracker", () => ({
  recordIntervention: mockRecordIntervention,
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
vi.mock("@/lib/reporting/dashboard/districtAggregator", () => ({
  computeDistrictDashboard: mockComputeDistrictDashboard,
}));
vi.mock("@/lib/reporting/trends/districtTrendAggregator", () => ({
  computeDistrictTrends: mockComputeDistrictTrends,
}));
vi.mock("@/lib/reporting/districtScope", () => ({
  resolveDistrictContext: mockResolveDistrictContext,
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    school: { findMany: mockSchoolFindMany },
  },
}));

import { GET as schoolInterventionsGET } from "@/app/api/admin/dashboard/school/interventions/route";
import { GET as districtDashboardGET } from "@/app/api/admin/dashboard/district/route";
import { GET as districtInterventionsGET } from "@/app/api/admin/dashboard/district/interventions/route";
import { GET as districtTrendsGET } from "@/app/api/admin/dashboard/district/trends/route";

const SCHOOL_ADMIN = {
  id: "admin-1",
  role: "ADMIN",
  schoolId: "school-1",
  isPlatformAdmin: false,
};

const PLATFORM_ADMIN = {
  id: "platform-1",
  role: "ADMIN",
  schoolId: "school-1",
  isPlatformAdmin: true,
};

const DISTRICT_ADMIN = {
  id: "district-1",
  role: "DISTRICT_ADMIN",
  schoolId: "school-2",
  isPlatformAdmin: false,
};

function makeReq(path: string, params: Record<string, string> = {}) {
  const url = new URL(`http://localhost${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new Request(url.toString()) as any;
}

function setupDefaults() {
  mockIsAiInterventionsEnabled.mockReturnValue(true);
  mockIsDistrictIntelligenceEnabled.mockReturnValue(true);
  mockRequireRole.mockResolvedValue(SCHOOL_ADMIN);
  mockAssertPermission.mockReturnValue(undefined);
  mockComputeRecommendations.mockResolvedValue({
    interventionPriorityScore: 42,
    growthRiskFlag: "low",
    recommendedActions: [],
    dataConfidence: "medium",
    generatedAt: "2026-02-26T12:00:00Z",
  });
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
  mockRecordIntervention.mockResolvedValue(undefined);
  mockComputeDistrictDashboard.mockResolvedValue({
    avgMasteryScore: 0.6,
    trainingAdoptionRate: 0.5,
    evidenceSubmissionRate: 0.5,
    schoolCount: 1,
    schoolsAtRisk: 0,
    topInterventionPriority: 42,
  });
  mockComputeDistrictTrends.mockResolvedValue({
    period: "monthly",
    masteryTrend: [],
    evidenceVelocityTrend: [],
  });
  mockResolveDistrictContext.mockResolvedValue({ districtId: "district-1", tenantId: "school-1" });
  mockSchoolFindMany.mockResolvedValue([{ id: "school-1" }]);
}

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaults();
});

describe("School interventions access", () => {
  it("school admin can access own school", async () => {
    const res = await schoolInterventionsGET(makeReq("/api/admin/dashboard/school/interventions"));
    expect(res.status).toBe(200);
  });

  it("school admin cannot access other school", async () => {
    const res = await schoolInterventionsGET(
      makeReq("/api/admin/dashboard/school/interventions", { schoolId: "other-school" })
    );
    expect(res.status).toBe(403);
  });

  it("platform admin can access any school", async () => {
    mockRequireRole.mockResolvedValue(PLATFORM_ADMIN);
    const res = await schoolInterventionsGET(
      makeReq("/api/admin/dashboard/school/interventions", { schoolId: "other-school" })
    );
    expect(res.status).toBe(200);
    const [args] = mockComputeRecommendations.mock.calls[0];
    expect(args.schoolId).toBe("other-school");
  });

  it("returns 404 when flag disabled", async () => {
    mockIsAiInterventionsEnabled.mockReturnValue(false);
    const res = await schoolInterventionsGET(makeReq("/api/admin/dashboard/school/interventions"));
    expect(res.status).toBe(404);
  });
});

describe("District endpoints access", () => {
  it("district admin can access district dashboard", async () => {
    mockRequireRole.mockResolvedValue(DISTRICT_ADMIN);
    const res = await districtDashboardGET(makeReq("/api/admin/dashboard/district"));
    expect(res.status).toBe(200);
  });

  it("teacher denied", async () => {
    mockRequireRole.mockRejectedValue(Object.assign(new Error("Forbidden"), { status: 403 }));
    const res = await districtDashboardGET(makeReq("/api/admin/dashboard/district"));
    expect(res.status).toBe(403);
  });

  it("guardian denied", async () => {
    mockRequireRole.mockRejectedValue(Object.assign(new Error("Forbidden"), { status: 403 }));
    const res = await districtInterventionsGET(makeReq("/api/admin/dashboard/district/interventions"));
    expect(res.status).toBe(403);
  });

  it("flag off returns 404", async () => {
    mockIsDistrictIntelligenceEnabled.mockReturnValue(false);
    const res = await districtTrendsGET(makeReq("/api/admin/dashboard/district/trends"));
    expect(res.status).toBe(404);
  });
});

