/**
 * __tests__/adaptive.mastery.test.ts  — NR-14B Phase 3
 *
 * Tests for recordAnswer (EMA mastery tracking) in lib/adaptive/updateMastery.ts.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    adaptiveMasteryRecord: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

import { recordAnswer, MASTERY_SCORE, MASTERY_STREAK, EMA_ALPHA, buildSkillKey } from "@/lib/adaptive/updateMastery";
import { prisma } from "@/lib/db";

const mockPrisma = prisma as any;

function noRecord() {
  mockPrisma.adaptiveMasteryRecord.findUnique.mockResolvedValueOnce(null);
  mockPrisma.adaptiveMasteryRecord.upsert.mockResolvedValueOnce({});
}

function withRecord(score: number, streak: number, masteredAt: Date | null = null) {
  mockPrisma.adaptiveMasteryRecord.findUnique.mockResolvedValueOnce({
    score,
    consecutiveCorrect: streak,
    masteredAt,
  });
  mockPrisma.adaptiveMasteryRecord.upsert.mockResolvedValueOnce({});
}

describe("recordAnswer — EMA behaviour", () => {
  beforeEach(() => vi.clearAllMocks());

  it("score rises on correct answer from zero", async () => {
    noRecord();
    const result = await recordAnswer({ studentId: "s1", skillKey: "MATH:G5:u1", correct: true });
    // newScore = 0 + 0.3 * (1 - 0) = 0.3
    expect(result.score).toBeCloseTo(EMA_ALPHA);
    expect(result.consecutiveCorrect).toBe(1);
  });

  it("score falls on wrong answer from non-zero", async () => {
    withRecord(0.5, 2);
    const result = await recordAnswer({ studentId: "s1", skillKey: "MATH:G5:u1", correct: false });
    // newScore = 0.5 + 0.3 * (0 - 0.5) = 0.5 - 0.15 = 0.35
    expect(result.score).toBeCloseTo(0.35);
  });

  it("streak resets to 0 on wrong answer", async () => {
    withRecord(0.7, 3);
    const result = await recordAnswer({ studentId: "s1", skillKey: "MATH:G5:u1", correct: false });
    expect(result.consecutiveCorrect).toBe(0);
  });

  it("mastered=true when score>=0.80 AND streak>=3", async () => {
    // Build up to mastery: score 0.85, streak 2 → one more correct should tip both
    // Score after correct from 0.85: 0.85 + 0.3*(1-0.85) = 0.85 + 0.045 = 0.895
    withRecord(0.85, 2);
    const result = await recordAnswer({ studentId: "s1", skillKey: "MATH:G5:u1", correct: true });
    expect(result.score).toBeCloseTo(0.895);
    expect(result.consecutiveCorrect).toBe(3);
    expect(result.mastered).toBe(true);
  });

  it("mastered=false when score>=0.80 but streak<3", async () => {
    withRecord(0.85, 1);
    const result = await recordAnswer({ studentId: "s1", skillKey: "MATH:G5:u1", correct: true });
    // score: 0.85 + 0.3*(1-0.85) = 0.895, streak: 2 — not enough streak
    expect(result.score).toBeGreaterThanOrEqual(MASTERY_SCORE);
    expect(result.consecutiveCorrect).toBe(2);
    expect(result.mastered).toBe(false);
  });

  it("mastered=false when streak>=3 but score<0.80", async () => {
    // score 0.70, streak 2 → correct → score rises but may not reach 0.80
    withRecord(0.70, 2);
    const result = await recordAnswer({ studentId: "s1", skillKey: "MATH:G5:u1", correct: true });
    // newScore = 0.70 + 0.3*(1-0.70) = 0.70 + 0.09 = 0.79  streak = 3
    expect(result.score).toBeCloseTo(0.79);
    expect(result.consecutiveCorrect).toBe(3);
    expect(result.mastered).toBe(false); // score < 0.80
  });

  it("masteredAt persists once set — not cleared on later wrong answer", async () => {
    const pastMasteredAt = new Date("2026-01-15");
    withRecord(0.82, 3, pastMasteredAt);
    const result = await recordAnswer({ studentId: "s1", skillKey: "MATH:G5:u1", correct: false });
    // streak resets, score drops, but mastered stays true because masteredAt is set
    expect(result.mastered).toBe(true);
    expect(result.masteredAt).toEqual(pastMasteredAt);
  });
});

describe("buildSkillKey", () => {
  it("builds key with unitId", () => {
    expect(buildSkillKey({ subject: "MATH", grade: 5, unitId: "unit-abc", contentId: "c1" }))
      .toBe("MATH:G5:unit-abc");
  });

  it("falls back to contentId when unitId is null", () => {
    expect(buildSkillKey({ subject: "SCIENCE", grade: 3, unitId: null, contentId: "content-x" }))
      .toBe("SCIENCE:G3:content-x");
  });
});
