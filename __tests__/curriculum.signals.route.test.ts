import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequirePlatformAdmin = vi.hoisted(() => vi.fn());
const mockIsCurriculumOptimizationEnabled = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockRecordMetricEvent = vi.hoisted(() => vi.fn());
const mockComputeNationalCurriculumSignals = vi.hoisted(() => vi.fn());
const mockOptimizeCurriculumSignals = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requirePlatformAdmin: mockRequirePlatformAdmin,
}));

vi.mock("@/lib/serverFlags", async () => {
  const actual = await vi.importActual<any>("@/lib/serverFlags");
  return {
    ...actual,
    isCurriculumOptimizationEnabled: mockIsCurriculumOptimizationEnabled,
  };
});

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
}));

vi.mock("@/lib/metrics/events", () => ({
  recordMetricEvent: mockRecordMetricEvent,
}));

vi.mock("@/lib/reporting/curriculum/nationalCurriculumSignals", () => ({
  computeNationalCurriculumSignals: mockComputeNationalCurriculumSignals,
}));

vi.mock("@/lib/ai/curriculum/curriculumOptimizer", () => ({
  optimizeCurriculumSignals: mockOptimizeCurriculumSignals,
}));

import { GET } from "@/app/api/admin/national/curriculum-signals/route";

function makeReq(path = "/api/admin/national/curriculum-signals") {
  return new Request(`http://localhost${path}`) as any;
}

describe("GET /api/admin/national/curriculum-signals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsCurriculumOptimizationEnabled.mockReturnValue(true);
    mockRequirePlatformAdmin.mockResolvedValue({
      id: "platform-1",
      role: "ADMIN",
      isPlatformAdmin: true,
      schoolId: "school-1",
    });
    mockLogAudit.mockResolvedValue(undefined);
    mockRecordMetricEvent.mockResolvedValue(undefined);
    mockComputeNationalCurriculumSignals.mockResolvedValue({
      rows: [],
      weakByGradeBand: {
        G4_6: [
          {
            gradeBand: "G4_6",
            subject: "MATH",
            strandKey: "fractions",
            strandName: "Fractions",
            sampleSize: 25,
            avgMastery: 0.48,
            avgMasteryDelta: -0.03,
            trendDirection: "declining",
            rank: 1,
            reasons: ["bottom_ranked_within_grade_band"],
          },
        ],
      },
      summary: {
        totalProfilesConsidered: 250,
        eligibleStrandCount: 12,
        filteredOutBySample: 4,
        minSampleSize: 20,
        weakBottomN: 3,
        weakMasteryThreshold: 0.6,
      },
    });
    mockOptimizeCurriculumSignals.mockResolvedValue({
      weakStrands: [
        {
          gradeBand: "G4_6",
          strands: [
            {
              gradeBand: "G4_6",
              subject: "MATH",
              strandKey: "fractions",
              strandName: "Fractions",
              sampleSize: 25,
              avgMastery: 0.48,
              avgMasteryDelta: -0.03,
              trendDirection: "declining",
              rank: 1,
              reasons: ["bottom_ranked_within_grade_band"],
            },
          ],
        },
      ],
      recommendedEmphasisChanges: ["Advisory only: prioritize reteach cycles."],
      aiSummary: undefined,
    });
  });

  it("returns 404 when feature flag is disabled", async () => {
    mockIsCurriculumOptimizationEnabled.mockReturnValue(false);

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

  it("returns aggregate-only JSON response without school-level fields", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.scope).toBe("national");
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("schoolId");
    expect(serialized).not.toContain("schoolName");
  });

  it("returns safe CSV export without school-level columns", async () => {
    const res = await GET(
      makeReq("/api/admin/national/curriculum-signals?format=csv")
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    const csv = await res.text();
    expect(csv).toContain("gradeBand");
    expect(csv).toContain("strandKey");
    expect(csv).not.toContain("schoolId");
    expect(csv).not.toContain("schoolName");
  });

  it("records telemetry event with national scope", async () => {
    await GET(makeReq());
    expect(mockRecordMetricEvent).toHaveBeenCalledWith(
      "curriculum_signals_viewed",
      expect.objectContaining({ scope: "national" }),
      expect.objectContaining({ scope: "national", scopeId: null })
    );
  });
});

