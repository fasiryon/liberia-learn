/**
 * __tests__/adaptive.stuck.test.ts  — NR-14B Phase 2
 *
 * Tests for detectStuck (pure function) and routeStuck (DB-backed).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma for routeStuck (DB calls)
vi.mock("@/lib/db", () => ({
  prisma: {
    lessonVariant: { findFirst: vi.fn() },
    lessonPrerequisite: { findMany: vi.fn() },
    adaptiveMasteryRecord: { findUnique: vi.fn() },
    curriculumContent: { findUnique: vi.fn() },
  },
}));

import { detectStuck, THRESHOLDS } from "@/lib/adaptive/detectStuck";
import { routeStuck } from "@/lib/adaptive/routeStuck";
import { prisma } from "@/lib/db";

const mockPrisma = prisma as any;

// ── detectStuck ────────────────────────────────────────────────────────────────

describe("detectStuck", () => {
  it("fires wrong_answers at exactly 3 wrong answers", () => {
    const result = detectStuck({ wrongCount: 3, lastResponseMs: 0, attemptCount: 0 });
    expect(result.isStuck).toBe(true);
    expect(result.signal).toBe("wrong_answers");
    expect(result.detail?.wrongCount).toBe(3);
  });

  it("fires wrong_answers above 3 wrong answers", () => {
    const result = detectStuck({ wrongCount: 5, lastResponseMs: 0, attemptCount: 0 });
    expect(result.isStuck).toBe(true);
    expect(result.signal).toBe("wrong_answers");
  });

  it("fires slow_response at exactly 2× baseline for upper grade", () => {
    const slowMs = THRESHOLDS.baselineResponseMs * THRESHOLDS.slowResponseMultiplier;
    const result = detectStuck({ wrongCount: 0, lastResponseMs: slowMs, attemptCount: 0, gradeBand: "upper" });
    expect(result.isStuck).toBe(true);
    expect(result.signal).toBe("slow_response");
  });

  it("respects lower-grade time multiplier — does NOT fire at standard threshold", () => {
    // Lower grades get 1.5× baseline, so 2× standard is below their threshold
    const standardSlowMs = THRESHOLDS.baselineResponseMs * THRESHOLDS.slowResponseMultiplier;
    const result = detectStuck({ wrongCount: 0, lastResponseMs: standardSlowMs, attemptCount: 0, gradeBand: "lower" });
    // standardSlowMs = 90000 * 2 = 180000
    // lower threshold = 90000 * 1.5 * 2 = 270000
    expect(result.isStuck).toBe(false);
  });

  it("fires slow_response for lower grade at their elevated threshold", () => {
    const lowerSlowMs = THRESHOLDS.baselineResponseMs * THRESHOLDS.lowerGradeMultiplier * THRESHOLDS.slowResponseMultiplier;
    const result = detectStuck({ wrongCount: 0, lastResponseMs: lowerSlowMs, attemptCount: 0, gradeBand: "lower" });
    expect(result.isStuck).toBe(true);
    expect(result.signal).toBe("slow_response");
  });

  it("fires repeat_attempts at exactly 3 attempts", () => {
    const result = detectStuck({ wrongCount: 0, lastResponseMs: 0, attemptCount: 3 });
    expect(result.isStuck).toBe(true);
    expect(result.signal).toBe("repeat_attempts");
    expect(result.detail?.attemptCount).toBe(3);
  });

  it("returns not-stuck below all thresholds", () => {
    const result = detectStuck({ wrongCount: 2, lastResponseMs: 10_000, attemptCount: 1 });
    expect(result.isStuck).toBe(false);
    expect(result.signal).toBeUndefined();
  });

  it("wrong_answers takes priority over repeat_attempts when both fire", () => {
    const result = detectStuck({ wrongCount: 3, lastResponseMs: 0, attemptCount: 3 });
    expect(result.signal).toBe("wrong_answers");
  });
});

// ── routeStuck ─────────────────────────────────────────────────────────────────

describe("routeStuck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prefers scaffold when a LessonVariant exists", async () => {
    mockPrisma.lessonVariant.findFirst.mockResolvedValueOnce({ id: "variant-1" });

    const result = await routeStuck({ studentId: "s1", lessonId: "l1" });
    expect(result.to).toBe("scaffold");
    expect((result as any).variantId).toBe("variant-1");
  });

  it("falls to prerequisite when no scaffold and prereq is unmastered", async () => {
    mockPrisma.lessonVariant.findFirst.mockResolvedValueOnce(null);
    mockPrisma.lessonPrerequisite.findMany.mockResolvedValueOnce([
      { prerequisiteLessonId: "prereq-1", strength: "required" },
    ]);
    mockPrisma.curriculumContent.findUnique.mockResolvedValueOnce({
      subject: "MATH",
      grade: 5,
      unitId: "unit-1",
      contentId: "prereq-1",
    });
    // No mastery record → not mastered
    mockPrisma.adaptiveMasteryRecord.findUnique.mockResolvedValueOnce(null);

    const result = await routeStuck({ studentId: "s1", lessonId: "l1" });
    expect(result.to).toBe("prerequisite");
    expect((result as any).lessonId).toBe("prereq-1");
  });

  it("falls to ai_tutor when no scaffold and all prereqs are mastered", async () => {
    mockPrisma.lessonVariant.findFirst.mockResolvedValueOnce(null);
    mockPrisma.lessonPrerequisite.findMany.mockResolvedValueOnce([
      { prerequisiteLessonId: "prereq-1", strength: "required" },
    ]);
    mockPrisma.curriculumContent.findUnique.mockResolvedValueOnce({
      subject: "MATH",
      grade: 5,
      unitId: "unit-1",
      contentId: "prereq-1",
    });
    // Mastered prereq
    mockPrisma.adaptiveMasteryRecord.findUnique.mockResolvedValueOnce({
      masteredAt: new Date("2026-01-01"),
    });

    const result = await routeStuck({ studentId: "s1", lessonId: "l1" });
    expect(result.to).toBe("ai_tutor");
  });

  it("falls to ai_tutor when no scaffold and no prerequisites exist", async () => {
    mockPrisma.lessonVariant.findFirst.mockResolvedValueOnce(null);
    mockPrisma.lessonPrerequisite.findMany.mockResolvedValueOnce([]);

    const result = await routeStuck({ studentId: "s1", lessonId: "l1" });
    expect(result.to).toBe("ai_tutor");
  });
});
