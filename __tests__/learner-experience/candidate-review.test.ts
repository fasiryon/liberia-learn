import fs from "fs";
import { describe, it, expect, vi } from "vitest";
import delivery from "@/docs/architecture/content-factory/evidence/first-three-v2-reconciliation.json";
import { CANDIDATE_REVIEW_IDS, candidateReviewEntry, candidateDiagnostic, diagnosticRequestSchema, reviewDiagnosticResult } from "@/lib/learner-experience/candidateReview";
import { loadPrototypeExperience } from "@/lib/learner-experience/prototypeRoute";
import { validateLessonExperience } from "@/lib/learner-experience/sceneContract";
import { validateExperienceLink } from "@/lib/learner-experience/links";
import { findLabExperience } from "@/lib/learner-experience/labExperience";
import { assertReviewReadScope } from "@/lib/curriculum/review/access";
import { initializeLab, acceptLabAction } from "@/lib/interactive-labs/v2/kernel";
import { getInteractiveLabDefinition } from "@/lib/interactive-labs/v2/registry";
import { parseResourceDraft } from "@/lib/content-factory/v2/quality";

describe("candidate review boundary", () => {
  it.each(["unknown", "__proto__", "../../input.json", "candidate-ft01-g7-civics-counties-capitals/../../", "candidate-ft01-g7-civics-counties-capitals%00"])("refuses unknown identity %s without filesystem access", id => {
    const read = vi.spyOn(fs, "readFileSync");
    expect(candidateReviewEntry(id)).toBeNull();
    expect(candidateDiagnostic(id)).toBeNull();
    expect(read).not.toHaveBeenCalled();
    read.mockRestore();
  });
  it.each(["STUDENT", "GUARDIAN", "TEACHER", "ADMIN"])("rejects %s for unassigned national candidates", role => {
    expect(() => assertReviewReadScope({ id: "synthetic", role, schoolId: "synthetic-school" }, null)).toThrow();
  });
  it("refuses client asserted scores and extra response fields", () => {
    expect(diagnosticRequestSchema.safeParse({ packageHash: "a".repeat(64), responses: {}, score: 100 }).success).toBe(false);
    expect(diagnosticRequestSchema.safeParse({ packageHash: "a".repeat(64), responses: { q1: { kind: "SINGLE_SELECT", optionId: "a", correct: true } } }).success).toBe(false);
  });
});

