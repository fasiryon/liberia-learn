/** Server-only insert/read boundary. Sealing is composition integrity, never approval. */
import { createHash } from "crypto";
import type { Prisma, PrismaClient, ContentBundleRecord } from "@prisma/client";
import { canonicalizeJson } from "@/lib/curriculum/provenance/hash";
import { sealContentBundle } from "../v1/seal";
import type { ContentBundleV1 } from "../v1/types";
import type { CompositionRecord, ContentBundleAuthorityReader } from "../v1/resolver";

export type BundleDatabase = Pick<PrismaClient, "contentBundleRecord">;
const digest = (value: unknown) => createHash("sha256").update(canonicalizeJson(value)).digest("hex");
const exact = (value: string) => typeof value === "string" && !!value.trim() && !/^(latest|current|\*)$/i.test(value.trim());

function prepare(input: CompositionRecord): CompositionRecord & { manifest: ContentBundleV1 } {
  if (!input || Object.keys(input).sort().join() !== "manifest,revisions") throw new Error("INVALID_COMPOSITION_ENVELOPE");
  const sealed = sealContentBundle(structuredClone(input.manifest));
  if (!sealed.ok) throw new Error("INVALID_CONTENT_BUNDLE");
  const bundle = sealed.sealed.bundle;
  if (!exact(bundle.identity.bundleId) || !exact(bundle.identity.version)) throw new Error("EXACT_BUNDLE_IDENTITY_REQUIRED");
  const members = [...bundle.lessons, ...bundle.activities, ...bundle.assessments];
  if (!input.revisions || typeof input.revisions !== "object" || Array.isArray(input.revisions)) throw new Error("INVALID_REVISION_PINS");
  if (Object.keys(input.revisions).length !== members.length) throw new Error("INVALID_REVISION_PINS");
  for (const member of members) {
    const pin = input.revisions[member.identity.itemId];
    if (!exact(member.identity.itemVersion) || !pin || Object.keys(pin).sort().join() !== "contentHash,provenanceId,revisionId" ||
        !exact(pin.revisionId) || !exact(pin.provenanceId) || typeof pin.contentHash !== "string" || !/^[a-f0-9]{64}$/.test(pin.contentHash) ||
        !bundle.governance.provenanceRefs.includes(pin.provenanceId)) throw new Error("INVALID_REVISION_PINS");
  }
  return { manifest: bundle, revisions: structuredClone(input.revisions) };
}

export function verifyStoredContentBundle(row: ContentBundleRecord): CompositionRecord & { manifest: ContentBundleV1 } {
  const raw = row.sealedComposition as unknown as CompositionRecord;
  if (!raw || digest(raw) !== row.compositionHash) throw new Error("STORED_COMPOSITION_HASH_MISMATCH");
  const composition = prepare(raw);
  const bundle = composition.manifest;
  if (bundle.identity.bundleId !== row.bundleId || bundle.identity.version !== row.bundleVersion ||
      bundle.schemaVersion !== row.schemaVersion || bundle.identity.contentHash !== row.contentHash ||
      bundle.curriculumAuthority.releaseId !== row.curriculumReleaseId ||
      bundle.curriculumAuthority.releaseIdentity !== row.releaseIdentity) throw new Error("STORED_BUNDLE_IDENTITY_MISMATCH");
  return composition;
}

export function createContentBundleRepository(db: BundleDatabase, schoolId: string) {
  if (!exact(schoolId)) throw new Error("SCHOOL_SCOPE_REQUIRED");
  return {
    async storeSealedContentBundle(input: CompositionRecord, createdById: string) {
      if (!exact(createdById)) throw new Error("PROVENANCE_ACTOR_REQUIRED");
      const composition = prepare(input);
      const bundle = composition.manifest;
      // create only: concurrent duplicates fail under the database unique constraint.
      return db.contentBundleRecord.create({ data: {
        bundleId: bundle.identity.bundleId, bundleVersion: bundle.identity.version,
        schemaVersion: bundle.schemaVersion, contentHash: bundle.identity.contentHash!,
        compositionHash: digest(composition), curriculumReleaseId: bundle.curriculumAuthority.releaseId,
        releaseIdentity: bundle.curriculumAuthority.releaseIdentity, schoolId, createdById,
        sealedComposition: composition as unknown as Prisma.InputJsonValue,
      } });
    },
    async getContentBundle(bundleId: string, bundleVersion: string) {
      if (!exact(bundleId) || !exact(bundleVersion)) throw new Error("EXACT_BUNDLE_IDENTITY_REQUIRED");
      const row = await db.contentBundleRecord.findFirst({ where: { schoolId, bundleId, bundleVersion } });
      return row ? verifyStoredContentBundle(row) : null;
    },
    async getContentBundleByHash(contentHash: string) {
      if (!/^[a-f0-9]{64}$/.test(contentHash)) throw new Error("INVALID_CONTENT_HASH");
      const rows = await db.contentBundleRecord.findMany({ where: { schoolId, contentHash } });
      return rows.map(verifyStoredContentBundle);
    },
  };
}

export function withPersistentComposition(reader: ContentBundleAuthorityReader, repository: ReturnType<typeof createContentBundleRepository>): ContentBundleAuthorityReader {
  // No fallback to fixtures or current rows if a persistent record is missing/corrupt.
  return { ...reader, readComposition: input => repository.getContentBundle(input.bundleId, input.bundleVersion) };
}
