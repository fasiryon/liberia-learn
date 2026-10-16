import { describe, expect, it } from "vitest";
import { BLANK_ANSWER, gradeAttempt } from "@/lib/exams/gradingPipeline";
import { submitExamSchema } from "@/lib/exams/examAuthority";

const questions = [
  { id: "q1", correctIndex: 1, moeCode: "M1", points: 1, options: ["a", "b", "c"] },
  { id: "q2", correctIndex: 0, moeCode: "M2", points: 3, options: ["a", "b"] },
  { id: "q3", correctIndex: 2, moeCode: "M3", points: 1, options: ["a", "b", "c"] },
];
const attempt = (answers: number[]) => ({ answers, passingScore: 0.7 }) as never;

describe("legacy exam scoring (LL-AEP-001 remediation)", () => {
  it("honors approved item points instead of counting questions equally", () => {
    const result = gradeAttempt(attempt([1, 1, 2]), questions as never);
    // q1 (1) + q3 (1) correct of 5 points; question-count scoring would give 2/3.
    expect(result).toMatchObject({ earnedPoints: 2, totalPoints: 5, score: 0.4, correctCount: 2 });
  });

  it("records blanks as blank, never as option 0", () => {
    // q2's key is option 0: a blank must not earn it.
    const result = gradeAttempt(attempt([1, BLANK_ANSWER]), questions as never);
    expect(result.perQuestion.map((item) => item.outcome)).toEqual(["CORRECT", "BLANK", "BLANK"]);
    expect(result).toMatchObject({ blankCount: 2, earnedPoints: 1 });
  });

  it("distinguishes invalid answers from blanks", () => {
    const result = gradeAttempt(attempt([1, 5, 2]), questions as never);
    expect(result.perQuestion[1].outcome).toBe("INVALID");
    expect(result).toMatchObject({ invalidCount: 1, blankCount: 0 });
    expect(() => gradeAttempt(attempt([1, 0, 2, 1]), questions as never)).toThrow("More answers than questions");
  });

  it("enforces stable question-to-response identity", () => {
    expect(gradeAttempt(attempt([1, 0, 2]), questions as never, { questionIds: ["q1", "q2", "q3"] }).score).toBe(1);
    expect(() => gradeAttempt(attempt([1, 0, 2]), questions as never, { questionIds: ["q2", "q1", "q3"] })).toThrow("Exam questions changed");
    expect(() => gradeAttempt(attempt([1, 0]), questions as never, { questionIds: ["q1", "q2"] })).toThrow("Exam questions changed");
  });

  it("accepts -1 as the blank marker at the API boundary and rejects other negatives", () => {
    expect(submitExamSchema.safeParse({ attemptId: "a", answers: [1, -1], questionIds: ["q1", "q2"] }).success).toBe(true);
    expect(submitExamSchema.safeParse({ attemptId: "a", answers: [-2] }).success).toBe(false);
  });
});
