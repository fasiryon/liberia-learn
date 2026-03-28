import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetLessonEmbeddingSource = vi.hoisted(() => vi.fn());
const mockSaveLessonEmbedding = vi.hoisted(() => vi.fn());
const mockSyncCurriculumContentRagChunks = vi.hoisted(() => vi.fn());
const mockRoutedEmbedding = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ai/rag/embeddingService", () => ({
  getLessonEmbeddingSource: mockGetLessonEmbeddingSource,
  saveLessonEmbedding: mockSaveLessonEmbedding,
}));

vi.mock("@/lib/ai/rag/ragIngestionService", () => ({
  syncCurriculumContentRagChunks: mockSyncCurriculumContentRagChunks,
}));

vi.mock("@/lib/ai/routedCompletion", () => ({
  routedEmbedding: mockRoutedEmbedding,
}));

import { handleGenerateEmbeddingsJob } from "@/worker/handlers/embeddings";

describe("handleGenerateEmbeddingsJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLessonEmbeddingSource.mockResolvedValue("lesson text");
    mockRoutedEmbedding.mockResolvedValue({
      model: "text-embedding-3-small",
      embedding: [0.1, 0.2, 0.3],
    });
    mockSaveLessonEmbedding.mockResolvedValue(undefined);
    mockSyncCurriculumContentRagChunks.mockResolvedValue(undefined);
  });

  it("uses routedEmbedding, persists the embedding, and syncs RAG chunks", async () => {
    await handleGenerateEmbeddingsJob({ lessonId: "lesson-1" });

    expect(mockRoutedEmbedding).toHaveBeenCalledWith({
      input: "lesson text",
    });
    expect(mockSaveLessonEmbedding).toHaveBeenCalledWith("lesson-1", [0.1, 0.2, 0.3]);
    expect(mockSyncCurriculumContentRagChunks).toHaveBeenCalledWith("lesson-1");
  });
});
