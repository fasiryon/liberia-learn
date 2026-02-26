/**
 * __tests__/district.aggregation.test.ts -- Block 14
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSchoolFindMany = vi.hoisted(() => vi.fn());
const mockComputeSchoolDashboard = vi.hoisted(() => vi.fn());
const mockComputeSchoolTrends = vi.hoisted(() => vi.fn());
const mockComputeRecommendations = vi.hoisted(() => vi.fn());
const mockFetchLatestImpactSnapshot = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    school: { findMany: mockSchoolFindMany },
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

beforeEach(() => {
  vi.clearAllMocks();
  mockSchoolFindMany.mockResolvedValue([
    { id: "school-1" },
    { id: "school-2" },
    { id: "school-3" },
  ]);
  mockComputeSchoolDashboard.mockResolvedValueOnce({
    avgMasteryScore: 0.6,
    trainingAdoptionRate: 0.2,
    evidenceSubmissionRate: 0.4,
  });
  mockComputeSchoolDashboard.mockResolvedValueOnce({
    avgMasteryScore: 0.8,
    trainingAdoptionRate: 0.6,
    evidenceSubmissionRate: 0.7,
  });
  mockComputeSchoolDashboard.mockResolvedValueOnce({
    avgMasteryScore: 0.4,
    trainingAdoptionRate: 0.1,
    evidenceSubmissionRate: 0.3,
  });
  mockComputeSchoolTrends.mockResolvedValue({
    period: "monthly",
    masteryTrend: [],
    evidenceVelocityTrend: [],
  });
  mockFetchLatestImpactSnapshot.mockResolvedValue(null);
  mockComputeRecommendations.mockResolvedValueOnce({
    interventionPriorityScore: 80,
    growthRiskFlag: "high",
    recommendedActions: [],
    dataConfidence: "medium",
    generatedAt: "2026-02-26T12:00:00Z",
  });
  mockComputeRecommendations.mockResolvedValueOnce({
    interventionPriorityScore: 20,
    growthRiskFlag: "low",
    recommendedActions: [],
    dataConfidence: "medium",
    generatedAt: "2026-02-26T12:00:00Z",
  });
  mockComputeRecommendations.mockResolvedValueOnce({
    interventionPriorityScore: 60,
    growthRiskFlag: "medium",
    recommendedActions: [],
    dataConfidence: "medium",
    generatedAt: "2026-02-26T12:00:00Z",
  });
});

describe("computeDistrictDashboard", () => {
  it("averages correct across 3 fixture schools", async () => {
    const result = await computeDistrictDashboard({
      tenantId: "tenant-1",
      districtId: "district-1",
    });

    expect(result.schoolCount).toBe(3);
    expect(result.avgMasteryScore).toBeCloseTo((0.6 + 0.8 + 0.4) / 3, 6);
    expect(result.trainingAdoptionRate).toBeCloseTo((0.2 + 0.6 + 0.1) / 3, 6);
    expect(result.evidenceSubmissionRate).toBeCloseTo((0.4 + 0.7 + 0.3) / 3, 6);
  });

  it("empty district returns zeros", async () => {
    mockSchoolFindMany.mockResolvedValueOnce([]);
    const result = await computeDistrictDashboard({
      tenantId: "tenant-1",
      districtId: "district-empty",
    });

    expect(result.schoolCount).toBe(0);
    expect(result.schoolsAtRisk).toBe(0);
    expect(result.topInterventionPriority).toBe(0);
  });

  it("schoolsAtRisk count correct", async () => {
    const result = await computeDistrictDashboard({
      tenantId: "tenant-1",
      districtId: "district-1",
    });

    expect(result.schoolsAtRisk).toBe(2);
  });

  it("schools outside district not included", async () => {
    await computeDistrictDashboard({
      tenantId: "tenant-1",
      districtId: "district-1",
    });

    expect(mockComputeSchoolDashboard).toHaveBeenCalledTimes(3);
    const calledIds = mockComputeSchoolDashboard.mock.calls.map((c) => c[0].schoolId);
    expect(calledIds).toEqual(["school-1", "school-2", "school-3"]);
  });

  it("idempotency verified", async () => {
    const result1 = await computeDistrictDashboard({
      tenantId: "tenant-1",
      districtId: "district-1",
    });

    mockComputeSchoolDashboard.mockReset();
    mockComputeSchoolDashboard.mockResolvedValueOnce({
      avgMasteryScore: 0.6,
      trainingAdoptionRate: 0.2,
      evidenceSubmissionRate: 0.4,
    });
    mockComputeSchoolDashboard.mockResolvedValueOnce({
      avgMasteryScore: 0.8,
      trainingAdoptionRate: 0.6,
      evidenceSubmissionRate: 0.7,
    });
    mockComputeSchoolDashboard.mockResolvedValueOnce({
      avgMasteryScore: 0.4,
      trainingAdoptionRate: 0.1,
      evidenceSubmissionRate: 0.3,
    });

    mockComputeRecommendations.mockReset();
    mockComputeRecommendations.mockResolvedValueOnce({
      interventionPriorityScore: 80,
      growthRiskFlag: "high",
      recommendedActions: [],
      dataConfidence: "medium",
      generatedAt: "2026-02-26T12:00:00Z",
    });
    mockComputeRecommendations.mockResolvedValueOnce({
      interventionPriorityScore: 20,
      growthRiskFlag: "low",
      recommendedActions: [],
      dataConfidence: "medium",
      generatedAt: "2026-02-26T12:00:00Z",
    });
    mockComputeRecommendations.mockResolvedValueOnce({
      interventionPriorityScore: 60,
      growthRiskFlag: "medium",
      recommendedActions: [],
      dataConfidence: "medium",
      generatedAt: "2026-02-26T12:00:00Z",
    });

    const result2 = await computeDistrictDashboard({
      tenantId: "tenant-1",
      districtId: "district-1",
    });

    expect(result1).toEqual(result2);
  });
});

