/**
 * lib/ai/rag/hybridRetrieval.ts
 *
 * Full hybrid RAG retrieval pipeline:
 *
 *   Step 1 — Dense:   pgvector cosine similarity over RagChunk embeddings
 *   Step 2 — Sparse:  PostgreSQL ts_rank BM25 over CurriculumContent (GIN index)
 *   Step 3 — Fusion:  Reciprocal Rank Fusion (k=60) merges both ranked lists
 *   Step 4 — Rerank:  Cohere cross-encoder reranks top-10 fusion results
 *
 * Callers replace direct `retrieveRelevantChunks` calls with `hybridRetrieve`.
 * Use `hybridRetrieveWithMetadata` in eval pipelines to get intermediate results
 * for diagnostic metrics (dense-only / sparse-only / pre-rerank recall).
 */

import {
  retrieveRelevantChunks,
  type RetrievedChunk,
  type RetrievalMode,
  type RetrievalContext,
} from "@/lib/ai/rag/retrievalService";
import { sparseRetrieve } from "@/lib/ai/rag/sparseRetrieval";
import { reciprocalRankFusion } from "@/lib/ai/rag/ragHybridFusion";
import { rerankChunks } from "@/lib/ai/rag/ragReranker";

/** Input shape — intentionally compatible with ChunkQueryInput in retrievalService. */
export type HybridQueryInput = {
  question: string;
  schoolId: string;
  subject?: string | null;
  grade?: number | null;
  allowedSubjects?: string[] | null;
  allowedGrades?: number[] | null;
  topK?: number;
  limit?: number;
  sourceTypes?: string[];
  mode?: RetrievalMode;
  context?: RetrievalContext;
};

/** Full result including intermediate retrieval stages — for eval diagnostics. */
export type HybridRetrieveMetadata = {
  /** Final output after RRF + rerank. */
  chunks: RetrievedChunk[];
  /** Dense vector retrieval results (top 20). */
  denseResults: RetrievedChunk[];
  /** BM25 sparse retrieval results (top 20). */
  sparseResults: RetrievedChunk[];
  /** Top-10 fusion results before Cohere rerank. */
  preRerankResults: RetrievedChunk[];
  /** Whether Cohere reranking was applied. */
  rerankEnabled: boolean;
};

/** Number of candidates to fetch from each retriever before fusion. */
const HYBRID_FETCH_K = 20;
/** RRF smoothing constant. */
const RRF_K = 60;
/** How many fusion results to feed into the Cohere reranker. */
const RERANK_CANDIDATES = 10;

/**
 * Hybrid retrieval pipeline: dense + sparse → RRF fusion → Cohere rerank.
 *
 * Drop-in replacement for `retrieveRelevantChunks` — returns the same type,
 * accepts the same input shape, and honours the same `topK` cap.
 */
export async function hybridRetrieve(
  input: HybridQueryInput
): Promise<RetrievedChunk[]> {
  const result = await hybridRetrieveWithMetadata(input);
  return result.chunks;
}

/**
 * Same pipeline as `hybridRetrieve`, but also returns intermediate results for
 * eval metrics: dense-only, sparse-only, and pre-rerank recall can be computed
 * from the returned `denseResults`, `sparseResults`, and `preRerankResults`.
 */
export async function hybridRetrieveWithMetadata(
  input: HybridQueryInput
): Promise<HybridRetrieveMetadata> {
  const trimmedQuestion = input.question.trim();
  const rerankEnabled = !!process.env.COHERE_API_KEY;
  const emptyResult: HybridRetrieveMetadata = {
    chunks: [],
    denseResults: [],
    sparseResults: [],
    preRerankResults: [],
    rerankEnabled,
  };

  if (!trimmedQuestion || !input.schoolId) {
    return emptyResult;
  }

  const effectiveTopK = Math.max(1, Math.min(input.topK ?? input.limit ?? 5, 8));

  // Step 1: Run dense and sparse retrievers in parallel.
  const [denseResults, sparseResults] = await Promise.all([
    retrieveRelevantChunks({
      question: trimmedQuestion,
      schoolId: input.schoolId,
      subject: input.subject,
      grade: input.grade,
      allowedSubjects: input.allowedSubjects,
      allowedGrades: input.allowedGrades,
      topK: HYBRID_FETCH_K,
      sourceTypes: input.sourceTypes,
      mode: input.mode,
      context: input.context,
    }),
    sparseRetrieve(
      trimmedQuestion,
      {
        subject: input.subject,
        gradeLevel: input.grade,
        schoolId: input.schoolId,
      },
      HYBRID_FETCH_K
    ),
  ]);

  // Step 2: Merge both ranked lists with RRF.
  const fusedResults = reciprocalRankFusion(denseResults, sparseResults, RRF_K);
  const preRerankResults = fusedResults.slice(0, RERANK_CANDIDATES);

  // Step 3: Cohere cross-encoder rerank.
  const chunks = await rerankChunks(trimmedQuestion, preRerankResults, effectiveTopK);

  console.info("[RAG_HYBRID] Retrieval complete", {
    retrievalMethod: "hybrid-rrf-rerank",
    denseCount: denseResults.length,
    sparseCount: sparseResults.length,
    fusedCount: fusedResults.length,
    rerankEnabled,
    topK: effectiveTopK,
  });

  return {
    chunks,
    denseResults,
    sparseResults,
    preRerankResults,
    rerankEnabled,
  };
}
