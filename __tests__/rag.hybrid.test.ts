/**
 * __tests__/rag.hybrid.test.ts
 *
 * Tests for the complete hybrid RAG pipeline:
 *   - sparseRetrieve (BM25 via PostgreSQL FTS)
 *   - reciprocalRankFusion (RRF merge)
 *   - rerankChunks (Cohere cross-encoder, graceful degradation)
 *   - hybridRetrieve (end-to-end pipeline)
 *   - Integration: grounded answer service uses hybridRetrieve
 *   - Eval metrics include hybrid breakdown
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/agents/moderation", () => ({
  moderateText: vi.fn(async () => ({ verdict: "SAFE" })),
}));

// ─── hoisted mock factories ────────────────────────────────────────────────
const mockPrismaQueryRaw = vi.hoisted(() => vi.fn());
const mockRetrieveRelevantChunks = vi.hoisted(() => vi.fn());
const mockCohereRerankFn = vi.hoisted(() => vi.fn());
// Class mock: use mockReturnValue so `new CohereClient(...)` returns the
// instance object.  Arrow functions cannot be constructors, so we must not
// use mockImplementation with an arrow function here.
const MockCohereClientClass = vi.hoisted(() => vi.fn());

// ─── module-level mocks ────────────────────────────────────────────────────
vi.mock("@/lib/db", () => ({
  prisma: { $queryRaw: mockPrismaQueryRaw },
}));

// Mock retrievalService so hybridRetrieve tests can control dense results.
vi.mock("@/lib/ai/rag/retrievalService", () => ({
  retrieveRelevantChunks: mockRetrieveRelevantChunks,
  retrieveRelevantLessons: vi.fn(),
}));

// Mock cohere-ai (static import in ragReranker.ts).
vi.mock("cohere-ai", () => ({
  CohereClient: MockCohereClientClass,
}));

// ─── imports (after vi.mock declarations) ─────────────────────────────────
import { sparseRetrieve } from "@/lib/ai/rag/sparseRetrieval";
import { reciprocalRankFusion } from "@/lib/ai/rag/ragHybridFusion";
import { rerankChunks } from "@/lib/ai/rag/ragReranker";
import { hybridRetrieve, hybridRetrieveWithMetadata } from "@/lib/ai/rag/hybridRetrieval";
import * as hybridRetrievalModule from "@/lib/ai/rag/hybridRetrieval";
import type { RetrievedChunk } from "@/lib/ai/rag/retrievalService";

// ─── helpers ──────────────────────────────────────────────────────────────
function makeChunk(overrides: Partial<RetrievedChunk> & { sourceId: string }): RetrievedChunk {
  return {
    id: overrides.sourceId,
    sourceType: "curriculum_content",
    sourceId: overrides.sourceId,
    title: overrides.title ?? "Test Lesson",
    content: overrides.content ?? "Content about the topic.",
    chunkIndex: 0,
    subject: overrides.subject ?? "MATH",
    grade: overrides.grade ?? 7,
    schoolId: null,
    scope: "GLOBAL",
    sourceLabel: overrides.sourceId,
    similarity: overrides.similarity ?? 0.85,
    rankingScore: overrides.rankingScore ?? 0.85,
    retrievalTier: "default",
    metadata: {},
    ...overrides,
  };
}

// ─── sparseRetrieve ────────────────────────────────────────────────────────
describe("sparseRetrieve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns results ranked by ts_rank (bm25Score descending)", async () => {
    const rows = [
      {
        id: "id-1",
        contentId: "photosynthesis-g5",
        title: "Photosynthesis and plants",
        content: "Photosynthesis is how plants make food using sunlight.",
        subject: "SCIENCE",
        grade: 5,
        bm25Score: 0.12,
      },
      {
        id: "id-2",
        contentId: "photosynthesis-g4",
        title: "Basic photosynthesis",
        content: "Leaves absorb light and produce food.",
        subject: "SCIENCE",
        grade: 4,
        bm25Score: 0.08,
      },
    ];
    mockPrismaQueryRaw.mockResolvedValue(rows);

    const results = await sparseRetrieve("what is photosynthesis", { subject: "SCIENCE" }, 10);

    expect(results).toHaveLength(2);
    // First result should have the higher bm25Score
    expect(results[0].sourceId).toBe("photosynthesis-g5");
    expect(results[0].similarity).toBe(0.12);
    expect(results[0].rankingScore).toBe(0.12);
    expect(results[1].sourceId).toBe("photosynthesis-g4");
    expect(results[1].similarity).toBe(0.08);

    // Verify SQL was called with the query and subject
    const sqlArg = mockPrismaQueryRaw.mock.calls[0][0] as any;
    expect(sqlArg.values).toContain("what is photosynthesis");
    expect(sqlArg.values).toContain("SCIENCE");
  });

  it("returns empty array gracefully when no FTS matches exist", async () => {
    mockPrismaQueryRaw.mockResolvedValue([]);

    const results = await sparseRetrieve("zxqfoo blargh", {}, 10);

    expect(results).toEqual([]);
  });

  it("returns empty array gracefully when query is blank", async () => {
    const results = await sparseRetrieve("  ", {}, 10);

    expect(results).toEqual([]);
    expect(mockPrismaQueryRaw).not.toHaveBeenCalled();
  });

  it("returns empty array gracefully when the DB query throws", async () => {
    mockPrismaQueryRaw.mockRejectedValue(new Error("DB down"));

    const results = await sparseRetrieve("fractions", {}, 10);

    expect(results).toEqual([]);
  });

  it("applies gradeLevel filter in SQL", async () => {
    mockPrismaQueryRaw.mockResolvedValue([]);

    await sparseRetrieve("fractions", { gradeLevel: 7 }, 10);

    const sqlArg = mockPrismaQueryRaw.mock.calls[0][0] as any;
    expect(sqlArg.values).toContain(7);
  });
});

// ─── reciprocalRankFusion ──────────────────────────────────────────────────
describe("reciprocalRankFusion", () => {
  it("merges two disjoint lists into a combined ranked list", () => {
    const dense = [makeChunk({ sourceId: "dense-1" }), makeChunk({ sourceId: "dense-2" })];
    const sparse = [makeChunk({ sourceId: "sparse-1" }), makeChunk({ sourceId: "sparse-2" })];

    const result = reciprocalRankFusion(dense, sparse, 60);

    expect(result).toHaveLength(4);
    // All sourceIds should be present
    const ids = result.map((c) => c.sourceId);
    expect(ids).toContain("dense-1");
    expect(ids).toContain("dense-2");
    expect(ids).toContain("sparse-1");
    expect(ids).toContain("sparse-2");
  });

  it("assigns higher RRF score to docs present in BOTH lists", () => {
    // "shared-1" appears at rank 0 in both lists — should outscore singletons
    const shared = makeChunk({ sourceId: "shared-1" });
    const dense = [shared, makeChunk({ sourceId: "dense-only-2" })];
    const sparse = [shared, makeChunk({ sourceId: "sparse-only-2" })];

    const result = reciprocalRankFusion(dense, sparse, 60);

    const sharedEntry = result.find((c) => c.sourceId === "shared-1")!;
    const denseOnlyEntry = result.find((c) => c.sourceId === "dense-only-2")!;
    const sparseOnlyEntry = result.find((c) => c.sourceId === "sparse-only-2")!;

    expect(sharedEntry.rankingScore).toBeGreaterThan(denseOnlyEntry.rankingScore);
    expect(sharedEntry.rankingScore).toBeGreaterThan(sparseOnlyEntry.rankingScore);
  });

  it("returns empty array when both inputs are empty", () => {
    expect(reciprocalRankFusion([], [], 60)).toEqual([]);
  });

  it("returns single-list results unchanged when one input is empty", () => {
    const dense = [
      makeChunk({ sourceId: "a" }),
      makeChunk({ sourceId: "b" }),
    ];
    const result = reciprocalRankFusion(dense, [], 60);
    expect(result).toHaveLength(2);
    expect(result[0].rankingScore).toBeGreaterThan(result[1].rankingScore);
  });

  it("deduplicates: same sourceId from multiple dense chunks collapses to one entry", () => {
    // Two dense chunks with the same sourceId (different chunkIndex)
    const dense = [
      makeChunk({ id: "chunk-0", sourceId: "lesson-1", chunkIndex: 0 }),
      makeChunk({ id: "chunk-1", sourceId: "lesson-1", chunkIndex: 1 }),
    ];
    const result = reciprocalRankFusion(dense, [], 60);
    expect(result).toHaveLength(1);
    expect(result[0].sourceId).toBe("lesson-1");
  });
});

// ─── rerankChunks ──────────────────────────────────────────────────────────
describe("rerankChunks (Cohere cross-encoder)", () => {
  const chunks = [
    makeChunk({ sourceId: "chunk-a", title: "Fractions" }),
    makeChunk({ sourceId: "chunk-b", title: "Decimals" }),
    makeChunk({ sourceId: "chunk-c", title: "Percentages" }),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Use a regular function (not arrow) so `new CohereClient(...)` works.
    // Arrow functions cannot be used as constructors; mockReturnValue wraps
    // the value in `() => value` which is an arrow — same problem.
    MockCohereClientClass.mockImplementation(function (this: { rerank: ReturnType<typeof vi.fn> }) {
      this.rerank = mockCohereRerankFn;
    });
    // Remove the API key by default; individual tests set it.
    delete process.env.COHERE_API_KEY;
  });

  it("degrades gracefully and returns fusion order when COHERE_API_KEY is not set", async () => {
    const result = await rerankChunks("fractions", chunks, 2);

    // Should return the first 2 without calling Cohere
    expect(result).toHaveLength(2);
    expect(result[0].sourceId).toBe("chunk-a");
    expect(result[1].sourceId).toBe("chunk-b");
    expect(mockCohereRerankFn).not.toHaveBeenCalled();
  });

  it("calls Cohere and reorders results when COHERE_API_KEY is set", async () => {
    process.env.COHERE_API_KEY = "test-key-for-vitest";

    // Cohere returns chunk-c as most relevant, then chunk-a
    mockCohereRerankFn.mockResolvedValue({
      results: [
        { index: 2, relevanceScore: 0.95 },
        { index: 0, relevanceScore: 0.80 },
      ],
    });

    const result = await rerankChunks("fractions", chunks, 2);

    expect(result).toHaveLength(2);
    expect(result[0].sourceId).toBe("chunk-c");
    expect(result[0].rankingScore).toBe(0.95);
    expect(result[1].sourceId).toBe("chunk-a");
    expect(result[1].rankingScore).toBe(0.80);
  });

  it("degrades gracefully and returns fusion order when Cohere API throws", async () => {
    process.env.COHERE_API_KEY = "test-key-for-vitest";
    mockCohereRerankFn.mockRejectedValue(new Error("rate limit"));

    const result = await rerankChunks("fractions", chunks, 2);

    expect(result).toHaveLength(2);
    expect(result[0].sourceId).toBe("chunk-a");
  });

  it("returns empty array when input is empty", async () => {
    const result = await rerankChunks("query", [], 5);
    expect(result).toEqual([]);
  });
});

// ─── hybridRetrieve ────────────────────────────────────────────────────────
describe("hybridRetrieve", () => {
  const denseChunks = [
    makeChunk({ sourceId: "lesson-dense-1", title: "Dense result 1", similarity: 0.92 }),
    makeChunk({ sourceId: "lesson-dense-2", title: "Dense result 2", similarity: 0.88 }),
  ];
  const sparseRows = [
    {
      id: "sparse-id-1",
      contentId: "lesson-sparse-1",
      title: "Sparse result 1",
      content: "Keyword-heavy lesson content.",
      subject: "MATH",
      grade: 7,
      bm25Score: 0.15,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.COHERE_API_KEY;
    mockRetrieveRelevantChunks.mockResolvedValue(denseChunks);
    mockPrismaQueryRaw.mockResolvedValue(sparseRows);
  });

  it("runs dense and sparse retrievers in parallel (both are called)", async () => {
    await hybridRetrieve({
      question: "what is a fraction",
      schoolId: "school-1",
      subject: "MATH",
      grade: 7,
      topK: 2,
    });

    expect(mockRetrieveRelevantChunks).toHaveBeenCalledOnce();
    expect(mockPrismaQueryRaw).toHaveBeenCalledOnce();
  });

  it("returns at most topK results", async () => {
    const results = await hybridRetrieve({
      question: "explain fractions",
      schoolId: "school-1",
      topK: 2,
    });

    expect(results.length).toBeLessThanOrEqual(2);
  });

  it("returns merged results from both dense and sparse sources", async () => {
    const results = await hybridRetrieve({
      question: "explain fractions",
      schoolId: "school-1",
      topK: 5,
    });

    const sourceIds = results.map((c) => c.sourceId);
    // Dense sources and/or sparse sources should appear
    expect(sourceIds.length).toBeGreaterThan(0);
  });

  it("returns empty array when question is blank", async () => {
    const results = await hybridRetrieve({
      question: "   ",
      schoolId: "school-1",
    });

    expect(results).toEqual([]);
    expect(mockRetrieveRelevantChunks).not.toHaveBeenCalled();
  });

  it("hybridRetrieveWithMetadata returns denseResults, sparseResults, preRerankResults", async () => {
    const meta = await hybridRetrieveWithMetadata({
      question: "what is photosynthesis",
      schoolId: "school-1",
      topK: 3,
    });

    expect(Array.isArray(meta.denseResults)).toBe(true);
    expect(Array.isArray(meta.sparseResults)).toBe(true);
    expect(Array.isArray(meta.preRerankResults)).toBe(true);
    expect(Array.isArray(meta.chunks)).toBe(true);
    expect(typeof meta.rerankEnabled).toBe("boolean");
    // Dense results came from our mock
    expect(meta.denseResults).toEqual(denseChunks);
    // Sparse results came from our mocked $queryRaw
    expect(meta.sparseResults).toHaveLength(1);
    expect(meta.sparseResults[0].sourceId).toBe("lesson-sparse-1");
  });
});

// ─── Integration: grounded answer service uses hybridRetrieve ─────────────
describe("Integration: groundedAnswerService uses hybridRetrieve", () => {
  it("answerGroundedQuestion calls hybridRetrieve when no pre-fetched chunks", async () => {
    // Spy on hybridRetrieve at the module level to verify it gets called.
    const spy = vi
      .spyOn(hybridRetrievalModule, "hybridRetrieve")
      .mockResolvedValue([]);

    // Dynamically import groundedAnswerService AFTER the spy is in place.
    const { answerGroundedQuestion } = await import(
      "@/lib/ai/rag/groundedAnswerService"
    );

    await answerGroundedQuestion({
      question: "What is a fraction?",
      schoolId: "school-1",
      role: "STUDENT",
    }).catch(() => {
      // Ignore downstream errors — we only care that hybridRetrieve was called.
    });

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

// ─── Eval metrics include hybrid breakdown ─────────────────────────────────
describe("Eval metrics include hybrid breakdown", () => {
  it("hybridRetrieveWithMetadata result contains all fields required by HybridRetrievalMetrics", async () => {
    mockRetrieveRelevantChunks.mockResolvedValue([
      makeChunk({ sourceId: "eval-dense", similarity: 0.9 }),
    ]);
    mockPrismaQueryRaw.mockResolvedValue([
      {
        id: "eval-id",
        contentId: "eval-sparse",
        title: "Eval lesson",
        content: "Relevant content.",
        subject: "MATH",
        grade: 7,
        bm25Score: 0.1,
      },
    ]);

    const meta = await hybridRetrieveWithMetadata({
      question: "Test eval question",
      schoolId: "school-1",
      topK: 3,
    });

    // All fields needed to compute HybridRetrievalMetrics are present.
    expect(meta).toHaveProperty("chunks");
    expect(meta).toHaveProperty("denseResults");
    expect(meta).toHaveProperty("sparseResults");
    expect(meta).toHaveProperty("preRerankResults");
    expect(meta).toHaveProperty("rerankEnabled");

    // Dense and sparse results are separate — enabling denseOnly / sparseOnly recall computation.
    expect(meta.denseResults[0].sourceId).toBe("eval-dense");
    expect(meta.sparseResults[0].sourceId).toBe("eval-sparse");
  });
});
