import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { partialFixture } from "./partialFixture";
import { planAuthoredSubset, processAuthoredSubset, PARTIAL_BATCH_VERSION } from "@/lib/content-factory/v2/partialBatch";
import { bytesHash } from "@/lib/content-factory/v2/batchContract";
import { digest, parseBlueprint, sealBlueprint } from "@/lib/content-factory/v2/blueprint";

let seed: Awaited<ReturnType<typeof partialFixture>>;
beforeAll(async () => { seed = await partialFixture(); });
const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) { if (path.dirname(path.resolve(dir)) !== path.resolve(os.tmpdir()) || !path.basename(dir).startsWith("ll-partial-test-")) throw new Error("unexpected_test_directory"); fs.rmSync(dir, { recursive: true, force: true }); } });
function input(count = 3) {
  const copy = structuredClone(seed);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ll-partial-test-")); dirs.push(dir);
  return { enabled: true, cohort: copy.cohort, selectedIds: copy.packages.slice(0, count).map(p => p.source.contentId),
    authoringInputs: copy.packages.slice(0, count).map(p => Buffer.from(JSON.stringify(p))), outputRoot: path.join(dir, "review") };
}
function packageDirectories(root: string) { return fs.readdirSync(path.join(root, "packages")).map(d => path.join(root, "packages", d)); }

