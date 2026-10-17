import fs from "fs";
import path from "path";
import { z } from "zod";
import { createHash } from "crypto";
import { loadLibraryExtract } from "@/lib/curriculum/modernization/extract";
import { hashCurriculumSnapshot } from "@/lib/curriculum/provenance/hash";
import { digest, sealBlueprint, type ExactPin, type UnitBlueprint } from "./blueprint";
import baseline from "@/curriculum/factory-v2/first-ten-baseline.json";

export const FIRST_TEN_INTAKE_VERSION = "factory-first-ten-intake/1.0.0";
export const FIRST_TEN_BASELINE = baseline;
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const id = z.string().min(1);
const count = z.number().int().nonnegative();
const objective = z.object({ id, statement: id, layer: z.enum(["NATIONAL_FOUNDATION", "LIBERIALEARN_MASTERY", "GLOBAL_EXCELLENCE"]) }).passthrough();
const task = z.object({ id, objectiveIds: z.array(id).min(1), kind: z.enum(["CONSTRUCTED", "CONSTRUCTED_EXPLANATION", "SELECTED_RESPONSE_DIAGNOSTIC", "REASONING_TASK", "PRODUCED_ANSWER", "ORIGINAL_WRITING"]), scoring: z.enum(["KEYED", "ANALYTIC_RUBRIC"]), task: id }).passthrough();
const specSchema = z.object({ contractVersion: z.literal("liberialearn-first-ten-modernization-contract/0.1.0"), status: id,
  basis: z.object({ inventory: z.object({ extractSha256: hash, lessons: count, capturedAt: id }) }),
  lessons: z.array(z.object({ key: id, contentPk: id, contentId: id, grade: z.number().int().min(1).max(12), subject: id, unitId: id.nullable(), legacyTitle: id,
    legacy: z.object({ revisionId: id, contentHash: hash }).passthrough(), objectives: z.array(objective).min(1),
    prerequisites: z.array(z.object({ id, statement: id, diagnostic: id, fallbackRoute: id }).passthrough()),
    independentAssessment: z.object({ endOfLesson: z.array(task).min(1) }).passthrough(),
    retention: z.object({ delayDays: z.number().int().min(7), items: z.array(id).min(1) }).passthrough(),
    transfer: z.object({ context: z.literal("NEW"), scoring: z.enum(["KEYED", "ANALYTIC_RUBRIC"]), task: id }).passthrough(),
    extension: z.object({ optional: z.literal(true), task: id }).passthrough(),
  }).passthrough()).length(10),
}).passthrough();
const manifestSchema = z.object({ capturedAt: id, lessons: count, revisionHashMismatches: z.literal(0), liveRowsDifferingFromCurrentRevision: z.literal(0), extractSha256: hash, transactionReadOnly: z.literal("on"), dependencyCounts: z.array(id).min(1) }).passthrough();
const rowSchema = z.object({ id, contentId: id,
  row: z.object({ grade: z.number().int().min(1).max(12), subject: id, contentType: id, title: id.nullable(), version: id, status: id }).passthrough(),
  revision: z.object({ id, sequence: count, snapshotSchemaVersion: z.number().int().positive(), contentHash: hash, contentSnapshot: z.unknown() }).passthrough(),
  liveSnapshot: z.unknown(),
  verification: z.object({ revisionHashMatches: z.literal(true), liveRowEqualsRevision: z.literal(true), storedRevisionHash: hash, recomputedRevisionHash: hash, liveSnapshotHash: hash }).passthrough(),
  dependencies: z.record(z.string(), count),
}).passthrough();
export const rawSha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

