import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRoutedCompletion = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ai/router", () => ({
  routedCompletion: mockRoutedCompletion,
}));

describe("lesson quiz AI services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retries quiz generation once after malformed JSON", async () => {
    mockRoutedCompletion
      .mockResolvedValueOnce({
        content: "{bad json",
        inputTokens: 10,
        outputTokens: 10,
        estimatedCostUSD: 0.001,
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          questions: Array.from({ length: 5 }, (_, index) => ({
            id: `q-${index + 1}`,
            question: `Question ${index + 1}`,
            options: ["A", "B", "C", "D"],
            correctIndex: 0,
            explanation: "Because",
          })),
        }),
        inputTokens: 10,
        outputTokens: 10,
        estimatedCostUSD: 0.001,
      });

    const { generateLessonQuiz } = await import("@/lib/ai/lessonQuiz");
    const quiz = await generateLessonQuiz({
      lessonTitle: "Adding Fractions",
      lessonContent:
        "Fractions represent equal parts of a whole. Add the numerators when the denominators are the same.",
      subject: "MATH",
      gradeLevel: 6,
    });

    expect(mockRoutedCompletion).toHaveBeenCalledTimes(2);
    expect(quiz.questions).toHaveLength(5);
  });

  it("parses lesson gap analysis responses", async () => {
    mockRoutedCompletion.mockResolvedValue({
      content: JSON.stringify({
        missedConcepts: [
          {
            concept: "Equal denominators",
            explanation: "Add only the numerators when the pieces are the same size.",
            rereadSuggestion: "Re-read the part that explains why the denominator stays the same.",
          },
        ],
        closingMessage: "You are close. Review that part and try again.",
      }),
      inputTokens: 10,
      outputTokens: 10,
      estimatedCostUSD: 0.001,
    });

    const { generateLessonGapAnalysis } = await import("@/lib/ai/lessonQuiz");
    const analysis = await generateLessonGapAnalysis({
      lessonTitle: "Adding Fractions",
      lessonContent:
        "Fractions represent equal parts of a whole. Add the numerators when the denominators are the same.",
      subject: "MATH",
      gradeLevel: 6,
      incorrectAnswers: [
        {
          question: "What do you do when the denominators match?",
          selectedOption: "Add everything",
          correctOption: "Add the numerators only",
          explanation: "The denominator stays the same because the piece size does not change.",
        },
      ],
    });

    expect(analysis.missedConcepts[0]?.concept).toBe("Equal denominators");
    expect(analysis.closingMessage).toContain("Review");
  });

  it("uses authored lesson quiz items instead of generating a shell", async () => {
    const { generateLessonQuiz } = await import("@/lib/ai/lessonQuiz");
    const questions = Array.from({ length: 5 }, (_, index) => ({
      id: `authored-${index + 1}`,
      question: `Which concrete check belongs to question ${index + 1}?`,
      options: ["The mapped answer", "A different operation", "An unrelated fact", "No evidence"],
      correctIndex: 0,
      explanation: "The mapped answer measures the lesson objective.",
    }));

    const quiz = await generateLessonQuiz({
      lessonTitle: "Number and Place Value",
      lessonContent: "A complete authored lesson body.",
      subject: "MATH",
      gradeLevel: 2,
      preAuthoredQuestions: questions,
    });

    expect(mockRoutedCompletion).not.toHaveBeenCalled();
    expect(quiz.questions).toEqual(questions);
  });
});
