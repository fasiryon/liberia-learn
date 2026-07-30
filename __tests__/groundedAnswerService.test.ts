import { beforeEach, describe, expect, it, vi } from "vitest";

// groundedAnswerService calls hybridRetrieve (not retrieveRelevantChunks directly).
// Mock hybridRetrieve so tests control the chunk set without touching the real DB.
const mockHybridRetrieve = vi.hoisted(() => vi.fn());
const mockRoutedCompletion = vi.hoisted(() => vi.fn());
const mockGetCachedValue = vi.hoisted(() => vi.fn());
const mockSetCachedValue = vi.hoisted(() => vi.fn());
const mockBuildAiCacheKey = vi.hoisted(() => vi.fn(() => "cache-key"));
const mockHashCacheQuery = vi.hoisted(() => vi.fn(() => "query-hash"));
const mockModerateText = vi.hoisted(() =>
  vi.fn(async (): Promise<{ verdict: "SAFE" | "UNSAFE" | "UNCERTAIN"; reason?: string }> => ({
    verdict: "SAFE",
  }))
);
const mockEnqueueEscalation = vi.hoisted(() => vi.fn(async () => ({ id: "escalation-1" })));

vi.mock("@/lib/ai/rag/hybridRetrieval", () => ({
  hybridRetrieve: mockHybridRetrieve,
}));

vi.mock("@/lib/ai/routedCompletion", () => ({
  routedCompletion: mockRoutedCompletion,
}));

vi.mock("@/lib/ai/cache", () => ({
  getCachedValue: mockGetCachedValue,
  setCachedValue: mockSetCachedValue,
  buildAiCacheKey: mockBuildAiCacheKey,
  hashCacheQuery: mockHashCacheQuery,
}));

// NR-9.5: moderateText internally calls @/lib/ai/routedCompletion too, which
// is already mocked above for the tutor's own answer generation. Mocking
// moderation separately keeps it from consuming that queue and breaking
// call-count assertions on mockRoutedCompletion.
vi.mock("@/lib/agents/moderation", () => ({
  moderateText: mockModerateText,
}));
vi.mock("@/lib/agents/escalation", () => ({
  enqueueEscalation: mockEnqueueEscalation,
}));

import {
  answerGroundedQuestion,
  normalizeGroundedSourceType,
} from "@/lib/ai/rag/groundedAnswerService";

