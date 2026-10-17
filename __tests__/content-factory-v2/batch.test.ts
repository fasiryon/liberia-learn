import { afterEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { runCandidateBatch } from "@/lib/content-factory/v2/batch";
import { tenLessonFixture } from "@/lib/content-factory/v2/batchFixture";
import { prepareBatch, bytesHash, validateBatchMedia, type BatchAsset } from "@/lib/content-factory/v2/batchContract";
import { staticBatchExecutors } from "@/lib/content-factory/v2/staticBatch";
import { demoBlueprint, buildDemo } from "@/lib/content-factory/v2/demo";
import { parseBlueprint, sealBlueprint } from "@/lib/content-factory/v2/blueprint";
import { inventoryLegacy } from "@/lib/content-factory/v2/inventory";
import { digest } from "@/lib/content-factory/v2/blueprint";
import { capture, provenance } from "./productionFixture";
import { validateProductionCapture } from "@/lib/content-factory/v2/productionInventory";
import { hashCurriculumSnapshot } from "@/lib/curriculum/provenance/hash";

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });
const temp = () => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ll-factory-ten-")); dirs.push(dir); return dir; };
async function inputs() {
  const fixture = await tenLessonFixture();
  return { ...fixture, enabled: true, outputRoot: temp(), createExecutors: () => staticBatchExecutors(fixture.generationBytes, bytesHash(fixture.generationBytes)) };
}

