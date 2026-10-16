import { describe, expect, it } from "vitest";
import { buildDemo, candidateBundle, demoBlueprint, demoExecutors } from "@/lib/content-factory/v2/demo";
import { validateContentBundle } from "@/lib/content-bundle/v1/validator";
import { parseBlueprint, sealBlueprint } from "@/lib/content-factory/v2/blueprint";
import { runFactory } from "@/lib/content-factory/v2/manager";
import { checkPackage, reviewerAssessmentPreview } from "@/lib/content-factory/v2/quality";

describe("Content Factory V2 candidate boundary", () => {
  it("generates a coherent reviewer package with all resource families and no release authority", async () => {
    const result = await buildDemo();
    expect(result.status).toBe("AWAITING_HUMAN_REVIEW");
    expect(result.artifacts.length).toBeGreaterThanOrEqual(16);
    expect(result.quality.failures).toEqual([]);
    expect(result.quality.humanRequired.length).toBeGreaterThan(0);
    expect(result.quality.releaseBlockers).toContain("PRODUCTION_INVENTORY_NOT_VERIFIED");
    expect(result.artifacts.every(a => a.blueprint.contentHash === result.blueprint.contentHash)).toBe(true);
    expect(result.events.some(e => e.status === "SUCCEEDED")).toBe(true);
    expect(JSON.stringify(result)).not.toContain('"official":true');
  });

  it("rejects blueprint authority injection, moving pins and stale content hashes", () => {
    const blueprint = demoBlueprint();
    expect(() => parseBlueprint({ ...blueprint, approved: true })).toThrow();
    expect(() => sealBlueprint({ ...blueprint, sources: [{ ...blueprint.sources[0], version: "latest" }] })).toThrow();
    expect(() => parseBlueprint({ ...blueprint, title: "edited" })).toThrow("blueprint_hash_mismatch");
  });

  it("rejects sequence cycles and missing prerequisite diagnostic references before execution", () => {
    const b = demoBlueprint();
    expect(() => sealBlueprint({ ...b, sequence: [{ ...b.sequence[0], dependsOn: [b.sequence[0].resourceId] }, ...b.sequence.slice(1)] })).toThrow();
    expect(() => sealBlueprint({ ...b, prerequisites: [{ ...b.prerequisites[0], diagnosticResourceId: "missing" }] })).toThrow();
  });

  it("retries generation with recorded failures, bounded attempts and exact dependency inputs", async () => {
    const executors = demoExecutors();
    const author = executors.LESSON_AUTHOR;
    let calls = 0;
    executors.LESSON_AUTHOR = async input => {
      calls++;
      if (calls === 1) throw new Error("temporary_generator_failure");
      expect(input.previousFailures).toContain("temporary_generator_failure");
      return author(input);
    };
    const result = await runFactory({ blueprint: demoBlueprint(), executors, maxAttempts: 2, appendAudit: async () => {} });
    expect(result.status).toBe("AWAITING_HUMAN_REVIEW");
    expect(calls).toBe(2);
    expect(result.events.some(e => e.status === "RETRY_REQUIRED")).toBe(true);
  });

  it("stops before downstream tasks after retry exhaustion", async () => {
    const executors = demoExecutors();
    executors.LESSON_AUTHOR = async () => { throw new Error("broken"); };
    const result = await runFactory({ blueprint: demoBlueprint(), executors, maxAttempts: 2, appendAudit: async () => {} });
    expect(result.status).toBe("FAILED");
    expect(result.events.filter(e => e.role === "LESSON_AUTHOR" && e.status === "STARTED")).toHaveLength(2);
    expect(result.events.some(e => e.role === "ASSESSMENT_DESIGNER")).toBe(false);
  });

  it("fails closed before invoking an executor when audit persistence fails", async () => {
    let calls = 0;
    const executors = demoExecutors();
    executors.CURRICULUM_ARCHITECT = async () => { calls++; return []; };
    await expect(runFactory({ blueprint: demoBlueprint(), executors, appendAudit: async () => { throw new Error("audit_unavailable"); } })).rejects.toThrow("audit_unavailable");
    expect(calls).toBe(0);
  });

  it("detects changed protected keys and mixed blueprint revisions", async () => {
    const result = await buildDemo();
    const changed = structuredClone(result.artifacts);
    const assessment = changed.find(a => a.payload.kind === "ASSESSMENT");
    if (!assessment || assessment.payload.kind !== "ASSESSMENT") throw new Error("fixture_missing");
    assessment.payload.specs[0] = { ...assessment.payload.specs[0], maxPoints: 99 };
    expect(checkPackage(result.blueprint, changed).failures.some(f => f.includes("hash"))).toBe(true);
    changed[0] = { ...changed[0], blueprint: { ...changed[0].blueprint, version: "9.0.0" } };
    expect(checkPackage(result.blueprint, changed).failures).toContain(`blueprint_pin_mismatch:${changed[0].id}`);
  });

  it("uses the Assessment V2 keyless projection for reviewer learner previews", async () => {
    const result = await buildDemo();
    const preview = reviewerAssessmentPreview(result.artifacts);
    expect(preview.length).toBeGreaterThan(0);
    expect(JSON.stringify(preview)).not.toMatch(/scoringSpecHash|moderationNotes|correctOptionId|acceptedAnswers/);
  });

  it("keeps deterministic resource identities and composes the existing ContentBundle contract", async () => {
    const first = await buildDemo(); const second = await buildDemo();
    expect(first.artifacts.map(a => a.contentHash)).toEqual(second.artifacts.map(a => a.contentHash));
    const bundle = candidateBundle(first.blueprint, first.artifacts);
    const validation = validateContentBundle(bundle);
    expect(validation.errors).toEqual([]);
    expect(bundle.governance.releaseRefs).toEqual([]);
    expect(bundle.extensions?.unitBlueprint).toEqual({ blueprintId: first.blueprint.blueprintId, version: first.blueprint.version, contentHash: first.blueprint.contentHash });
  });

  it("does not continue or retry generation after artifact persistence fails", async () => {
    const persisted: string[] = [];
    await expect(runFactory({ blueprint: demoBlueprint(), executors: demoExecutors(), appendAudit: async () => {}, persistArtifact: async artifact => { persisted.push(artifact.id); throw new Error("artifact_store_failed"); } })).rejects.toThrow("artifact_store_failed");
    expect(persisted).toEqual(["curriculum-map"]);
  });

  it("repairs an invalid candidate on retry before independent review", async () => {
    const executors = demoExecutors(); const author = executors.LESSON_AUTHOR;
    let attempts = 0;
    executors.LESSON_AUTHOR = async input => {
      attempts++;
      const drafts = await author(input);
      if (attempts === 1) {
        const lesson = drafts.find(d => d.payload.kind === "LESSON");
        if (!lesson || lesson.payload.kind !== "LESSON") throw new Error("fixture_missing");
        lesson.payload = { ...lesson.payload, candidate: { ...lesson.payload.candidate, scenes: [] } };
      } else expect(input.previousFailures.length).toBeGreaterThan(0);
      return drafts;
    };
    const result = await runFactory({ blueprint: demoBlueprint(), executors, appendAudit: async () => {} });
    expect(result.status).toBe("AWAITING_HUMAN_REVIEW");
    expect(attempts).toBe(2);
    expect(result.events.findIndex(e => e.role === "INDEPENDENT_QUALITY_REVIEWER")).toBeGreaterThan(result.events.findIndex(e => e.role === "LESSON_AUTHOR" && e.status === "RETRY_REQUIRED"));
  });
});
