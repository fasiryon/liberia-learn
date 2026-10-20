import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { hashCurriculumSnapshot } from "@/lib/curriculum/provenance/hash";
import { buildCurriculumContentSnapshot } from "@/lib/curriculum/provenance/snapshot";
import { firstTenBlueprint, rawSha256, validateFirstTenSources } from "@/lib/content-factory/v2/firstTen";
import { demoBlueprint } from "@/lib/content-factory/v2/demo";
import { blueprintHash, parseBlueprint, sealBlueprint } from "@/lib/content-factory/v2/blueprint";

function fixture() {
  const capturedAt = "2026-10-16T18:44:42.884Z";
  const records = Array.from({ length: 10 }, (_, i) => {
    const projection = buildCurriculumContentSnapshot({ title: `Synthetic lesson ${i}`, grade: 7, subject: "CIVICS", contentType: "LESSON", payload: { body: `Synthetic instructional body ${i}` }, unitId: null, orderInUnit: null, lessonType: null, learningObjectives: [], moeAlignments: null, waecSyllabusTopics: [], deliveryProfile: null, heroImageUrl: null, heroImageMeta: null, inlineIllustrations: null });
    const contentHash = hashCurriculumSnapshot(projection.schemaVersion, projection.snapshot);
    return { id: `fixture-row-${i}`, contentId: `fixture-logical-${i}`, row: { grade: 7, subject: "CIVICS", contentType: "LESSON", title: `Synthetic lesson ${i}`, version: "1.0.0", status: "APPROVED" },
      revision: { id: `fixture-revision-${i}`, sequence: 1, snapshotSchemaVersion: projection.schemaVersion, contentSnapshot: projection.snapshot, contentHash }, liveSnapshot: null,
      verification: { revisionHashMatches: true, liveRowEqualsRevision: true, storedRevisionHash: contentHash, recomputedRevisionHash: contentHash, liveSnapshotHash: contentHash }, dependencies: { assignments: 2, gradedSubmissions: 3, learningEvents: 7 },
    };
  });
  const spec = { contractVersion: "liberialearn-first-ten-modernization-contract/1.0.0", status: "READY_FOR_OWNER_APPROVAL", basis: { inventory: { extractSha256: "", lessons: 10, capturedAt } },
    lessons: records.map((r, i) => ({ key: `fixture-${i}`, contentPk: r.id, contentId: r.contentId, grade: 7, subject: "CIVICS", unitId: null, legacyTitle: r.row.title, legacy: { revisionId: r.revision.id, contentHash: r.revision.contentHash },
      objectives: [{ id: `o${i}`, statement: "Explain a synthetic example.", layer: "LIBERIALEARN_MASTERY" }, { id: `ge${i}`, statement: "Reason from an unfamiliar synthetic example.", layer: "GLOBAL_EXCELLENCE" }],
      prerequisites: [{ id: `p${i}`, statement: "Read the example.", diagnostic: "Read a label.", fallbackRoute: "Use text labels." }], independentAssessment: { endOfLesson: [{ id: `a${i}`, objectiveIds: [`o${i}`, `ge${i}`], kind: "REASONING_TASK", scoring: "ANALYTIC_RUBRIC", task: "Explain the example independently." }] },
      retention: { delayDays: 7, items: ["Explain a new example."] }, transfer: { context: "NEW", scoring: "ANALYTIC_RUBRIC", task: "Apply to a different example." }, extension: { optional: true, task: "Explore another example." },
    })),
  };
  const manifest = { capturedAt, lessons: 10, revisionHashMismatches: 0, liveRowsDifferingFromCurrentRevision: 0, extractSha256: "", transactionReadOnly: "on", dependencyCounts: ["assignments", "gradedSubmissions", "learningEvents"] };
  const encode = () => {
    const extractBytes = Buffer.from(records.map(r => JSON.stringify(r)).join("\n") + "\n");
    manifest.extractSha256 = rawSha256(extractBytes); spec.basis.inventory.extractSha256 = manifest.extractSha256;
    const specBytes = Buffer.from(JSON.stringify(spec));
    return { extractBytes, specBytes, manifestBytes: Buffer.from(JSON.stringify(manifest)), expectedSpecSha256: rawSha256(specBytes) };
  };
  return { spec, records, manifest, encode };
}

