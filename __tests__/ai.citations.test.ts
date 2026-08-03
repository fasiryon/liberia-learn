import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRetrieveRelevantChunks = vi.hoisted(() => vi.fn());
const mockRoutedCompletion = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ai/rag/retrievalService", () => ({
  retrieveRelevantChunks: mockRetrieveRelevantChunks,
}));

vi.mock("@/lib/ai/routedCompletion", () => ({
  routedCompletion: mockRoutedCompletion,
}));

vi.mock("@/lib/agents/moderation", () => ({
  moderateText: vi.fn(async () => ({ verdict: "SAFE" })),
}));

import { answerGroundedQuestion } from "@/lib/ai/rag/groundedAnswerService";

describe("AI citations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns teacher/admin citation metadata from retrieved chunk metadata", async () => {
    mockRetrieveRelevantChunks.mockResolvedValue([
      {
        id: "chunk-1",
        sourceType: "curriculum_content",
        sourceId: "curr-1",
        title: "Fractions Lesson",
        content: "Fractions are equal parts of a whole.",
        chunkIndex: 0,
        subject: "MATH",
        grade: 5,
        schoolId: "school-1",
        scope: "SCHOOL",
        sourceLabel: "Fractions Lesson",
        similarity: 0.91,
        metadata: { unitTitle: "Unit 2: Fractions" },
      },
    ]);
    mockRoutedCompletion.mockResolvedValue({
      content: JSON.stringify({
        answer: "Fractions are equal parts of a whole.",
        sourceIds: ["chunk-1"],
      }),
      estimatedCostUSD: 0.001,
      inputTokens: 10,
      outputTokens: 10,
      model: "gpt-4o-mini",
      tier: "smart",
    });

    const result = await answerGroundedQuestion({
      question: "What is a fraction?",
      schoolId: "school-1",
      subject: "MATH",
      grade: 5,
      role: "TEACHER",
    });

    expect(result.citations).toHaveLength(1);
    expect(result.citations[0]).toMatchObject({
      sourceLabel: "Fractions Lesson",
      sourceType: "curriculum_content",
      title: "Fractions Lesson",
      subject: "MATH",
      grade: 5,
      unit: "Unit 2: Fractions",
    });
  });

  it("simplifies citations for student and guardian audiences", async () => {
    mockRetrieveRelevantChunks.mockResolvedValue([
      {
        id: "chunk-2",
        sourceType: "curriculum_content",
        sourceId: "curr-2",
        title: "Place Value Lesson",
        content: "Place value shows digit position.",
        chunkIndex: 0,
        subject: "MATH",
        grade: 4,
        schoolId: "school-1",
        scope: "SCHOOL",
        sourceLabel: "Place Value Lesson",
        similarity: 0.88,
      },
    ]);
    mockRoutedCompletion.mockResolvedValue({
      content: JSON.stringify({
        answer: "Place value shows what each digit is worth.",
        sourceIds: ["chunk-2"],
      }),
      estimatedCostUSD: 0.001,
      inputTokens: 10,
      outputTokens: 10,
      model: "gpt-4o-mini",
      tier: "smart",
    });

    const studentResult = await answerGroundedQuestion({
      question: "Explain place value.",
      schoolId: "school-1",
      subject: "MATH",
      grade: 4,
      role: "STUDENT",
    });

    expect(studentResult.citations[0]).toEqual({
      sourceLabel: "Based on this lesson",
      sourceType: "curriculum_content",
    });
  });
});
