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
  buildCurriculumContentSnapshot,
  validateCurriculumContentSnapshot,
} from "@/lib/curriculum/provenance/snapshot";
import { hashCurriculumSnapshot } from "@/lib/curriculum/provenance/hash";
import { isNativeCurriculumV2Payload } from "@/lib/curriculum/v2/contract";
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

/**
 * Native Curriculum V2 structure is only ever written through revision-tracked writers, so every
 * change is a new revision that needs its own exact-revision human review. With provenance writers
 * off there is no revision, so a write carrying native scene keys is refused (Codex P1-5/P1-7):
 * approved native instruction cannot be rewritten in place, and a published legacy row cannot be
 * turned into an unreviewed native lesson.
 */
function assertNativeWriteHasRevisionAuthority(data: { payload?: unknown }): void {
  if (isNativeCurriculumV2Payload(data.payload)) {
    throw new Error("NATIVE_CURRICULUM_V2_REQUIRES_PROVENANCE_WRITERS: native scene structure is written only through revision-tracked writers");
  }
}

/**
 * Compatibility mode (writers off) has no revision to record a change against, so an EXISTING
 * native Curriculum V2 row is frozen there whatever the incoming payload looks like (Codex
 * second-pass P1-1): a legacy-looking replacement such as `{ body }` would otherwise downgrade
 * approved native instruction in place, keep its approval and create no revision. Only the
 * operational (non-instructional, non-identity) fields may change. Legacy rows are unaffected.
 */
export function assertExistingNativeRowFrozenWithoutRevisions(
  existing: Pick<CurriculumContent, "payload">,
  data: Record<string, unknown>,
): void {
  if (!isNativeCurriculumV2Payload(existing.payload)) return;
  const keys = Object.keys(data);
  if (keys.length > 0 && keys.every((key) => NATIVE_FROZEN_WRITABLE_FIELDS.has(key))) return;
  throw new Error("NATIVE_CURRICULUM_V2_EXISTING_ROW_REQUIRES_PROVENANCE_WRITERS: existing native content changes only through revision-tracked writers");
}

