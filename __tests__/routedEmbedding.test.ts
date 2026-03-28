import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEmbeddingsCreate = vi.hoisted(() => vi.fn());
const mockGetOpenAIClientOrThrow = vi.hoisted(() => vi.fn());
const mockRoutedTextCompletion = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ai/openaiClient", () => ({
  getOpenAIClientOrThrow: mockGetOpenAIClientOrThrow,
}));

vi.mock("@/lib/ai/router", () => ({
  routedCompletion: mockRoutedTextCompletion,
}));

import { routedEmbedding } from "@/lib/ai/routedCompletion";

describe("routedEmbedding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOpenAIClientOrThrow.mockReturnValue({
      embeddings: {
        create: mockEmbeddingsCreate,
      },
    });
  });

  it("sanitizes malformed text and calls the embeddings API", async () => {
    mockEmbeddingsCreate.mockResolvedValue({
      data: [{ embedding: [0.1, 0.2, 0.3] }],
    });

    const result = await routedEmbedding({
      input: "  bad\u0000text\uD800  ",
    });

    expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
      model: "text-embedding-3-small",
      input: "badtext�",
    });
    expect(result.embedding).toEqual([0.1, 0.2, 0.3]);
  });

  it("rejects empty embedding input", async () => {
    await expect(routedEmbedding({ input: " \u0000 " })).rejects.toThrow(
      "Cannot generate embedding for empty input"
    );
    expect(mockEmbeddingsCreate).not.toHaveBeenCalled();
  });
});
