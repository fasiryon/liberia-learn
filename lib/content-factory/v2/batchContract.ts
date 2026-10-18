import { z } from "zod";
import { createHash } from "crypto";
import { digest, exactPinSchema, parseBlueprint, type UnitBlueprint } from "./blueprint";
import { inventoryLegacy } from "./inventory";
import { sceneDeliverability } from "@/lib/curriculum/v2/deliverability";
import { validateProductionCapture } from "./productionInventory";
import { ageBandForGrade } from "@/lib/curriculum/v2/authoringContext";

export const BATCH_VERSION = "factory-ten-candidates/1.0.0" as const;
const id = z.string().min(1).max(500).refine(v => v === v.trim() && !/^(latest|current|\*)$/i.test(v));
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const version = z.string().regex(/^\d+\.\d+\.\d+$/);
export const actorSchema = z.strictObject({ kind: z.literal("AI"), agentId: id, modelFamily: id, sessionId: id });
const sourceSchema = z.strictObject({ databaseId: id, contentId: id, revisionId: id, revisionNumber: z.number().int().nonnegative(), snapshotSha256: hash });
export const assetSchema = z.strictObject({
  resourceId: id, sceneId: id, mediaId: id, altText: id,
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp", "text/plain"]),
  bytesBase64: z.string().min(1).max(4_000_000), sha256: hash,
  provenance: exactPinSchema, license: id,
  origin: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("EXISTING"), attribution: id }),
    z.strictObject({ kind: z.literal("GENERATED"), generator: id, generatorVersion: id, promptSha256: hash, declaration: id }),
  ]),
});
export const batchContractSchema = z.strictObject({
  schemaVersion: z.literal(BATCH_VERSION), batchId: id, version,
  curriculumContract: exactPinSchema,
  documents: z.array(z.strictObject({ pin: exactPinSchema, bytesBase64: z.string().min(1).max(4_000_000) })).min(1),
  inventoryHash: hash,
  evidence: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("SYNTHETIC"), notice: id }),
    z.strictObject({ kind: z.literal("ACCEPTED_READ_ONLY_EXPORT"), manifestSha256: hash, authorizationRef: id, targetAndRoleAttestationRef: id, fullVisibilityRef: id, privacyReviewRef: id }),
  ]),
  lessons: z.array(z.strictObject({
    candidateId: id, candidateVersion: version, source: sourceSchema,
    blueprint: z.unknown(), generation: exactPinSchema, assets: z.array(assetSchema).max(100),
  })).length(10),
});
export type BatchContract = z.infer<typeof batchContractSchema>;
export type BatchLesson = BatchContract["lessons"][number];
export type BatchAsset = z.infer<typeof assetSchema>;
export const bytesHash = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
export function assertBatchAssetBytes(asset: BatchAsset): void {
  const bytes = Buffer.from(asset.bytesBase64, "base64");
  if (bytes.toString("base64") !== asset.bytesBase64 || bytesHash(bytes) !== asset.sha256) throw new Error("batch_asset_hash_mismatch");
  const badPng = asset.mimeType === "image/png" && bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a";
  const badJpeg = asset.mimeType === "image/jpeg" && bytes.subarray(0, 3).toString("hex") !== "ffd8ff";
  const badWebp = asset.mimeType === "image/webp" && (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP");
  if (badPng || badJpeg || badWebp) throw new Error("batch_asset_format_mismatch");
}
export type ProductionCaptureInput = { raw: string; provenance: Parameters<typeof validateProductionCapture>[1]; manifestJson: string };

/** All ten sources are checked before any author or output sink is invoked. No database client. */
export function prepareBatch(contractInput: unknown, inventoryInput: unknown, capture?: ProductionCaptureInput) {
  const contract = batchContractSchema.parse(contractInput);
  const report = inventoryLegacy(inventoryInput);
  const documents = new Map<string, Buffer>();
  for (const document of contract.documents) {
    const bytes = Buffer.from(document.bytesBase64, "base64");
    const key = digest("pin", document.pin);
    if (documents.has(key) || bytes.toString("base64") !== document.bytesBase64 || bytesHash(bytes) !== document.pin.sha256) throw new Error("batch_source_document_invalid");
    documents.set(key, bytes);
  }
  if (!documents.has(digest("pin", contract.curriculumContract))) throw new Error("batch_curriculum_contract_document_missing");
  if (contract.inventoryHash !== report.inventoryHash) throw new Error("batch_inventory_hash_mismatch");
  if ((contract.evidence.kind === "SYNTHETIC") !== (report.inventory.environment === "REPOSITORY_FIXTURE")) throw new Error("batch_evidence_environment_mismatch");
  if (contract.evidence.kind === "ACCEPTED_READ_ONLY_EXPORT") {
    if (!capture) throw new Error("batch_production_capture_required");
    const verified = validateProductionCapture(capture.raw, capture.provenance);
    if (bytesHash(capture.manifestJson) !== contract.evidence.manifestSha256 || digest("manifest", JSON.parse(capture.manifestJson)) !== digest("manifest", verified.manifest)) throw new Error("batch_production_manifest_mismatch");
    if (capture.provenance.authorizationRef !== contract.evidence.authorizationRef || capture.provenance.targetAttestationRef !== contract.evidence.targetAndRoleAttestationRef) throw new Error("batch_production_attestation_mismatch");
    if (verified.inventory.inventoryHash !== report.inventoryHash || verified.manifest.legacyLessonMetadataCount !== 0) throw new Error("batch_production_inventory_mismatch_or_incomplete");
    for (const entry of contract.lessons) {
      const row = verified.inventory.rows.find(r => r.databaseId === entry.source.databaseId);
      if (!row || row.gaps.length) throw new Error("batch_production_source_ineligible");
    }
  }
  for (const values of [contract.lessons.map(l => l.candidateId), contract.lessons.map(l => l.source.databaseId), contract.lessons.map(l => l.source.contentId), contract.lessons.map(l => l.source.revisionId)]) {
    if (new Set(values).size !== 10) throw new Error("batch_duplicate_identity");
  }
  const lessons = contract.lessons.map(entry => {
    const source = report.rows.find(row => row.databaseId === entry.source.databaseId);
    if (!source || source.gaps.length || source.contentType.toUpperCase() !== "LESSON") throw new Error("batch_source_ineligible");
    const snapshot = z.object({ delivery: z.record(z.string(), z.unknown()) }).safeParse(source.contentSnapshot);
    if (!snapshot.success || !["body", "bodyStandard", "bodyBlock", "legacyContent", "lessonContent"].some(key => typeof snapshot.data.delivery[key] === "string" && String(snapshot.data.delivery[key]).trim())) throw new Error("batch_legacy_full_body_missing");
    if (source.contentId !== entry.source.contentId || source.revisionId !== entry.source.revisionId || source.revisionNumber !== entry.source.revisionNumber || source.contentHash !== entry.source.snapshotSha256) throw new Error("batch_source_revision_mismatch");
    if (report.rows.some(row => [row.databaseId, row.contentId, row.revisionId].includes(entry.candidateId))) throw new Error("batch_candidate_reuses_source_identity");
    const blueprint = parseBlueprint(entry.blueprint);
    if (blueprint.grade !== source.grade || blueprint.subject !== source.subject) throw new Error("batch_curriculum_scope_mismatch");
    if (blueprint.blueprintId !== entry.candidateId || blueprint.version !== entry.candidateVersion) throw new Error("batch_candidate_blueprint_identity_mismatch");
    const binding = blueprint.legacy[0];
    if (blueprint.legacy.length !== 1 || !binding || digest("source", entry.source) !== digest("source", { databaseId: binding.databaseId, contentId: binding.contentId, revisionId: binding.revisionId, revisionNumber: binding.revisionNumber, snapshotSha256: binding.snapshotSha256 }) || binding.inventoryPin.sha256 !== report.inventoryHash) throw new Error("batch_blueprint_source_binding_mismatch");
    // The Lead's contract is a pinned input, not a new educational authority.
    if (!blueprint.provenance.some(pin => digest("pin", pin) === digest("pin", contract.curriculumContract))) throw new Error("batch_curriculum_contract_unpinned");
    for (const objective of blueprint.objectives) {
      const pin = blueprint.sources.find(p => p.id === objective.sourceId);
      const bytes = pin && documents.get(digest("pin", pin));
      if (!bytes) throw new Error("batch_objective_source_document_missing");
      let value: unknown = JSON.parse(bytes.toString("utf8"));
      if (!objective.sourcePointer.startsWith("/")) throw new Error("batch_objective_pointer_invalid");
      for (const segment of objective.sourcePointer.slice(1).split("/")) {
        const key = segment.replace(/~1/g, "/").replace(/~0/g, "~");
        if (!value || typeof value !== "object" || !Object.hasOwn(value, key)) throw new Error("batch_objective_pointer_unresolved");
        value = Reflect.get(value, key);
      }
    }
    entry.assets.forEach(assertBatchAssetBytes);
    return { entry, source, blueprint };
  });
  return { contract, report, lessons };
}

/** Every declared media reference has actual bytes, an exact source, and matching alternative text. */
export function validateBatchMedia(blueprint: UnitBlueprint, assets: BatchAsset[], artifacts: readonly import("./types").FactoryArtifact[]): string[] {
  const failures: string[] = [];
  const used = new Set<BatchAsset>();
  for (const artifact of artifacts) if (artifact.payload.kind === "LESSON") {
    if (artifact.payload.candidate.ageBand !== ageBandForGrade(blueprint.grade)) failures.push(`candidate_age_band_mismatch:${artifact.id}`);
    for (const scene of artifact.payload.candidate.scenes) {
      const delivery = sceneDeliverability(scene, null, false);
      if (Object.values(delivery.byScenario).includes("NOT_DELIVERABLE")) failures.push(`scene_not_deliverable:${artifact.id}:${scene.id}`);
      for (const media of scene.media ?? []) {
        const matches = assets.filter(a => a.resourceId === artifact.id && a.sceneId === scene.id && a.mediaId === media.id);
        if (matches.length !== 1) { failures.push(`media_provenance_missing_or_duplicate:${artifact.id}:${media.id}`); continue; }
        const asset = matches[0]; used.add(asset);
        if (asset.altText !== media.altText || !media.altText.trim()) failures.push(`media_alt_text_mismatch:${media.id}`);
        if (!scene.fallback?.objectivePreserved || !scene.accessibility.textAlternative.trim()) failures.push(`media_accessible_fallback_missing:${media.id}`);
        if (!blueprint.provenance.some(p => digest("pin", p) === digest("pin", asset.provenance))) failures.push(`media_source_unpinned:${media.id}`);
      }
    }
  }
  if (used.size !== assets.length) failures.push("media_orphan_asset");
  if (assets.reduce((n, a) => n + Buffer.from(a.bytesBase64, "base64").byteLength, 0) + Buffer.byteLength(JSON.stringify(artifacts.map(a => a.payload))) > blueprint.support.offline.maxBytes) failures.push("media_package_byte_budget_exceeded");
  return failures;
}
