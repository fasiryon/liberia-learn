import { beforeEach, describe, expect, it, vi } from "vitest";

const mockIsMoePortalEnabled = vi.hoisted(() => vi.fn());
const mockRequireMoeActor = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockHandleApiError = vi.hoisted(() => vi.fn());
const mockWithRedisCache = vi.hoisted(() => vi.fn());
const mockComputeNationalGeoPerformance = vi.hoisted(() => vi.fn());
const mockBuildNationalInsights = vi.hoisted(() => vi.fn());
const mockComputeNationalCurriculumSignals = vi.hoisted(() => vi.fn());

vi.mock("@/lib/serverFlags", () => ({ isMoePortalEnabled: mockIsMoePortalEnabled }));
vi.mock("@/lib/moe/authority", () => ({ requireMoeActor: mockRequireMoeActor }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/errors/apiErrorHandler", () => ({ handleApiError: mockHandleApiError }));
vi.mock("@/lib/cache/redisCache", () => ({ withRedisCache: mockWithRedisCache }));
vi.mock("@/lib/reporting/geo/geoAggregator", () => ({
  computeNationalGeoPerformance: mockComputeNationalGeoPerformance,
}));
vi.mock("@/lib/reporting/national/nationalInsightsAggregator", () => ({
  buildNationalInsights: mockBuildNationalInsights,
}));
vi.mock("@/lib/reporting/curriculum/nationalCurriculumSignals", () => ({
  computeNationalCurriculumSignals: mockComputeNationalCurriculumSignals,
}));
vi.mock("@/lib/db", () => ({
  prisma: { school: { findMany: vi.fn() } },
}));

import { GET } from "@/app/api/moe/counties/route";

function makeReq(url: string) {
  return { nextUrl: new URL(url) } as any;
}

const MOE_USER = { id: "moe-1", role: "MOE_OFFICIAL" };

const GEO_RESULT = {
  period: { from: "2026-02", to: "2026-04" },
  counties: [
    {
      county: "Montserrado",
      hasData: true,
      metrics: { masteryAvg: 0.75, growthAvg: 0.06, atRiskPct: 0.08, attendanceProxyAvg: 0.9 },
    },
    {
      county: "Bomi",
      hasData: false,
      metrics: { masteryAvg: null, growthAvg: null, atRiskPct: null, attendanceProxyAvg: null },
    },
  ],
};

const INSIGHTS_STUB = {
  hasData: true,
  topImprovingCounties: [],
  topDecliningCounties: [],
  benchmarks: {},
  insights: [],
  sources: { geoCountiesWithData: 1, curriculumEligibleStrands: 10 },
};

describe("GET /api/moe/counties", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsMoePortalEnabled.mockReturnValue(true);
    mockRequireMoeActor.mockResolvedValue({ user: MOE_USER, scope: { level: "national" } });
    mockLogAudit.mockResolvedValue(undefined);
    mockHandleApiError.mockImplementation((err: unknown) =>
      Response.json({ error: "error" }, { status: (err as { status?: number })?.status ?? 500 })
    );
    mockWithRedisCache.mockImplementation((_k: string, _t: number, fn: () => Promise<unknown>) => fn());
    mockComputeNationalGeoPerformance.mockResolvedValue(GEO_RESULT);
    mockBuildNationalInsights.mockReturnValue(INSIGHTS_STUB);
    mockComputeNationalCurriculumSignals.mockResolvedValue({
      rows: [],
      weakByGradeBand: {},
      summary: { totalProfilesConsidered: 0, eligibleStrandCount: 0, filteredOutBySample: 0, minSampleSize: 0, weakBottomN: 0, weakMasteryThreshold: 0 },
    });
  });

  it("returns 404 when MOE portal disabled", async () => {
    mockIsMoePortalEnabled.mockReturnValue(false);
    const res = await GET(makeReq("http://localhost/api/moe/counties"));
    expect(res.status).toBe(404);
  });

  it("returns 200 with county breakdown", async () => {
    const { prisma } = await import("@/lib/db");
    (prisma.school.findMany as any).mockResolvedValue([
      { county: "Montserrado", _count: { users: 5000 } },
    ]);
    const res = await GET(makeReq("http://localhost/api/moe/counties"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.counties).toHaveLength(2);
    expect(body.totalCounties).toBe(2);
  });

  it("suppresses counties with fewer than 5 students", async () => {
    const { prisma } = await import("@/lib/db");
    (prisma.school.findMany as any).mockResolvedValue([
      { county: "Montserrado", _count: { users: 3 } }, // below threshold
    ]);
    const res = await GET(makeReq("http://localhost/api/moe/counties"));
    const body = await res.json();
    const montserrado = body.counties.find((c: { county: string }) => c.county === "Montserrado");
    expect(montserrado.suppressed).toBe(true);
    expect(montserrado.metrics).toBeNull();
  });

  it("returns 400 for invalid period (from > to)", async () => {
    const { prisma } = await import("@/lib/db");
    (prisma.school.findMany as any).mockResolvedValue([]);
    const res = await GET(makeReq("http://localhost/api/moe/counties?from=2026-06&to=2026-01"));
    expect(res.status).toBe(400);
  });

  it("accepts custom date range via query params", async () => {
    const { prisma } = await import("@/lib/db");
    (prisma.school.findMany as any).mockResolvedValue([]);
    await GET(makeReq("http://localhost/api/moe/counties?from=2026-01&to=2026-03"));
    expect(mockComputeNationalGeoPerformance).toHaveBeenCalledWith({
      periodRange: { from: "2026-01", to: "2026-03" },
    });
  });

  it("fires logAudit on success", async () => {
    const { prisma } = await import("@/lib/db");
    (prisma.school.findMany as any).mockResolvedValue([]);
    await GET(makeReq("http://localhost/api/moe/counties"));
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "MOE_COUNTY_BREAKDOWN_VIEW" })
    );
  });

  it("returns 403 when requireMoeActor throws", async () => {
    mockRequireMoeActor.mockRejectedValueOnce(
      Object.assign(new Error("Forbidden"), { status: 403 })
    );
    const res = await GET(makeReq("http://localhost/api/moe/counties"));
    expect(res.status).toBe(403);
  });
});
