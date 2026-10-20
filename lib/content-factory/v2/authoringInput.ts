import { z } from "zod";
import requirements from "@/curriculum/factory-v2/authoring/first-three/requirements.json";
import { actorSchema, assetSchema, assertBatchAssetBytes, validateBatchMedia } from "./batchContract";
import { blueprintRef, digest, exactPinSchema, FACTORY_ROLES, parseBlueprint, type UnitBlueprint } from "./blueprint";
import { artifactHash, checkPackage, parseResourceDraft } from "./quality";
import type { FactoryArtifact, ResourceDraft } from "./types";
import { FIRST_TEN_ASSESSMENT_KIND_MAP } from "./firstTen";
import { FIRST_TEN_AUTHORITY } from "./firstTenContract";

export const AUTHORING_INPUT_VERSION = "factory-lesson-authoring-input/1.0.0" as const;
export type AuthoringRequirements = { baselineCommit: string; lessons: {
  key: string; source: { databaseId: string; contentId: string; revisionId: string; revisionNumber: number; snapshotSha256: string };
  subject: string; grade: number; objectiveIds: string[];
  misconceptions: { id: string; description: string; probe: string; feedback: string; misconceptionId?: string }[];
  mediaSpecifications: { id: string; requirement: string; offlineFallback: string }[];
  retention: { delayDays: number; items: string[]; policyRef?: string; assessmentPurpose?: string; itemContext?: string };
  assessmentTasks: { id: string; objectiveIds: string[]; kind: string; scoring: string; task: string; assessmentPurpose?: string; itemContext?: string }[];
}[] };
const id = z.string().min(1).refine(value => value.trim() === value, "exact_identity_required");
const nullableId = id.nullable();
const sourceSchema = z.strictObject({ databaseId: id, contentId: id, revisionId: id, revisionNumber: z.number().int().nonnegative(), snapshotSha256: z.string().regex(/^[a-f0-9]{64}$/) });
export const authoringInputSchema = z.strictObject({
  schemaVersion: z.literal(AUTHORING_INPUT_VERSION), inputState: z.enum(["TEMPLATE", "AUTHORED_DRAFT"]),
  state: z.literal("DRAFT"), approved: z.literal(false), released: z.literal(false), published: z.literal(false), audience: z.literal("REVIEWER_ONLY"),
  cohortCommit: z.string().regex(/^[a-f0-9]{40}$/), source: sourceSchema, blueprint: z.unknown(),
  authors: z.record(z.enum(FACTORY_ROLES), actorSchema.nullable()),
  resources: z.array(z.strictObject({ id, version: id, role: z.enum(FACTORY_ROLES), payload: z.unknown().nullable() })),
  misconceptionBindings: z.array(z.strictObject({ id, objectiveId: nullableId, instructionSceneId: nullableId, assessmentResourceId: nullableId, itemId: nullableId, responsePattern: nullableId })),
  mediaSpecifications: z.array(z.strictObject({ id, resourceId: nullableId, sceneId: nullableId, mediaId: nullableId,
    implementation: z.enum(["STATIC_ASSET", "GOVERNED_INTERACTION", "TEXT_OR_PAPER"]).nullable(),
    mimeType: nullableId, altText: nullableId, keyboardPath: nullableId, transcript: nullableId, provenance: exactPinSchema.nullable(), license: nullableId, fallbackDescription: nullableId,
  })),
  rubricBindings: z.array(z.strictObject({ taskId: id, resourceId: id, itemId: nullableId, rubricId: nullableId, scoringVersion: nullableId })),
  retentionChecks: z.strictObject({ delayDays: z.number().int().min(7), resourceId: id, assistance: z.literal("NONE"),
    items: z.array(z.strictObject({ requirementIndex: z.number().int().nonnegative(), itemIds: z.array(id) })),
  }),
  assets: z.array(assetSchema),
});
export type AuthoringInput = z.infer<typeof authoringInputSchema>;