describe("Source-bound ten-lesson candidate batch", () => {
  it("binds the existing offline production validator to all ten selected revisions and its exact manifest", async () => {
    // Production-shaped SYNTHETIC data exercises ingestion. No live access or attestation is claimed.
    const input = await inputs(); const template = capture();
    const rows = Array.from({ length: 10 }, (_, index) => ({ ...structuredClone(template[2]), databaseId: `synthetic-export-row-${index}`, contentId: `synthetic-export-logical-${index}`, currentRevisionId: `synthetic-export-revision-${index}`,
      revisions: [{ ...template[2].revisions[0], revisionId: `synthetic-export-revision-${index}` }],
    }));
    const raw = [template[0], { ...template[1], lessonCount: 10, contentTypes: [{ contentType: "LESSON", count: 10 }] }, ...rows, { ...template[3], lessonCount: 10 }].map(r => JSON.stringify(r)).join("\n") + "\n";
    const verified = validateProductionCapture(raw, provenance);
    const manifestJson = JSON.stringify(verified.manifest, null, 2) + "\n";
    input.contract.inventoryHash = verified.inventory.inventoryHash;
    input.contract.evidence = { kind: "ACCEPTED_READ_ONLY_EXPORT", manifestSha256: bytesHash(manifestJson), authorizationRef: provenance.authorizationRef, targetAndRoleAttestationRef: provenance.targetAttestationRef, fullVisibilityRef: "SYNTHETIC", privacyReviewRef: "SYNTHETIC" };
    input.contract.lessons.forEach((entry, index) => {
      const row = verified.inventory.rows[index];
      entry.source = { databaseId: row.databaseId, contentId: row.contentId, revisionId: row.revisionId!, revisionNumber: row.revisionNumber!, snapshotSha256: row.contentHash! };
      const blueprint = parseBlueprint(entry.blueprint);
      entry.blueprint = sealBlueprint({ ...blueprint, legacy: [{ ...entry.source, inventoryPin: { ...blueprint.legacy[0].inventoryPin, sha256: verified.inventory.inventoryHash } }] });
    });
    const productionCapture = { raw, provenance, manifestJson };
    expect(() => prepareBatch(input.contract, verified.inventory.inventory)).toThrow("batch_production_capture_required");
    expect(prepareBatch(input.contract, verified.inventory.inventory, productionCapture).lessons).toHaveLength(10);
    expect(() => prepareBatch(input.contract, verified.inventory.inventory, { ...productionCapture, manifestJson: manifestJson + " " })).toThrow("batch_production_manifest_mismatch");
    const summaries = await runCandidateBatch({ ...input, inventory: verified.inventory.inventory, productionCapture });
    expect(summaries.every(s => s.generationStatus === "AWAITING_HUMAN_REVIEW" && s.state === "DRAFT" && !s.released)).toBe(true);
    await expect(runCandidateBatch({ ...input, inventory: verified.inventory.inventory, productionCapture, outputRoot: process.cwd() })).rejects.toThrow("production_candidate_output_must_be_outside_repository");
  });

  it("processes ten, preserves exact sources, retains audits and reuses completed packages without authoring", async () => {
    const input = await inputs(); const before = JSON.stringify(input.inventory);
    let calls = 0;
    const create = input.createExecutors;
    input.createExecutors = () => { calls++; return create(); };
    const first = await runCandidateBatch(input);
    expect(first).toHaveLength(10);
    expect(first.every(s => s.state === "DRAFT" && !s.released && !s.approved && s.reviewState === "PENDING_INDEPENDENT_REVIEW" && s.generationStatus === "AWAITING_HUMAN_REVIEW")).toBe(true);
    expect(first.every(s => s.failures.length === 0 && s.releaseBlockers.includes("SYNTHETIC_EVIDENCE_ONLY"))).toBe(true);
    expect(JSON.stringify(input.inventory)).toBe(before);
    const dir = path.join(input.outputRoot, fs.readdirSync(input.outputRoot)[0]);
    const preserved = JSON.parse(fs.readFileSync(path.join(dir, "input.json"), "utf8"));
    expect(input.inventory.lessons).toContainEqual(expect.objectContaining({ databaseId: preserved.source.databaseId, contentSnapshot: preserved.source.contentSnapshot, relationshipCounts: preserved.source.relationshipCounts }));
    const filesBefore = fs.readdirSync(dir);
    const result = JSON.parse(fs.readFileSync(path.join(dir, "result.json"), "utf8"));
    expect(result.artifacts.filter((a: { payload: { kind: string } }) => a.payload.kind === "ASSESSMENT")).toHaveLength(4);
    let previousHash = null;
    for (const event of result.events) {
      const { eventHash, ...body } = event;
      expect(body.previousHash).toBe(previousHash);
      expect(eventHash).toBe(digest("factory-event/2.0.0", body)); previousHash = eventHash;
    }
    expect(await runCandidateBatch(input)).toEqual(first);
    expect(calls).toBe(10); expect(fs.readdirSync(dir)).toEqual(filesBefore);
  });

  it("preflights the tenth source and feature flag before any author or output write", async () => {
    const input = await inputs(); let calls = 0;
    input.createExecutors = () => { calls++; throw new Error("must_not_run"); };
    await expect(runCandidateBatch({ ...input, enabled: false })).rejects.toThrow("disabled");
    input.contract.lessons[9].source.revisionId = "stale-revision";
    await expect(runCandidateBatch(input)).rejects.toThrow("batch_source_revision_mismatch");
    expect(calls).toBe(0); expect(fs.readdirSync(input.outputRoot)).toEqual([]);
  });

  it("rejects missing bodies, duplicate sources, bad hashes and mismatched evidence", async () => {
    const input = await inputs();
    const bad = structuredClone(input.contract); bad.lessons.pop();
    expect(() => prepareBatch(bad, input.inventory)).toThrow();
    const duplicate = structuredClone(input.contract); duplicate.lessons[9] = duplicate.lessons[0];
    expect(() => prepareBatch(duplicate, input.inventory)).toThrow("batch_duplicate_identity");
    input.inventory.lessons[0].contentSnapshot.delivery.body = "";
    input.inventory.lessons[0].contentHash = "0".repeat(64);
    input.contract.inventoryHash = inventoryLegacy(input.inventory).inventoryHash;
    expect(() => prepareBatch(input.contract, input.inventory)).toThrow("batch_source_ineligible");
    input.inventory.lessons[0].contentHash = hashCurriculumSnapshot(1, input.inventory.lessons[0].contentSnapshot);
    input.contract.inventoryHash = inventoryLegacy(input.inventory).inventoryHash;
    expect(() => prepareBatch(input.contract, input.inventory)).toThrow("batch_legacy_full_body_missing");
    const clean = await inputs(); const production = { ...clean.inventory, environment: "PRODUCTION_READ_ONLY_EXPORT" };
    clean.contract.inventoryHash = inventoryLegacy(production).inventoryHash;
    expect(() => prepareBatch(clean.contract, production)).toThrow("batch_evidence_environment_mismatch");
  });

  it("refuses changed inputs under an existing candidate version and detects package tampering", async () => {
    const input = await inputs(); await runCandidateBatch(input);
    input.contract.version = "1.0.1";
    await expect(runCandidateBatch(input)).rejects.toThrow("batch_candidate_version_immutable");
    input.contract.version = "1.0.0";
    const dir = path.join(input.outputRoot, fs.readdirSync(input.outputRoot)[0]);
    fs.appendFileSync(path.join(dir, "summary.json"), " ");
    await expect(runCandidateBatch(input)).rejects.toThrow("batch_package_integrity_failure");
  });

  it("retains incomplete attempt evidence and blocks automatic retries", async () => {
    const input = await inputs(); let calls = 0;
    input.createExecutors = () => { calls++; throw new Error("adapter_crashed"); };
    await expect(runCandidateBatch(input)).rejects.toThrow("adapter_crashed");
    await expect(runCandidateBatch(input)).rejects.toThrow("batch_incomplete_attempt_requires_recovery");
    expect(calls).toBe(1);
    const dir = path.join(input.outputRoot, fs.readdirSync(input.outputRoot)[0]);
    expect(fs.existsSync(path.join(dir, "input.json"))).toBe(true);
    expect(fs.existsSync(path.join(dir, "failure.json"))).toBe(true);
  });

  it("prevents concurrent reruns from invoking a second author", async () => {
    const input = await inputs(); let calls = 0; const create = input.createExecutors;
    input.createExecutors = () => { calls++; return create(); };
    const attempts = await Promise.allSettled([runCandidateBatch(input), runCandidateBatch(input)]);
    expect(attempts.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter(r => r.status === "rejected")).toHaveLength(1);
    expect(calls).toBe(10);
  });

  it("keeps self-review failed and never advances the independent review state", async () => {
    const input = await inputs();
    input.actors.INDEPENDENT_QUALITY_REVIEWER = input.actors.LESSON_AUTHOR;
    const results = await runCandidateBatch(input);
    expect(results.every(r => r.generationStatus === "FAILED" && r.reviewState === "PENDING_INDEPENDENT_REVIEW" && !r.released && !r.approved)).toBe(true);
  });

  it("retains rejected generation bytes and a failed audit without downstream authoring", async () => {
    const input = await inputs();
    const drafts = JSON.parse(input.generationBytes.toString());
    drafts.CURRICULUM_ARCHITECT[0].payload.approved = true;
    const bytes = Buffer.from(JSON.stringify(drafts));
    for (const lesson of input.contract.lessons) {
      lesson.generation.sha256 = bytesHash(bytes);
      input.generationInputs[lesson.candidateId] = bytes.toString("base64");
    }
    input.createExecutors = () => staticBatchExecutors(bytes, bytesHash(bytes));
    const results = await runCandidateBatch(input);
    expect(results.every(r => r.generationStatus === "FAILED" && !r.approved)).toBe(true);
    const dir = path.join(input.outputRoot, fs.readdirSync(input.outputRoot)[0]);
    const preserved = JSON.parse(fs.readFileSync(path.join(dir, "input.json"), "utf8"));
    expect(Buffer.from(preserved.generationInputBase64, "base64")).toEqual(bytes);
    expect(fs.readdirSync(dir).filter(f => f.startsWith("event-"))).toHaveLength(2);
  });

  it("requires exact objective source bytes, pointers and source bindings", async () => {
    const input = await inputs();
    input.contract.documents[0].bytesBase64 = Buffer.from("tampered").toString("base64");
    expect(() => prepareBatch(input.contract, input.inventory)).toThrow("batch_source_document_invalid");
    const clean = await inputs();
    const b = demoBlueprint();
    clean.contract.lessons[0].blueprint = sealBlueprint({ ...b, blueprintId: clean.contract.lessons[0].candidateId });
    expect(() => prepareBatch(clean.contract, clean.inventory)).toThrow("batch_blueprint_source_binding_mismatch");
  });

  it("requires matching provenance, alternative text, objective-preserving fallback and no orphan assets", async () => {
    const result = await buildDemo();
    const lesson = result.artifacts.find(a => a.payload.kind === "LESSON")!;
    if (lesson.payload.kind !== "LESSON") throw new Error("fixture_missing");
    const scene = structuredClone(lesson.payload.candidate.scenes[0]);
    const media = { id: "diagram-1", kind: "DIAGRAM" as const, requirement: "MEDIA_REQUIRED" as const, description: "Decimal chart", altText: "A place value chart" };
    const candidate = { ...lesson.payload.candidate, scenes: [{ ...scene, media: [media] }, ...lesson.payload.candidate.scenes.slice(1)] };
    const artifacts = [{ ...lesson, payload: { kind: "LESSON" as const, candidate } }];
    expect(validateBatchMedia(result.blueprint, [], artifacts).join()).toContain("media_provenance_missing");
    const asset: BatchAsset = { resourceId: lesson.id, sceneId: scene.id, mediaId: media.id, altText: media.altText, mimeType: "text/plain", bytesBase64: "Y2hhcnQ=", sha256: bytesHash("chart"), provenance: result.blueprint.sources[0], license: "fixture-only", origin: { kind: "EXISTING", attribution: "Synthetic fixture" } };
    expect(validateBatchMedia(result.blueprint, [asset], artifacts).join()).toContain("media_accessible_fallback_missing");
    candidate.scenes[0] = { ...candidate.scenes[0], fallback: { kind: "TEXT_WALKTHROUGH", content: "Read place labels left to right.", objectivePreserved: true } };
    expect(validateBatchMedia(result.blueprint, [asset], artifacts)).toEqual([]);
    expect(validateBatchMedia(result.blueprint, [{ ...asset, altText: "wrong" }], artifacts).join()).toContain("media_alt_text_mismatch");
  });
});
