import { getOpenAIClientOrThrow } from "@/lib/ai/openaiClient";
import {
  routedCompletion as routedTextCompletion,
  type RouterOptions,
  type RouterResult,
} from "@/lib/ai/router";

const EMBEDDING_MODEL = "text-embedding-3-small";

type RoutedEmbeddingOptions = {
  input: string | string[];
  model?: string;
};

type RoutedEmbeddingResult = {
  model: string;
  embedding: number[] | number[][];
};

function normalizeEmbeddingText(input: string): string {
  const normalized = input.toWellFormed().replace(/\u0000/g, "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    throw new Error("Cannot generate embedding for empty input");
  }
  return normalized;
}

export function routedEmbedding(
  opts: { input: string; model?: string }
): Promise<{ model: string; embedding: number[] }>;
export function routedEmbedding(
  opts: { input: string[]; model?: string }
): Promise<{ model: string; embedding: number[][] }>;
export async function routedEmbedding(
  opts: RoutedEmbeddingOptions
): Promise<RoutedEmbeddingResult> {
  const normalizedInput = Array.isArray(opts.input)
    ? opts.input.map(normalizeEmbeddingText)
    : normalizeEmbeddingText(opts.input);

  const client = getOpenAIClientOrThrow();
  const response = await client.embeddings.create({
    model: opts.model ?? EMBEDDING_MODEL,
    input: normalizedInput,
  });

  if (Array.isArray(normalizedInput)) {
    const embedding = response.data.map((item) => item.embedding);
    if (
      embedding.length !== normalizedInput.length ||
      embedding.some((vector) => !Array.isArray(vector))
    ) {
      throw new Error("Embedding model returned no vectors");
    }

    return {
      model: opts.model ?? EMBEDDING_MODEL,
      embedding,
    };
  }

  const embedding = response.data[0]?.embedding;
  if (!Array.isArray(embedding)) {
    throw new Error("Embedding model returned no vector");
  }

  return {
    model: opts.model ?? EMBEDDING_MODEL,
    embedding,
  };
}

export function routedCompletion(opts: RouterOptions): Promise<RouterResult>;
export async function routedCompletion(
  opts: RouterOptions
): Promise<RouterResult> {
  return routedTextCompletion(opts);
}
