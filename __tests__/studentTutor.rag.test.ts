import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRetrieveRelevantLessons = vi.hoisted(() => vi.fn());
const mockRoutedCompletion = vi.hoisted(() => vi.fn());
const mockIsRagTutorEnabled = vi.hoisted(() => vi.fn());
const mockStudentFindUnique = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ai/rag/retrievalService", () => ({
  retrieveRelevantLessons: mockRetrieveRelevantLessons,
}));

vi.mock("@/lib/ai/router", () => ({
  routedCompletion: mockRoutedCompletion,
}));

vi.mock("@/lib/serverFlags", async () => {
  const actual = await vi.importActual<any>("@/lib/serverFlags");
  return {
    ...actual,
    isRagTutorEnabled: mockIsRagTutorEnabled,
  };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    student: {
      findUnique: mockStudentFindUnique,
    },
  },
}));

import { answerStudentQuestion } from "@/lib/ai/tutor/studentTutor";

describe("answerStudentQuestion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStudentFindUnique.mockResolvedValue({
      currentGrade: 5,
      enrollments: [{ Class: { subject: "MATH" } }],
    });
    mockRoutedCompletion.mockResolvedValue({
      content: "Fractions are parts of a whole.",
      estimatedCostUSD: 0.0001,
      inputTokens: 1,
      model: "gpt-4o-mini",
      outputTokens: 1,
      tier: "smart",
    });
  });

  it("uses lesson context when ENABLE_RAG_TUTOR is true", async () => {
    mockIsRagTutorEnabled.mockReturnValue(true);
    mockRetrieveRelevantLessons.mockResolvedValue([
      {
        id: "lesson-1",
        title: "Fractions",
        content: "Fractions describe equal parts of a whole.",
        subject: "MATH",
        gradeLevel: 5,
        similarity: 0.92,
      },
    ]);

    await answerStudentQuestion("student-1", "What is a fraction?", []);

    const [call] = mockRoutedCompletion.mock.calls[0];
    expect(call.messages[0].content).toContain(
      "Relevant lesson content from your curriculum"
    );
    expect(call.messages[0].content).toContain("Fractions");
  });

  it("falls back when ENABLE_RAG_TUTOR is false", async () => {
    mockIsRagTutorEnabled.mockReturnValue(false);
    mockRetrieveRelevantLessons.mockResolvedValue([]);

    await answerStudentQuestion("student-1", "What is a fraction?", []);

    const [call] = mockRoutedCompletion.mock.calls[0];
    expect(call.messages[0].content).toContain(
      "You are a helpful educational tutor"
    );
    expect(mockRetrieveRelevantLessons).not.toHaveBeenCalled();
  });
});
