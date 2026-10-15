/** Server-only insert/read boundary. Sealing is composition integrity, never approval.
 * DEC-011: identity is immutable and global; ownership is NATIONAL or SCHOOL; a school may read a
 * NATIONAL record only through an ACTIVE ContentBundleAllocation. Allocation is never inferred.
 */
import { createHash } from "crypto";
import type { Prisma, PrismaClient, ContentBundleRecord } from "@prisma/client";
import { canonicalizeJson } from "@/lib/curriculum/provenance/hash";
import { sealContentBundle } from "../v1/seal";
import type { ContentBundleV1 } from "../v1/types";
import type { CompositionRecord, ContentBundleAuthorityReader } from "../v1/resolver";

export type BundleDatabase = Pick<PrismaClient, "contentBundleRecord" | "contentBundleAllocation">;
export type NationalBundleDatabase = Pick<PrismaClient, "contentBundleRecord">;
export const NATIONAL_OWNER_SCOPE = "NATIONAL";
export const SCHOOL_OWNER_SCOPE = "SCHOOL";
/** School-owned identities live in the owner's namespace; national identities never use it. */
export const schoolBundleNamespace = (schoolId: string) => `school.${schoolId}.`;
const digest = (value: unknown) => createHash("sha256").update(canonicalizeJson(value)).digest("hex");
const exact = (value: string) => typeof value === "string" && !!value.trim() && value.trim() === value && !/^(latest|current|\*)$/i.test(value);

function prepare(input: CompositionRecord): CompositionRecord & { manifest: ContentBundleV1 } {
  if (!input || Object.keys(input).sort().join() !== "manifest,revisions") throw new Error("INVALID_COMPOSITION_ENVELOPE");
  const sealed = sealContentBundle(structuredClone(input.manifest));
  if (!sealed.ok) throw new Error("INVALID_CONTENT_BUNDLE");
  const bundle = sealed.sealed.bundle;
  if (!exact(bundle.identity.bundleId) || !exact(bundle.identity.version)) throw new Error("EXACT_BUNDLE_IDENTITY_REQUIRED");
  // Governed activity pointers carry their own exact revision pin (Activity Wave); embedded
  // members carry one each. Every pin must belong to exactly one of them.
  const pinned = [
    ...[...bundle.lessons, ...bundle.activities, ...bundle.assessments].map(member => ({ id: member.identity.itemId, version: member.identity.itemVersion })),
    ...(bundle.activityReferences ?? []).map(ref => ({ id: ref.activityId, version: ref.version })),
  ];
  if (!input.revisions || typeof input.revisions !== "object" || Array.isArray(input.revisions)) throw new Error("INVALID_REVISION_PINS");
  if (new Set(pinned.map(p => p.id)).size !== pinned.length || Object.keys(input.revisions).length !== pinned.length) throw new Error("INVALID_REVISION_PINS");
  for (const member of pinned) {
    const pin = input.revisions[member.id];
    if (!exact(member.version) || !pin || Object.keys(pin).sort().join() !== "contentHash,provenanceId,revisionId" ||
        !exact(pin.revisionId) || !exact(pin.provenanceId) || typeof pin.contentHash !== "string" || !/^[a-f0-9]{64}$/.test(pin.contentHash) ||
        !bundle.governance.provenanceRefs.includes(pin.provenanceId)) throw new Error("INVALID_REVISION_PINS");
  }
  return { manifest: bundle, revisions: structuredClone(input.revisions) };
}

function ownershipValid(row: Pick<ContentBundleRecord, "ownerScope" | "ownerSchoolId" | "bundleId">) {
  if (row.ownerScope === NATIONAL_OWNER_SCOPE) return row.ownerSchoolId === null && !row.bundleId.startsWith("school.");
  if (row.ownerScope === SCHOOL_OWNER_SCOPE) return !!row.ownerSchoolId && row.bundleId.startsWith(schoolBundleNamespace(row.ownerSchoolId)) && row.bundleId.length > schoolBundleNamespace(row.ownerSchoolId).length;
  return false;
}

export function verifyStoredContentBundle(row: ContentBundleRecord): CompositionRecord & { manifest: ContentBundleV1 } {
  const raw = row.sealedComposition as unknown as CompositionRecord;
  if (!raw || digest(raw) !== row.compositionHash) throw new Error("STORED_COMPOSITION_HASH_MISMATCH");
  if (!ownershipValid(row)) throw new Error("STORED_BUNDLE_OWNERSHIP_INVALID");
  const composition = prepare(raw);
  const bundle = composition.manifest;
  if (bundle.identity.bundleId !== row.bundleId || bundle.identity.version !== row.bundleVersion ||
      bundle.schemaVersion !== row.schemaVersion || bundle.identity.contentHash !== row.contentHash ||
      bundle.curriculumAuthority.releaseId !== row.curriculumReleaseId ||
      bundle.curriculumAuthority.releaseIdentity !== row.releaseIdentity) throw new Error("STORED_BUNDLE_IDENTITY_MISMATCH");
  return composition;
}

function recordData(composition: CompositionRecord & { manifest: ContentBundleV1 }, owner: { ownerScope: string; ownerSchoolId: string | null }, createdById: string) {
  const bundle = composition.manifest;
  return {
    bundleId: bundle.identity.bundleId, bundleVersion: bundle.identity.version,
    schemaVersion: bundle.schemaVersion, contentHash: bundle.identity.contentHash!,
    compositionHash: digest(composition), curriculumReleaseId: bundle.curriculumAuthority.releaseId,
    releaseIdentity: bundle.curriculumAuthority.releaseIdentity, ...owner, createdById,
    sealedComposition: composition as unknown as Prisma.InputJsonValue,
  };
}