/** Integrity only. Exported live-row assertions and operator authority are not independently proven. */
export function validateFirstTenSources(input: { specBytes: Buffer; manifestBytes: Buffer; extractBytes: Buffer; expectedSpecSha256: string }) {
  const specSha256 = rawSha256(input.specBytes);
  if (specSha256 !== input.expectedSpecSha256) throw new Error("first_ten_spec_hash_mismatch");
  const spec = specSchema.parse(JSON.parse(input.specBytes.toString("utf8")));
  const manifest = manifestSchema.parse(JSON.parse(input.manifestBytes.toString("utf8")));
  const extractSha256 = rawSha256(input.extractBytes);
  if (extractSha256 !== manifest.extractSha256 || extractSha256 !== spec.basis.inventory.extractSha256) throw new Error("first_ten_extract_hash_mismatch");
  const records = input.extractBytes.toString("utf8").split(/\r?\n/).filter(line => line.trim()).map(line => z.object({ id, contentId: id }).passthrough().parse(JSON.parse(line)));
  if (records.length !== manifest.lessons || records.length !== spec.basis.inventory.lessons || manifest.capturedAt !== spec.basis.inventory.capturedAt) throw new Error("first_ten_extract_count_or_capture_mismatch");
  for (const keys of [records.map(r => r.id), records.map(r => r.contentId), spec.lessons.map(l => l.contentPk), spec.lessons.map(l => l.contentId), spec.lessons.map(l => l.legacy.revisionId)]) if (new Set(keys).size !== keys.length) throw new Error("first_ten_duplicate_identity");
  const lessons = spec.lessons.map((lesson, index) => {
    const source = rowSchema.parse(records.find(row => row.id === lesson.contentPk));
    if (source.contentId !== lesson.contentId || source.revision.id !== lesson.legacy.revisionId || source.revision.contentHash !== lesson.legacy.contentHash) throw new Error("first_ten_source_binding_mismatch");
    if (source.row.grade !== lesson.grade || source.row.subject !== lesson.subject || source.row.contentType.toUpperCase() !== "LESSON") throw new Error("first_ten_source_scope_mismatch");
    const snapshot = z.object({ identity: z.object({ grade: z.number(), subject: id }), delivery: z.record(z.string(), z.unknown()) }).passthrough().parse(source.revision.contentSnapshot);
    if (snapshot.identity.grade !== lesson.grade || snapshot.identity.subject !== lesson.subject) throw new Error("first_ten_snapshot_scope_mismatch");
    if (!["body", "bodyStandard", "bodyBlock", "legacyContent", "lessonContent"].some(k => typeof snapshot.delivery[k] === "string" && String(snapshot.delivery[k]).trim())) throw new Error("first_ten_body_missing");
    const recomputed = hashCurriculumSnapshot(source.revision.snapshotSchemaVersion, source.revision.contentSnapshot);
    if ([lesson.legacy.contentHash, source.verification.storedRevisionHash, source.verification.recomputedRevisionHash, source.verification.liveSnapshotHash].some(value => value !== recomputed)) throw new Error("first_ten_snapshot_hash_mismatch");
    if (source.liveSnapshot !== null) throw new Error("first_ten_live_projection_differs");
    if (manifest.dependencyCounts.some(key => !Object.hasOwn(source.dependencies, key))) throw new Error("first_ten_dependency_count_missing");
    const sourceRef = { databaseId: source.id, contentId: source.contentId, revisionId: source.revision.id, revisionNumber: source.revision.sequence, snapshotSha256: source.revision.contentHash };
    return { index, lesson, source, sourceRef };
  });
  return { spec, specSha256, manifest, manifestSha256: rawSha256(input.manifestBytes), extractSha256, lessons };
}
export type FirstTenSources = ReturnType<typeof validateFirstTenSources>;

/** Reuse the original loader, then strengthen its cast-based parsing at the factory boundary. */
export function loadFirstTenSources(specBytes: Buffer, extractDirectory: string): FirstTenSources {
  loadLibraryExtract(extractDirectory);
  const result = validateFirstTenSources({ specBytes, manifestBytes: fs.readFileSync(path.join(extractDirectory, "manifest.json")), extractBytes: fs.readFileSync(path.join(extractDirectory, "lessons.jsonl")), expectedSpecSha256: baseline.specSha256 });
  const actual = result.lessons.map(({ lesson, sourceRef }) => ({ key: lesson.key, ...sourceRef, grade: lesson.grade, subject: lesson.subject }));
  const expected = baseline.lessons.map(l => ({ key: l.key, databaseId: l.databaseId, contentId: l.contentId, revisionId: l.revisionId, revisionNumber: 1, snapshotSha256: l.snapshotSha256, grade: l.grade, subject: l.subject }));
  if (digest("first-ten-order", actual) !== digest("first-ten-order", expected)) throw new Error("first_ten_cohort_changed");
  return result;
}

