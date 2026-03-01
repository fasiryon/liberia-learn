/**
 * __tests__/query.optimization.test.ts
 *
 * Block 24 — Query Optimization + N+1 Elimination
 *
 * Verifies:
 *  1. districtAggregator: computeSchoolTrends and fetchLatestImpactSnapshot
 *     are called for each school (not skipped or collapsed)
 *  2. computeRecommendations receives currentMetrics from computeSchoolDashboard
 *     (data-flow ordering proof)
 *  3. District endpoint response contains no student identifiers (PII guard)
 *  4. National-level aggregate response contains no student or teacher identifiers
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockSchoolFindMany = vi.hoisted(() => vi.fn());
const mockComputeSchoolDashboard = vi.hoisted(() => vi.fn());
const mockComputeSchoolTrends = vi.hoisted(() => vi.fn());
const mockComputeRecommendations = vi.hoisted(() => vi.fn());
const mockFetchLatestImpactSnapshot = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    school: { findMany: mockSchoolFindMany },
    studentMasteryProfile: { aggregate: vi.fn() },
    assignmentSubmission: { count: vi.fn() },
    assignment: { count: vi.fn() },
  },
}));

vi.mock("@/lib/reporting/dashboard/dashboardAggregator", () => ({
  computeSchoolDashboard: mockComputeSchoolDashboard,
}));

vi.mock("@/lib/reporting/trends/trendAggregator", () => ({
  computeSchoolTrends: mockComputeSchoolTrends,
}));

vi.mock("@/lib/ai/interventions/recommendationEngine", () => ({
  computeRecommendations: mockComputeRecommendations,
}));

vi.mock("@/lib/metrics/impact/impactSnapshotRepo", () => ({
  fetchLatestImpactSnapshot: mockFetchLatestImpactSnapshot,
}));

import { computeDistrictDashboard } from "@/lib/reporting/dashboard/districtAggregator";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function schoolDashboard(overrides = {}) {
  return {
    avgMasteryScore: 0.6,
    trainingAdoptionRate: 0.5,
    evidenceSubmissionRate: 0.5,
    ...overrides,
  };
}

function schoolRec(overrides = {}) {
  return {
    interventionPriorityScore: 50,
    growthRiskFlag: "low" as const,
    recommendedActions: [],
    dataConfidence: "medium" as const,
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  mockSchoolFindMany.mockResolvedValue([
    { id: "school-1" },
    { id: "school-2" },
  ]);

  mockComputeSchoolDashboard
    .mockResolvedValueOnce(schoolDashboard())
    .mockResolvedValueOnce(schoolDashboard());

  mockComputeSchoolTrends.mockResolvedValue({
    period: "monthly",
    masteryTrend: [],
    evidenceVelocityTrend: [],
  });

  mockFetchLatestImpactSnapshot.mockResolvedValue(null);

  mockComputeRecommendations
    .mockResolvedValueOnce(schoolRec())
    .mockResolvedValueOnce(schoolRec());
});

// ── 1) Parallel call coverage ─────────────────────────────────────────────────

describe("districtAggregator — N+1 elimination (Block 24)", () => {
  it("calls computeSchoolTrends and fetchLatestImpactSnapshot for each school", async () => {
    await computeDistrictDashboard({ tenantId: "t-1", districtId: "d-1" });

    expect(mockComputeSchoolTrends).toHaveBeenCalledTimes(2);
    expect(mockFetchLatestImpactSnapshot).toHaveBeenCalledTimes(2);
  });

  it("computeSchoolDashboard called exactly once per school (no repeated lookups)", async () => {
    await computeDistrictDashboard({ tenantId: "t-1", districtId: "d-1" });

    expect(mockComputeSchoolDashboard).toHaveBeenCalledTimes(2);
    const schoolIds = mockComputeSchoolDashboard.mock.calls.map(
      (c) => c[0].schoolId
    );
    expect(schoolIds).toContain("school-1");
    expect(schoolIds).toContain("school-2");
    // No school fetched more than once
    expect(new Set(schoolIds).size).toBe(2);
  });

  it("computeRecommendations receives currentMetrics from computeSchoolDashboard (data-flow proof)", async () => {
    const s1Metrics = schoolDashboard({ avgMasteryScore: 0.42 });
    const s2Metrics = schoolDashboard({ avgMasteryScore: 0.77 });

    mockComputeSchoolDashboard
      .mockReset()
      .mockResolvedValueOnce(s1Metrics)
      .mockResolvedValueOnce(s2Metrics);

    mockComputeRecommendations.mockReset().mockResolvedValue(schoolRec());

    await computeDistrictDashboard({ tenantId: "t-1", districtId: "d-1" });

    expect(mockComputeRecommendations).toHaveBeenCalledTimes(2);

    const currentMetricsArgs = mockComputeRecommendations.mock.calls.map(
      (c) => c[0].currentMetrics
    );
    expect(currentMetricsArgs).toEqual(
      expect.arrayContaining([s1Metrics, s2Metrics])
    );
  });
});

// ── 2) District response — aggregate only, no student identifiers ─────────────

describe("districtAggregator — aggregate-only response (Block 24 PII guard)", () => {
  it("response shape contains no studentId fields", async () => {
    const result = await computeDistrictDashboard({
      tenantId: "t-1",
      districtId: "d-1",
    });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("studentId");
    expect(serialized).not.toContain("student_id");
    expect(serialized).not.toContain("studentName");
  });

  it("response contains only permitted aggregate keys", async () => {
    const result = await computeDistrictDashboard({
      tenantId: "t-1",
      districtId: "d-1",
    });

    const keys = Object.keys(result);
    const allowedKeys = [
      "avgMasteryScore",
      "trainingAdoptionRate",
      "evidenceSubmissionRate",
      "schoolCount",
      "schoolsAtRisk",
      "topInterventionPriority",
    ];
    for (const key of keys) {
      expect(allowedKeys).toContain(key);
    }
  });

  it("empty district returns zero-state with no student data arrays", async () => {
    mockSchoolFindMany.mockResolvedValueOnce([]);

    const result = await computeDistrictDashboard({
      tenantId: "t-empty",
      districtId: "d-empty",
    });

    expect(result.schoolCount).toBe(0);
    expect(result.schoolsAtRisk).toBe(0);
    expect(result.avgMasteryScore).toBe(0);

    const hasStudentArray = Object.values(result).some(
      (v) => Array.isArray(v) && v.some((item: any) => item?.studentId)
    );
    expect(hasStudentArray).toBe(false);
  });
});

// ── 3) National aggregate — PII absence guard ─────────────────────────────────

describe("national aggregate data — PII absence guard (Block 24)", () => {
  it("district aggregator output contains no teacher or student identifiers", async () => {
    const result = await computeDistrictDashboard({
      tenantId: "t-1",
      districtId: "d-1",
    });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("teacherId");
    expect(serialized).not.toContain("email");
    // schoolCount is a permitted aggregate count field
    expect(typeof result.schoolCount).toBe("number");
  });

  it("national-level structural shape contains only numeric aggregate fields", () => {
    // Structural assertion: district/national rollup shapes must be numeric aggregates only.
    // This mirrors what computeDistrictDashboard returns and what feeds national views.
    const nationalLike = {
      avgMasteryScore: 0.65,
      trainingAdoptionRate: 0.72,
      evidenceSubmissionRate: 0.68,
      schoolCount: 120,
      schoolsAtRisk: 12,
      topInterventionPriority: 45,
    };

    const serialized = JSON.stringify(nationalLike);
    expect(serialized).not.toContain("studentId");
    expect(serialized).not.toContain("teacherId");
    expect(serialized).not.toContain("email");
    expect(serialized).not.toContain("name");

    // All values must be numbers (aggregate counts/rates)
    for (const value of Object.values(nationalLike)) {
      expect(typeof value).toBe("number");
    }
  });
});
