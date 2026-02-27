import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequirePlatformAdmin = vi.hoisted(() => vi.fn());
const mockIsNationalInsightsEnabled = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockRecordMetricEvent = vi.hoisted(() => vi.fn());
const mockComputeNationalGeoPerformance = vi.hoisted(() => vi.fn());
const mockComputeNationalCurriculumSignals = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requirePlatformAdmin: mockRequirePlatformAdmin,
}));

vi.mock("@/lib/serverFlags", async () => {
  const actual = await vi.importActual<any>("@/lib/serverFlags");
  return {
    ...actual,
    isNationalInsightsEnabled: mockIsNationalInsightsEnabled,
  };
});

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
}));

vi.mock("@/lib/metrics/events", () => ({
  recordMetricEvent: mockRecordMetricEvent,
}));

vi.mock("@/lib/reporting/geo/geoAggregator", () => ({
  computeNationalGeoPerformance: mockComputeNationalGeoPerformance,
}));

vi.mock("@/lib/reporting/curriculum/nationalCurriculumSignals", () => ({
  computeNationalCurriculumSignals: mockComputeNationalCurriculumSignals,
}));

import { buildNationalInsights } from "@/lib/reporting/national/nationalInsightsAggregator";
import { GET } from "@/app/api/admin/national/insights/route";

function makeReq(path = "/api/admin/national/insights?from=2025-01&to=2025-01") {
  return new Request(`http://localhost${path}`) as any;
}

const geoFixture = {
  period: {
    from: "2025-01-01T00:00:00.000Z",
    to: "2025-01-31T23:59:59.999Z",
  },
  counties: [
    {
      county: "Montserrado",
      hasData: true,
      metrics: {
        masteryAvg: 0.7,
        growthAvg: 0.12,
        atRiskPct: 0.3,
        attendanceProxyAvg: 0.8,
      },
    },
    {
      county: "Bomi",
      hasData: true,
      metrics: {
        masteryAvg: 0.5,
        growthAvg: -0.05,
        atRiskPct: 0.4,
        attendanceProxyAvg: 0.6,
      },
    },
    {
      county: "Bong",
      hasData: true,
      metrics: {
        masteryAvg: 0.8,
        growthAvg: 0.2,
        atRiskPct: 0.2,
        attendanceProxyAvg: 0.9,
      },
    },
    {
      county: "Lofa",
      hasData: false,
      metrics: {
        masteryAvg: null,
        growthAvg: null,
        atRiskPct: null,
        attendanceProxyAvg: null,
      },
    },
  ],
};

const curriculumFixture = {
  rows: [
    {
      gradeBand: "G4_6",
      subject: "MATH",
      strandKey: "fractions",
      strandName: "Fractions",
      sampleSize: 25,
      avgMastery: 0.48,
      avgMasteryDelta: 0.03,
      trendDirection: "improving",
    },
    {
      gradeBand: "G7_9",
      subject: "SCIENCE",
      strandKey: "ecosystems",
      strandName: "Ecosystems",
      sampleSize: 22,
      avgMastery: 0.44,
      avgMasteryDelta: -0.02,
      trendDirection: "declining",
    },
  ],
  weakByGradeBand: {
    G4_6: [],
    G7_9: [],
  },
  summary: {
    totalProfilesConsidered: 120,
    eligibleStrandCount: 2,
    filteredOutBySample: 0,
    minSampleSize: 20,
    weakBottomN: 3,
    weakMasteryThreshold: 0.6,
  },
};

describe("buildNationalInsights", () => {
  it("computes benchmarks and deterministic ordering", () => {
    const result = buildNationalInsights({
      geo: geoFixture as any,
      curriculum: curriculumFixture as any,
    });

    expect(result.benchmarks.masteryAvg.avg).toBeCloseTo(0.6667, 4);
    expect(result.benchmarks.masteryAvg.median).toBeCloseTo(0.7, 4);
    expect(result.benchmarks.masteryAvg.p25).toBeCloseTo(0.5, 4);
    expect(result.benchmarks.masteryAvg.p75).toBeCloseTo(0.7, 4);

    expect(result.benchmarks.growthAvg.avg).toBeCloseTo(0.09, 4);
    expect(result.benchmarks.growthAvg.median).toBeCloseTo(0.12, 4);
    expect(result.benchmarks.growthAvg.p25).toBeCloseTo(-0.05, 4);
    expect(result.benchmarks.growthAvg.p75).toBeCloseTo(0.12, 4);

    expect(result.topImprovingCounties.map((c) => c.county)).toEqual([
      "Bong",
      "Montserrado",
      "Bomi",
    ]);
    expect(result.topDecliningCounties.map((c) => c.county)).toEqual([
      "Bomi",
      "Montserrado",
      "Bong",
    ]);
  });

  it("handles missing data with null benchmarks and hasData false", () => {
    const result = buildNationalInsights({
      geo: {
        period: geoFixture.period,
        counties: [
          {
            county: "Bomi",
            hasData: false,
            metrics: {
              masteryAvg: null,
              growthAvg: null,
              atRiskPct: null,
              attendanceProxyAvg: null,
            },
          },
        ],
      },
      curriculum: {
        rows: [],
        weakByGradeBand: {},
        summary: {
          totalProfilesConsidered: 0,
          eligibleStrandCount: 0,
          filteredOutBySample: 0,
          minSampleSize: 20,
          weakBottomN: 3,
          weakMasteryThreshold: 0.6,
        },
      },
    });

    expect(result.hasData).toBe(false);
    expect(result.benchmarks.masteryAvg.avg).toBeNull();
    expect(result.benchmarks.growthAvg.median).toBeNull();
    expect(result.topImprovingCounties).toHaveLength(0);
    expect(result.insights.every((insight) => insight.value === null)).toBe(true);
  });
});

describe("GET /api/admin/national/insights", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsNationalInsightsEnabled.mockReturnValue(true);
    mockRequirePlatformAdmin.mockResolvedValue({
      id: "platform-1",
      role: "ADMIN",
      isPlatformAdmin: true,
      schoolId: "school-1",
    });
    mockLogAudit.mockResolvedValue(undefined);
    mockRecordMetricEvent.mockResolvedValue(undefined);
    mockComputeNationalGeoPerformance.mockResolvedValue(geoFixture);
    mockComputeNationalCurriculumSignals.mockResolvedValue(curriculumFixture);
  });

  it("returns 404 when feature flag is disabled", async () => {
    mockIsNationalInsightsEnabled.mockReturnValue(false);

    const res = await GET(makeReq());
    expect(res.status).toBe(404);
    expect(mockRequirePlatformAdmin).not.toHaveBeenCalled();
  });

  it("denies non-national admin access", async () => {
    mockRequirePlatformAdmin.mockRejectedValue(
      Object.assign(new Error("Forbidden"), { status: 403 })
    );

    const res = await GET(makeReq());
    expect(res.status).toBe(403);
  });

  it("returns deterministic ordering and no PII fields", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.topImprovingCounties.map((c: any) => c.county)).toEqual([
      "Bong",
      "Montserrado",
      "Bomi",
    ]);

    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("schoolId");
    expect(serialized).not.toContain("studentId");
    expect(serialized).not.toContain("teacherId");
    expect(serialized).not.toContain("schoolName");
  });
});
