import { z } from "zod";
import { createHash } from "crypto";
import { canonicalizeJson } from "@/lib/curriculum/provenance/hash";
import { ASSESSMENT_EVIDENCE_KINDS } from "@/lib/curriculum/excellence/assessmentBlueprint";
import { SCAFFOLD_LEVELS } from "@/lib/curriculum/v2/contract";

export const UNIT_BLUEPRINT_VERSION = "unit-blueprint/2.0.0" as const;
export const FACTORY_ROLES = ["CURRICULUM_ARCHITECT", "LEARNING_SCIENCE_DESIGNER", "LESSON_AUTHOR", "ASSESSMENT_DESIGNER", "PROJECT_PRACTICAL_DESIGNER", "MEDIA_ACCESSIBILITY", "INDEPENDENT_QUALITY_REVIEWER", "GOVERNANCE_RELEASE"] as const;
export type FactoryRole = typeof FACTORY_ROLES[number];
export const RESOURCE_KINDS = ["DESIGN_NOTE", "LESSON", "CLASSWORK", "HOMEWORK", "QUIZ", "SUMMATIVE", "PRACTICAL", "PROJECT", "TEACHER_GUIDE", "ANSWER_KEY", "RUBRIC", "WORKSHEET", "ACCESSIBLE_ASSET", "RETENTION", "TRANSFER", "EXTENSION"] as const;

const id = z.string().min(1).max(500).refine(s => s.trim() === s && !/^(latest|current|\*)$/i.test(s), "exact_identity_required");
const text = z.string().trim().min(1).max(12000);
const ids = z.array(id).max(500).refine(a => new Set(a).size === a.length, "duplicate_id");
const version = z.string().regex(/^\d+\.\d+\.\d+$/);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
export const exactPinSchema = z.strictObject({ id, version: id, sha256, sourceRef: id });
export type ExactPin = z.infer<typeof exactPinSchema>;

export const unitBlueprintSchema = z.strictObject({
  schemaVersion: z.literal(UNIT_BLUEPRINT_VERSION), blueprintId: id, version, contentHash: sha256,
  grade: z.number().int().min(1).max(12), subject: id, unitId: id, title: text,
  repositoryCommit: z.string().regex(/^[a-f0-9]{40}$/), sources: z.array(exactPinSchema).min(1),
  objectives: z.array(z.strictObject({ id, kind: z.enum(["NATIONAL", "LIBERIALEARN_EXTENSION"]), statement: text,
    sourceId: id, sourcePointer: id, scope: z.enum(["REQUIRED", "OPTIONAL_EXTENSION"]),
    mapping: z.enum(["PROPOSED", "SOURCE_PINNED"]),
  })).min(1),
  outcomes: z.array(z.strictObject({ id, objectiveIds: ids.min(1), demonstration: text })).min(1),
  prerequisites: z.array(z.strictObject({ id, statement: text, diagnosticResourceId: id, fallbackResourceId: id })),
  misconceptions: z.array(z.strictObject({ id, objectiveId: id, description: text, instructionResourceId: id, assessmentResourceId: id, responsePattern: text })),
  sequence: z.array(z.strictObject({ resourceId: id, dependsOn: ids, objectiveIds: ids.min(1), scaffold: z.enum(SCAFFOLD_LEVELS) })).min(1),
  resources: z.array(z.strictObject({ id, kind: z.enum(RESOURCE_KINDS), role: z.enum(FACTORY_ROLES), objectiveIds: ids.min(1), dependsOn: ids,
    audience: z.enum(["LEARNER", "TEACHER", "REVIEWER_ONLY"]),
  })).min(1),
  assessmentPlan: z.array(z.strictObject({
    id, resourceId: id, itemIds: ids, kind: z.enum(ASSESSMENT_EVIDENCE_KINDS), objectiveIds: ids.min(1), scaffold: z.enum(SCAFFOLD_LEVELS),
    timing: z.enum(["PRE_LESSON", "IN_LESSON", "END_OF_LESSON", "DELAYED"]), delayDays: z.number().int().positive().optional(),
    context: z.enum(["REHEARSED", "NEW"]), scoring: z.enum(["KEYED", "ANALYTIC_RUBRIC", "NOT_SCORED"]),
    prerequisiteIndex: z.number().int().nonnegative().optional(), fallbackRoute: text.optional(), optional: z.boolean().optional(),
    source: z.literal("EXCELLENCE_PLAN"), ref: id,
  })).min(1),
  support: z.strictObject({ differentiation: z.array(text).min(1), accessibility: z.array(text).min(1),
    offline: z.strictObject({ mode: z.literal("TEXT_PAPER_CAPTURE_ONLY"), requirements: z.array(text).min(1), maxBytes: z.number().int().positive() }),
  }),
  provenance: z.array(exactPinSchema).min(1),
  legacy: z.array(z.strictObject({ databaseId: id, contentId: id, revisionId: id, revisionNumber: z.number().int().nonnegative(), snapshotSha256: sha256, inventoryPin: exactPinSchema })),
  legacyLeads: z.array(z.strictObject({ identifier: id, reportedNamespace: z.literal("REVISION_ID_IN_PR191"), subject: id, reportedTitle: text, verification: z.literal("UNVERIFIED_REFERENCE_ONLY") })).optional(),
  unresolved: z.array(text),
});
export type UnitBlueprint = z.infer<typeof unitBlueprintSchema>;
export type BlueprintRef = Pick<UnitBlueprint, "blueprintId" | "version" | "contentHash">;

