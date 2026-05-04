import { beforeEach, describe, expect, it, vi } from "vitest";

const mockIsMoePortalEnabled = vi.hoisted(() => vi.fn());
const mockRequireMoeActor = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockLogLearningEvent = vi.hoisted(() => vi.fn());
const mockLogDataAccess = vi.hoisted(() => vi.fn());
const mockHandleApiError = vi.hoisted(() => vi.fn());
const mockWithRequestLogging = vi.hoisted(() =>
  vi.fn().mockImplementation((_route: string, handler: unknown) => handler)
);
const mockWithRedisCache = vi.hoisted(() => vi.fn());
const mockGetProductMetricsDashboard = vi.hoisted(() => vi.fn());
const mockComputeNationalGeoPerformance = vi.hoisted(() => vi.fn());

vi.mock("@/lib/serverFlags", () => ({ isMoePortalEnabled: mockIsMoePortalEnabled }));
vi.mock("@/lib/moe/authority", () => ({ requireMoeActor: mockRequireMoeActor }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/events/logLearningEvent", () => ({ logLearningEvent: mockLogLearningEvent }));
vi.mock("@/lib/dataAccess/logDataAccess", () => ({ logDataAccess: mockLogDataAccess }));
vi.mock("@/lib/errors/apiErrorHandler", () => ({ handleApiError: mockHandleApiError }));
vi.mock("@/lib/cache/redisCache", () => ({ withRedisCache: mockWithRedisCache }));
vi.mock("@/lib/reporting/productMetrics", () => ({
  getProductMetricsDashboard: mockGetProductMetricsDashboard,
}));
vi.mock("@/lib/reporting/geo/geoAggregator", () => ({
  computeNationalGeoPerformance: mockComputeNationalGeoPerformance,
}));
vi.mock("@/lib/logging/requestLogger", () => ({
  withRequestLogging: mockWithRequestLogging,
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    school: { count: vi.fn(), findMany: vi.fn() },
    district: { count: vi.fn() },
    student: { count: vi.fn() },
    scheduledWork: { count: vi.fn() },
    interventionLog: { count: vi.fn() },
    derivedStudentProgress: { findMany: vi.fn() },
    studentMasteryProfile: { aggregate: vi.fn() },
    aIInteraction: { aggregate: vi.fn(), groupBy: vi.fn() },
  },
}));

import { GET } from "@/app/api/moe/dashboard/route";
import { prisma } from "@/lib/db";

const MOE_USER = { id: "moe-1", role: "MOE_OFFICIAL", isPlatformAdmin: false };

const GEO_RESULT = {
  period: { from: "2026-02", to: "2026-04" },
  counties: [
    {
      county: "Montserrado",
      hasData: true,
      metrics: { masteryAvg: 0.72, growthAvg: 0.05, atRiskPct: 0.1, attendanceProxyAvg: 0.88 },
    },
    {
      county: "Bomi",
      hasData: false,
      metrics: { masteryAvg: null, growthAvg: null, atRiskPct: null, attendanceProxyAvg: null },
    },
  ],
};

const AGGREGATE_STUB = {
  generatedAt: "2026-04-14T00:00:00.000Z",
  geoPeriod: { from: "2026-02", to: "2026-04" },
  schools: 42,
  districts: 5,
  students: 8000,
  activeStudentsLast30Days: 3000,
  nationalAvgMasteryScore: 68.5,
  scheduledWork: { total: 500, delivered: 420, deliveryRatePct: 84 },
  interventionsLast30Days: 12,
  examStats: {
    totalExamsPublished: 10,
    totalAttempts: 200,
    nationalPassRate: 72,
    certificationIssued: 150,
    flaggedAttempts: 3,
    subjectBreakdown: [],
  },
  productMetrics: {
    nationalLessonCompletionRate: 0.8,
    nationalExamPassRate: 0.72,
    nationalGuardianEngagementRate: 0.4,
    interventionImpactRate: 0.65,
    topPerformingDistricts: [],
    lowestPerformingDistricts: [],
  },
  countyBreakdown: [
    { county: "Montserrado", hasData: true, suppressed: false, studentCount: 5000, metrics: {} },
    { county: "Bomi", hasData: false, suppressed: true, studentCount: null, metrics: null },
  ],
  aiUsageLast30Days: {
    totalInteractions: 500,
    totalTokensUsed: 200000,
    estimatedCostUSD: 1.5,
    avgCostPerInteraction: 0.003,
    byFeature: [],
  },
};

describe("GET /api/moe/dashboard (Sprint 6 enhanced)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsMoePortalEnabled.mockReturnValue(true);
    mockRequireMoeActor.mockResolvedValue({ user: MOE_USER, scope: { level: "national" } });
    mockLogAudit.mockResolvedValue(undefined);
    mockLogLearningEvent.mockResolvedValue(undefined);
    mockLogDataAccess.mockResolvedValue(undefined);
    mockHandleApiError.mockImplementation((err: unknown) =>
      Response.json({ error: "error" }, { status: (err as { status?: number })?.status ?? 500 })
    );
    // withRedisCache passes through to fn in tests
    mockWithRedisCache.mockImplementation((_key: string, _ttl: number, fn: () => Promise<unknown>) => fn());
    mockGetProductMetricsDashboard.mockResolvedValue({ nationalOutcomes: null });
    mockComputeNationalGeoPerformance.mockResolvedValue(GEO_RESULT);
  });

  it("returns 404 when MOE portal is disabled", async () => {
    mockIsMoePortalEnabled.mockReturnValue(false);
    const res = await GET();
    expect(res.status).toBe(404);
  });

  it("returns 403 when requireMoeActor throws auth error", async () => {
    mockRequireMoeActor.mockRejectedValueOnce(
      Object.assign(new Error("Forbidden"), { status: 403 })
    );
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns 200 with aggregate payload when cache hits", async () => {
    mockWithRedisCache.mockResolvedValue(AGGREGATE_STUB);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.schools).toBe(42);
    expect(body.countyBreakdown).toHaveLength(2);
    expect(body.aiUsageLast30Days.totalInteractions).toBe(500);
  });

  it("county breakdown suppresses cohorts with hasData=false", async () => {
    mockWithRedisCache.mockResolvedValue(AGGREGATE_STUB);
    const res = await GET();
    const body = await res.json();
    const bomi = body.countyBreakdown.find((c: { county: string }) => c.county === "Bomi");
    expect(bomi.suppressed).toBe(true);
    expect(bomi.metrics).toBeNull();
  });

  it("preserves school county labels when geo metrics are unavailable", async () => {
    mockComputeNationalGeoPerformance.mockResolvedValueOnce({
      period: { from: "2026-02", to: "2026-04" },
      counties: [],
    });

    vi.mocked(prisma.school.count).mockResolvedValue(1);
    vi.mocked(prisma.district.count).mockResolvedValue(1);
    vi.mocked(prisma.student.count).mockResolvedValue(6);
    vi.mocked(prisma.scheduledWork.count)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    vi.mocked(prisma.interventionLog.count).mockResolvedValue(0);
    vi.mocked(prisma.school.findMany).mockResolvedValue([
      { county: "Montserrado", _count: { users: 6 } },
    ] as any);
    vi.mocked(prisma.derivedStudentProgress.findMany).mockResolvedValue([]);
    vi.mocked(prisma.studentMasteryProfile.aggregate).mockResolvedValue({
      _avg: { currentScore: null },
    } as any);
    vi.mocked(prisma.aIInteraction.aggregate).mockResolvedValue({
      _count: { _all: 0 },
      _sum: { tokensUsed: null, estimatedCostUSD: null },
    } as any);
    vi.mocked(prisma.aIInteraction.groupBy as any).mockResolvedValue([]);

    const res = await GET();
    const body = await res.json();
    const montserrado = body.countyBreakdown.find(
      (county: { county: string }) => county.county === "Montserrado"
    );

    expect(montserrado).toEqual(
      expect.objectContaining({
        county: "Montserrado",
        hasData: false,
        suppressed: true,
        studentCount: null,
        metrics: null,
      })
    );
    expect(JSON.stringify(body)).not.toContain(process.env.E2E_DEMO_STUDENT_EMAIL ?? "<E2E_DEMO_STUDENT_EMAIL>");
    expect(body.studentRows).toBeUndefined();
    expect(body.studentsList).toBeUndefined();
  });

  it("returns aggregate-only payload with no individual student rows", async () => {
    mockWithRedisCache.mockResolvedValue(AGGREGATE_STUB);
    const res = await GET();
    const body = await res.json();
    expect(body.studentId).toBeUndefined();
    expect(body.students).toBe(8000);
    expect(Array.isArray(body.studentRows)).toBe(false);
    expect(Array.isArray(body.studentsList)).toBe(false);
  });

  it("fires logLearningEvent with moe.dashboard.viewed", async () => {
    mockWithRedisCache.mockResolvedValue(AGGREGATE_STUB);
    await GET();
    expect(mockLogLearningEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "moe.dashboard.viewed", userId: "moe-1" })
    );
  });

  it("fires logAudit with MOE_DASHBOARD_VIEW", async () => {
    mockWithRedisCache.mockResolvedValue(AGGREGATE_STUB);
    await GET();
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "MOE_DASHBOARD_VIEW", userId: "moe-1" })
    );
  });

  it("writes a DataAccessLog entry for MOE dashboard reads", async () => {
    mockWithRedisCache.mockResolvedValue(AGGREGATE_STUB);
    await GET();
    expect(mockLogDataAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "moe-1",
        resourceType: "moe_dashboard",
        resourceId: "national",
        action: "view",
        scope: "national",
      })
    );
  });
});
