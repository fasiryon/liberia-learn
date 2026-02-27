import { beforeEach, describe, expect, it, vi } from "vitest";

const mockMasteryFindMany = vi.hoisted(() => vi.fn());
const mockAttendanceFindMany = vi.hoisted(() => vi.fn());
const mockRequirePlatformAdmin = vi.hoisted(() => vi.fn());
const mockIsGeoIntelligenceEnabled = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockRecordMetricEvent = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    studentMasteryProfile: { findMany: mockMasteryFindMany },
    attendanceRecord: { findMany: mockAttendanceFindMany },
  },
}));

vi.mock("@/lib/auth", () => ({
  requirePlatformAdmin: mockRequirePlatformAdmin,
}));

vi.mock("@/lib/serverFlags", async () => {
  const actual = await vi.importActual<any>("@/lib/serverFlags");
  return {
    ...actual,
    isGeoIntelligenceEnabled: mockIsGeoIntelligenceEnabled,
  };
});

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
}));

vi.mock("@/lib/metrics/events", () => ({
  recordMetricEvent: mockRecordMetricEvent,
}));

import { computeNationalGeoPerformance } from "@/lib/reporting/geo/geoAggregator";
import { GET } from "@/app/api/admin/national/geo-performance/route";

function makeReq(path = "/api/admin/national/geo-performance?from=2025-01&to=2025-01") {
  return new Request(`http://localhost${path}`) as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsGeoIntelligenceEnabled.mockReturnValue(true);
  mockRequirePlatformAdmin.mockResolvedValue({
    id: "platform-1",
    role: "ADMIN",
    isPlatformAdmin: true,
    schoolId: "school-1",
  });
  mockLogAudit.mockResolvedValue(undefined);
  mockRecordMetricEvent.mockResolvedValue(undefined);
  mockMasteryFindMany.mockResolvedValue([
    {
      currentScore: 0.8,
      baselineScore: 0.6,
      masteryState: "DECAYING",
      student: { user: { school: { county: "Montserrado" } } },
    },
    {
      currentScore: 0.6,
      baselineScore: 0.5,
      masteryState: "MASTERED",
      student: { user: { school: { county: "Montserrado" } } },
    },
  ]);
  mockAttendanceFindMany.mockResolvedValue([
    {
      status: "PRESENT",
      Meeting: { Class: { School: { county: "Montserrado" } } },
    },
    {
      status: "LATE",
      Meeting: { Class: { School: { county: "Montserrado" } } },
    },
    {
      status: "ABSENT",
      Meeting: { Class: { School: { county: "Montserrado" } } },
    },
  ]);
});

describe("computeNationalGeoPerformance", () => {
  it("aggregates county metrics correctly on fixtures", async () => {
    const result = await computeNationalGeoPerformance({
      periodRange: { from: "2025-01", to: "2025-01" },
    });

    const row = result.counties.find((c) => c.county === "Montserrado");
    expect(row).toBeTruthy();
    expect(row?.metrics.masteryAvg).toBeCloseTo(0.7, 4);
    expect(row?.metrics.growthAvg).toBeCloseTo(0.15, 4);
    expect(row?.metrics.atRiskPct).toBeCloseTo(0.5, 4);
    expect(row?.metrics.attendanceProxyAvg).toBeCloseTo(2 / 3, 4);
  });

  it("returns null metrics for missing counties", async () => {
    const result = await computeNationalGeoPerformance({
      periodRange: { from: "2025-01", to: "2025-01" },
    });

    const row = result.counties.find((c) => c.county === "Bomi");
    expect(row).toBeTruthy();
    expect(row?.hasData).toBe(false);
    expect(row?.metrics.masteryAvg).toBeNull();
    expect(row?.metrics.growthAvg).toBeNull();
    expect(row?.metrics.atRiskPct).toBeNull();
    expect(row?.metrics.attendanceProxyAvg).toBeNull();
  });
});

describe("GET /api/admin/national/geo-performance", () => {
  it("returns 404 when feature flag is disabled", async () => {
    mockIsGeoIntelligenceEnabled.mockReturnValue(false);

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

  it("returns aggregate-only response without school identifiers", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("schoolId");
    expect(serialized).not.toContain("schoolName");
  });
});