/** Empty authoring slots are template data, never generated candidate lesson content. */
export function createAuthoringTemplate(blueprint: UnitBlueprint, context: AuthoringRequirements = requirements): AuthoringInput {
  const source = blueprint.legacy[0];
  const required = context.lessons.find(l => l.source.contentId === source?.contentId);
  if (!required) throw new Error("first_three_source_not_selected");
  return authoringInputSchema.parse({
    schemaVersion: AUTHORING_INPUT_VERSION, inputState: "TEMPLATE", state: "DRAFT", approved: false, released: false, published: false, audience: "REVIEWER_ONLY",
    cohortCommit: context.baselineCommit, source: required.source, blueprint,
    authors: Object.fromEntries(FACTORY_ROLES.map(role => [role, null])),
    resources: blueprint.resources.map(r => ({ id: r.id, role: r.role, version: blueprint.version, payload: null })),
    misconceptionBindings: required.misconceptions.map(m => ({ id: m.id, objectiveId: null, instructionSceneId: null, assessmentResourceId: null, itemId: null, responsePattern: null })),
    mediaSpecifications: required.mediaSpecifications.map(m => ({ id: m.id, resourceId: null, sceneId: null, mediaId: null, implementation: null, mimeType: null, altText: null, keyboardPath: null, transcript: null, provenance: null, license: null, fallbackDescription: null })),
    rubricBindings: blueprint.assessmentPlan.filter(t => t.scoring === "ANALYTIC_RUBRIC").map(t => ({ taskId: t.id, resourceId: t.resourceId, itemId: null, rubricId: null, scoringVersion: null })),
    retentionChecks: { delayDays: required.retention.delayDays, resourceId: "retention", assistance: "NONE", items: required.retention.items.map((_, requirementIndex) => ({ requirementIndex, itemIds: [] })) }, assets: [],
  });
}

/** Convert validated authored inputs to the existing static factory role map, without generating content. */
export function authoringGenerationInput(input: unknown, context: AuthoringRequirements = requirements) {
  const result = validateAuthoringInput(input, "authored", context);
  if (!result.valid) throw new Error("authored_input_incomplete_or_invalid");
  const value = authoringInputSchema.parse(input);
  return Object.fromEntries(FACTORY_ROLES.map(role => [role, value.resources.filter(r => r.role === role).map(r => parseResourceDraft({ id: r.id, version: r.version, payload: r.payload }))]));
}