describe("answerGroundedQuestion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCachedValue.mockReturnValue(null);
    mockModerateText.mockResolvedValue({ verdict: "SAFE" });
  });

  it("falls back safely when retrieved chunks are unusable", async () => {
    mockHybridRetrieve.mockResolvedValue([
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
        rankingScore: 0.41,
      },
    ]);

    const result = await answerGroundedQuestion({
      question: "What is the attendance retention policy?",
      schoolId: "school-1",
      role: "ADMIN",
    });

    expect(mockHybridRetrieve).toHaveBeenCalledWith(
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
    mockHybridRetrieve.mockResolvedValue([
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
        rankingScore: 0.41,
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
    mockHybridRetrieve.mockResolvedValue([]);

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
    mockHybridRetrieve.mockResolvedValue([
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
        rankingScore: 0.91,
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

    expect(mockHybridRetrieve).toHaveBeenCalledWith(
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
    mockHybridRetrieve.mockResolvedValue([
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
        rankingScore: 0.88,
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

    expect(mockHybridRetrieve).toHaveBeenCalledWith(
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

  it("returns zero spend and cacheHit=true when serving a cached answer", async () => {
    mockGetCachedValue.mockReturnValue({
      answer: "Cached grounded answer",
      sources: [],
      retrievalWeak: false,
      hadFallback: false,
      cacheHit: false,
      isWeakGrounding: false,
      actions: [],
      confidence: "high",
      groundingScore: 0.91,
      sourcesUsed: 1,
      citations: [],
      tokensUsed: 42,
      estimatedCost: 0.002,
    });

    const result = await answerGroundedQuestion({
      question: "What is a fraction?",
      schoolId: "school-1",
      subject: "MATH",
      grade: 5,
      role: "TEACHER",
    });

    expect(result.answer).toBe("Cached grounded answer");
    expect(result.cacheHit).toBe(true);
    expect(result.tokensUsed).toBe(0);
    expect(result.estimatedCost).toBe(0);
    expect(mockRoutedCompletion).not.toHaveBeenCalled();
  });

  it("blocks unsafe input before any retrieval or LLM call (NR-9.5)", async () => {
    mockModerateText.mockResolvedValueOnce({ verdict: "UNSAFE", reason: "unsafe_input" });

    const result = await answerGroundedQuestion({
      question: "something unsafe",
      schoolId: "school-1",
      role: "STUDENT",
    });

    expect(result.fallbackReason).toBe("input_moderation_blocked");
    expect(result.answer).toContain("can't help with that");
    expect(mockHybridRetrieve).not.toHaveBeenCalled();
    expect(mockRoutedCompletion).not.toHaveBeenCalled();
  });

  it("regenerates once on unsafe output, then escalates and blocks if still unsafe (NR-9.5)", async () => {
    mockHybridRetrieve.mockResolvedValue([
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
        rankingScore: 0.91,
      },
    ]);
    mockRoutedCompletion.mockResolvedValue({
      content: JSON.stringify({ answer: "an unsafe answer", sourceIds: ["chunk-1"] }),
      estimatedCostUSD: 0.001,
      inputTokens: 10,
      outputTokens: 10,
      model: "gpt-4o-mini",
      tier: "smart",
    });
    // input SAFE, then output UNSAFE twice (initial + retry)
    mockModerateText
      .mockResolvedValueOnce({ verdict: "SAFE" })
      .mockResolvedValueOnce({ verdict: "UNSAFE", reason: "unsafe_output" })
      .mockResolvedValueOnce({ verdict: "UNSAFE", reason: "unsafe_output" });

    const result = await answerGroundedQuestion({
      question: "What is a fraction?",
      schoolId: "school-1",
      subject: "MATH",
      grade: 5,
      role: "STUDENT",
    });

    expect(mockRoutedCompletion).toHaveBeenCalledTimes(2);
    expect(result.fallbackReason).toBe("output_moderation_unsafe");
    expect(result.answer).toContain("can't help with that");
    expect(mockEnqueueEscalation).toHaveBeenCalledWith(
      expect.objectContaining({ priority: "HIGH", schoolId: "school-1" })
    );
  });

  it("uses the regenerated answer when the retry passes moderation (NR-9.5)", async () => {
    mockHybridRetrieve.mockResolvedValue([
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
        rankingScore: 0.91,
      },
    ]);
    mockRoutedCompletion
      .mockResolvedValueOnce({
        content: JSON.stringify({ answer: "an unsafe answer", sourceIds: ["chunk-1"] }),
        estimatedCostUSD: 0.001,
        inputTokens: 10,
        outputTokens: 10,
        model: "gpt-4o-mini",
        tier: "smart",
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({ answer: "a safe regenerated answer", sourceIds: ["chunk-1"] }),
        estimatedCostUSD: 0.001,
        inputTokens: 10,
        outputTokens: 10,
        model: "gpt-4o-mini",
        tier: "smart",
      });
    mockModerateText
      .mockResolvedValueOnce({ verdict: "SAFE" })
      .mockResolvedValueOnce({ verdict: "UNSAFE", reason: "unsafe_output" })
      .mockResolvedValueOnce({ verdict: "SAFE" });

    const result = await answerGroundedQuestion({
      question: "What is a fraction?",
      schoolId: "school-1",
      subject: "MATH",
      grade: 5,
      role: "STUDENT",
    });

    expect(result.answer).toBe("a safe regenerated answer");
    expect(mockEnqueueEscalation).not.toHaveBeenCalled();
  });
});
