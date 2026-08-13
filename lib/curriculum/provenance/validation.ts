import type {
  CurriculumOriginKind,
  CurriculumProvenanceCompleteness,
  CurriculumRevisionKind,
} from "@prisma/client";

export type RevisionLineage = {
  revisionKind: CurriculumRevisionKind;
  originKind: CurriculumOriginKind;
  generatorName?: string | null;
  generatorVersion?: string | null;
  aiProvider?: string | null;
  aiModel?: string | null;
  generatedAt?: Date | null;
  generationCorrelationId?: string | null;
  primaryPromptKey?: string | null;
  primaryPromptVersion?: string | null;
  primaryPromptHash?: string | null;
  authorUserId?: string | null;
  sourceRevisionId?: string | null;
  idempotencyKey?: string | null;
  backfillRunId?: string | null;
  hasImportEvidence?: boolean;
  requestedCompleteness?: CurriculumProvenanceCompleteness;
};

const AI_ORIGINS = new Set<CurriculumOriginKind>([
  "AI_GENERATED",
  "AI_UPGRADED",
]);

function present(value: unknown): boolean {
  return typeof value === "string" ? value.trim().length > 0 : value instanceof Date;
}

function minCompleteness(
  a: CurriculumProvenanceCompleteness,
  b: CurriculumProvenanceCompleteness,
): CurriculumProvenanceCompleteness {
  const rank: Record<CurriculumProvenanceCompleteness, number> = {
    UNVERIFIED: 0,
    PARTIAL: 1,
    VERIFIED: 2,
  };
  return rank[a] <= rank[b] ? a : b;
}

export function evaluateProvenanceCompleteness(
  lineage: RevisionLineage,
): CurriculumProvenanceCompleteness {
  let maximum: CurriculumProvenanceCompleteness;
  if (lineage.originKind === "LEGACY_UNKNOWN") {
    maximum = "UNVERIFIED";
  } else if (AI_ORIGINS.has(lineage.originKind)) {
    maximum = [
      lineage.generatorName,
      lineage.generatorVersion,
      lineage.aiProvider,
      lineage.aiModel,
      lineage.generatedAt,
      lineage.generationCorrelationId,
      lineage.primaryPromptKey,
      lineage.primaryPromptVersion,
      lineage.primaryPromptHash,
    ].every(present)
      ? "VERIFIED"
      : "PARTIAL";
  } else if (lineage.originKind === "DETERMINISTIC_GENERATED") {
    maximum = [
      lineage.generatorName,
      lineage.generatorVersion,
      lineage.generatedAt,
    ].every(present)
      ? "VERIFIED"
      : "PARTIAL";
  } else if (lineage.originKind === "HUMAN_AUTHORED") {
    maximum = present(lineage.authorUserId) ? "VERIFIED" : "PARTIAL";
  } else if (lineage.originKind === "FORKED") {
    maximum =
      present(lineage.authorUserId) && present(lineage.sourceRevisionId)
        ? "VERIFIED"
        : "PARTIAL";
  } else if (lineage.originKind === "IMPORTED") {
    maximum =
      [lineage.generatorName, lineage.generatorVersion].every(present) &&
      lineage.hasImportEvidence === true
        ? "VERIFIED"
        : "PARTIAL";
  } else {
    maximum = "PARTIAL";
  }

  if (lineage.revisionKind === "BACKFILL_SNAPSHOT") {
    if (!present(lineage.backfillRunId) || !present(lineage.idempotencyKey)) {
      throw new Error("Backfill revisions require backfillRunId and idempotencyKey");
    }
  }
  if (lineage.primaryPromptHash && !/^[a-f0-9]{64}$/.test(lineage.primaryPromptHash)) {
    throw new Error("primaryPromptHash must be lowercase SHA-256");
  }
  return lineage.requestedCompleteness
    ? minCompleteness(lineage.requestedCompleteness, maximum)
    : maximum;
}

export function assertAutomatedApprovalAllowed(
  completeness: CurriculumProvenanceCompleteness,
): void {
  if (completeness !== "VERIFIED") {
    throw new Error("Automated approval requires VERIFIED provenance");
  }
}
