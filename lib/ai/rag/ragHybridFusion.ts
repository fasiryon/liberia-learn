/**
 * lib/ai/rag/ragHybridFusion.ts
 *
 * Reciprocal Rank Fusion (RRF) — merges dense vector search results with
 * BM25 sparse search results into a single ranked list without requiring
 * score normalization.
 *
 * RRF formula (Cormack et al., 2009):
 *   rrf_score(d) = Σ_r  1 / (k + rank_r(d) + 1)
 *
 * where k=60 is the smoothing constant and rank_r(d) is the 0-based position
 * of document d in result list r (∞ when absent, contributing 0).
 *
 * Documents present in both lists receive combined scores, naturally surfacing
 * results that are semantically similar AND keyword-relevant.
 */

import type { RetrievedChunk } from "@/lib/ai/rag/retrievalService";

/**
 * Merge two ranked RetrievedChunk lists using Reciprocal Rank Fusion.
 *
 * @param denseResults  Dense vector retrieval results, ranked best-first.
 * @param sparseResults BM25 sparse retrieval results, ranked best-first.
 * @param k             RRF smoothing constant (default 60).
 * @returns All unique documents from both lists, sorted by fused RRF score
 *          descending.  `rankingScore` is set to the RRF score.
 */
export function reciprocalRankFusion(
  denseResults: RetrievedChunk[],
  sparseResults: RetrievedChunk[],
  k: number = 60
): RetrievedChunk[] {
  if (denseResults.length === 0 && sparseResults.length === 0) {
    return [];
  }

  // Build best-rank maps keyed by sourceId (document identity).
  // Multiple dense chunks can share the same sourceId (different chunkIndex);
  // retain the best (lowest) rank for each source document.
  const denseBySource = new Map<string, { rank: number; chunk: RetrievedChunk }>();
  for (let i = 0; i < denseResults.length; i++) {
    const chunk = denseResults[i];
    const existing = denseBySource.get(chunk.sourceId);
    if (!existing || i < existing.rank) {
      denseBySource.set(chunk.sourceId, { rank: i, chunk });
    }
  }

  const sparseBySource = new Map<string, { rank: number; chunk: RetrievedChunk }>();
  for (let i = 0; i < sparseResults.length; i++) {
    const chunk = sparseResults[i];
    const existing = sparseBySource.get(chunk.sourceId);
    if (!existing || i < existing.rank) {
      sparseBySource.set(chunk.sourceId, { rank: i, chunk });
    }
  }

  // Collect all unique source IDs across both result sets.
  const allSourceIds = new Set([...denseBySource.keys(), ...sparseBySource.keys()]);

  const scored: Array<{ rrfScore: number; chunk: RetrievedChunk }> = [];

  for (const sourceId of allSourceIds) {
    const denseEntry = denseBySource.get(sourceId);
    const sparseEntry = sparseBySource.get(sourceId);

    let rrfScore = 0;
    if (denseEntry) {
      rrfScore += 1 / (k + denseEntry.rank + 1);
    }
    if (sparseEntry) {
      rrfScore += 1 / (k + sparseEntry.rank + 1);
    }

    // Prefer the dense chunk as the representative (contains rich chunk-level
    // text from RagChunk ingestion).  Fall back to the sparse chunk when the
    // document only appeared in the BM25 results.
    const representative = denseEntry ?? sparseEntry;
    if (!representative) {
      continue;
    }

    scored.push({ rrfScore, chunk: representative.chunk });
  }

  scored.sort((a, b) => b.rrfScore - a.rrfScore);

  return scored.map(({ chunk, rrfScore }) => ({
    ...chunk,
    rankingScore: rrfScore,
  }));
}
