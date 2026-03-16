import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetLessonEmbeddingSource = vi.hoisted(() => vi.fn());
const mockSaveLessonEmbedding = vi.hoisted(() => vi.fn());
const mockRoutedCompletion = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ai/rag/embeddingService", () => ({
  getLessonEmbeddingSource: mockGetLessonEmbeddingSource,
  saveLessonEmbedding: mockSaveLessonEmbedding,
}));

vi.mock("@/lib/ai/routedCompletion", () => ({
  routedCompletion: mockRoutedCompletion,
}));

import { handleGenerateEmbeddingsJob } from "@/worker/handlers/embeddings";

describe("handleGenerateEmbeddingsJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLessonEmbeddingSource.mockResolvedValue("lesson text");
    mockRoutedCompletion.mockResolvedValue({
      mode: "embedding",
      model: "text-embedding-3-small",
      embedding: [0.1, 0.2, 0.3],
    });
    mockSaveLessonEmbedding.mockResolvedValue(undefined);
  });

  it("uses routedCompletion and persists the embedding", async () => {
    await handleGenerateEmbeddingsJob({ lessonId: "lesson-1" });

    expect(mockRoutedCompletion).toHaveBeenCalledWith({
      mode: "embedding",
      input: "lesson text",
    });
    expect(mockSaveLessonEmbedding).toHaveBeenCalledWith("lesson-1", [0.1, 0.2, 0.3]);
  });
});
