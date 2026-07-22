import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRoutedCompletion = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ai/router", () => ({
  routedCompletion: mockRoutedCompletion,
}));

import { generateExam } from "@/lib/exams/examGenerator";

function makeExamResponse(questionCount = 4, moeStandards: string[] = ["LR-MATH-1", "LR-MATH-2"]) {
  return {
    content: JSON.stringify({
      title: "Grade 6 Math Exam",
      subject: "MATH",
      grade: 6,
      moeStandards,
      timeLimit: 60,
      passingScore: 0.7,
      questions: Array.from({ length: questionCount }, (_, index) => ({
        prompt: `Question ${index + 1}`,
        options: ["A", "B", "C", "D"],
        correctIndex: index % 4,
        explanation: "Because this is the correct answer.",
        moeCode: moeStandards[index % moeStandards.length],
        points: 1,
      })),
    }),
  };
}

describe("generateExam", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates the correct question count", async () => {
    mockRoutedCompletion.mockResolvedValueOnce(makeExamResponse(4));

    const exam = await generateExam({
      subject: "MATH",
      grade: 6,
      moeStandards: ["LR-MATH-1", "LR-MATH-2"],
      questionCount: 4,
      timeLimit: 60,
    });

    expect(exam.questions).toHaveLength(4);
  });

  it("ensures all questions have 4 options", async () => {
    mockRoutedCompletion.mockResolvedValueOnce(makeExamResponse(3, ["LR-SCI-1"]));
    const exam = await generateExam({
      subject: "SCIENCE",
      grade: 7,
      moeStandards: ["LR-SCI-1"],
      questionCount: 3,
      timeLimit: 45,
    });

    expect(exam.questions.every((question) => question.options.length === 4)).toBe(true);
  });

  it("ensures correctIndex is 0-3", async () => {
    mockRoutedCompletion.mockResolvedValueOnce(makeExamResponse(4, ["LR-CIV-1", "LR-CIV-2"]));
    const exam = await generateExam({
      subject: "CIVICS",
      grade: 8,
      moeStandards: ["LR-CIV-1", "LR-CIV-2"],
      questionCount: 4,
      timeLimit: 60,
    });

    expect(exam.questions.every((question) => question.correctIndex >= 0 && question.correctIndex <= 3)).toBe(true);
  });

  it("ensures moeCode is present on every question", async () => {
    mockRoutedCompletion.mockResolvedValueOnce(makeExamResponse(5, ["LR-LIT-1", "LR-LIT-2"]));
    const exam = await generateExam({
      subject: "LITERACY",
      grade: 5,
      moeStandards: ["LR-LIT-1", "LR-LIT-2"],
      questionCount: 5,
      timeLimit: 50,
    });

    expect(exam.questions.every((question) => question.moeCode.length > 0)).toBe(true);
  });

  it("normalizes a passingScore returned as a percentage instead of a fraction", async () => {
    mockRoutedCompletion.mockResolvedValueOnce({
      content: JSON.stringify({
        title: "Grade 6 Math Exam",
        subject: "MATH",
        grade: 6,
        moeStandards: ["LR-MATH-1"],
        timeLimit: 60,
        passingScore: 70,
        questions: Array.from({ length: 4 }, (_, index) => ({
          prompt: `Question ${index + 1}`,
          options: ["A", "B", "C", "D"],
          correctIndex: 0,
          explanation: "Because this is the correct answer.",
          moeCode: "LR-MATH-1",
          points: 1,
        })),
      }),
    });

    const exam = await generateExam({
      subject: "MATH",
      grade: 6,
      moeStandards: ["LR-MATH-1"],
      questionCount: 4,
      timeLimit: 60,
    });

    expect(exam.passingScore).toBeCloseTo(0.7);
  });

  it("still fails a genuinely out-of-range passingScore rather than silently guessing", async () => {
    mockRoutedCompletion.mockResolvedValue({
      content: JSON.stringify({
        title: "Grade 6 Math Exam",
        subject: "MATH",
        grade: 6,
        moeStandards: ["LR-MATH-1"],
        timeLimit: 60,
        passingScore: 700,
        questions: Array.from({ length: 4 }, (_, index) => ({
          prompt: `Question ${index + 1}`,
          options: ["A", "B", "C", "D"],
          correctIndex: 0,
          explanation: "Because this is the correct answer.",
          moeCode: "LR-MATH-1",
          points: 1,
        })),
      }),
    });

    await expect(
      generateExam({
        subject: "MATH",
        grade: 6,
        moeStandards: ["LR-MATH-1"],
        questionCount: 4,
        timeLimit: 60,
      })
    ).rejects.toThrow();
  });

  it("normalizes a per-question suffix appended to an otherwise-correct moeCode", async () => {
    mockRoutedCompletion.mockResolvedValueOnce({
      content: JSON.stringify({
        title: "Grade 7 Math Exam",
        subject: "MATH",
        grade: 7,
        moeStandards: ["MATH.G7.RATIO"],
        timeLimit: 60,
        passingScore: 0.7,
        questions: Array.from({ length: 5 }, (_, index) => ({
          prompt: `Question ${index + 1}`,
          options: ["A", "B", "C", "D"],
          correctIndex: 0,
          explanation: "Because this is the correct answer.",
          moeCode: `MATH.G7.RATIO.${index + 1}`,
          points: 1,
        })),
      }),
    });

    const exam = await generateExam({
      subject: "MATH",
      grade: 7,
      moeStandards: ["MATH.G7.RATIO"],
      questionCount: 5,
      timeLimit: 60,
    });

    expect(exam.questions.every((question) => question.moeCode === "MATH.G7.RATIO")).toBe(true);
  });

  it("still fails a moeCode that does not unambiguously extend a single requested standard", async () => {
    mockRoutedCompletion.mockResolvedValue({
      content: JSON.stringify({
        title: "Grade 7 Math Exam",
        subject: "MATH",
        grade: 7,
        moeStandards: ["MATH.G7.RATIO", "MATH.G7.NUM"],
        timeLimit: 60,
        passingScore: 0.7,
        questions: Array.from({ length: 4 }, (_, index) => ({
          prompt: `Question ${index + 1}`,
          options: ["A", "B", "C", "D"],
          correctIndex: 0,
          explanation: "Because this is the correct answer.",
          moeCode: "MATH.G7.UNRELATED",
          points: 1,
        })),
      }),
    });

    await expect(
      generateExam({
        subject: "MATH",
        grade: 7,
        moeStandards: ["MATH.G7.RATIO", "MATH.G7.NUM"],
        questionCount: 4,
        timeLimit: 60,
      })
    ).rejects.toThrow();
  });

  it("throws if AI returns malformed response after retry", async () => {
    mockRoutedCompletion
      .mockResolvedValueOnce({ content: "{bad json" })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          title: "Bad Exam",
          subject: "MATH",
          grade: 6,
          moeStandards: ["LR-MATH-1"],
          timeLimit: 60,
          passingScore: 0.7,
          questions: [{ prompt: "Bad", options: ["A"], correctIndex: 0, explanation: "Bad", moeCode: "LR-MATH-1", points: 1 }],
        }),
      });

    await expect(
      generateExam({
        subject: "MATH",
        grade: 6,
        moeStandards: ["LR-MATH-1"],
        questionCount: 1,
        timeLimit: 60,
      })
    ).rejects.toThrow();
  });
});
