import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRetrieveRelevantChunks = vi.hoisted(() => vi.fn());
const mockRoutedCompletion = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ai/rag/retrievalService", () => ({
  retrieveRelevantChunks: mockRetrieveRelevantChunks,
}));

vi.mock("@/lib/ai/routedCompletion", () => ({
  routedCompletion: mockRoutedCompletion,
}));

import {
  answerGroundedQuestion,
  normalizeGroundedSourceType,
} from "@/lib/ai/rag/groundedAnswerService";

describe("answerGroundedQuestion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("falls back safely when retrieved chunks are unusable", async () => {
    mockRetrieveRelevantChunks.mockResolvedValue([
      {
        id: "chunk-1",
        sourceType: "policy_document",
        sourceId: "policy-1",
        title: "   ",
        content: "   ",
        chunkIndex: 0,
        subject: null,
        grade: null,
        schoolId: null,
        scope: "GLOBAL",
        sourceLabel: "docs/governance/DATA_GOVERNANCE.md",
        similarity: 0.41,
      },
    ]);

    const result = await answerGroundedQuestion({
      question: "What is the attendance retention policy?",
      schoolId: "school-1",
      role: "ADMIN",
    });

    expect(mockRetrieveRelevantChunks).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "policy" })
    );
    expect(result.retrievalWeak).toBe(true);
    expect(result.hadFallback).toBe(true);
    expect(result.isWeakGrounding).toBe(true);
    expect(result.answer).toContain("could not find enough approved LiberiaLearn content");
    expect(result.sources[0]?.sourceType).toBe("policy");
    expect(result.actions.map((action) => action.type)).toEqual(["SUGGEST_INTERVENTION"]);
    expect(mockRoutedCompletion).not.toHaveBeenCalled();
  });

  it("does not fallback when chunks exist even if retrieval is weak", async () => {
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
        sourceLabel: "teacher-fractions",
        similarity: 0.41,
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
      role: "STUDENT",
    });

    expect(result.hadFallback).toBe(false);
    expect(result.retrievalWeak).toBe(true);
    expect(result.isWeakGrounding).toBe(true);
    expect(result.answer).toContain("equal parts of a whole");
    expect(mockRoutedCompletion).toHaveBeenCalledOnce();
  });

  it("falls back when chunks are empty", async () => {
    mockRetrieveRelevantChunks.mockResolvedValue([]);

    const result = await answerGroundedQuestion({
      question: "What is a fraction?",
      schoolId: "school-1",
      role: "STUDENT",
    });

    expect(result.hadFallback).toBe(true);
    expect(result.sources).toEqual([]);
    expect(mockRoutedCompletion).not.toHaveBeenCalled();
  });

  it("uses classroom mode for subject/grade questions and returns grounded curriculum sources", async () => {
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
        sourceLabel: "teacher-fractions",
        similarity: 0.91,
      },
    ]);
    mockRoutedCompletion.mockResolvedValue({
      content: JSON.stringify({
        answer: "Fractions describe equal parts of a whole.",
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
      role: "STUDENT",
    });

    expect(mockRetrieveRelevantChunks).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "classroom" })
    );
    expect(result.retrievalWeak).toBe(false);
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].id).toBe("chunk-1");
    expect(result.sources[0].sourceType).toBe("curriculum");
    expect(result.actions.map((action) => action.type)).toEqual([
      "GENERATE_PRACTICE",
      "EXPLAIN_DIFFERENTLY",
    ]);
    expect(result.actions[0].payload).toMatchObject({
      subject: "MATH",
      gradeLevel: "5",
    });
  });

  it("allows explicit mixed mode without accidental policy preference", async () => {
    mockRetrieveRelevantChunks.mockResolvedValue([
      {
        id: "chunk-2",
        sourceType: "policy_document",
        sourceId: "policy-1",
        title: "Security Model",
        content: "Security guidance.",
        chunkIndex: 0,
        subject: null,
        grade: null,
        schoolId: null,
        scope: "GLOBAL",
        sourceLabel: "docs/governance/SECURITY_MODEL.md",
        similarity: 0.88,
      },
    ]);
    mockRoutedCompletion.mockResolvedValue({
      content: JSON.stringify({
        answer: "Security guidance applies here.",
        sourceIds: ["chunk-2"],
      }),
      estimatedCostUSD: 0.001,
      inputTokens: 10,
      outputTokens: 10,
      model: "gpt-4o-mini",
      tier: "smart",
    });

    const result = await answerGroundedQuestion({
      question: "Compare lesson guidance and governance constraints.",
      schoolId: "school-1",
      mode: "mixed",
      role: "ADMIN",
    });

    expect(mockRetrieveRelevantChunks).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "mixed" })
    );
    expect(result.retrievalWeak).toBe(false);
    expect(result.sources[0].sourceType).toBe("policy");
    expect(result.actions.map((action) => action.type)).toEqual(["SUGGEST_INTERVENTION"]);
  });

  it("normalizes source types to curriculum, lesson, standard, or policy", () => {
    expect(
      normalizeGroundedSourceType({
        sourceType: "lesson_content",
        sourceLabel: "teacher-fractions",
        title: "Fractions Unit",
        content: "Equal parts of a whole",
      })
    ).toBe("curriculum");

    expect(
      normalizeGroundedSourceType({
        sourceType: "assignment",
        sourceLabel: "homework/week-2",
        title: "Practice work",
        content: "Complete these lesson questions",
      })
    ).toBe("lesson");

    expect(
      normalizeGroundedSourceType({
        sourceType: "moe_standard",
        sourceLabel: "standards/math",
        title: "Grade 7 Benchmarks",
        content: "Competency strand outcomes",
      })
    ).toBe("standard");

    expect(
      normalizeGroundedSourceType({
        sourceType: "unknown",
        sourceLabel: "docs/governance/security",
        title: "Security Model",
        content: "Compliance and audit guidance",
      })
    ).toBe("policy");
  });
});
