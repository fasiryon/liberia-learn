import {
  Prisma,
  type CurriculumContent,
  type CurriculumContentRevision,
  type CurriculumLifecycleState,
  type CurriculumProvenance,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { logAuditRequired } from "@/lib/audit";
import {
  buildCurriculumContentSnapshotV1,
  CURRICULUM_SNAPSHOT_SCHEMA_VERSION,
  validateCurriculumContentSnapshotV1,
} from "@/lib/curriculum/provenance/snapshot";
import { hashCurriculumSnapshot } from "@/lib/curriculum/provenance/hash";
import {
  evaluateProvenanceCompleteness,
  type RevisionLineage,
} from "@/lib/curriculum/provenance/validation";

export type CurriculumTransaction = Prisma.TransactionClient;

export type GovernedWriteResult = {
  content: CurriculumContent;
  provenance: CurriculumProvenance | null;
  revision: CurriculumContentRevision | null;
};

export type GovernedMutationContext = RevisionLineage & {
  actorUserId?: string | null;
  actorLabel?: string | null;
  auditAction: string;
  auditDetails?: Record<string, unknown>;
  schoolId?: string | null;
  traceId?: string | null;
};

export function provenanceWritersEnabled(): boolean {
  return process.env.P2A_PROVENANCE_WRITERS_DISABLED?.trim().toLowerCase() === "false";
}

function scalarString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "set" in value) {
    const set = (value as { set?: unknown }).set;
    return typeof set === "string" ? set : null;
  }
  return null;
}

function assertContentWriteIsNonAuthoritative(
  data: { status?: unknown; editReviewStatus?: unknown; publishedAt?: unknown },
): void {
  const status = scalarString(data.status)?.trim().toUpperCase();
  const editReviewStatus = scalarString(data.editReviewStatus)?.trim().toUpperCase();
  const publishes = status === "PUBLISHED" || status === "APPROVED";
  const approvesEdit = editReviewStatus === "APPROVED";
  const stampsPublication = data.publishedAt !== undefined && data.publishedAt !== null;
  if (publishes || approvesEdit || stampsPublication) {
    throw new Error(
      "P2A_COMPATIBILITY_AUTHORITY_REQUIRED: authoritative curriculum state must be written through governance",
    );
  }
}

function lifecycleFromLegacyStatus(status: string): CurriculumLifecycleState {
  switch (status.trim().toUpperCase()) {
    case "PUBLISHED":
    case "APPROVED":
      return "APPROVED";
    case "REJECTED":
      return "REJECTED";
    case "NEEDS_REVIEW":
    case "PENDING_REVIEW":
      return "PENDING_REVIEW";
    default:
      return "DRAFT";
  }
}

function auditEntry(
  content: CurriculumContent,
  context: GovernedMutationContext,
  revisionId: string,
) {
  return {
    userId: context.actorUserId ?? null,
    action: context.auditAction,
    resourceType: "curriculum",
    resourceId: content.contentId,
    schoolId: context.schoolId ?? content.schoolId ?? null,
    traceId: context.traceId ?? null,
    details: {
      revisionId,
      revisionKind: context.revisionKind,
      originKind: context.originKind,
      ...(context.actorLabel ? { actorLabel: context.actorLabel } : {}),
      ...(context.auditDetails ?? {}),
    },
  };
}

