import type { RetrievedChunk } from "@/lib/ai/rag/retrievalService";
import type { RetrievalMetricResult } from "@/lib/evals/types";

type MetadataFilter = {
  subject?: string | null;
  grade?: number | null;
  sourceType?: string | null;
  schoolId?: string | null;
};

type RetrievalIdentifierChunk = Pick<
  RetrievedChunk,
  "id" | "sourceId" | "sourceLabel" | "sourceType" | "subject" | "grade" | "schoolId"
>;

const LEGACY_EXPECTED_ID_ALIASES: Record<string, string[]> = {
  wk_mca7a_mon_p1: [
    "math-g7-equivalent-fractions-foundations",
    "math-g7-comparing-fractions-benchmarks",
  ],
  wk_mca7a_mon_p5: [
    "math-g7-equivalent-fractions-foundations",
    "math-g7-comparing-fractions-benchmarks",
  ],
  wk_mca7a_tue_p1: ["math-g7-adding-fractions-like-denominators"],
  "math-g10-ratio-language-and-rate": ["math-g10-g10-ratio-language-and-rate"],
  "math-g10-proportional-tables-and-graphs": ["math-g10-g10-proportional-tables-and-graphs"],
  "math-g10-solving-proportion-problems": ["math-g10-g10-solving-proportion-problems"],
  "math-g10-exam-style-multi-step-problems": ["math-g10-g10-exam-style-multi-step-problems"],
  "grade3-comprehension-key-details": ["literacy-g3-grade3-comprehension-key-details"],
  "grade3-answering-comprehension-questions": [
    "literacy-g3-grade3-answering-comprehension-questions",
  ],
  "grade6-making-inferences": ["literacy-g6-grade6-making-inferences"],
  "grade6-inference-with-evidence": ["literacy-g6-grade6-inference-with-evidence"],
  "finding-main-idea": ["literacy-g6-finding-main-idea"],
  "writing-short-summaries": ["literacy-g6-writing-short-summaries"],
  "science-g5-plants": ["science-g5-photosynthesis-food-making"],
};

function normalizeText(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function normalizeSubject(value: string | null | undefined): string {
  return value?.trim().toUpperCase() ?? "";
}

function normalizeSourceType(value: string | null | undefined): string {
  const sourceType = normalizeText(value);

  if (sourceType.includes("curriculum")) {
    return "curriculum";
  }

  if (sourceType.includes("lesson") || sourceType.includes("assignment")) {
    return "lesson";
  }

  if (sourceType.includes("standard") || sourceType.includes("moe")) {
    return "standard";
  }

  if (
    sourceType.includes("policy") ||
    sourceType.includes("governance") ||
    sourceType.includes("adr")
  ) {
    return "policy";
  }

  return sourceType;
}

function expandExpectedIdentifier(identifier: string): string[] {
  const normalized = normalizeText(identifier);
  if (!normalized) {
    return [];
  }

  return Array.from(
    new Set([normalized, ...(LEGACY_EXPECTED_ID_ALIASES[normalized] ?? []).map(normalizeText)])
  );
}

function buildExpectedIdentifierGroups(expectedIds: string[]): string[][] {
  const uniqueGroups = new Map<string, string[]>();

  for (const expectedId of expectedIds) {
    const group = expandExpectedIdentifier(expectedId);
    if (group.length === 0) {
      continue;
    }

    const key = group.join("|");
    if (!uniqueGroups.has(key)) {
      uniqueGroups.set(key, group);
    }
  }

  return Array.from(uniqueGroups.values());
}

function buildExpectedIdentifierSet(expectedIds: string[]): Set<string> {
  return new Set(buildExpectedIdentifierGroups(expectedIds).flat());
}

function countMatchedExpectedGroups(expectedIds: string[], retrievedIds: string[]): number {
  const retrieved = new Set(retrievedIds.map(normalizeText).filter(Boolean));
  return buildExpectedIdentifierGroups(expectedIds).filter((group) =>
    group.some((identifier) => retrieved.has(identifier))
  ).length;
}

function dedupeRetrievedIds(retrievedIds: string[], k?: number): string[] {
  const unique: string[] = [];
  const seen = new Set<string>();

  for (const id of retrievedIds.map(normalizeText).filter(Boolean)) {
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    unique.push(id);
    if (typeof k === "number" && unique.length >= k) {
      break;
    }
  }

  return unique;
}

export function getChunkEvalIdentifier(chunk: RetrievalIdentifierChunk): string {
  const sourceType = normalizeSourceType(chunk.sourceType);
  if (sourceType === "curriculum" && chunk.sourceLabel?.trim()) {
    return chunk.sourceLabel.trim();
  }

  return chunk.sourceId?.trim() || chunk.sourceLabel?.trim() || chunk.id;
}

export function filterRetrievedChunksByMetadata(
  chunks: RetrievalIdentifierChunk[],
  filter: MetadataFilter
): RetrievalIdentifierChunk[] {
  return chunks.filter((chunk) => {
    if (filter.schoolId && chunk.schoolId !== filter.schoolId) {
      return false;
    }

    if (filter.subject && normalizeSubject(chunk.subject) !== normalizeSubject(filter.subject)) {
      return false;
    }

    if (typeof filter.grade === "number" && chunk.grade !== filter.grade) {
      return false;
    }

    if (
      filter.sourceType &&
      normalizeSourceType(chunk.sourceType) !== normalizeSourceType(filter.sourceType)
    ) {
      return false;
    }

    return true;
  });
}

export function computeRecallAtK(
  expectedIds: string[],
  retrievedIds: string[],
  k = 5
): number {
  const expectedGroups = buildExpectedIdentifierGroups(expectedIds);
  if (expectedGroups.length === 0) {
    return 1;
  }

  const topK = dedupeRetrievedIds(retrievedIds, k);
  const matched = countMatchedExpectedGroups(expectedIds, topK);
  return Math.min(1, matched / expectedGroups.length);
}

export const recallAtK = computeRecallAtK;

export function computePrecisionAtK(
  expectedIds: string[],
  retrievedIds: string[],
  k = 5
): number {
  const topK = dedupeRetrievedIds(retrievedIds, k);
  if (topK.length === 0) {
    return expectedIds.length === 0 ? 1 : 0;
  }

  const expected = buildExpectedIdentifierSet(expectedIds);
  const matched = topK.filter((id) => expected.has(id)).length;
  return matched / topK.length;
}

export const precisionAtK = computePrecisionAtK;

export function computeMrr(expectedIds: string[], retrievedIds: string[]): number {
  const expected = buildExpectedIdentifierSet(expectedIds);
  if (expected.size === 0) {
    return 1;
  }

  const index = dedupeRetrievedIds(retrievedIds)
    .findIndex((identifier) => expected.has(identifier));

  return index === -1 ? 0 : 1 / (index + 1);
}

export const meanReciprocalRank = computeMrr;

export function evaluateRetrievalMetrics(
  expectedIds: string[],
  retrievedChunks: RetrievalIdentifierChunk[],
  k = 5
): RetrievalMetricResult {
  const retrievedIds = retrievedChunks.map(getChunkEvalIdentifier);
  const dedupedTopK = dedupeRetrievedIds(retrievedIds, k);
  const relevantRetrievedCount = countMatchedExpectedGroups(expectedIds, dedupedTopK);

  return {
    recallAt5: computeRecallAtK(expectedIds, retrievedIds, k),
    precisionAt5: computePrecisionAtK(expectedIds, retrievedIds, k),
    mrr: computeMrr(expectedIds, retrievedIds),
    relevantRetrievedCount,
    retrievedCount: dedupedTopK.length,
  };
}
