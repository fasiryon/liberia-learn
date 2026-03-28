import type { GroundedAnswerResult } from "@/lib/ai/rag/groundedAnswerService";
import type { RetrievedChunk } from "@/lib/ai/rag/retrievalService";
import type { AnswerMetricResult } from "@/lib/evals/types";

type LengthRange = {
  min: number;
  max: number;
};

const DEFAULT_LENGTH_RANGE: LengthRange = {
  min: 120,
  max: 900,
};

const REFUSAL_PATTERNS = [
  "i could not find enough approved liberialearn content",
  "i cannot answer that confidently",
  "i can't answer that confidently",
  "not enough approved liberialearn content",
  "i do not have enough grounded information",
  "unable to answer",
];

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSentences(value: string): string[] {
  return value
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function toTokenSet(value: string): Set<string> {
  return new Set(
    normalizeText(value)
      .split(" ")
      .map((token) => token.trim())
      .filter((token) => token.length >= 3)
  );
}

export function computeGroundingScore(
  answer: string,
  chunks: Array<Pick<RetrievedChunk, "content" | "title">>
): number {
  const sentences = splitSentences(answer);
  if (sentences.length === 0) {
    return 0;
  }

  const chunkTokenSets = chunks.map((chunk) =>
    toTokenSet(`${chunk.title} ${chunk.content}`)
  );

  const groundedSentenceCount = sentences.filter((sentence) => {
    const sentenceTokens = toTokenSet(sentence);
    if (sentenceTokens.size === 0) {
      return false;
    }

    return chunkTokenSets.some((chunkTokens) => {
      let overlapCount = 0;

      for (const token of sentenceTokens) {
        if (chunkTokens.has(token)) {
          overlapCount += 1;
        }
      }

      return (
        overlapCount >= 3 ||
        overlapCount / Math.max(sentenceTokens.size, 1) >= 0.35
      );
    });
  }).length;

  return groundedSentenceCount / sentences.length;
}

export const groundingScore = computeGroundingScore;

export function computeFallbackRate(
  results: Array<Pick<GroundedAnswerResult, "hadFallback">>
): number {
  if (results.length === 0) {
    return 0;
  }

  const fallbackCount = results.filter((result) => result.hadFallback).length;
  return fallbackCount / results.length;
}

export const fallbackRate = computeFallbackRate;

export function computeRefusalRate(
  results: Array<Pick<GroundedAnswerResult, "answer" | "hadFallback">>
): number {
  if (results.length === 0) {
    return 0;
  }

  const refusalCount = results.filter((result) => {
    const normalized = normalizeText(result.answer);
    return (
      result.hadFallback ||
      REFUSAL_PATTERNS.some((pattern) => normalized.includes(pattern))
    );
  }).length;

  return refusalCount / results.length;
}

export const refusalRate = computeRefusalRate;

export function computeLengthScore(
  answer: string,
  range: LengthRange = DEFAULT_LENGTH_RANGE
): number {
  const length = answer.trim().length;
  if (length === 0) {
    return 0;
  }

  if (length >= range.min && length <= range.max) {
    return 1;
  }

  if (length < range.min) {
    return Math.max(0, length / range.min);
  }

  return Math.max(0, range.max / length);
}

export const lengthScore = computeLengthScore;

export function evaluateAnswerMetrics(input: {
  answer: string;
  chunks: Array<Pick<RetrievedChunk, "content" | "title">>;
  hadFallback: boolean;
  expectedLengthRange?: LengthRange;
}): AnswerMetricResult {
  const singleResult = [
    {
      answer: input.answer,
      hadFallback: input.hadFallback,
    },
  ];

  return {
    groundingScore: computeGroundingScore(input.answer, input.chunks),
    fallbackRate: computeFallbackRate(singleResult),
    refusalRate: computeRefusalRate(singleResult),
    lengthScore: computeLengthScore(input.answer, input.expectedLengthRange),
  };
}
