import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { authoringGenerationInput, authoringInputSchema, validateAuthoringInput } from "@/lib/content-factory/v2/authoringInput";
import { parseBlueprint, sealBlueprint } from "@/lib/content-factory/v2/blueprint";

const ids = ["wk_mca7a_fri_p4", "wk_mca7a_fri_p3", "lesson_mca_1"];
const load = (id = ids[0]) => authoringInputSchema.parse(JSON.parse(readFileSync(`curriculum/factory-v2/authoring/first-three/${id}.input-template.json`, "utf8")));

describe("First-three authoring inputs, no generated lesson content", () => {
  it.each(ids)("accepts the exact empty template for %s while blocking authored submission", id => {
    const value = load(id);
    expect(value.source.contentId).toBe(id);
    expect(value.resources.every(r => r.payload === null)).toBe(true);
    expect(Object.values(value.authors).every(a => a === null)).toBe(true);
    expect(value.assets).toEqual([]);
    const template = validateAuthoringInput(value, "template");
    expect(template.valid).toBe(true); expect(template.generatedCandidates).toBe(0);
    expect(template.readyForFactoryExecution).toBe(false);
    const authored = validateAuthoringInput(value, "authored");
    expect(authored.valid).toBe(false); expect(authored.missing).toContain("resource_payload:lesson");
    expect(authored.missing.some(m => m.startsWith("rubric:"))).toBe(true);
    expect(authored.missing.some(m => m.startsWith("misconception:"))).toBe(true);
    expect(authored.missing.some(m => m.startsWith("retention_item_binding:"))).toBe(true);
    expect(authored.released).toBe(false);
    expect(() => authoringGenerationInput(value)).toThrow("authored_input_incomplete_or_invalid");
    value.inputState = "AUTHORED_DRAFT";
    expect(validateAuthoringInput(value, "authored").valid).toBe(false);
    expect(() => authoringGenerationInput(value)).toThrow("authored_input_incomplete_or_invalid");
  });
  it("rejects source revision substitution and Civics subject replacement", () => {
    const v = load(); v.source.revisionId = "different";
    expect(() => validateAuthoringInput(v, "template")).toThrow("authoring_source_binding_mismatch");
    const other = load(); other.blueprint = sealBlueprint({ ...parseBlueprint(other.blueprint), subject: "SOCIAL_STUDIES" });
    expect(() => validateAuthoringInput(other, "template")).toThrow("authoring_blueprint_scope_mismatch");
    const whitespace = load(); whitespace.source.contentId += " ";
    expect(() => validateAuthoringInput(whitespace, "template")).toThrow();
  });
  it.each(["approved", "released", "published"])("refuses %s assertions", key => {
    const v = load(); Object.assign(v, { [key]: true });
    expect(() => validateAuthoringInput(v, "template")).toThrow();
  });
  it.each(["misconceptionBindings", "mediaSpecifications", "rubricBindings"] as const)("requires the entire %s set", key => {
    const v = load(); v[key].pop();
    expect(() => validateAuthoringInput(v, "template")).toThrow();
  });
  it("preserves every authoritative independent task and retention requirement", () => {
    const v = load(); const b = parseBlueprint(v.blueprint);
    b.assessmentPlan.find(t => t.timing === "END_OF_LESSON")!.scoring = "NOT_SCORED";
    v.blueprint = sealBlueprint(b);
    expect(validateAuthoringInput(v, "template").failures.some(f => f.startsWith("required_assessment_task_changed:"))).toBe(true);
    const retention = load(); const plan = parseBlueprint(retention.blueprint);
    plan.assessmentPlan.find(t => t.kind === "DELAYED_RETRIEVAL")!.delayDays = 3;
    retention.blueprint = sealBlueprint(plan);
    expect(validateAuthoringInput(retention, "template").failures).toContain("retention_delay_unbound");
    const omitted = load(); omitted.retentionChecks.items.pop();
    expect(() => validateAuthoringInput(omitted, "template")).toThrow("authoring_retention_requirements_missing");
  });
  it("routes lesson fields through the strict owner parser so protected keys cannot enter lesson content", () => {
    const v = load(); v.resources.find(r => r.id === "lesson")!.payload = { kind: "LESSON", candidate: { answerKey: "restricted-test-marker" } };
    expect(validateAuthoringInput(v, "template").failures.some(f => f.startsWith("resource_invalid:lesson:"))).toBe(true);
  });
  it("supports an SVG specification without claiming an SVG byte adapter or completed media", () => {
    const v = load(); v.mediaSpecifications[0].mimeType = "image/svg+xml";
    const result = validateAuthoringInput(v, "template");
    expect(result.valid).toBe(true);
    expect(result.executionBlockers).toContain(`SVG_ASSET_ADAPTER_REQUIRED:${v.mediaSpecifications[0].id}`);
    v.mediaSpecifications[0].mimeType = "video/mp4";
    expect(validateAuthoringInput(v, "template").missing).toContain(`media_transcript:${v.mediaSpecifications[0].id}`);
  });
  it("reuses actual-byte integrity validation and refuses authoring review/approval identities", () => {
    const v = load(); const b = parseBlueprint(v.blueprint);
    v.assets.push({ resourceId: "lesson", sceneId: "fixture-scene", mediaId: "fixture-media", altText: "Synthetic test bytes", mimeType: "text/plain", bytesBase64: "dGVzdA==", sha256: "0".repeat(64), provenance: b.sources[0], license: "test-only", origin: { kind: "EXISTING", attribution: "Synthetic integrity test" } });
    expect(validateAuthoringInput(v, "template").failures).toContain("batch_asset_hash_mismatch");
    v.authors.GOVERNANCE_RELEASE = { kind: "AI", agentId: "fixture", modelFamily: "fixture", sessionId: "fixture" };
    expect(validateAuthoringInput(v, "template").failures).toContain("review_authority_not_an_authoring_input:GOVERNANCE_RELEASE");
  });
});
