import type { GroundedAnswerResult } from "@/lib/ai/rag/groundedAnswerService";
import type { RetrievedChunk, RetrievalMode } from "@/lib/ai/rag/retrievalService";
import type { Role } from "@prisma/client";

export type EvalRole = Extract<
  Role,
  "TEACHER" | "ADMIN" | "STUDENT" | "GUARDIAN"
>;

export type EvalCase = {
  id: string;
  question: string;
  role: EvalRole;
  mode: RetrievalMode;
  subject?: string;
  grade?: number;
  schoolId: string;
  expectedChunkIds?: string[];
  expectedKeywords: string[];
  shouldFallback: boolean;
};

export type RetrievalMetricResult = {
  recallAt5: number;
  precisionAt5: number;
  mrr: number;
  relevantRetrievedCount: number;
  retrievedCount: number;
};

export type RetrievalEvalResult = RetrievalMetricResult;

export type AnswerMetricResult = {
  groundingScore: number;
  fallbackRate: number;
  refusalRate: number;
  lengthScore: number;
};

export type AnswerEvalResult = AnswerMetricResult;

export type EvalCaseResult = {
  caseId: string;
  role: EvalRole;
  mode: RetrievalMode;
  schoolId: string;
  subject: string | null;
  grade: number | null;
  question: string;
  expectedChunkIds: string[];
  expectedKeywords: string[];
  shouldFallback: boolean;
  passed: boolean;
  retrieval: RetrievalMetricResult;
  answer: AnswerMetricResult;
  result: Pick<
    GroundedAnswerResult,
    "answer" | "hadFallback" | "isWeakGrounding" | "retrievalWeak" | "sources"
  >;
  retrievedChunkIds: string[];
  retrievedChunks: Array<
    Pick<
      RetrievedChunk,
      "id" | "sourceId" | "sourceLabel" | "sourceType" | "subject" | "grade" | "schoolId"
    >
  >;
  /** Present when the hybrid pipeline ran with metadata collection. */
  hybridMetrics?: HybridRetrievalMetrics;
};

export type EvalAggregateMetrics = {
  caseCount: number;
  avgRecallAt5: number;
  avgPrecisionAt5: number;
  avgMrr: number;
  avgGrounding: number;
  avgLengthScore: number;
  fallbackRate: number;
  refusalRate: number;
};

export type EvalRunResult = {
  runAt: string;
  datasetSize: number;
  filters: {
    subject?: string;
    grade?: number;
    role?: EvalRole;
  };
  thresholds: {
    minRecallAt5: number;
    minGroundingScore: number;
    maxFallbackRate: number;
  };
  passed: boolean;
  aggregate: EvalAggregateMetrics;
  cases: EvalCaseResult[];
  /** Hybrid pipeline stage comparison (present when cases include hybridMetrics). */
  hybridAggregate?: HybridAggregateMetrics;
};

export type EvalRunSummary = EvalRunResult;

/** Per-case comparison of retrieval quality across pipeline stages. */
export type HybridRetrievalMetrics = {
  /** Recall@5 using dense vector retrieval only. */
  denseOnlyRecallAt5: number;
  /** Recall@5 using BM25 sparse retrieval only. */
  sparseOnlyRecallAt5: number;
  /** Recall@5 after RRF + Cohere rerank (the full hybrid pipeline). */
  hybridRecallAt5: number;
  /**
   * Delta: hybridRecallAt5 − pre-rerank recall@5.
   * Positive values indicate the Cohere reranker improved result ordering.
   */
  rerankImprovement: number;
};

/** Aggregate hybrid metrics across all eval cases. */
export type HybridAggregateMetrics = {
  avgDenseOnlyRecallAt5: number;
  avgSparseOnlyRecallAt5: number;
  avgHybridRecallAt5: number;
  avgRerankImprovement: number;
};
