import { describe, it, expect } from "vitest";
import { nextDifficulty, recommendGrade, scorePlacement } from "@/lib/placementAuthority/scoring";

const items = (pattern: Array<[number, boolean]>) => pattern.map(([difficulty, isCorrect]) => ({ difficulty, isCorrect }));

describe("server placement scoring (placement.grade.v1)", () => {
  it("derives bands across score ranges from server-scored items", () => {
    const at = (correct: number) =>
      scorePlacement(Array.from({ length: 10 }, (_, i) => ({ difficulty: 3, isCorrect: i < correct }))).band;
    expect(at(4)).toBe("foundational");
    expect(at(5)).toBe("developing");
    expect(at(7)).toBe("developing");
    expect(at(8)).toBe("proficient");
    expect(at(9)).toBe("advanced");
  });

  it("maps weighted accuracy and difficulty to the grade table", () => {
    expect(recommendGrade(95, 4.6)).toBe(12);
    expect(recommendGrade(85, 3)).toBe(8);
    expect(recommendGrade(72, 2)).toBe(6);
    expect(recommendGrade(20, 1)).toBe(2);
  });

  it("weights harder items more heavily", () => {
    const easyRight = scorePlacement(items([[1, true], [5, false]]));
    const hardRight = scorePlacement(items([[1, false], [5, true]]));
    expect(hardRight.weightedAccuracy).toBeGreaterThan(easyRight.weightedAccuracy);
    expect(hardRight.accuracyRate).toBe(easyRight.accuracyRate);
  });

  it("adapts difficulty within 1..5", () => {
    expect(nextDifficulty(null)).toBe(3);
    expect(nextDifficulty({ difficulty: 5, isCorrect: true })).toBe(5);
    expect(nextDifficulty({ difficulty: 1, isCorrect: false })).toBe(1);
    expect(nextDifficulty({ difficulty: 3, isCorrect: false })).toBe(2);
  });

  it("refuses to score an empty response set", () => {
    expect(() => scorePlacement([])).toThrow();
  });
});