/** Writers-off update: the existing row is locked and checked in the same transaction as the write. */
async function compatibilityUpdate(
  tx: CurriculumTransaction,
  where: Prisma.CurriculumContentWhereUniqueInput,
  data: Prisma.CurriculumContentUncheckedUpdateInput,
): Promise<CurriculumContent> {
  assertNativeWriteHasRevisionAuthority(data);
  const existing = await lockAndReadContent(tx, where);
  assertExistingNativeRowFrozenWithoutRevisions(existing, data as Record<string, unknown>);
  // Bound to the locked row's id: the write can only reach the row that was inspected.
  return tx.curriculumContent.update({ where: { id: existing.id }, data });
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

function contentNotFound(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("No CurriculumContent record found for the update", {
    code: "P2025",
    clientVersion: Prisma.prismaVersion.client,
  });
}

/**
 * Lock the row, then read it. Every check on an existing row runs against this post-lock read: a
 * pre-lock snapshot can be stale, and a row that was absent at lookup is never written blind (a row
 * committed concurrently surfaces as not-found here and the caller retries against the real row).
 */
async function lockAndReadContent(
  tx: CurriculumTransaction,
  where: Prisma.CurriculumContentWhereUniqueInput,
): Promise<CurriculumContent> {
  const target = await tx.curriculumContent.findUnique({ where, select: { id: true } });
  if (!target) throw contentNotFound();
  await lockContent(tx, target.id);
  const locked = await tx.curriculumContent.findUnique({ where: { id: target.id } });
  if (!locked) throw contentNotFound();
  return locked;
}

export async function lockAndReadCurriculumContent(
  tx: CurriculumTransaction,
  where: Prisma.CurriculumContentWhereUniqueInput,
): Promise<CurriculumContent> {
  return lockAndReadContent(tx, where);
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
  const { schemaVersion, snapshot } = buildCurriculumContentSnapshot(content);
  validateCurriculumContentSnapshot(schemaVersion, snapshot);
  const contentHash = hashCurriculumSnapshot(schemaVersion, snapshot);
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
      snapshotSchemaVersion: schemaVersion,
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
  const { schemaVersion, snapshot } = buildCurriculumContentSnapshot(content);
  validateCurriculumContentSnapshot(schemaVersion, snapshot);
  const contentHash = hashCurriculumSnapshot(schemaVersion, snapshot);
  const idempotencyKey = `p2a-adopt:${content.id}:${contentHash}`;
  const provenance = await tx.curriculumProvenance.create({
    data: {
      curriculumContentId: content.id,
      provenanceCompleteness: "UNVERIFIED",
      // A native payload never inherits an approval from a legacy status: it starts as a DRAFT for review.
      lifecycleState: isNativeCurriculumV2Payload(content.payload) ? "DRAFT" : lifecycleFromLegacyStatus(content.status),
    },
  });
  const revision = await tx.curriculumContentRevision.create({
    data: {
      provenanceId: provenance.id,
      sequence: 1,
      revisionKind: "BACKFILL_SNAPSHOT",
      originKind: "LEGACY_UNKNOWN",
      snapshotSchemaVersion: schemaVersion,
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
    assertNativeWriteHasRevisionAuthority(data);
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

/**
 * Native Curriculum V2 instruction is immutable once approved (Codex P1-5): a change to any
 * instructional structure of an APPROVED native lesson must become a new draft lesson/revision
 * reviewed on its own, never an edit that the earlier approval appears to cover. The check runs
 * inside the write transaction, so a refused edit rolls back.
 */
export function assertNativeApprovedRevisionUnchanged(
  provenance: Pick<CurriculumProvenance, "lifecycleState">,
  currentRevision: Pick<CurriculumContentRevision, "contentHash" | "snapshotSchemaVersion"> | null,
  before: Pick<CurriculumContent, "payload">,
  after: CurriculumContent,
): void {
  if (!isNativeCurriculumV2Payload(before.payload) && !isNativeCurriculumV2Payload(after.payload)) return;
  if (provenance.lifecycleState !== "APPROVED") return;
  const { schemaVersion, snapshot } = buildCurriculumContentSnapshot(after);
  if (!currentRevision || currentRevision.snapshotSchemaVersion !== schemaVersion || currentRevision.contentHash !== hashCurriculumSnapshot(schemaVersion, snapshot)) {
    throw new Error("NATIVE_CURRICULUM_V2_APPROVED_REVISION_IMMUTABLE: create a new draft revision for review instead of editing approved instruction");
  }
}

export async function updateCurriculumContent(
  where: Prisma.CurriculumContentWhereUniqueInput,
  data: Prisma.CurriculumContentUncheckedUpdateInput,
  context: GovernedMutationContext,
): Promise<GovernedWriteResult> {
  assertContentWriteIsNonAuthoritative(data);
  if (!provenanceWritersEnabled()) {
    assertNativeWriteHasRevisionAuthority(data);
    const content = await prisma.$transaction((tx) => compatibilityUpdate(tx, where, data));
    return { content, provenance: null, revision: null };
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
    return { content: await compatibilityUpdate(tx, where, data), provenance: null, revision: null };
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
    // The snapshot used for provenance and the native-approval check is read after the lock.
    const before = await lockAndReadContent(tx, where);
    const { provenance, currentRevision } = await ensureCurriculumProvenance(tx, before);
    const content = await tx.curriculumContent.update({ where: { id: before.id }, data });
    assertNativeApprovedRevisionUnchanged(provenance, currentRevision, before, content);
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
    assertNativeWriteHasRevisionAuthority(create);
    assertNativeWriteHasRevisionAuthority(update);
    // An absent row is created with a plain insert: a row committed concurrently makes the insert fail
    // on its unique key instead of being overwritten unchecked. An existing row is locked and checked.
    const content = await prisma.$transaction(async (tx) => {
      const target = await tx.curriculumContent.findUnique({ where, select: { id: true } });
      return target
        ? compatibilityUpdate(tx, { id: target.id }, update)
        : tx.curriculumContent.create({ data: create });
    });
    return { content, provenance: null, revision: null };
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

/**
 * Fields an existing native Curriculum V2 row may change without a revision: rendering and search
 * artefacts only. `hash` is the row's unique payload identity, so it moves only with a revision.
 */
const NATIVE_FROZEN_WRITABLE_FIELDS = new Set([...OPERATIONAL_FIELDS].filter((field) => field !== "hash"));

export async function updateCurriculumOperationalFields(
  where: Prisma.CurriculumContentWhereUniqueInput,
  data: Prisma.CurriculumContentUncheckedUpdateInput,
): Promise<CurriculumContent> {
  const keys = Object.keys(data);
  if (keys.length === 0 || keys.some((key) => !OPERATIONAL_FIELDS.has(key))) {
    throw new Error(`Operational curriculum adapter rejected fields: ${keys.join(",")}`);
  }
  if (!keys.some((key) => !NATIVE_FROZEN_WRITABLE_FIELDS.has(key))) {
    return prisma.curriculumContent.update({ where, data });
  }
  // An identity field (`hash`) is checked against the locked row: native content is never re-keyed here.
  return prisma.$transaction(async (tx) => {
    const existing = await lockAndReadContent(tx, where);
    assertExistingNativeRowFrozenWithoutRevisions(existing, data as Record<string, unknown>);
    return tx.curriculumContent.update({ where: { id: existing.id }, data });
  });
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