const KIND_MAP = { CONSTRUCTED: "SHORT_CONSTRUCTED_RESPONSE", CONSTRUCTED_EXPLANATION: "SHORT_CONSTRUCTED_RESPONSE", SELECTED_RESPONSE_DIAGNOSTIC: "SELECTED_RESPONSE", REASONING_TASK: "EXTENDED_REASONING", PRODUCED_ANSWER: "SHORT_CONSTRUCTED_RESPONSE", ORIGINAL_WRITING: "ORIGINAL_WRITING" } as const;

/** Planning only. No candidate body, scoring key, visual asset, approval or review is invented. */
export function firstTenBlueprint(sources: FirstTenSources, index: number): UnitBlueprint {
  const { lesson, sourceRef } = sources.lessons[index];
  const pin: ExactPin = { id: "first-ten-cohort-contract", version: "0.1.0", sha256: sources.specSha256, sourceRef: `git:${baseline.sourceCommit}:${baseline.specPath}` };
  const objectiveIds = lesson.objectives.map(o => o.id);
  const resource = (id: string, kind: UnitBlueprint["resources"][number]["kind"], role: UnitBlueprint["resources"][number]["role"], dependsOn: string[], audience: UnitBlueprint["resources"][number]["audience"] = "LEARNER") => ({ id, kind, role, dependsOn, audience, objectiveIds });
  const evidence = (id: string, resourceId: string, kind: UnitBlueprint["assessmentPlan"][number]["kind"], extra: Partial<UnitBlueprint["assessmentPlan"][number]> = {}) => ({ id, resourceId, kind, itemIds: [`${id}-item`], objectiveIds, scaffold: "NONE" as const, timing: "END_OF_LESSON" as const, context: "REHEARSED" as const, scoring: "ANALYTIC_RUBRIC" as const, source: "EXCELLENCE_PLAN" as const, ref: `${pin.sourceRef}#/lessons/${index}`, ...extra });
  return sealBlueprint({ schemaVersion: "unit-blueprint/2.1.0", blueprintId: `candidate-${lesson.key}`, version: "0.1.0", grade: lesson.grade, subject: lesson.subject,
    unitId: `candidate-unit-${lesson.key}`, title: lesson.legacyTitle, repositoryCommit: baseline.sourceCommit, sources: [pin], provenance: [pin], legacy: [{ ...sourceRef, inventoryPin: { id: "first-ten-local-extract", version: "1.0.0", sha256: sources.extractSha256, sourceRef: "local-read-only-extract:lessons.jsonl" } }],
    objectives: lesson.objectives.map((o, i) => ({ id: o.id, statement: o.statement, kind: o.layer === "NATIONAL_FOUNDATION" ? "NATIONAL" : o.layer, scope: "REQUIRED", sourceId: pin.id, sourcePointer: `/lessons/${index}/objectives/${i}`, mapping: "PROPOSED" })),
    outcomes: lesson.objectives.map(o => ({ id: `${o.id}-outcome`, objectiveIds: [o.id], demonstration: o.statement })),
    prerequisites: lesson.prerequisites.map(p => ({ id: p.id, statement: p.statement, diagnosticResourceId: "diagnostic", fallbackResourceId: "worksheet" })),
    misconceptions: [], sequence: [{ resourceId: "diagnostic", dependsOn: [], objectiveIds, scaffold: "NONE" }, { resourceId: "lesson", dependsOn: ["diagnostic"], objectiveIds, scaffold: "FULL" }, { resourceId: "summative", dependsOn: ["lesson"], objectiveIds, scaffold: "NONE" }],
    resources: [resource("curriculum-map", "DESIGN_NOTE", "CURRICULUM_ARCHITECT", [], "REVIEWER_ONLY"), resource("learning-design", "DESIGN_NOTE", "LEARNING_SCIENCE_DESIGNER", ["curriculum-map"], "REVIEWER_ONLY"), resource("lesson", "LESSON", "LESSON_AUTHOR", ["learning-design"]), resource("classwork", "CLASSWORK", "LESSON_AUTHOR", ["lesson"]), resource("worksheet", "WORKSHEET", "LESSON_AUTHOR", ["lesson"]), resource("diagnostic", "QUIZ", "ASSESSMENT_DESIGNER", ["lesson"]), resource("summative", "SUMMATIVE", "ASSESSMENT_DESIGNER", ["lesson"]), resource("retention", "RETENTION", "ASSESSMENT_DESIGNER", ["summative"]), resource("transfer", "TRANSFER", "ASSESSMENT_DESIGNER", ["summative"]), resource("answer-keys", "ANSWER_KEY", "ASSESSMENT_DESIGNER", ["diagnostic", "summative", "retention", "transfer"], "REVIEWER_ONLY"), resource("rubrics", "RUBRIC", "ASSESSMENT_DESIGNER", ["summative", "transfer"], "REVIEWER_ONLY"), resource("extension", "EXTENSION", "MEDIA_ACCESSIBILITY", ["lesson"])],
    assessmentPlan: [
      ...lesson.prerequisites.map((p, i) => evidence(`${p.id}-diagnostic`, "diagnostic", "PREREQUISITE_DIAGNOSTIC", { timing: "PRE_LESSON", scoring: "KEYED", prerequisiteIndex: i, fallbackRoute: "worksheet" })),
      evidence(`${lesson.key}-practice`, "classwork", "SHORT_CONSTRUCTED_RESPONSE", { itemIds: [], timing: "IN_LESSON", scoring: "NOT_SCORED" }),
      ...lesson.independentAssessment.endOfLesson.map((t, i) => evidence(t.id, "summative", KIND_MAP[t.kind], { objectiveIds: t.objectiveIds, scoring: t.scoring, ref: `${pin.sourceRef}#/lessons/${index}/independentAssessment/endOfLesson/${i}` })),
      evidence(`${lesson.key}-retention`, "retention", "DELAYED_RETRIEVAL", { timing: "DELAYED", delayDays: lesson.retention.delayDays, scoring: "KEYED" }),
      evidence(`${lesson.key}-transfer`, "transfer", "TRANSFER_TASK", { context: "NEW", scoring: lesson.transfer.scoring }),
      evidence(`${lesson.key}-extension`, "extension", "EXTENSION", { itemIds: [], optional: true, timing: "IN_LESSON", scoring: "NOT_SCORED" }),
    ],
    support: { differentiation: ["Author must supply grade-appropriate scaffolding and preserve independent assessment."], accessibility: ["Author must supply each specified visual with provenance, alt text and a keyboard/text alternative."], offline: { mode: "TEXT_PAPER_CAPTURE_ONLY", requirements: ["Author must implement the original specification's offline fallbacks."], maxBytes: 500000 } },
    unresolved: ["AUTHORING_DRAFTS_KEYS_RUBRICS_AND_MEDIA_REQUIRED", "MISCONCEPTION_ITEM_BINDINGS_REQUIRED", "LOCAL_EXPORT_NOT_PRODUCTION_ATTESTED", "LIVE_ROW_ASSERTION_NOT_INDEPENDENTLY_PROVEN", "FULL_DEPENDENCY_STORE_COVERAGE_NOT_CAPTURED", "QUALIFIED_CURRICULUM_MAPPING_REVIEW_REQUIRED", "EXACT_REVISION_HUMAN_REVIEW_REQUIRED"],
  });
}
