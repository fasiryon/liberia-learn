import { describe, expect, it } from "vitest";
import { gradeAttempt } from "@/lib/exams/gradingPipeline";

const questions = [
  { id: "q1", correctIndex: 1, moeCode: "M1" },
  { id: "q2", correctIndex: 2, moeCode: "M2" },
] as any;

describe("gradeAttempt", () => {
  it("scores 100% when all answers are correct", () => {
    const result = gradeAttempt({ answers: [1, 2], passingScore: 0.7 } as any, questions);
    expect(result.score).toBe(1);
    expect(result.correctCount).toBe(2);
  });

  it("scores 0% when all answers are wrong", () => {
    const result = gradeAttempt({ answers: [0, 0], passingScore: 0.7 } as any, questions);
    expect(result.score).toBe(0);
    expect(result.correctCount).toBe(0);
  });

  it("identifies weakMoeCodes from wrong answers", () => {
    const result = gradeAttempt({ answers: [1, 0], passingScore: 0.7 } as any, questions);
    expect(result.weakMoeCodes).toEqual(["M2"]);
  });

  it("passed=true when score >= passingScore", () => {
    const result = gradeAttempt({ answers: [1, 2], passingScore: 0.8 } as any, questions);
    expect(result.passed).toBe(true);
  });

  it("passed=false when score < passingScore", () => {
    const result = gradeAttempt({ answers: [1, 0], passingScore: 0.8 } as any, questions);
    expect(result.passed).toBe(false);
  });
});