describe("Explicit authored subsets of the unchanged ten-lesson manifest", () => {
  it("processes exactly 3 of 10 and preserves seven NOT_STARTED without placeholders or full readiness", async () => {
    const i = input(); const original = JSON.stringify(i.cohort);
    const baselinePath = "curriculum/factory-v2/first-ten-baseline.json"; const pinnedBytes = bytesHash(fs.readFileSync(baselinePath));
    const result = await processAuthoredSubset(i);
    expect(result.suppliedCount).toBe(3); expect(result.notStartedCount).toBe(7);
    expect(result.lessons.filter(l => l.status === "NOT_STARTED")).toHaveLength(7);
    expect(result.lessons.filter(l => l.status === "NOT_STARTED").every(l => l.packageHash === null)).toBe(true);
    expect(packageDirectories(i.outputRoot)).toHaveLength(3);
    expect(result.scope).toBe("PARTIAL_DRAFT_SUBMISSION"); expect(result.fullCohortReady).toBe(false);
    expect(JSON.stringify(i.cohort)).toBe(original); expect(bytesHash(fs.readFileSync(baselinePath))).toBe(pinnedBytes);
    for (const directory of packageDirectories(i.outputRoot)) {
      const summary = JSON.parse(fs.readFileSync(path.join(directory, "summary.json"), "utf8"));
      expect(summary).toMatchObject({ state: "DRAFT", approved: false, released: false, reviewState: "PENDING_INDEPENDENT_REVIEW", generationStatus: "AWAITING_HUMAN_REVIEW", failures: [] });
      expect(summary.releaseBlockers).toContain("SYNTHETIC_EVIDENCE_ONLY");
      const data = JSON.parse(fs.readFileSync(path.join(directory, "result.json"), "utf8"));
      expect(data.reviewerIndependence).toBeNull();
      expect(data.events.at(-1).status).toBe("REVIEW_PENDING");
      expect(data.events.some((e: { role: string; status: string }) => e.role === "GOVERNANCE_RELEASE" || e.role === "INDEPENDENT_QUALITY_REVIEWER" && e.status === "SUCCEEDED")).toBe(false);
      let previous = null;
      for (const event of data.events) { const { eventHash, ...body } = event; expect(body.previousHash).toBe(previous); expect(eventHash).toBe(digest("factory-event/2.0.0", body)); previous = eventHash; }
    }
    const { manifestHash, ...body } = result; expect(manifestHash).toBe(digest(PARTIAL_BATCH_VERSION, body));
  });
  it("processes 10 of 10 through the same path, keeping complete draft coverage separate from readiness", async () => {
    const i = input(10); const result = await processAuthoredSubset(i);
    expect(result.scope).toBe("FULL_COHORT_DRAFT_SUBMISSION"); expect(result.notStartedCount).toBe(0);
    expect(result.lessons.every(l => l.status === "AWAITING_HUMAN_REVIEW")).toBe(true);
    expect(result).toMatchObject({ fullCohortReady: false, readiness: "NOT_EVALUATED", state: "DRAFT", approved: false, published: false, released: false });
    expect(packageDirectories(i.outputRoot)).toHaveLength(10);
  });
  it("reuses identical packages and receipts, and can extend 3-of-10 to 10-of-10 without regenerating the first three", async () => {
    const i = input(); const first = await processAuthoredSubset(i);
    expect(await processAuthoredSubset({ ...i, selectedIds: [...i.selectedIds].reverse(), authoringInputs: [...i.authoringInputs].reverse() })).toEqual(first);
    const full = await processAuthoredSubset({ ...i, selectedIds: seed.packages.map(p => p.source.contentId), authoringInputs: seed.packages.map(p => Buffer.from(JSON.stringify(p))) });
    for (const lesson of first.lessons.filter(l => l.packageHash)) expect(full.lessons.find(l => l.contentId === lesson.contentId)?.packageHash).toBe(lesson.packageHash);
    expect(fs.readdirSync(path.join(i.outputRoot, "submissions"))).toHaveLength(2);
  });
  it.each(["unknown", "duplicate", "empty", "missing-package", "extra-package", "duplicate-package"])("rejects invalid subset %s before output writes", async kind => {
    const i = input();
    if (kind === "unknown") i.selectedIds[0] = "unknown-id";
    if (kind === "duplicate") i.selectedIds[1] = i.selectedIds[0];
    if (kind === "empty") i.selectedIds = [];
    if (kind === "missing-package") i.authoringInputs.pop();
    if (kind === "extra-package") i.authoringInputs.push(Buffer.from(JSON.stringify(seed.packages[3])));
    if (kind === "duplicate-package") i.authoringInputs[1] = i.authoringInputs[0];
    await expect(processAuthoredSubset(i)).rejects.toThrow(); expect(fs.existsSync(i.outputRoot)).toBe(false);
  });
  it.each(["revisionId", "snapshotSha256"] as const)("rejects supplied source %s mismatch", async key => {
    const i = input(); const p = JSON.parse(i.authoringInputs[0].toString()); p.source[key] = key === "snapshotSha256" ? "0".repeat(64) : "wrong-revision";
    i.authoringInputs[0] = Buffer.from(JSON.stringify(p));
    await expect(processAuthoredSubset(i)).rejects.toThrow("authoring_source_binding_mismatch"); expect(fs.existsSync(i.outputRoot)).toBe(false);
  });
  it("verifies sources against the whole manifest, including unselected records", async () => {
    const i = input(); i.cohort.sources[9].contentHash = "0".repeat(64);
    expect(() => planAuthoredSubset(i.cohort, i.selectedIds)).toThrow("partial_full_cohort_source_mismatch");
    await expect(processAuthoredSubset(i)).rejects.toThrow(); expect(fs.existsSync(i.outputRoot)).toBe(false);
  });
  it.each(["key", "rubric", "mapping", "media", "template", "approval"])("rejects incomplete or unauthorized %s without filling gaps", async kind => {
    const i = input(); const p = JSON.parse(i.authoringInputs[2].toString());
    if (kind === "template") p.inputState = "TEMPLATE";
    if (kind === "approval") p.approved = true;
    if (kind === "key") { const a = p.resources.find((r: { id: string }) => r.id === "quiz"); delete a.payload.specs[0].key; }
    if (kind === "rubric") { const a = p.resources.find((r: { id: string }) => r.id === "summative"); a.payload.specs.find((s: { key: { kind: string } }) => s.key.kind === "RUBRIC").key.rubric.criteria = []; }
    if (kind === "mapping") { const b = parseBlueprint(p.blueprint); b.assessmentPlan.find(t => t.kind === "DELAYED_RETRIEVAL")!.itemIds = ["absent-item"]; p.blueprint = sealBlueprint(b); }
    if (kind === "media") {
      const required = i.cohort.requirements.lessons[2]; required.mediaSpecifications.push({ id: "synthetic-required-media", requirement: "SYNTHETIC fixture required media", offlineFallback: "SYNTHETIC fallback" });
      p.mediaSpecifications.push({ id: "synthetic-required-media", resourceId: "lesson-1", sceneId: "places-intro", mediaId: "absent-asset", implementation: "STATIC_ASSET", mimeType: "text/plain", altText: "SYNTHETIC fixture", keyboardPath: "SYNTHETIC path", transcript: null, provenance: parseBlueprint(p.blueprint).sources[0], license: "fixture-only", fallbackDescription: "SYNTHETIC fallback" });
    }
    i.authoringInputs[2] = Buffer.from(JSON.stringify(p));
    await expect(processAuthoredSubset(i)).rejects.toThrow(); expect(fs.existsSync(i.outputRoot)).toBe(false);
  });
  it("refuses changed bytes at the same candidate version and detects package tampering", async () => {
    const i = input(); await processAuthoredSubset(i);
    const changed = [...i.authoringInputs]; changed[0] = Buffer.concat([changed[0], Buffer.from(" ")]);
    await expect(processAuthoredSubset({ ...i, authoringInputs: changed })).rejects.toThrow("batch_candidate_version_immutable");
    fs.appendFileSync(path.join(packageDirectories(i.outputRoot)[0], "summary.json"), " ");
    await expect(processAuthoredSubset(i)).rejects.toThrow("batch_package_integrity_failure");
  });
  it("does not waive primary media just because a complete fallback declaration was supplied", async () => {
    const i = input(); const p = JSON.parse(i.authoringInputs[0].toString());
    i.cohort.requirements.lessons[0].mediaSpecifications.push({ id: "synthetic-primary-media", requirement: "SYNTHETIC primary media requirement", offlineFallback: "SYNTHETIC fallback" });
    const resource = p.resources.find((r: { id: string }) => r.id === "lesson-1");
    const scene = resource.payload.candidate.scenes[0];
    scene.fallback = { kind: "TEXT_WALKTHROUGH", content: scene.content.body, objectivePreserved: true };
    p.mediaSpecifications.push({ id: "synthetic-primary-media", resourceId: "lesson-1", sceneId: scene.id, mediaId: null, implementation: "TEXT_OR_PAPER", mimeType: null, altText: scene.accessibility.textAlternative, keyboardPath: scene.accessibility.keyboardPath, transcript: null, provenance: parseBlueprint(p.blueprint).sources[0], license: "fixture-only", fallbackDescription: scene.content.body });
    i.authoringInputs[0] = Buffer.from(JSON.stringify(p));
    await expect(processAuthoredSubset(i)).rejects.toThrow("partial_required_media_unresolved");
    expect(fs.existsSync(i.outputRoot)).toBe(false);
  });
  it("keeps invalid required-media declarations out even when other resources are complete", async () => {
    const i = input(); const p = JSON.parse(i.authoringInputs[0].toString());
    i.cohort.requirements.lessons[0].mediaSpecifications.push({ id: "synthetic-svg", requirement: "SYNTHETIC SVG primary asset", offlineFallback: "SYNTHETIC fallback" });
    p.mediaSpecifications.push({ id: "synthetic-svg", resourceId: null, sceneId: null, mediaId: null, implementation: null, mimeType: "image/svg+xml", altText: null, keyboardPath: null, transcript: null, provenance: null, license: null, fallbackDescription: null });
    i.authoringInputs[0] = Buffer.from(JSON.stringify(p));
    await expect(processAuthoredSubset(i)).rejects.toThrow("partial_authoring_incomplete");
    expect(fs.existsSync(i.outputRoot)).toBe(false);
  });
  it("fails closed when disabled or given an in-repository output path", async () => {
    const i = input(); await expect(processAuthoredSubset({ ...i, enabled: false })).rejects.toThrow("disabled");
    await expect(processAuthoredSubset({ ...i, outputRoot: process.cwd() })).rejects.toThrow("partial_output_must_be_outside_repository");
    expect(fs.existsSync(i.outputRoot)).toBe(false);
  });
});
