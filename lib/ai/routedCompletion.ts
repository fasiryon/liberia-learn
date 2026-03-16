import { getOpenAIClientOrThrow } from "@/lib/ai/openaiClient";
import {
  routedCompletion as routedTextCompletion,
  type RouterOptions,
  type RouterResult,
} from "@/lib/ai/router";

const EMBEDDING_MODEL = "text-embedding-3-small";

type RoutedEmbeddingOptions = {
  mode: "embedding";
  input: string;
  model?: string;
};

type RoutedEmbeddingResult = {
  mode: "embedding";
  model: string;
  embedding: number[];
};

export function routedCompletion(opts: RoutedEmbeddingOptions): Promise<RoutedEmbeddingResult>;
export function routedCompletion(opts: RouterOptions): Promise<RouterResult>;
export async function routedCompletion(
  opts: RoutedEmbeddingOptions | RouterOptions
): Promise<RoutedEmbeddingResult | RouterResult> {
  if ("mode" in opts && opts.mode === "embedding") {
    const input = opts.input.trim();
    if (!input) {
      throw new Error("Cannot generate embedding for empty input");
    }

    const client = getOpenAIClientOrThrow();
    const response = await client.embeddings.create({
      model: opts.model ?? EMBEDDING_MODEL,
      input,
    });
    const embedding = response.data[0]?.embedding;
    if (!Array.isArray(embedding)) {
      throw new Error("Embedding model returned no vector");
    }

    return {
      mode: "embedding",
      model: opts.model ?? EMBEDDING_MODEL,
      embedding,
    };
  }

  return routedTextCompletion(opts as RouterOptions);
}