/** Validation only. No author callbacks, persistence, review, publication, or grading. */
export function validateAuthoringInput(input: unknown, mode: "template" | "authored", context: AuthoringRequirements = requirements) {
  const value = authoringInputSchema.parse(input);
  if (value.cohortCommit !== context.baselineCommit) throw new Error("authoring_cohort_commit_mismatch");
  const blueprint = parseBlueprint(value.blueprint);
  if (context.baselineCommit === FIRST_TEN_AUTHORITY.commit) {
    const pin = (entry: { id: string; version: string; sha256: string; sourceRef: string }) => entry.id === "first-ten-cohort-contract" && entry.version === "1.0.0" && entry.sha256 === FIRST_TEN_AUTHORITY.specSha256 && entry.sourceRef === `git:${FIRST_TEN_AUTHORITY.commit}:curriculum/modernization/v1/first-ten/spec.json`;
    if (blueprint.repositoryCommit !== FIRST_TEN_AUTHORITY.commit || !blueprint.sources.some(pin) || !blueprint.provenance.some(pin)) throw new Error("authoring_contract_blueprint_pin_mismatch");
    if (blueprint.version === "0.1.0") throw new Error("authoring_new_contract_requires_new_candidate_version");
  }
  const required = context.lessons.find(l => l.source.contentId === value.source.contentId);
  if (!required || digest("source", required.source) !== digest("source", value.source)) throw new Error("authoring_source_binding_mismatch");
  const source = blueprint.legacy[0];
  if (blueprint.legacy.length !== 1 || !source || digest("source", value.source) !== digest("source", { databaseId: source.databaseId, contentId: source.contentId, revisionId: source.revisionId, revisionNumber: source.revisionNumber, snapshotSha256: source.snapshotSha256 }) || blueprint.subject !== required.subject || blueprint.grade !== required.grade) throw new Error("authoring_blueprint_scope_mismatch");
  if (required.objectiveIds.some(id => !blueprint.objectives.some(o => o.id === id && o.scope === "REQUIRED"))) throw new Error("authoring_required_objective_missing");
  const sameSet = (a: string[], b: string[]) => a.length === b.length && new Set(a).size === a.length && a.every(id => b.includes(id));
  if (!sameSet(value.resources.map(r => r.id), blueprint.resources.map(r => r.id))) throw new Error("authoring_resource_set_mismatch");
  if (!sameSet(value.misconceptionBindings.map(m => m.id), required.misconceptions.map(m => m.id))) throw new Error("authoring_misconception_set_mismatch");
  if (!sameSet(value.mediaSpecifications.map(m => m.id), required.mediaSpecifications.map(m => m.id))) throw new Error("authoring_media_requirement_set_mismatch");
  if (!sameSet(value.retentionChecks.items.map(i => String(i.requirementIndex)), required.retention.items.map((_, i) => String(i))) || value.retentionChecks.delayDays < required.retention.delayDays) throw new Error("authoring_retention_requirements_missing");
  if (!sameSet(value.rubricBindings.map(r => r.taskId), blueprint.assessmentPlan.filter(t => t.scoring === "ANALYTIC_RUBRIC").map(t => t.id))) throw new Error("authoring_rubric_requirement_set_mismatch");
  const missing: string[] = [], failures: string[] = [];
  for (const task of required.assessmentTasks) {
    const plan = blueprint.assessmentPlan.find(t => t.id === task.id);
    if (!plan || plan.kind !== FIRST_TEN_ASSESSMENT_KIND_MAP[task.kind] || plan.scoring !== task.scoring || plan.scaffold !== "NONE" || plan.timing !== "END_OF_LESSON" || !sameSet(plan.objectiveIds, task.objectiveIds)) failures.push(`required_assessment_task_changed:${task.id}`);
  }
  if (!blueprint.assessmentPlan.some(t => t.resourceId === value.retentionChecks.resourceId && t.kind === "DELAYED_RETRIEVAL" && (t.delayDays ?? 0) >= value.retentionChecks.delayDays)) failures.push("retention_delay_unbound");
  for (const asset of value.assets) try { assertBatchAssetBytes(asset); } catch (error) { failures.push(error instanceof Error ? error.message : "asset_bytes_invalid"); }
  const executionBlockers = ["EXPLICIT_COHORT_SUBMISSION_REQUIRED", "ACCEPTED_NORMALIZED_FACTORY_INVENTORY_REQUIRED", "INDEPENDENT_AND_QUALIFIED_REVIEW_REQUIRED", "UNRELEASED_VALIDATION_ONLY"];
  if (value.inputState !== "AUTHORED_DRAFT") missing.push("inputState:AUTHORED_DRAFT");
  const drafts = new Map<string, ResourceDraft>();
  for (const resource of value.resources) {
    const plan = blueprint.resources.find(r => r.id === resource.id)!;
    if (resource.role !== plan.role || resource.version !== blueprint.version) failures.push(`resource_scope_mismatch:${resource.id}`);
    if (resource.payload === null) missing.push(`resource_payload:${resource.id}`);
    else try { drafts.set(resource.id, parseResourceDraft({ id: resource.id, version: resource.version, payload: resource.payload })); }
    catch (error) { failures.push(`resource_invalid:${resource.id}:${error instanceof Error ? error.message : "invalid"}`); }
    if (!value.authors[resource.role]) missing.push(`author_identity:${resource.role}`);
  }
  for (const role of ["INDEPENDENT_QUALITY_REVIEWER", "GOVERNANCE_RELEASE"] as const) if (value.authors[role] !== null) failures.push(`review_authority_not_an_authoring_input:${role}`);
  for (const binding of value.misconceptionBindings) for (const field of ["objectiveId", "instructionSceneId", "assessmentResourceId", "itemId", "responsePattern"] as const) if (binding[field] === null) missing.push(`misconception:${binding.id}:${field}`);
  for (const binding of value.rubricBindings) for (const field of ["itemId", "rubricId", "scoringVersion"] as const) if (binding[field] === null) missing.push(`rubric:${binding.taskId}:${field}`);
  for (const item of value.retentionChecks.items) if (!item.itemIds.length) missing.push(`retention_item_binding:${item.requirementIndex}`);
  for (const media of value.mediaSpecifications) {
    for (const field of ["resourceId", "sceneId", "implementation", "altText", "keyboardPath", "provenance", "license", "fallbackDescription"] as const) if (media[field] === null) missing.push(`media:${media.id}:${field}`);
    if (media.implementation === "STATIC_ASSET" && (!media.mediaId || !media.mimeType)) missing.push(`media_static_asset_binding:${media.id}`);
    if (/^(audio|video)\//.test(media.mimeType ?? "") && !media.transcript) missing.push(`media_transcript:${media.id}`);
    const specification = required.mediaSpecifications.find(m => m.id === media.id)!;
    if (media.mimeType === "image/svg+xml" || /\bSVG\b/.test(specification.requirement)) executionBlockers.push(`SVG_ASSET_ADAPTER_REQUIRED:${media.id}`);
    if (media.implementation === "GOVERNED_INTERACTION") executionBlockers.push(`GOVERNED_RUNTIME_BINDING_REQUIRED:${media.id}`);
    if (media.implementation === "TEXT_OR_PAPER") executionBlockers.push(`PRIMARY_MEDIA_REQUIREMENT_REVIEW_REQUIRED:${media.id}`);
  }
  if (mode === "authored" && drafts.size === blueprint.resources.length && value.resources.every(r => value.authors[r.role])) {
    const artifacts = new Map<string, FactoryArtifact>();
    const build = (id: string): FactoryArtifact => {
      const existing = artifacts.get(id); if (existing) return existing;
      const plan = blueprint.resources.find(r => r.id === id)!;
      const dependencies = plan.dependsOn.map(id => { const a = build(id); return { id, version: a.version, contentHash: a.contentHash }; });
      const draft = drafts.get(id)!; const author = value.authors[plan.role]!;
      const body = { ...draft, role: plan.role, author, blueprint: blueprintRef(blueprint), dependencies };
      const artifact = { ...body, contentHash: artifactHash(body) }; artifacts.set(id, artifact); return artifact;
    };
    blueprint.resources.forEach(r => build(r.id));
    failures.push(...checkPackage(blueprint, [...artifacts.values()]).failures, ...validateBatchMedia(blueprint, value.assets, [...artifacts.values()]));
    for (const binding of value.misconceptionBindings) {
      const lesson = [...drafts.values()].find(d => d.payload.kind === "LESSON" && d.payload.candidate.scenes.some(s => s.id === binding.instructionSceneId && s.misconceptionIds.includes(binding.id)));
      const assessment = drafts.get(binding.assessmentResourceId ?? "")?.payload;
      const spec = assessment?.kind === "ASSESSMENT" ? assessment.specs.find(s => s.itemId === binding.itemId && s.misconceptionSignals.some(m => m.misconceptionId === binding.id && m.responsePattern === binding.responsePattern)) : null;
      if (!lesson || !spec || !blueprint.misconceptions.some(m => m.id === binding.id && m.objectiveId === binding.objectiveId && m.instructionResourceId === lesson.id && m.assessmentResourceId === binding.assessmentResourceId && m.responsePattern === binding.responsePattern)) failures.push(`misconception_binding_unresolved:${binding.id}`);
    }
    for (const binding of value.rubricBindings) {
      const task = blueprint.assessmentPlan.find(t => t.id === binding.taskId)!;
      const p = drafts.get(binding.resourceId)?.payload;
      const spec = p?.kind === "ASSESSMENT" ? p.specs.find(s => s.itemId === binding.itemId) : null;
      if (task.resourceId !== binding.resourceId || !task.itemIds.includes(binding.itemId ?? "") || !spec || spec.key.kind !== "RUBRIC" || spec.key.rubric.rubricId !== binding.rubricId || spec.scoringVersion !== binding.scoringVersion) failures.push(`rubric_binding_unresolved:${binding.taskId}`);
    }
    const retention = drafts.get(value.retentionChecks.resourceId)?.payload;
    for (const requirement of value.retentionChecks.items) if (retention?.kind !== "ASSESSMENT" || retention.definition.purpose !== "RETENTION" || requirement.itemIds.some(id => !retention.items.some(i => i.itemId === id))) failures.push(`retention_binding_unresolved:${requirement.requirementIndex}`);
    for (const media of value.mediaSpecifications) {
      const p = drafts.get(media.resourceId ?? "")?.payload;
      const scene = p?.kind === "LESSON" ? p.candidate.scenes.find(s => s.id === media.sceneId) : null;
      if (!scene || !scene.fallback?.objectivePreserved || scene.accessibility.keyboardPath !== media.keyboardPath || scene.fallback.content !== media.fallbackDescription) failures.push(`media_scene_or_fallback_unresolved:${media.id}`);
      if (!blueprint.provenance.some(pin => digest("pin", pin) === digest("pin", media.provenance))) failures.push(`media_provenance_unpinned:${media.id}`);
      if (media.implementation === "STATIC_ASSET" && (!scene?.media?.some(m => m.id === media.mediaId && m.altText === media.altText) || !value.assets.some(a => a.resourceId === media.resourceId && a.sceneId === media.sceneId && a.mediaId === media.mediaId && a.mimeType === media.mimeType && a.license === media.license && digest("pin", a.provenance) === digest("pin", media.provenance)))) failures.push(`media_asset_unresolved:${media.id}`);
    }
  }
  return { sourceContentId: value.source.contentId, state: value.state, inputState: value.inputState, mode, valid: failures.length === 0 && (mode === "template" || missing.length === 0),
    missing: [...new Set(missing)], failures: [...new Set(failures)], executionBlockers: [...new Set(executionBlockers)], readyForFactoryExecution: false, generatedCandidates: 0, approved: false, released: false };
}