describe("Fixed first-ten source intake", () => {
  it("preserves the complete exact cohort, dependency counts and Civics while producing valid planning blueprints", () => {
    const f = fixture(); const input = f.encode(); const before = input.extractBytes.toString();
    const result = validateFirstTenSources(input);
    expect(result.lessons.map(l => l.sourceRef.contentId)).toEqual(f.spec.lessons.map(l => l.contentId));
    expect(result.lessons[0].source.dependencies).toEqual(f.records[0].dependencies);
    expect(input.extractBytes.toString()).toBe(before);
    for (let i = 0; i < 10; i++) {
      const blueprint = firstTenBlueprint(result, i);
      expect(blueprint.subject).toBe("CIVICS"); expect(blueprint.schemaVersion).toBe("unit-blueprint/2.1.0");
      expect(blueprint.objectives.every(o => o.scope === "REQUIRED")).toBe(true);
      expect(blueprint.objectives.map(o => o.kind)).toEqual(["LIBERIALEARN_MASTERY", "GLOBAL_EXCELLENCE"]);
      expect(blueprint.legacy[0]).toMatchObject(result.lessons[i].sourceRef);
      expect(blueprint.assessmentPlan.find(t => t.id === `a${i}`)).toMatchObject({ kind: "EXTENDED_REASONING", scaffold: "NONE", timing: "END_OF_LESSON" });
      expect(blueprint.unresolved).toContain("AUTHORING_DRAFTS_KEYS_RUBRICS_AND_MEDIA_REQUIRED");
    }
  });
  it("retains the 2.0 blueprint hash and refuses new required layers tagged as 2.0", () => {
    const old = demoBlueprint(); expect(blueprintHash(old)).toBe(old.contentHash);
    expect(old.schemaVersion).toBe("unit-blueprint/2.0.0");
    const persisted = JSON.parse(readFileSync("artifacts/content-factory-v2/demo/run-1792192144091/unit-blueprint.json", "utf8"));
    expect(parseBlueprint(persisted).contentHash).toBe("a2382c06ce4ec96be3634e9f0304689f88316a39d11fa976c4a44bbbe4dce40a");
    const modern = firstTenBlueprint(validateFirstTenSources(fixture().encode()), 0);
    expect(() => sealBlueprint({ ...modern, schemaVersion: "unit-blueprint/2.0.0" })).toThrow("objective_layers_require_blueprint_2_1");
  });
  it("preserves keyed transfer tasks instead of replacing the cohort's scoring design", () => {
    const f = fixture(); f.spec.lessons[7].transfer.scoring = "KEYED";
    const sources = validateFirstTenSources(f.encode());
    expect(firstTenBlueprint(sources, 7).assessmentPlan.find(t => t.kind === "TRANSFER_TASK")?.scoring).toBe("KEYED");
  });
  it("rejects spec or raw-export tampering before source selection", () => {
    const input = fixture().encode();
    expect(() => validateFirstTenSources({ ...input, specBytes: Buffer.from("{}") })).toThrow("first_ten_spec_hash_mismatch");
    expect(() => validateFirstTenSources({ ...input, extractBytes: Buffer.concat([input.extractBytes, Buffer.from(" ")]) })).toThrow("first_ten_extract_hash_mismatch");
  });
  it.each(["contentId", "revision", "scope", "body", "live", "counts", "readOnly", "duplicate", "eleven", "boolean"])("blocks malformed or inconsistent %s evidence", kind => {
    const f = fixture();
    if (kind === "contentId") f.records[0].contentId = "different";
    if (kind === "revision") f.records[0].revision.id = "different";
    if (kind === "scope") f.records[0].row.subject = "SOCIAL_STUDIES";
    if (kind === "body") f.records[0].revision.contentSnapshot.delivery.body = "changed";
    if (kind === "live") f.records[0].verification.liveSnapshotHash = "0".repeat(64);
    if (kind === "counts") f.records[0].dependencies.assignments = -1;
    if (kind === "readOnly") f.manifest.transactionReadOnly = "off";
    if (kind === "duplicate") f.records[9].id = f.records[0].id;
    if (kind === "eleven") f.spec.lessons.push(f.spec.lessons[0]);
    if (kind === "boolean") Object.assign(f.records[0].verification, { liveRowEqualsRevision: "true" });
    expect(() => validateFirstTenSources(f.encode())).toThrow();
  });
});
