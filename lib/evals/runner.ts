import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { answerGroundedQuestion } from "@/lib/ai/rag/groundedAnswerService";
import { resolveAllowedMode } from "@/lib/ai/rag/assistantAccess";
import {
  type RetrievalContext,
  type RetrievalContextMode,
} from "@/lib/ai/rag/retrievalService";
import { hybridRetrieveWithMetadata } from "@/lib/ai/rag/hybridRetrieval";
import { isEvalDbLoggingEnabled } from "@/lib/serverFlags";
import { evaluateAnswerMetrics } from "@/lib/evals/answer";
import {
  evaluateRetrievalMetrics,
  getChunkEvalIdentifier,
} from "@/lib/evals/retrieval";
import type {
  EvalAggregateMetrics,
  EvalCase,
  EvalCaseResult,
  EvalRunResult,
  EvalRole,
  HybridRetrievalMetrics,
  HybridAggregateMetrics,
} from "@/lib/evals/types";
import type { RetrievedChunk } from "@/lib/ai/rag/retrievalService";
import { logger } from "@/lib/logger";

export const EVAL_THRESHOLDS = {
  minRecallAt5: 0.6,
  minGroundingScore: 0.5,
  maxFallbackRate: 0.4,
} as const;

type RunEvalOptions = {
  subject?: string;
  grade?: number;
  role?: EvalRole;
  outputDir?: string;
};

function inferContextMode(input: Pick<EvalCase, "role" | "mode">): RetrievalContextMode {
  if (input.role === "ADMIN") {
    return "governance";
  }

  if (input.mode === "policy") {
    return "governance";
  }

  if (input.role === "STUDENT") {
    return "learning";
  }

  if (input.role === "GUARDIAN") {
    return "support";
  }

  return input.mode === "mixed" ? "mixed" : "lesson";
}

function buildEvalContext(evalCase: EvalCase): RetrievalContext {
  return {
    role: evalCase.role,
    mode: inferContextMode(evalCase),
    subject: evalCase.subject ?? null,
    gradeLevel:
      typeof evalCase.grade === "number" ? String(evalCase.grade) : null,
  };
}

function buildEvalAudienceScope(evalCase: EvalCase): {
  allowedSubjects?: string[];
  allowedGrades?: number[];
} {
  if (
    (evalCase.role === "STUDENT" || evalCase.role === "GUARDIAN") &&
    (evalCase.subject || typeof evalCase.grade === "number")
  ) {
    return {
      allowedSubjects: evalCase.subject ? [evalCase.subject] : undefined,
      allowedGrades: typeof evalCase.grade === "number" ? [evalCase.grade] : undefined,
    };
  }

  return {};
}

function aggregateCaseMetrics(caseResults: EvalCaseResult[]): EvalAggregateMetrics {
  const divisor = Math.max(caseResults.length, 1);
  const sum = caseResults.reduce(
    (acc, result) => {
      acc.recallAt5 += result.retrieval.recallAt5;
      acc.precisionAt5 += result.retrieval.precisionAt5;
      acc.mrr += result.retrieval.mrr;
      acc.grounding += result.answer.groundingScore;
      acc.lengthScore += result.answer.lengthScore;
      acc.fallbacks += result.result.hadFallback ? 1 : 0;
      acc.refusals += result.answer.refusalRate > 0 ? 1 : 0;
      return acc;
    },
    {
      recallAt5: 0,
      precisionAt5: 0,
      mrr: 0,
      grounding: 0,
      lengthScore: 0,
      fallbacks: 0,
      refusals: 0,
    }
  );

  return {
    caseCount: caseResults.length,
    avgRecallAt5: sum.recallAt5 / divisor,
    avgPrecisionAt5: sum.precisionAt5 / divisor,
    avgMrr: sum.mrr / divisor,
    avgGrounding: sum.grounding / divisor,
    avgLengthScore: sum.lengthScore / divisor,
    fallbackRate: sum.fallbacks / divisor,
    refusalRate: sum.refusals / divisor,
  };
}

function aggregateHybridMetrics(
  caseResults: EvalCaseResult[]
): HybridAggregateMetrics | undefined {
  const hybridCases = caseResults.filter((r) => r.hybridMetrics != null);
  if (hybridCases.length === 0) {
    return undefined;
  }

  const divisor = hybridCases.length;
  const sum = hybridCases.reduce(
    (acc, r) => {
      const m = r.hybridMetrics!;
      acc.dense += m.denseOnlyRecallAt5;
      acc.sparse += m.sparseOnlyRecallAt5;
      acc.hybrid += m.hybridRecallAt5;
      acc.rerank += m.rerankImprovement;
      return acc;
    },
    { dense: 0, sparse: 0, hybrid: 0, rerank: 0 }
  );

  return {
    avgDenseOnlyRecallAt5: sum.dense / divisor,
    avgSparseOnlyRecallAt5: sum.sparse / divisor,
    avgHybridRecallAt5: sum.hybrid / divisor,
    avgRerankImprovement: sum.rerank / divisor,
  };
}