/**
 * National composition storage. Storing is not release, approval or allocation: a stored national
 * record is unavailable to every school until a separate governed allocation exists. No route
 * exposes this; the authority that may invoke it is an open governance decision.
 */
export function createNationalContentBundleStore(db: NationalBundleDatabase) {
  return {
    async storeNationalContentBundle(input: CompositionRecord, createdById: string) {
      if (!exact(createdById)) throw new Error("PROVENANCE_ACTOR_REQUIRED");
      const composition = prepare(input);
      if (composition.manifest.identity.bundleId.startsWith("school.")) throw new Error("NATIONAL_NAMESPACE_INVALID");
      // create only: concurrent duplicates fail under the database unique constraint.
      return db.contentBundleRecord.create({ data: recordData(composition, { ownerScope: NATIONAL_OWNER_SCOPE, ownerSchoolId: null }, createdById) });
    },
  };
}

export function createContentBundleRepository(db: BundleDatabase, schoolId: string) {
  if (!exact(schoolId)) throw new Error("SCHOOL_SCOPE_REQUIRED");
  // Authorization precedes integrity verification so an unauthorized caller cannot distinguish
  // a foreign, corrupt or absent record: all are null.
  async function authorized(row: ContentBundleRecord | null) {
    if (!row) return null;
    if (row.ownerScope === SCHOOL_OWNER_SCOPE) return row.ownerSchoolId === schoolId ? row : null;
    if (row.ownerScope !== NATIONAL_OWNER_SCOPE) return null;
    const allocation = await db.contentBundleAllocation.findFirst({ where: { bundleRecordId: row.id, schoolId, status: "ACTIVE" }, select: { id: true } });
    return allocation ? row : null;
  }
  return {
    /** School-owned storage; the identity must sit in this school's namespace. */
    async storeSchoolContentBundle(input: CompositionRecord, createdById: string) {
      if (!exact(createdById)) throw new Error("PROVENANCE_ACTOR_REQUIRED");
      const composition = prepare(input);
      const namespace = schoolBundleNamespace(schoolId);
      const bundleId = composition.manifest.identity.bundleId;
      if (!bundleId.startsWith(namespace) || bundleId.length === namespace.length) throw new Error("SCHOOL_NAMESPACE_REQUIRED");
      return db.contentBundleRecord.create({ data: recordData(composition, { ownerScope: SCHOOL_OWNER_SCOPE, ownerSchoolId: schoolId }, createdById) });
    },
    async getContentBundle(bundleId: string, bundleVersion: string) {
      if (!exact(bundleId) || !exact(bundleVersion)) throw new Error("EXACT_BUNDLE_IDENTITY_REQUIRED");
      const row = await authorized(await db.contentBundleRecord.findUnique({ where: { bundleId_bundleVersion: { bundleId, bundleVersion } } }));
      return row ? verifyStoredContentBundle(row) : null;
    },
    async getContentBundleByHash(contentHash: string) {
      if (!/^[a-f0-9]{64}$/.test(contentHash)) throw new Error("INVALID_CONTENT_HASH");
      const rows = await db.contentBundleRecord.findMany({ where: { contentHash } });
      const visible = (await Promise.all(rows.map(authorized))).filter((row): row is ContentBundleRecord => !!row);
      return visible.map(verifyStoredContentBundle);
    },
  };
}

export type AllocationDatabase = Pick<PrismaClient, "contentBundleRecord" | "contentBundleAllocation">;
/**
 * Allocation mechanism only. It records a decision made elsewhere (governanceRef) and invents no
 * permission: no route calls it, and who may grant or revoke is an open governance decision.
 */
export function createContentBundleAllocationStore(db: AllocationDatabase) {
  return {
    async grant(input: { bundleId: string; bundleVersion: string; schoolId: string; governanceRef: string; grantedById: string }) {
      if (![input.bundleId, input.bundleVersion, input.schoolId, input.governanceRef, input.grantedById].every(exact)) throw new Error("ALLOCATION_INPUT_REQUIRED");
      const record = await db.contentBundleRecord.findUnique({ where: { bundleId_bundleVersion: { bundleId: input.bundleId, bundleVersion: input.bundleVersion } }, select: { id: true, ownerScope: true } });
      if (!record || record.ownerScope !== NATIONAL_OWNER_SCOPE) throw new Error("NATIONAL_BUNDLE_REQUIRED");
      return db.contentBundleAllocation.create({ data: { bundleRecordId: record.id, schoolId: input.schoolId, governanceRef: input.governanceRef, grantedById: input.grantedById } });
    },
    async revoke(input: { allocationId: string; revokedById: string; revocationRef: string }) {
      if (![input.allocationId, input.revokedById, input.revocationRef].every(exact)) throw new Error("ALLOCATION_INPUT_REQUIRED");
      const { count } = await db.contentBundleAllocation.updateMany({ where: { id: input.allocationId, status: "ACTIVE" }, data: { status: "REVOKED", revokedById: input.revokedById, revokedAt: new Date(), revocationRef: input.revocationRef } });
      if (count !== 1) throw new Error("ACTIVE_ALLOCATION_REQUIRED");
    },
  };
}

export function withPersistentComposition(reader: ContentBundleAuthorityReader, repository: ReturnType<typeof createContentBundleRepository>): ContentBundleAuthorityReader {
  // No fallback to fixtures or current rows if a persistent record is missing/corrupt/unallocated.
  return { ...reader, readComposition: input => repository.getContentBundle(input.bundleId, input.bundleVersion) };
}
