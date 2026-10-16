import { describe, expect, it } from "vitest";
import { buildDemo, demoBlueprint, demoExecutors } from "@/lib/content-factory/v2/demo";
import { sealBlueprint } from "@/lib/content-factory/v2/blueprint";
import { runFactory } from "@/lib/content-factory/v2/manager";
import { sealDefinition, sealForm } from "@/lib/assessment/v2/hash";
import { artifactHash, checkPackage } from "@/lib/content-factory/v2/quality";

describe("Independent Content Factory V2 adversarial review", () => {
  it("rejects a formative quiz standing in for delayed retrieval", async () => {
    const b = demoBlueprint();
    const blueprint = sealBlueprint({ ...b, assessmentPlan: b.assessmentPlan.map(t => t.kind === "DELAYED_RETRIEVAL" ? { ...t, resourceId: "quiz" } : t) });
    const result = await runFactory({ blueprint, executors: demoExecutors(), appendAudit: async () => {} });
    expect(result.status).not.toBe("AWAITING_HUMAN_REVIEW");
  });

  it("rejects a sequence claiming extension objectives for a core lesson", () => {
    const b = demoBlueprint();
    const extensionId = b.objectives.find(o => o.kind === "LIBERIALEARN_EXTENSION")!.id;
    expect(() => sealBlueprint({ ...b, sequence: b.sequence.map(s => s.resourceId === "lesson-1" ? { ...s, objectiveIds: [extensionId] } : s) })).toThrow();
  });

  it("rejects a reviewer sharing the lesson author's stable identity", async () => {
    const result = await runFactory({ blueprint: demoBlueprint(), executors: demoExecutors(), appendAudit: async () => {},
      actors: { LESSON_AUTHOR: { kind: "AI", agentId: "same-author", modelFamily: "family-a", sessionId: "author-session" },
        INDEPENDENT_QUALITY_REVIEWER: { kind: "AI", agentId: "same-author", modelFamily: "family-b", sessionId: "review-session" } } });
    expect(result.status).toBe("FAILED");
    expect(result.events.some(e => e.error === "self_review_forbidden")).toBe(true);
  });

  it("rejects approval authority smuggled into a resealed nested assessment definition", async () => {
    const executors = demoExecutors();
    const original = executors.ASSESSMENT_DESIGNER;
    executors.ASSESSMENT_DESIGNER = async input => {
      const drafts = await original(input);
      const assessment = drafts.find(d => d.payload.kind === "ASSESSMENT")!;
      if (assessment.payload.kind !== "ASSESSMENT") throw new Error("fixture_missing");
      const p = assessment.payload;
      p.definition = sealDefinition({ ...p.definition, ...{ approved: true, official: true } });
      p.form = sealForm({ ...p.form, definition: { definitionId: p.definition.definitionId, version: p.definition.version, contentHash: p.definition.contentHash } });
      return drafts;
    };
    const result = await runFactory({ blueprint: demoBlueprint(), executors, appendAudit: async () => {} });
    expect(result.status).not.toBe("AWAITING_HUMAN_REVIEW");
  });

  it("detects a resealed artifact that points to a stale dependency hash", async () => {
    const result = await buildDemo();
    const artifacts = structuredClone(result.artifacts);
    const target = artifacts.find(a => a.dependencies.length)!;
    target.dependencies[0].contentHash = "0".repeat(64);
    target.contentHash = artifactHash(target);
    expect(checkPackage(result.blueprint, artifacts).failures).toContain(`dependency_hash_mismatch:${target.id}:${target.dependencies[0].id}`);
  });

  it("detects protected scoring prose copied into a learner worksheet even after resealing", async () => {
    const result = await buildDemo();
    const artifacts = structuredClone(result.artifacts);
    const assessment = artifacts.find(a => a.payload.kind === "ASSESSMENT")!;
    const worksheet = artifacts.find(a => a.id === "worksheet")!;
    if (assessment.payload.kind !== "ASSESSMENT" || worksheet.payload.kind !== "DOCUMENT") throw new Error("fixture_missing");
    worksheet.payload.sections[0].text = assessment.payload.specs[0].moderationNotes[0];
    worksheet.contentHash = artifactHash(worksheet);
    expect(checkPackage(result.blueprint, artifacts).failures).toContain("assessment_secret_in_resource:worksheet");
  });
});
