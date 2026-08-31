import { describe, expect, it } from "vitest";
import { openLessonQuizSession, projectQuizForLearner, sealLessonQuizSession } from "@/lib/grading/lessonQuizSession";

const questions = Array.from({ length: 5 }, (_, index) => ({
  id: `q-${index}`, question: "Question", options: ["A", "B", "C", "D"], correctIndex: 0, explanation: "Because",
}));

describe("lesson quiz answer-key boundary", () => {
  it("does not serialize answer keys to the learner payload", () => {
    expect(projectQuizForLearner(questions)).not.toContainEqual(expect.objectContaining({ correctIndex: expect.anything() }));
  });

  it("binds encrypted answer authority to the learner and lesson", () => {
    const token = sealLessonQuizSession({ userId: "student-1", lessonId: "lesson-1", quizId: "quiz-1", questions });
    expect(openLessonQuizSession(token, "student-1", "lesson-1")?.questions[0]?.correctIndex).toBe(0);
    expect(openLessonQuizSession(token, "student-2", "lesson-1")).toBeNull();
    expect(openLessonQuizSession(token, "student-1", "lesson-2")).toBeNull();
  });
});