function evaluateCasePass(result: EvalCaseResult): boolean {
  return (
    result.retrieval.recallAt5 >= EVAL_THRESHOLDS.minRecallAt5 &&
    result.answer.groundingScore >= EVAL_THRESHOLDS.minGroundingScore &&
    Number(result.result.hadFallback) <= Number(result.shouldFallback)
  );
}

function evaluateRunPass(aggregate: EvalAggregateMetrics): boolean {
  return (
    aggregate.avgRecallAt5 >= EVAL_THRESHOLDS.minRecallAt5 &&
    aggregate.avgGrounding >= EVAL_THRESHOLDS.minGroundingScore &&
    aggregate.fallbackRate <= EVAL_THRESHOLDS.maxFallbackRate
  );
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function printFailingClassroomCaseDebug(
  evalCase: Pick<EvalCase, "id" | "mode" | "subject" | "grade">,
  chunks: RetrievedChunk[]
) {
  if (evalCase.mode !== "classroom") {
    return;
  }

  const topChunks = chunks.slice(0, 5).map((chunk) => ({
    id: chunk.sourceLabel ?? chunk.sourceId ?? chunk.id,
    sourceType: chunk.sourceType,
    gradeLevel: chunk.grade,
    rankingScore: Number(chunk.rankingScore.toFixed(3)),
    retrievalTier: chunk.retrievalTier ?? "default",
  }));

  const fallbackTierActivated = chunks.some(
    (chunk) =>
      chunk.retrievalTier != null &&
      chunk.retrievalTier !== "same_grade" &&
      chunk.retrievalTier !== "default"
  );

  logger.info("[EVAL DEBUG] classroom case retrieval miss", {
    evalCaseId: evalCase.id,
    subject: evalCase.subject ?? "n/a",
    grade: evalCase.grade ?? "n/a",
    fallbackTierActivated,
    topChunks,
  });
}

export function printEvalSummary(result: EvalRunResult) {
  const rows = result.cases.map((item) => ({
    id: item.caseId,
    role: item.role,
    mode: item.mode,
    recallAt5: formatPercent(item.retrieval.recallAt5),
    precisionAt5: formatPercent(item.retrieval.precisionAt5),
    grounding: formatPercent(item.answer.groundingScore),
    fallback: item.result.hadFallback ? "yes" : "no",
    passed: item.passed ? "yes" : "no",
  }));

  console.table(rows);
  console.table([
    {
      datasetSize: result.datasetSize,
      avgRecallAt5: formatPercent(result.aggregate.avgRecallAt5),
      avgPrecisionAt5: formatPercent(result.aggregate.avgPrecisionAt5),
      avgMrr: result.aggregate.avgMrr.toFixed(2),
      avgGrounding: formatPercent(result.aggregate.avgGrounding),
      fallbackRate: formatPercent(result.aggregate.fallbackRate),
      refusalRate: formatPercent(result.aggregate.refusalRate),
      passed: result.passed ? "yes" : "no",
    },
  ]);
}

async function persistEvalSummary(result: EvalRunResult) {
  if (!isEvalDbLoggingEnabled()) {
    return;
  }

  const evalRunModel = (prisma as any)?.evalRun;
  const create = evalRunModel?.create;

  if (typeof create !== "function") {
    return;
  }

  await create.call(evalRunModel, {
    data: {
      datasetSize: result.datasetSize,
      avgRecallAt5: result.aggregate.avgRecallAt5,
      avgPrecisionAt5: result.aggregate.avgPrecisionAt5,
      avgGrounding: result.aggregate.avgGrounding,
      fallbackRate: result.aggregate.fallbackRate,
      passed: result.passed,
      resultJson: result,
    },
  });
}

async function persistEvalSummarySafely(result: EvalRunResult) {
  try {
    await persistEvalSummary(result);
  } catch (error) {
    logger.warn("[EVAL_RUNNER][DB_LOGGING_SKIPPED]", { error });
  }
}

function filterCases(cases: EvalCase[], options: RunEvalOptions): EvalCase[] {
  return cases.filter((evalCase) => {
    if (
      options.subject &&
      evalCase.subject?.toUpperCase() !== options.subject.toUpperCase()
    ) {
      return false;
    }

    if (typeof options.grade === "number" && evalCase.grade !== options.grade) {
      return false;
    }

    if (options.role && evalCase.role !== options.role) {
      return false;
    }

    return true;
  });
}

export async function runEvalCases(
  cases: EvalCase[],
  options: RunEvalOptions = {}
): Promise<EvalRunResult> {
  const selectedCases = filterCases(cases, options);
  const caseResults: EvalCaseResult[] = [];

  for (const evalCase of selectedCases) {
    const effectiveMode = resolveAllowedMode(evalCase.role, evalCase.mode);
    if (!effectiveMode) {
      throw new Error(`Unsupported eval role for case ${evalCase.id}`);
    }

    const effectiveCase = {
      ...evalCase,
      mode: effectiveMode,
    };
    const context = buildEvalContext(effectiveCase);
    const audienceScope = buildEvalAudienceScope(effectiveCase);

    // Use the full hybrid pipeline and capture intermediate results for metrics.
    const hybridResult = await hybridRetrieveWithMetadata({
      question: effectiveCase.question,
      schoolId: effectiveCase.schoolId,
      subject: effectiveCase.subject ?? null,
      grade: effectiveCase.grade ?? null,
      allowedSubjects: audienceScope.allowedSubjects,
      allowedGrades: audienceScope.allowedGrades,
      topK: 5,
      mode: effectiveCase.mode,
      context,
    });
    const retrievedChunks = hybridResult.chunks;

    const grounded = await answerGroundedQuestion({
      question: effectiveCase.question,
      schoolId: effectiveCase.schoolId,
      subject: effectiveCase.subject ?? null,
      grade: effectiveCase.grade ?? null,
      allowedSubjects: audienceScope.allowedSubjects,
      allowedGrades: audienceScope.allowedGrades,
      mode: effectiveCase.mode,
      role: effectiveCase.role,
      context,
      chunks: retrievedChunks,
      isEvalRun: true,
    });

    const retrieval = evaluateRetrievalMetrics(
      evalCase.expectedChunkIds ?? [],
      retrievedChunks
    );
    const answer = evaluateAnswerMetrics({
      answer: grounded.answer,
      chunks: retrievedChunks,
      hadFallback: grounded.hadFallback,
    });

    // Compute hybrid pipeline stage metrics for diagnostic comparison.
    const denseOnlyRecallAt5 = evaluateRetrievalMetrics(
      evalCase.expectedChunkIds ?? [],
      hybridResult.denseResults
    ).recallAt5;
    const sparseOnlyRecallAt5 = evaluateRetrievalMetrics(
      evalCase.expectedChunkIds ?? [],
      hybridResult.sparseResults
    ).recallAt5;
    const hybridRecallAt5 = retrieval.recallAt5;
    const preRerankRecallAt5 = evaluateRetrievalMetrics(
      evalCase.expectedChunkIds ?? [],
      hybridResult.preRerankResults
    ).recallAt5;

    const hybridMetrics: HybridRetrievalMetrics = {
      denseOnlyRecallAt5,
      sparseOnlyRecallAt5,
      hybridRecallAt5,
      rerankImprovement: hybridRecallAt5 - preRerankRecallAt5,
    };

    const result: EvalCaseResult = {
      caseId: evalCase.id,
      role: effectiveCase.role,
      mode: effectiveCase.mode,
      schoolId: effectiveCase.schoolId,
      subject: effectiveCase.subject ?? null,
      grade: effectiveCase.grade ?? null,
      question: effectiveCase.question,
      expectedChunkIds: evalCase.expectedChunkIds ?? [],
      expectedKeywords: evalCase.expectedKeywords,
      shouldFallback: evalCase.shouldFallback,
      passed: false,
      retrieval,
      answer,
      result: {
        answer: grounded.answer,
        hadFallback: grounded.hadFallback,
        isWeakGrounding: grounded.isWeakGrounding,
        retrievalWeak: grounded.retrievalWeak,
        sources: grounded.sources,
      },
      retrievedChunkIds: retrievedChunks.map(getChunkEvalIdentifier),
      retrievedChunks: retrievedChunks.map((chunk) => ({
        id: chunk.id,
        sourceId: chunk.sourceId,
        sourceLabel: chunk.sourceLabel,
        sourceType: chunk.sourceType,
        subject: chunk.subject,
        grade: chunk.grade,
        schoolId: chunk.schoolId,
      })),
      hybridMetrics,
    };

    result.passed = evaluateCasePass(result);
    if (!result.passed) {
      printFailingClassroomCaseDebug(effectiveCase, retrievedChunks);
    }
    caseResults.push(result);
  }

  const aggregate = aggregateCaseMetrics(caseResults);
  const hybridAggregate = aggregateHybridMetrics(caseResults);
  const output: EvalRunResult = {
    runAt: new Date().toISOString(),
    datasetSize: caseResults.length,
    filters: {
      subject: options.subject,
      grade: options.grade,
      role: options.role,
    },
    thresholds: EVAL_THRESHOLDS,
    passed: evaluateRunPass(aggregate),
    aggregate,
    cases: caseResults,
    ...(hybridAggregate ? { hybridAggregate } : {}),
  };

  const outputDir = options.outputDir ?? path.join(process.cwd(), "evals", "results");
  await mkdir(outputDir, { recursive: true });
  const timestamp = output.runAt.replace(/[:.]/g, "-");
  await writeFile(
    path.join(outputDir, `${timestamp}.json`),
    JSON.stringify(output, null, 2),
    "utf8"
  );

  await persistEvalSummarySafely(output);

  return output;
}
