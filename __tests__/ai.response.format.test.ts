import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRetrieveRelevantChunks = vi.hoisted(() => vi.fn());
const mockRoutedCompletion = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ai/rag/retrievalService", () => ({
  retrieveRelevantChunks: mockRetrieveRelevantChunks,
}));

vi.mock("@/lib/ai/routedCompletion", () => ({
  routedCompletion: mockRoutedCompletion,
}));

import { answerGroundedQuestion } from "@/lib/ai/rag/groundedAnswerService";

describe("AI trust response format", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns groundingScore, sourcesUsed, and high confidence for strongly grounded answers", async () => {
    mockRetrieveRelevantChunks.mockResolvedValue([
      {
        id: "chunk-1",
        sourceType: "curriculum_content",
        sourceId: "curr-1",
        title: "Fractions Unit",
        content: "Fractions are equal parts of a whole.",
        chunkIndex: 0,
        subject: "MATH",
        grade: 5,
        schoolId: "school-1",
        scope: "SCHOOL",
        sourceLabel: "Fractions Unit",
        similarity: 0.92,
        metadata: { unitTitle: "Unit 2" },
      },
    ]);
    mockRoutedCompletion.mockResolvedValue({
      content: JSON.stringify({
        answer: "Fractions describe equal parts of a whole.",
        sourceIds: ["chunk-1"],
      }),
      estimatedCostUSD: 0.001,
      inputTokens: 10,
      outputTokens: 12,
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

    expect(result.groundingScore).toBeGreaterThanOrEqual(0.9);
    expect(result.sourcesUsed).toBe(1);
    expect(result.confidence).toBe("high");
    expect(result.tokensUsed).toBe(22);
    expect(result.estimatedCost).toBe(0.001);
    expect(result.fallbackReason).toBeUndefined();
  });

  it("forces low confidence when groundingScore is below the safe threshold", async () => {
    mockRetrieveRelevantChunks.mockResolvedValue([
      {
        id: "chunk-weak",
        sourceType: "curriculum_content",
        sourceId: "curr-2",
        title: "Weak match",
        content: "Short content.",
        chunkIndex: 0,
        subject: "SCIENCE",
        grade: 7,
        schoolId: "school-1",
        scope: "SCHOOL",
        sourceLabel: "Weak match",
        similarity: 0.52,
      },
    ]);
    mockRoutedCompletion.mockResolvedValue({
      content: JSON.stringify({
        answer: "This uses a weaker supporting match.",
        sourceIds: ["chunk-weak"],
      }),
      estimatedCostUSD: 0.0005,
      inputTokens: 8,
      outputTokens: 8,
      model: "gpt-4o-mini",
      tier: "smart",
    });

    const result = await answerGroundedQuestion({
      question: "Explain this science idea.",
      schoolId: "school-1",
      subject: "SCIENCE",
      grade: 7,
      role: "STUDENT",
    });

    expect(result.groundingScore).toBeLessThan(0.66);
    expect(result.confidence).toBe("low");
  });

  it("includes fallbackReason when fallback triggers", async () => {
    mockRetrieveRelevantChunks.mockResolvedValue([]);

    const result = await answerGroundedQuestion({
      question: "What does the policy say about attendance?",
      schoolId: "school-1",
      role: "ADMIN",
    });

    expect(result.hadFallback).toBe(true);
    expect(result.confidence).toBe("low");
    expect(result.fallbackReason).toBe("insufficient_retrieved_context");
    expect(result.explanation?.fallbackUsed).toBe(true);
  });
});