async function lockContent(tx: CurriculumTransaction, id: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "CurriculumContent" WHERE "id" = ${id} FOR UPDATE`;
}

export async function lockCurriculumContent(
  tx: CurriculumTransaction,
  id: string,
): Promise<void> {
  await lockContent(tx, id);
}

export async function updateCurriculumGovernanceProjection(
  tx: CurriculumTransaction,
  where: string | Prisma.CurriculumContentWhereUniqueInput,
  data: Pick<
    Prisma.CurriculumContentUncheckedUpdateInput,
    "status" | "payload" | "publishedAt" | "rejectionReason" | "editReviewStatus"
  >,
): Promise<CurriculumContent> {
  return tx.curriculumContent.update({
    where: typeof where === "string" ? { id: where } : where,
    data,
  });
}

export async function updateCurriculumReleaseProjectionMany(
  tx: CurriculumTransaction,
  where: Prisma.CurriculumContentWhereInput,
  data: Pick<Prisma.CurriculumContentUncheckedUpdateManyInput, "versionId" | "status">,
): Promise<{ count: number }> {
  return tx.curriculumContent.updateMany({ where, data });
}

async function createRevision(
  tx: CurriculumTransaction,
  content: CurriculumContent,
  provenance: CurriculumProvenance,
  sequence: number,
  context: GovernedMutationContext,
  defaultSourceRevisionId: string | null,
): Promise<CurriculumContentRevision> {
  const snapshot = buildCurriculumContentSnapshotV1(content);
  validateCurriculumContentSnapshotV1(snapshot);
  const contentHash = hashCurriculumSnapshot(CURRICULUM_SNAPSHOT_SCHEMA_VERSION, snapshot);
  const completeness = evaluateProvenanceCompleteness({
    ...context,
    sourceRevisionId: context.sourceRevisionId ?? defaultSourceRevisionId,
  });
  const revision = await tx.curriculumContentRevision.create({
    data: {
      provenanceId: provenance.id,
      sequence,
      revisionKind: context.revisionKind,
      originKind: context.originKind,
      snapshotSchemaVersion: CURRICULUM_SNAPSHOT_SCHEMA_VERSION,
      contentSnapshot: snapshot as unknown as Prisma.InputJsonValue,
      contentHash,
      generatorName: context.generatorName ?? null,
      generatorVersion: context.generatorVersion ?? null,
      aiProvider: context.aiProvider ?? null,
      aiModel: context.aiModel ?? null,
      generatedAt: context.generatedAt ?? null,
      generationCorrelationId: context.generationCorrelationId ?? null,
      primaryPromptKey: context.primaryPromptKey ?? null,
      primaryPromptVersion: context.primaryPromptVersion ?? null,
      primaryPromptHash: context.primaryPromptHash ?? null,
      authorUserId: context.authorUserId ?? context.actorUserId ?? null,
      sourceRevisionId: context.sourceRevisionId ?? defaultSourceRevisionId,
      idempotencyKey: context.idempotencyKey ?? null,
      backfillRunId: context.backfillRunId ?? null,
    },
  });
  await tx.curriculumProvenance.update({
    where: { id: provenance.id },
    data: {
      currentRevisionId: revision.id,
      provenanceCompleteness: completeness,
    },
  });
  await logAuditRequired(auditEntry(content, context, revision.id), tx);
  return revision;
}

async function adoptLegacyContent(
  tx: CurriculumTransaction,
  content: CurriculumContent,
  backfillRunId = "p2a-writer-adoption",
): Promise<{ provenance: CurriculumProvenance; revision: CurriculumContentRevision }> {
  const snapshot = buildCurriculumContentSnapshotV1(content);
  validateCurriculumContentSnapshotV1(snapshot);
  const contentHash = hashCurriculumSnapshot(CURRICULUM_SNAPSHOT_SCHEMA_VERSION, snapshot);
  const idempotencyKey = `p2a-adopt:${content.id}:${contentHash}`;
  const provenance = await tx.curriculumProvenance.create({
    data: {
      curriculumContentId: content.id,
      provenanceCompleteness: "UNVERIFIED",
      lifecycleState: lifecycleFromLegacyStatus(content.status),
    },
  });
  const revision = await tx.curriculumContentRevision.create({
    data: {
      provenanceId: provenance.id,
      sequence: 1,
      revisionKind: "BACKFILL_SNAPSHOT",
      originKind: "LEGACY_UNKNOWN",
      snapshotSchemaVersion: CURRICULUM_SNAPSHOT_SCHEMA_VERSION,
      contentSnapshot: snapshot as unknown as Prisma.InputJsonValue,
      contentHash,
      idempotencyKey,
      backfillRunId,
    },
  });
  const updated = await tx.curriculumProvenance.update({
    where: { id: provenance.id },
    data: { currentRevisionId: revision.id },
  });
  return { provenance: updated, revision };
}

export async function ensureCurriculumProvenance(
  tx: CurriculumTransaction,
  content: CurriculumContent,
  options: { backfillRunId?: string } = {},
): Promise<{ provenance: CurriculumProvenance; currentRevision: CurriculumContentRevision | null }> {
  const existing = await tx.curriculumProvenance.findUnique({
    where: { curriculumContentId: content.id },
    include: { currentRevision: true },
  });
  if (existing) {
    return { provenance: existing, currentRevision: existing.currentRevision };
  }
  const adopted = await adoptLegacyContent(tx, content, options.backfillRunId);
  return { provenance: adopted.provenance, currentRevision: adopted.revision };
}

async function findIdempotentRevision(
  tx: CurriculumTransaction,
  idempotencyKey?: string | null,
): Promise<CurriculumContentRevision | null> {
  if (!idempotencyKey) return null;
  return tx.curriculumContentRevision.findUnique({ where: { idempotencyKey } });
}

export async function createCurriculumContent(
  data: Prisma.CurriculumContentUncheckedCreateInput,
  context: GovernedMutationContext,
): Promise<GovernedWriteResult> {
  assertContentWriteIsNonAuthoritative(data);
  if (!provenanceWritersEnabled()) {
    return { content: await prisma.curriculumContent.create({ data }), provenance: null, revision: null };
  }
  return prisma.$transaction(async (tx) => {
    const prior = await findIdempotentRevision(tx, context.idempotencyKey);
    if (prior) {
      const provenance = await tx.curriculumProvenance.findUniqueOrThrow({
        where: { id: prior.provenanceId },
      });
      const content = await tx.curriculumContent.findUniqueOrThrow({
        where: { id: provenance.curriculumContentId },
      });
      return { content, provenance, revision: prior };
    }
    const content = await tx.curriculumContent.create({ data });
    const provenance = await tx.curriculumProvenance.create({
      data: {
        curriculumContentId: content.id,
        provenanceCompleteness: "UNVERIFIED",
        lifecycleState: "DRAFT",
      },
    });
    const revision = await createRevision(tx, content, provenance, 1, context, null);
    const updatedRoot = await tx.curriculumProvenance.findUniqueOrThrow({
      where: { id: provenance.id },
    });
    return { content, provenance: updatedRoot, revision };
  });
}

export async function updateCurriculumContent(
  where: Prisma.CurriculumContentWhereUniqueInput,
  data: Prisma.CurriculumContentUncheckedUpdateInput,
  context: GovernedMutationContext,
): Promise<GovernedWriteResult> {
  assertContentWriteIsNonAuthoritative(data);
  if (!provenanceWritersEnabled()) {
    return { content: await prisma.curriculumContent.update({ where, data }), provenance: null, revision: null };
  }
  return prisma.$transaction((tx) => updateCurriculumContentInTransaction(tx, where, data, context));
}

export async function updateCurriculumContentInTransaction(
  tx: CurriculumTransaction,
  where: Prisma.CurriculumContentWhereUniqueInput,
  data: Prisma.CurriculumContentUncheckedUpdateInput,
  context: GovernedMutationContext,
): Promise<GovernedWriteResult> {
  assertContentWriteIsNonAuthoritative(data);
  if (!provenanceWritersEnabled()) {
    return { content: await tx.curriculumContent.update({ where, data }), provenance: null, revision: null };
  }
    const prior = await findIdempotentRevision(tx, context.idempotencyKey);
    if (prior) {
      const provenance = await tx.curriculumProvenance.findUniqueOrThrow({
        where: { id: prior.provenanceId },
      });
      const content = await tx.curriculumContent.findUniqueOrThrow({
        where: { id: provenance.curriculumContentId },
      });
      return { content, provenance, revision: prior };
    }
    const before = await tx.curriculumContent.findUniqueOrThrow({ where });
    await lockContent(tx, before.id);
    const { provenance, currentRevision } = await ensureCurriculumProvenance(tx, before);
    const content = await tx.curriculumContent.update({ where: { id: before.id }, data });
    const last = await tx.curriculumContentRevision.findFirst({
      where: { provenanceId: provenance.id },
      orderBy: { sequence: "desc" },
      select: { sequence: true },
    });
    const revision = await createRevision(
      tx,
      content,
      provenance,
      (last?.sequence ?? 0) + 1,
      context,
      currentRevision?.id ?? null,
    );
    const updatedRoot = await tx.curriculumProvenance.findUniqueOrThrow({
      where: { id: provenance.id },
    });
    return { content, provenance: updatedRoot, revision };
}

export async function upsertCurriculumContent(
  where: Prisma.CurriculumContentWhereUniqueInput,
  create: Prisma.CurriculumContentUncheckedCreateInput,
  update: Prisma.CurriculumContentUncheckedUpdateInput,
  context: GovernedMutationContext,
): Promise<GovernedWriteResult> {
  assertContentWriteIsNonAuthoritative(create);
  assertContentWriteIsNonAuthoritative(update);
  if (!provenanceWritersEnabled()) {
    return {
      content: await prisma.curriculumContent.upsert({ where, create, update }),
      provenance: null,
      revision: null,
    };
  }
  const existing = await prisma.curriculumContent.findUnique({ where, select: { id: true } });
  return existing
    ? updateCurriculumContent({ id: existing.id }, update, context)
    : createCurriculumContent(create, context);
}

const OPERATIONAL_FIELDS = new Set([
  "thumbnailUrl",
  "thumbnailStatus",
  "thumbnailGeneratedAt",
  "thumbnailError",
  "imageGenerationStatus",
  "imageGenerationCost",
  "embeddedAt",
  "embedding",
  "hash",
  "isHero",
]);

export async function updateCurriculumOperationalFields(
  where: Prisma.CurriculumContentWhereUniqueInput,
  data: Prisma.CurriculumContentUncheckedUpdateInput,
): Promise<CurriculumContent> {
  const keys = Object.keys(data);
  if (keys.length === 0 || keys.some((key) => !OPERATIONAL_FIELDS.has(key))) {
    throw new Error(`Operational curriculum adapter rejected fields: ${keys.join(",")}`);
  }
  return prisma.curriculumContent.update({ where, data });
}

export async function hardDeleteNeverGovernedCurriculumContent(
  where: Prisma.CurriculumContentWhereUniqueInput,
): Promise<CurriculumContent> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Hard deletion of CurriculumContent is prohibited in production");
  }
  const row = await prisma.curriculumContent.findUniqueOrThrow({
    where,
    include: { provenance: { select: { id: true } } },
  });
  if (row.provenance) {
    throw new Error("Governed CurriculumContent cannot be hard deleted");
  }
  return prisma.curriculumContent.delete({ where: { id: row.id } });
}

export async function saveCurriculumEmbedding(
  contentRecordId: string,
  vectorLiteral: string,
): Promise<void> {
  if (typeof prisma.$executeRaw !== "function") return;
  if (!/^\[(?:-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)(?:,-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)*\]$/i.test(vectorLiteral)) {
    throw new Error("Invalid vector literal");
  }
  const vectorSql = Prisma.raw(`'${vectorLiteral}'::vector`);
  await prisma.$executeRaw(Prisma.sql`
    UPDATE "CurriculumContent"
    SET "embedding" = ${vectorSql}, "embeddedAt" = NOW()
    WHERE "id" = ${contentRecordId}
  `);
}

export async function clearCurriculumEmbedding(contentRecordId: string): Promise<void> {
  if (typeof prisma.$executeRaw !== "function") return;
  await prisma.$executeRaw(Prisma.sql`
    UPDATE "CurriculumContent"
    SET "embedding" = NULL, "embeddedAt" = NULL
    WHERE "id" = ${contentRecordId}
  `);
}

export async function requeuePublishedCurriculumEmbeddings(): Promise<number> {
  const count = await prisma.$executeRaw(Prisma.sql`
    UPDATE "CurriculumContent"
    SET "embedding" = NULL, "embeddedAt" = NULL
    WHERE LOWER(TRIM("status")) IN ('published', 'approved', 'accepted')
  `);
  return Number(count ?? 0);
}
