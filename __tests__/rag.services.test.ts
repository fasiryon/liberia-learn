import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEmbeddingsCreate = vi.hoisted(() => vi.fn());
const mockGetOpenAIClientOrThrow = vi.hoisted(() => vi.fn());
const mockCurriculumFindUnique = vi.hoisted(() => vi.fn());
const mockStudentFindUnique = vi.hoisted(() => vi.fn());
const mockExecuteRaw = vi.hoisted(() => vi.fn());
const mockQueryRaw = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ai/openaiClient", () => ({
  getOpenAIClientOrThrow: mockGetOpenAIClientOrThrow,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    curriculumContent: {
      findUnique: mockCurriculumFindUnique,
    },
    student: {
      findUnique: mockStudentFindUnique,
    },
    $executeRaw: mockExecuteRaw,
    $queryRaw: mockQueryRaw,
  },
}));

import { embedLesson, embedText } from "@/lib/ai/rag/embeddingService";
import { retrieveRelevantLessons } from "@/lib/ai/rag/retrievalService";

describe("embeddingService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOpenAIClientOrThrow.mockReturnValue({
      embeddings: {
        create: mockEmbeddingsCreate,
      },
    });
  });

  it("embedText returns array of 1536 numbers", async () => {
    const vector = Array.from({ length: 1536 }, (_, index) => index / 1000);
    mockEmbeddingsCreate.mockResolvedValue({
      data: [{ embedding: vector }],
    });

    const result = await embedText("fractions lesson content");

    expect(result).toHaveLength(1536);
    expect(result[0]).toBe(0);
    expect(result[1535]).toBe(1.535);
  });

  it("embedLesson stores embedding on content record", async () => {
    mockCurriculumFindUnique.mockResolvedValue({
      id: "content-1",
      subject: "MATH",
      payload: { title: "Fractions", body: "Lesson body" },
    });
    mockEmbeddingsCreate.mockResolvedValue({
      data: [{ embedding: Array.from({ length: 1536 }, () => 0.1) }],
    });
    mockExecuteRaw.mockResolvedValue(1);

    await embedLesson("content-1");

    expect(mockExecuteRaw).toHaveBeenCalledOnce();
  });
});

describe("retrievalService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEmbeddingsCreate.mockResolvedValue({
      data: [{ embedding: Array.from({ length: 1536 }, () => 0.2) }],
    });
    mockGetOpenAIClientOrThrow.mockReturnValue({
      embeddings: {
        create: mockEmbeddingsCreate,
      },
    });
  });

  it("retrieveRelevantLessons returns empty array gracefully when no embeddings exist", async () => {
    mockStudentFindUnique.mockResolvedValue({
      currentGrade: 5,
      enrollments: [{ Class: { subject: "MATH" } }],
    });
    mockQueryRaw.mockResolvedValue([]);

    const result = await retrieveRelevantLessons("What are fractions?", "student-1");

    expect(result).toEqual([]);
  });

  it("retrieval scopes to student grade level", async () => {
    mockStudentFindUnique.mockResolvedValue({
      currentGrade: 6,
      enrollments: [{ Class: { subject: "SCIENCE" } }],
    });
    mockQueryRaw.mockResolvedValue([
      {
        id: "lesson-1",
        title: "Matter",
        content: "Matter has mass and occupies space.",
        subject: "SCIENCE",
        gradeLevel: 6,
        similarity: 0.93,
      },
    ]);

    const result = await retrieveRelevantLessons("What is matter?", "student-1");

    expect(result[0].gradeLevel).toBe(6);
    const sqlArg = mockQueryRaw.mock.calls[0][0] as any;
    expect(sqlArg.values).toContain(6);
  });
});
