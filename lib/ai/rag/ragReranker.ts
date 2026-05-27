/**
 * lib/ai/rag/ragReranker.ts
 *
 * Cross-encoder reranking via the Cohere Rerank API (rerank-english-v3.0).
 *
 * Degrades gracefully when COHERE_API_KEY is not configured: logs a warning
 * and returns the fusion-ordered slice — never throws.
 *
 * Free tier: 10 K reranks / month — sufficient for a pilot school deployment.
 */

// Static import so vitest's vi.mock("cohere-ai") intercepts it reliably.
import { CohereClient } from "cohere-ai";
import type { RetrievedChunk } from "@/lib/ai/rag/retrievalService";

/** Extract a text preview from a chunk for the Cohere ranking model. */
function extractBodyPreview(chunk: RetrievedChunk): string {
  return chunk.content.slice(0, 512).trim();
}

/**
 * Rerank `chunks` using the Cohere cross-encoder model.
 *
 * Each document submitted to Cohere is `"<title> <body preview>"`.
 * On success the returned array is ordered by `relevanceScore` descending
 * with `rankingScore` set to the Cohere score.
 *
 * If COHERE_API_KEY is unset **or** the API call fails, the function
 * falls back silently to `chunks.slice(0, topN)` (RRF order).
 *
 * @param query  The user's original question.
 * @param chunks Candidates to rerank (typically top-10 from RRF fusion).
 * @param topN   Number of chunks to return after reranking (default 5).
 */
export async function rerankChunks(
  query: string,
  chunks: RetrievedChunk[],
  topN: number = 5
): Promise<RetrievedChunk[]> {
  if (chunks.length === 0) {
    return [];
  }
  if (chunks.length <= 1) {
    return chunks.slice(0, topN);
  }

  const apiKey = process.env.COHERE_API_KEY;
  if (!apiKey) {
    console.warn(
      "[RAG_RERANKER] COHERE_API_KEY not set — skipping Cohere rerank, returning hybrid fusion order"
    );
    return chunks.slice(0, topN);
  }

  try {
    const cohere = new CohereClient({ token: apiKey });

    const documents: string[] = chunks.map(
      (c) => `${c.title} ${extractBodyPreview(c)}`
    );

    const response = await cohere.rerank({
      model: "rerank-english-v3.0",
      query,
      documents,
      topN,
      returnDocuments: false,
    });

    const results = response.results ?? [];
    if (results.length === 0) {
      return chunks.slice(0, topN);
    }

    return results.map((result) => ({
      ...chunks[result.index],
      rankingScore: result.relevanceScore,
    }));
  } catch (error) {
    console.error("[RAG_RERANKER] Cohere rerank failed — returning fusion order", { error });
    return chunks.slice(0, topN);
  }
}