export function digest(domain: string, value: unknown): string {
  return createHash("sha256").update(canonicalizeJson({ domain, value })).digest("hex");
}
export function blueprintHash(blueprint: Omit<UnitBlueprint, "contentHash"> | UnitBlueprint): string {
  const { contentHash: _hash, ...payload } = { contentHash: "", ...blueprint };
  return digest(UNIT_BLUEPRINT_VERSION, payload);
}
export function blueprintRef(blueprint: UnitBlueprint): BlueprintRef {
  return { blueprintId: blueprint.blueprintId, version: blueprint.version, contentHash: blueprint.contentHash };
}

/** Parse before generation. References and sequencing are validated as one contract. */
export function parseBlueprint(input: unknown): UnitBlueprint {
  const b = unitBlueprintSchema.parse(input);
  if (b.contentHash !== blueprintHash(b)) throw new Error("blueprint_hash_mismatch");
  const unique = (values: string[]) => { if (new Set(values).size !== values.length) throw new Error("duplicate_identity"); };
  unique(b.sources.map(s => s.id)); unique(b.objectives.map(o => o.id)); unique(b.outcomes.map(o => o.id));
  unique(b.resources.map(r => r.id)); unique(b.sequence.map(s => s.resourceId)); unique(b.assessmentPlan.map(t => t.id));
  unique(b.prerequisites.map(p => p.id)); unique(b.misconceptions.map(m => m.id));
  const objectiveIds = new Set(b.objectives.map(o => o.id));
  const resourceIds = new Set(b.resources.map(r => r.id));
  const assertObjectives = (values: string[]) => { if (values.some(v => !objectiveIds.has(v))) throw new Error("unknown_objective"); };
  const assertResources = (values: string[]) => { if (values.some(v => !resourceIds.has(v))) throw new Error("unknown_resource"); };
  for (const o of b.objectives) {
    if (!b.sources.some(s => s.id === o.sourceId)) throw new Error("objective_source_missing");
    if (o.kind === "LIBERIALEARN_EXTENSION" && o.scope !== "OPTIONAL_EXTENSION") throw new Error("extension_must_be_optional");
  }
  for (const o of b.outcomes) assertObjectives(o.objectiveIds);
  for (const o of b.objectives) if (!b.outcomes.some(outcome => outcome.objectiveIds.includes(o.id))) throw new Error("outcome_missing");
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const visit = (resourceId: string) => {
    if (visiting.has(resourceId)) throw new Error("resource_dependency_cycle");
    if (visited.has(resourceId)) return;
    const resource = b.resources.find(r => r.id === resourceId);
    if (!resource) throw new Error("unknown_resource");
    visiting.add(resourceId); resource.dependsOn.forEach(visit); visiting.delete(resourceId); visited.add(resourceId);
  };
  for (const r of b.resources) { assertObjectives(r.objectiveIds); visit(r.id); }
  const earlier = new Set<string>();
  for (const s of b.sequence) {
    assertResources([s.resourceId, ...s.dependsOn]); assertObjectives(s.objectiveIds);
    const resource = b.resources.find(r => r.id === s.resourceId);
    if (!resource || resource.objectiveIds.length !== s.objectiveIds.length || s.objectiveIds.some(id => !resource.objectiveIds.includes(id))) throw new Error("sequence_objective_mismatch");
    if (s.dependsOn.some(d => !earlier.has(d))) throw new Error("sequence_dependency_not_earlier");
    earlier.add(s.resourceId);
  }
  for (const p of b.prerequisites) assertResources([p.diagnosticResourceId, p.fallbackResourceId]);
  for (const m of b.misconceptions) { assertObjectives([m.objectiveId]); assertResources([m.instructionResourceId, m.assessmentResourceId]); }
  for (const t of b.assessmentPlan) {
    assertResources([t.resourceId]); assertObjectives(t.objectiveIds);
    const resource = b.resources.find(r => r.id === t.resourceId);
    if (!resource || t.objectiveIds.some(id => !resource.objectiveIds.includes(id))) throw new Error("task_objective_outside_resource");
    if (t.fallbackRoute) assertResources([t.fallbackRoute]);
    if (t.timing === "DELAYED" && !t.delayDays) throw new Error("delayed_task_needs_interval");
    if (t.prerequisiteIndex !== undefined && t.prerequisiteIndex >= b.prerequisites.length) throw new Error("unknown_prerequisite");
    if (t.optional && t.timing === "END_OF_LESSON" && t.kind !== "EXTENSION") throw new Error("required_evidence_cannot_be_optional");
  }
  return b;
}
export function sealBlueprint(input: Omit<UnitBlueprint, "contentHash"> | UnitBlueprint): UnitBlueprint {
  return parseBlueprint({ ...input, contentHash: blueprintHash(input) });
}
