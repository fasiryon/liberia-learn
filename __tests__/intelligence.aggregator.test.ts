import { beforeEach, describe, expect, it, vi } from "vitest";

const mockClassFindMany = vi.hoisted(() => vi.fn());
const mockEventFindMany = vi.hoisted(() => vi.fn());
const mockConfusionCount = vi.hoisted(() => vi.fn());
const mockInterventionCount = vi.hoisted(() => vi.fn());
const mockConfusionFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    class: { findMany: mockClassFindMany },
    studentPerformanceEvent: { findMany: mockEventFindMany },
    confusionSignal: {
      count: mockConfusionCount,
      findMany: mockConfusionFindMany,
    },
    interventionRecommendation: { count: mockInterventionCount },
  },
}));

import {
  getClassPerformanceSummary,
  getStudentPerformanceSummary,
  getSubjectPerformanceSummary,
} from "@/lib/intelligence/performanceAggregator";

beforeEach(() => {
  vi.clearAllMocks();
  mockClassFindMany.mockResolvedValue([
    { enrollments: [{ studentId: "student-1" }, { studentId: "student-2" }] },
  ]);
  mockEventFindMany.mockResolvedValue([
    { studentId: "student-1", score: 0.2, attempts: 1 },
    { studentId: "student-1", score: 0.4, attempts: 1 },
    { studentId: "student-2", score: 0.9, attempts: 1 },
    { studentId: "student-2", score: 0.8, attempts: 1 },
  ]);
  mockConfusionCount.mockResolvedValue(2);
  mockInterventionCount.mockResolvedValue(1);
  mockConfusionFindMany.mockResolvedValue([
    { conceptTag: "MATH::fractions" },
    { conceptTag: "MATH::fractions" },
    { conceptTag: "MATH::ratios" },
  ]);
});

describe("performanceAggregator", () => {
  it("computes avgScore correctly", async () => {
    const summary = await getStudentPerformanceSummary("student-1", "school-1");
    expect(summary.avgScore).toBe(0.57);
  });

  it("maps avgScore to correct masteryLevel", async () => {
    const summary = await getStudentPerformanceSummary("student-1", "school-1");
    expect(summary.masteryLevel).toBe("developing");
  });

  it("detects improving trend correctly", async () => {
    mockEventFindMany.mockResolvedValueOnce([
      { score: 0.9 },
      { score: 0.9 },
      { score: 0.9 },
      { score: 0.9 },
      { score: 0.9 },
      { score: 0.5 },
      { score: 0.5 },
      { score: 0.5 },
      { score: 0.5 },
      { score: 0.5 },
    ]);
    const summary = await getStudentPerformanceSummary("student-2", "school-1");
    expect(summary.improvementTrend).toBe("improving");
  });

  it("detects declining trend correctly", async () => {
    mockEventFindMany.mockResolvedValueOnce([
      { score: 0.2 },
      { score: 0.2 },
      { score: 0.2 },
      { score: 0.2 },
      { score: 0.2 },
      { score: 0.8 },
      { score: 0.8 },
      { score: 0.8 },
      { score: 0.8 },
      { score: 0.8 },
    ]);
    const summary = await getStudentPerformanceSummary("student-3", "school-1");
    expect(summary.improvementTrend).toBe("declining");
  });

  it("returns zeros when no events exist", async () => {
    mockEventFindMany.mockResolvedValueOnce([]);
    mockConfusionCount.mockResolvedValueOnce(0);
    mockInterventionCount.mockResolvedValueOnce(0);
    const summary = await getStudentPerformanceSummary("student-4", "school-1");
    expect(summary).toMatchObject({
      avgScore: 0,
      confusionCount: 0,
      pendingInterventions: 0,
      improvementTrend: "stable",
    });
  });

  it("class summary scoped to teacher's school only", async () => {
    await getClassPerformanceSummary("teacher-1", "school-1");
    expect(mockClassFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { teacherId: "teacher-1", schoolId: "school-1" } })
    );
  });

  it("returns subject summary with common confusions", async () => {
    const summary = await getSubjectPerformanceSummary("school-1", "MATH");
    expect(summary.commonConfusions[0]).toBe("MATH::fractions");
  });
});