// Restricted content is intentionally not present on CI. Run this explicit gate locally with
// PR195_REAL_PACKAGE_QA=1; a skip is never candidate certification.
describe.skipIf(process.env.PR195_REAL_PACKAGE_QA !== "1")("exact delivered V2 learning sequence", () => {
  it.each(CANDIDATE_REVIEW_IDS)("loads the real package and registered labs for %s", id => {
    const entry = candidateReviewEntry(id)!;
    const loaded = loadPrototypeExperience(id)!;
    expect(entry).not.toBeNull();
    validateLessonExperience(entry.experience);
    expect(entry.experience.offline.packageable).toBe(false);
    expect(entry.experience.authority.releaseId).toBeNull();
    expect(entry.experience.scenes.some(s => s.type === "GUIDED_EXAMPLE")).toBe(true);
    expect(entry.links.length).toBeGreaterThan(0);
    for (const link of entry.links) {
      const lab = findLabExperience(link.experience.labId)!;
      validateExperienceLink(link, entry.experience, lab);
      expect(link.status).toBe("CANDIDATE");
      expect(link.evidenceMapping.every(m => m.disposition === "RAW_OBSERVATION")).toBe(true);
      const definition = getInteractiveLabDefinition(lab.labId)!;
      const state = initializeLab(definition);
      expect(acceptLabAction(definition, state, { type: "mode", mode: "EXPLORE" }).ok).toBe(true);
    }
    expect(loaded.labs).not.toEqual({});
    const handoff = entry.experience.scenes.at(-1)!;
    expect(handoff.interaction.kind).toBe("ASSESSMENT_HANDOFF");
    if (handoff.interaction.kind === "ASSESSMENT_HANDOFF") expect(handoff.interaction.assessment.items).toEqual([]);
    expect(JSON.stringify(entry)).not.toMatch(/"(?:specs|scoringSpecHash|answerKey|rubric|expectedObservation|responsePattern|originalAuthoringInputBase64)"/);
  });
  it.each(CANDIDATE_REVIEW_IDS)("routes failed diagnostics to real worksheet without returning keys for %s", id => {
    const diagnostic = candidateDiagnostic(id)!;
    const responses = Object.fromEntries(diagnostic.items.map(item => [item.itemId, item.itemType === "SINGLE_SELECT" ? { kind: "SINGLE_SELECT", optionId: item.options.at(-1)!.optionId } : { kind: "NUMERIC", value: "-987654321", unit: item.expectedUnit }]));
    const request = diagnosticRequestSchema.parse({ packageHash: diagnostic.packageHash, responses });
    const result = reviewDiagnosticResult(id, request)!;
    expect(result.phase).toBe("REMEDIATION");
    expect(result.remediation!.sections.length).toBeGreaterThan(0);
    expect(result.masteryWrites).toBe(false);
    expect(result.officialGrades).toBe(false);
    expect(result.released).toBe(false);
    expect(JSON.stringify({ diagnostic, result })).not.toMatch(/"(?:specs|correctOptionId|correctIndex|scoringSpecHash|answerKey|rubric|misconceptionIds|pointsAwarded)"/);
    expect(reviewDiagnosticResult(id, { ...request, packageHash: "0".repeat(64) })).toBeNull();
    const item = diagnostic.items.at(-1)!;
    expect(() => reviewDiagnosticResult(id, { ...request, responses: { ...request.responses, [item.itemId]: { kind: "SINGLE_SELECT", optionId: "unrecognized" } } })).toThrow();
  });
  it("matches all three immutable delivery hashes", () => {
    for (const id of CANDIDATE_REVIEW_IDS) expect(delivery.packages.some(p => p.packageHash === candidateDiagnostic(id)!.packageHash)).toBe(true);
  });
  it.each(CANDIDATE_REVIEW_IDS)("allows instruction after a fully correct server-evaluated diagnostic for %s", id => {
    const diagnostic = candidateDiagnostic(id)!;
    const pin = delivery.packages.find(p => p.packageHash === diagnostic.packageHash)!;
    const resource = pin.resources.find(r => r.resourceId === "diagnostic")!;
    const envelope = JSON.parse(fs.readFileSync(`${pin.reviewPackage}/${resource.file}`, "utf8"));
    const draft = parseResourceDraft({ id: envelope.id, version: envelope.version, payload: envelope.payload });
    if (draft.payload.kind !== "ASSESSMENT") throw new Error("diagnostic_required");
    const payload = draft.payload;
    const responses = Object.fromEntries(payload.items.map(item => {
      const spec = payload.specs.find(s => s.itemId === item.itemId)!;
      if (spec.key.kind === "SINGLE_SELECT") return [item.itemId, { kind: "SINGLE_SELECT", optionId: spec.key.correctOptionId }];
      if (spec.key.kind === "NUMERIC") return [item.itemId, { kind: "NUMERIC", value: String(spec.key.key.value), unit: spec.key.key.acceptedUnits[0] ?? null }];
      throw new Error("unsupported_diagnostic_key");
    }));
    expect(reviewDiagnosticResult(id, diagnosticRequestSchema.parse({ packageHash: diagnostic.packageHash, responses }))?.phase).toBe("INSTRUCTION");
  });
  it("rejects a substituted package manifest before projecting any learner data", () => {
    const original = fs.readFileSync;
    const spy = vi.spyOn(fs, "readFileSync").mockImplementation((...args: Parameters<typeof original>) => {
      if (String(args[0]).endsWith("manifest.json")) return Buffer.from("{}");
      return original(...args);
    });
    try { expect(() => candidateReviewEntry(CANDIDATE_REVIEW_IDS[0])).toThrow("candidate_manifest_pin_mismatch"); }
    finally { spy.mockRestore(); }
  });
});
