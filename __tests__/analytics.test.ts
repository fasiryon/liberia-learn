import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  derivedStudentProgress: { findMany: vi.fn() },
  interventionChain: { findMany: vi.fn() },
  teacherAction: { findMany: vi.fn() },
  aIInteraction: { findMany: vi.fn() },
  misconceptionTag: { findMany: vi.fn() },
  student: { count: vi.fn() },
  school: { findMany: vi.fn() },
  class: { count: vi.fn() },
  user: { count: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { getStudentLongitudinalSummaries, getLongitudinalAggregate } from "@/lib/analytics/studentLongitudinal";
import { getInterventionEffectiveness } from "@/lib/analytics/interventionEffectiveness";
import { getTeacherActionCorrelation } from "@/lib/analytics/teacherActionCorrelation";
import { getAiUsageQuality } from "@/lib/analytics/aiUsageQuality";
import { getMisconceptionFrequency } from "@/lib/analytics/misconceptionFrequency";
import { getRetentionSummary } from "@/lib/analytics/retentionSummary";

beforeEach(() => vi.clearAllMocks());

// ── Student Longitudinal ──────────────────────────────────────────────────────

describe("getStudentLongitudinalSummaries", () => {
  it("returns empty when no records", async () => {
    mockPrisma.derivedStudentProgress.findMany.mockResolvedValue([]);
    const result = await getStudentLongitudinalSummaries();
    expect(result).toHaveLength(0);
  });

  it("computes mastery rate correctly from DerivedStudentProgress", async () => {
    mockPrisma.derivedStudentProgress.findMany.mockResolvedValue([
      { studentId: "s1", schoolId: "school-1", masteryState: "MASTERED", currentScore: 80, growthDelta: 5, derivedAt: new Date() },
      { studentId: "s1", schoolId: "school-1", masteryState: "AT_RISK", currentScore: 40, growthDelta: -2, derivedAt: new Date() },
      { studentId: "s1", schoolId: "school-1", masteryState: "CONSOLIDATED", currentScore: 75, growthDelta: 3, derivedAt: new Date() },
    ]);
    const result = await getStudentLongitudinalSummaries();
    expect(result).toHaveLength(1);
    const s = result[0];
    expect(s.totalStrands).toBe(3);
    expect(s.masteredStrands).toBe(2);
    expect(s.masteryRatePct).toBeCloseTo(66.67, 1);
    expect(s.atRiskStrands).toBe(1);
  });
});

describe("getLongitudinalAggregate", () => {
  it("returns zeroed result when no records", async () => {
    mockPrisma.derivedStudentProgress.findMany.mockResolvedValue([]);
    const result = await getLongitudinalAggregate();
    expect(result.totalStudentsTracked).toBe(0);
    expect(result.avgMasteryRatePct).toBeNull();
  });
});

// ── Intervention Effectiveness ────────────────────────────────────────────────

describe("getInterventionEffectiveness", () => {
  it("returns zeroed report when no chains", async () => {
    mockPrisma.interventionChain.findMany.mockResolvedValue([]);
    const result = await getInterventionEffectiveness();
    expect(result.totalChains).toBe(0);
    expect(result.closureRatePct).toBe(0);
  });

  it("computes closure rate", async () => {
    mockPrisma.interventionChain.findMany.mockResolvedValue([
      { status: "closed", attributionSource: "teacher_flag", openedAt: new Date("2026-01-01"), closedAt: new Date("2026-01-08") },
      { status: "open", attributionSource: "teacher_flag", openedAt: new Date("2026-01-01"), closedAt: null },
      { status: "closed", attributionSource: "ai_assessment", openedAt: new Date("2026-01-01"), closedAt: new Date("2026-01-05") },
    ]);
    const result = await getInterventionEffectiveness();
    expect(result.totalChains).toBe(3);
    expect(result.closedChains).toBe(2);
    expect(result.closureRatePct).toBeCloseTo(66.67, 1);
    expect(result.byAttributionSource).toHaveLength(2);
    expect(result.avgDaysToClose).toBeGreaterThan(0);
  });
});

// ── Teacher Action Correlation ────────────────────────────────────────────────

describe("getTeacherActionCorrelation", () => {
  it("returns empty report when no actions", async () => {
    mockPrisma.teacherAction.findMany.mockResolvedValue([]);
    const result = await getTeacherActionCorrelation();
    expect(result.totalActions).toBe(0);
    expect(result.byActionType).toHaveLength(0);
  });

  it("groups by action type and counts top teachers", async () => {
    const base = { teacherUserId: "t1", actionType: "assign_work", occurredAt: new Date("2026-04-01") };
    mockPrisma.teacherAction.findMany.mockResolvedValue([
      base,
      { ...base, actionType: "assign_work" },
      { ...base, teacherUserId: "t2", actionType: "grade" },
    ]);
    const result = await getTeacherActionCorrelation();
    expect(result.totalActions).toBe(3);
    expect(result.uniqueTeachers).toBe(2);
    expect(result.byActionType[0].actionType).toBe("assign_work");
    expect(result.topActiveTeachers[0].teacherUserId).toBe("t1");
  });
});

// ── AI Usage Quality ──────────────────────────────────────────────────────────

describe("getAiUsageQuality", () => {
  it("returns zeroed report when no interactions", async () => {
    mockPrisma.aIInteraction.findMany.mockResolvedValue([]);
    const result = await getAiUsageQuality();
    expect(result.totalInteractions).toBe(0);
    expect(result.fallbackRatePct).toBe(0);
  });

  it("computes fallback rate and byFeature breakdown", async () => {
    mockPrisma.aIInteraction.findMany.mockResolvedValue([
      { feature: "tutor", model: "gpt-4", tokensUsed: 500, estimatedCostUSD: 0.01, hadFallback: false },
      { feature: "tutor", model: "gpt-4", tokensUsed: 300, estimatedCostUSD: 0.005, hadFallback: true },
      { feature: "curriculum", model: "gpt-3.5", tokensUsed: 200, estimatedCostUSD: 0.002, hadFallback: false },
    ]);
    const result = await getAiUsageQuality();
    expect(result.totalInteractions).toBe(3);
    expect(result.fallbackRatePct).toBeCloseTo(33.33, 1);
    expect(result.byFeature.find((f) => f.feature === "tutor")?.count).toBe(2);
  });
});

// ── Misconception Frequency ───────────────────────────────────────────────────

describe("getMisconceptionFrequency", () => {
  it("returns zeroed report when no tags", async () => {
    mockPrisma.misconceptionTag.findMany.mockResolvedValue([]);
    const result = await getMisconceptionFrequency();
    expect(result.totalTags).toBe(0);
    expect(result.topCategories).toHaveLength(0);
  });

  it("groups by category and computes active pct", async () => {
    mockPrisma.misconceptionTag.findMany.mockResolvedValue([
      { categoryId: "fraction_division", status: "active", origin: "assessment_evaluation", confidence: 0.9 },
      { categoryId: "fraction_division", status: "resolved", origin: "assessment_evaluation", confidence: 0.7 },
      { categoryId: "algebra_basics", status: "active", origin: "tutor", confidence: 0.8 },
    ]);
    const result = await getMisconceptionFrequency();
    expect(result.totalTags).toBe(3);
    expect(result.activeTagCount).toBe(2);
    expect(result.topCategories[0].categoryId).toBe("fraction_division");
    expect(result.topCategories[0].activePct).toBeCloseTo(50, 1);
  });
});

// ── Retention Summary ─────────────────────────────────────────────────────────

describe("getRetentionSummary", () => {
  it("computes retention rate from student + progress counts", async () => {
    mockPrisma.student.count.mockResolvedValueOnce(100).mockResolvedValueOnce(10);
    mockPrisma.derivedStudentProgress.findMany.mockResolvedValue(
      Array.from({ length: 75 }, (_, i) => ({ studentId: `s${i}` }))
    );
    mockPrisma.school.findMany.mockResolvedValue([]);
    const result = await getRetentionSummary();
    expect(result.totalStudents).toBe(100);
    expect(result.activeStudents).toBe(75);
    expect(result.retentionRatePct).toBe(75);
  });
});
