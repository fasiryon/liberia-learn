import { describe, expect, it } from "vitest";
import { computeDifficultyTier } from "@/lib/adaptive/difficultyAdapter";
import type { MasteryGap } from "@/lib/adaptive/gapDetector";

function makeGap(averageScore: number): MasteryGap {
  return {
    strand: "fractions",
    subject: "MATH",
    grade: 6,
    averageScore,
    attemptCount: 3,
    lastAttemptAt: new Date("2026-03-13T00:00:00.000Z"),
  };
}

describe("computeDifficultyTier", () => {
  it('returns "remedial" when averageScore < 0.40', () => {
    expect(computeDifficultyTier(makeGap(0.39), [])).toBe("remedial");
  });

  it('returns "standard" when averageScore is 0.40-0.69', () => {
    expect(computeDifficultyTier(makeGap(0.55), [])).toBe("standard");
  });

  it('returns "stretch" when averageScore >= 0.70', () => {
    expect(computeDifficultyTier(makeGap(0.7), [])).toBe("stretch");
  });

  it("promotes tier when last 3 attempts all > 0.80", () => {
    const result = computeDifficultyTier(makeGap(0.5), [
      { score: 0.9, completedAt: new Date("2026-03-13T00:00:00.000Z") },
      { score: 0.82, completedAt: new Date("2026-03-12T00:00:00.000Z") },
      { score: 0.95, completedAt: new Date("2026-03-11T00:00:00.000Z") },
    ]);
    expect(result).toBe("stretch");
  });

  it("demotes tier when last 3 attempts all < 0.40", () => {
    const result = computeDifficultyTier(makeGap(0.5), [
      { score: 0.3, completedAt: new Date("2026-03-13T00:00:00.000Z") },
      { score: 0.2, completedAt: new Date("2026-03-12T00:00:00.000Z") },
      { score: 0.1, completedAt: new Date("2026-03-11T00:00:00.000Z") },
    ]);
    expect(result).toBe("remedial");
  });

  it("never goes below remedial or above stretch", () => {
    expect(
      computeDifficultyTier(makeGap(0.2), [
        { score: 0.1, completedAt: new Date("2026-03-13T00:00:00.000Z") },
        { score: 0.1, completedAt: new Date("2026-03-12T00:00:00.000Z") },
        { score: 0.1, completedAt: new Date("2026-03-11T00:00:00.000Z") },
      ])
    ).toBe("remedial");

    expect(
      computeDifficultyTier(makeGap(0.9), [
        { score: 0.95, completedAt: new Date("2026-03-13T00:00:00.000Z") },
        { score: 0.96, completedAt: new Date("2026-03-12T00:00:00.000Z") },
        { score: 0.97, completedAt: new Date("2026-03-11T00:00:00.000Z") },
      ])
    ).toBe("stretch");
  });
});
