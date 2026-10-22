import { z } from "zod";
import { parseCandidateLessonV2 } from "@/lib/curriculum/v2/parse";
import { parseActivityDefinition } from "@/lib/activity-definition/v1/validator";
import { hashActivityDefinition } from "@/lib/activity-definition/v1/hash";
import { validateDefinition, validateForm, validateItem } from "@/lib/assessment/v2/validator";
import { parseCandidateAssessmentV2 } from "@/lib/assessment/v2/parse";
import { projectItemForLearner, protectedStrings, assertLearnerSafe } from "@/lib/assessment/v2/projection";
import { evaluateAssessmentBlueprint } from "@/lib/curriculum/excellence/assessmentBlueprint";
import { EXCELLENCE_RUBRIC_V1 } from "@/lib/curriculum/excellence/standard";
import { blueprintRef, digest, parseBlueprint, UNIT_BLUEPRINT_V4_VERSION, type UnitBlueprint } from "./blueprint";
import { CANDIDATE_LESSON_V2_CONTRACT_V4 } from "@/lib/curriculum/v2/contract";
import { evaluateV4Standard } from "@/lib/curriculum/v4/standard";
import { subjectFamily, validateBlock } from "@/lib/learner-experience/teaching/registry";
import type { AssessmentCandidate, FactoryArtifact, QualityReport, ResourceDraft, ResourcePayload } from "./types";

const nonempty = z.string().trim().min(1).max(16000);
const documentSchema = z.strictObject({ kind: z.literal("DOCUMENT"), title: nonempty,
  sections: z.array(z.strictObject({ heading: nonempty, text: nonempty })).min(1).max(30),
  textAlternative: nonempty, keyboardPath: nonempty, offlineInstructions: nonempty, references: z.array(nonempty),
});
const assessments = new Set(["QUIZ", "SUMMATIVE", "RETENTION", "TRANSFER"]);
const activities = new Set(["CLASSWORK", "HOMEWORK", "PRACTICAL", "PROJECT"]);
const sameIds = (a: readonly string[], b: readonly string[]) => a.length === b.length && new Set(a).size === a.length && a.every(id => b.includes(id));
const exactKeys = (value: object, keys: string[]) => Object.keys(value).every(k => keys.includes(k)) && keys.every(k => k in value);

/** File-backed authors use the same owner parsers as generated candidates. */
export function parseResourceDraft(input: unknown): ResourceDraft {
  const envelope = z.strictObject({ id: nonempty, version: z.string().regex(/^\d+\.\d+\.\d+$/), payload: z.unknown() }).parse(input);
  const tagged = z.object({ kind: z.enum(["LESSON", "ACTIVITY", "ASSESSMENT", "DOCUMENT"]) }).parse(envelope.payload);
  let payload: ResourcePayload;
  if (tagged.kind === "LESSON") {
    const p = z.strictObject({ kind: z.literal("LESSON"), candidate: z.unknown() }).parse(envelope.payload);
    payload = { kind: "LESSON", candidate: parseCandidateLessonV2(JSON.stringify(p.candidate)) };
  } else if (tagged.kind === "ACTIVITY") {
    const p = z.strictObject({ kind: z.literal("ACTIVITY"), definition: z.unknown() }).parse(envelope.payload);
    const definition = parseActivityDefinition(p.definition);
    if (!definition) throw new Error("activity_contract_invalid");
    payload = { kind: "ACTIVITY", definition };
  } else if (tagged.kind === "ASSESSMENT") {
    const p = z.strictObject({ kind: z.literal("ASSESSMENT"), definition: z.unknown(), form: z.unknown(), items: z.unknown(), specs: z.unknown() }).parse(envelope.payload);
    payload = { kind: "ASSESSMENT", ...parseCandidateAssessmentV2({ definition: p.definition, form: p.form, items: p.items, specs: p.specs }) };
  } else {
    // Complete strict parsing precedes this cast; repository nullability weakens Zod inference.
    payload = documentSchema.parse(envelope.payload) as ResourcePayload;
  }
  return { id: envelope.id, version: envelope.version, payload };
}

export function artifactHash(artifact: Omit<FactoryArtifact, "contentHash"> | FactoryArtifact): string {
  const { contentHash: _hash, ...payload } = { contentHash: "", ...artifact };
  return digest("factory-resource/2.0.0", payload);
}

/** Executed on every generation attempt, before it can become a dependency. */
export function validateArtifact(blueprint: UnitBlueprint, artifact: FactoryArtifact): string[] {
  const failures: string[] = [];
  const fail = (code: string) => failures.push(`${code}:${artifact.id}`);
  try {
    if (!exactKeys(artifact, ["id", "version", "payload", "blueprint", "role", "author", "dependencies", "contentHash"])) fail("artifact_fields_invalid");
    if (!/^\d+\.\d+\.\d+$/.test(artifact.version)) fail("artifact_version_invalid");
    if (artifact.contentHash !== artifactHash(artifact)) fail("artifact_hash_mismatch");
    if (digest("blueprint-ref", artifact.blueprint) !== digest("blueprint-ref", blueprintRef(blueprint))) fail("blueprint_pin_mismatch");
    const plan = blueprint.resources.find(r => r.id === artifact.id);
    if (!plan || plan.role !== artifact.role) { fail("resource_not_in_role_plan"); return failures; }
    const p = artifact.payload;
    if (plan.kind === "LESSON" && p.kind !== "LESSON") fail("lesson_payload_required");
    if (assessments.has(plan.kind) && p.kind !== "ASSESSMENT") fail("assessment_payload_required");
    if (activities.has(plan.kind) && p.kind !== "ACTIVITY") fail("activity_payload_required");
    if (!assessments.has(plan.kind) && !activities.has(plan.kind) && plan.kind !== "LESSON" && p.kind !== "DOCUMENT") fail("document_payload_required");
    if (["ANSWER_KEY", "RUBRIC"].includes(plan.kind) && plan.audience !== "REVIEWER_ONLY") fail("protected_resource_audience");
    if (p.kind === "LESSON") {
      if (!exactKeys(p, ["kind", "candidate"])) fail("payload_fields_invalid");
      const candidate = parseCandidateLessonV2(JSON.stringify(p.candidate));
      const covered = [...new Set(candidate.scenes.flatMap(s => [...s.objectiveIds]))];
      if (!sameIds(covered, plan.objectiveIds)) fail("lesson_objective_mismatch");
      for (const scene of candidate.scenes) {
        if (scene.objectiveIds.some(id => !plan.objectiveIds.includes(id))) fail("scene_objective_unknown");
        if (!scene.accessibility.textAlternative.trim() || !scene.accessibility.keyboardPath.trim()) fail("scene_accessibility_missing");
        if (scene.offline.mode !== "FULL_OFFLINE" && !scene.fallback) fail("offline_fallback_missing");
      }
      const v4 = blueprint.schemaVersion === UNIT_BLUEPRINT_V4_VERSION;
      if (v4) {
        if (candidate.contractVersion !== CANDIDATE_LESSON_V2_CONTRACT_V4) fail("v4_lesson_contract_required");
        for (const scene of candidate.scenes) for (const block of [...(scene.teaching?.blocks ?? []), ...(scene.teaching?.visual ? [scene.teaching.visual] : [])]) {
          for (const problem of validateBlock(block, { subject: blueprint.subject, grade: blueprint.grade }).problems) fail(`v4_${problem}`);
        }
        for (const problem of evaluateV4Standard(candidate, { subject: blueprint.subject, grade: blueprint.grade }).problems) if (problem.severity !== "ADVISORY") fail(`v4_standard_${problem.code}`);
      }
      // Other V4 families use their own guided/independent instructional pattern.
      if (!v4 || subjectFamily(blueprint.subject) === "MATHEMATICS") for (const objectiveId of plan.objectiveIds) {
        const scenes = candidate.scenes.filter(s => s.objectiveIds.includes(objectiveId));
        const model = scenes.findIndex(s => s.purpose === "MODEL_WORKED_EXAMPLE");
        const guided = scenes.findIndex(s => s.purpose === "GUIDED_PRACTICE");
        const independent = scenes.findIndex(s => s.purpose === "INDEPENDENT_PRACTICE" && s.pedagogy?.scaffoldLevel === "NONE");
        if (!(model >= 0 && guided > model && independent > guided)) fail("instructional_fading_missing");
      }
    } else if (p.kind === "ACTIVITY") {
      if (!exactKeys(p, ["kind", "definition"])) fail("payload_fields_invalid");
      const activity = parseActivityDefinition(p.definition);
      if (!activity) fail("activity_contract_invalid");
      else {
        if (activity.contentHash !== hashActivityDefinition(activity)) fail("activity_hash_mismatch");
        if (activity.activityId !== artifact.id || activity.version !== artifact.version || activity.kind !== plan.kind) fail("activity_identity_mismatch");
        if (!sameIds(activity.content.objectiveIds, plan.objectiveIds)) fail("activity_objective_mismatch");
        if (activity.governance.reviewRefs.length || activity.governance.releaseRefs.length || activity.governance.lifecycleRefs.length) fail("candidate_has_authority_attestations");
        if (!activity.content.accessibility.supportsScreenReader || activity.content.accessibility.requiresColorVision) fail("activity_accessibility_missing");
      }
    } else if (p.kind === "ASSESSMENT") {
      if (!exactKeys(p, ["kind", "definition", "form", "items", "specs"])) fail("payload_fields_invalid");
      const { kind: _kind, ...assessment } = p;
      parseCandidateAssessmentV2(assessment);
      for (const issue of validateDefinition(p.definition).issues) fail(`assessment_${issue.code}`);
      if (p.definition.grade !== blueprint.grade || p.definition.subject !== blueprint.subject || !sameIds(p.definition.objectiveIds, plan.objectiveIds)) fail("assessment_scope_mismatch");
      const purpose = { QUIZ: blueprint.assessmentPlan.some(t => t.resourceId === artifact.id && t.kind === "PREREQUISITE_DIAGNOSTIC") ? "DIAGNOSTIC" : "FORMATIVE", SUMMATIVE: "SUMMATIVE", RETENTION: "RETENTION", TRANSFER: "TRANSFER" }[plan.kind];
      if (p.definition.purpose !== purpose) fail("assessment_purpose_mismatch");
      if (p.items.length !== p.specs.length || new Set(p.items.map(i => i.itemId)).size !== p.items.length) fail("assessment_item_set_invalid");
      if (p.form.items.length !== p.items.length) fail("assessment_form_closure_mismatch");
      const itemMap = new Map(p.items.map(i => [`${i.itemId}@${i.version}`, i]));
      for (const issue of validateForm(p.form, p.definition, itemMap).issues) fail(`assessment_${issue.code}`);
      for (const item of p.items) {
        const spec = p.specs.find(s => s.itemId === item.itemId && s.itemVersion === item.version);
        if (!spec) { fail("assessment_spec_missing"); continue; }
        for (const issue of validateItem(item, spec).issues) fail(`assessment_${issue.code}`);
        if (p.form.items.find(r => r.itemId === item.itemId)?.points !== spec.maxPoints) fail("form_scoring_points_mismatch");
        if (item.objectiveIds.some(id => !plan.objectiveIds.includes(id))) fail("assessment_objective_unknown");
        if (plan.kind === "TRANSFER" && item.context !== "NEW") fail("transfer_context_not_new");
        if (["SUMMATIVE", "RETENTION", "TRANSFER"].includes(plan.kind) && (item.hints.length || item.feedbackPolicy.hints !== "NONE" || item.feedbackPolicy.correctAnswer !== "NEVER")) fail("independent_evidence_assistance");
      }
      if (p.form.delivery.offlineDelivery !== "CAPTURE_ONLY") fail("assessment_offline_not_capture_only");
    } else if (p.kind === "DOCUMENT") {
      documentSchema.parse(p);
      if (p.references.some(ref => !blueprint.resources.some(r => r.id === ref))) fail("document_reference_unknown");
      if (p.references.some(ref => !plan.dependsOn.includes(ref))) fail("document_reference_not_hash_dependency");
    } else fail("payload_kind_unknown");
  } catch (error) { fail(`candidate_invalid_${error instanceof Error ? error.message.slice(0, 150) : "unknown"}`); }
  return failures;
}

export function reviewerAssessmentPreview(artifacts: readonly FactoryArtifact[]) {
  return artifacts.flatMap(a => a.payload.kind === "ASSESSMENT" ? a.payload.items.map(item => projectItemForLearner(item, { attemptId: "REVIEWER_PREVIEW_UNRELEASED", independent: true, points: a.payload.kind === "ASSESSMENT" ? a.payload.specs.find(s => s.itemId === item.itemId)?.maxPoints ?? 0 : 0 })) : []);
}

export function checkPackage(blueprintInput: UnitBlueprint, artifacts: readonly FactoryArtifact[]): QualityReport {
  const blueprint = parseBlueprint(blueprintInput);
  const failures = artifacts.flatMap(a => validateArtifact(blueprint, a));
  const byId = new Map(artifacts.map(a => [a.id, a]));
  if (byId.size !== artifacts.length) failures.push("duplicate_artifact_id");
  for (const r of blueprint.resources) if (!byId.has(r.id)) failures.push(`resource_missing:${r.id}`);
  for (const artifact of artifacts) {
    const plan = blueprint.resources.find(r => r.id === artifact.id);
    if (!plan) continue;
    if (!sameIds(artifact.dependencies.map(d => d.id), plan.dependsOn)) failures.push(`dependency_set_mismatch:${artifact.id}`);
    for (const dep of artifact.dependencies) {
      const actual = byId.get(dep.id);
      if (!actual || actual.version !== dep.version || actual.contentHash !== dep.contentHash) failures.push(`dependency_hash_mismatch:${artifact.id}:${dep.id}`);
    }
    if (artifact.payload.kind === "ACTIVITY") {
      for (const binding of artifact.payload.definition.lessonBindings) {
        const lesson = byId.get(binding.lessonId);
        if (!lesson || lesson.payload.kind !== "LESSON" || lesson.version !== binding.version) failures.push(`activity_lesson_version_mismatch:${artifact.id}`);
      }
    }
  }
  const requiredObjectiveIds = blueprint.objectives.filter(o => o.scope === "REQUIRED").map(o => o.id);
  const tasks = blueprint.assessmentPlan;
  const assessmentBlueprint = evaluateAssessmentBlueprint({ subject: blueprint.subject, objectiveIds: requiredObjectiveIds, prerequisiteCount: blueprint.prerequisites.length, tasks });
  failures.push(...assessmentBlueprint.blockingGaps.map(g => `excellence:${g}`));
  for (const task of tasks) {
    const resource = byId.get(task.resourceId);
    if (!resource) continue;
    const p = resource.payload;
    const assessed = task.scoring !== "NOT_SCORED" || ["TRANSFER_TASK", "DELAYED_RETRIEVAL", "PREREQUISITE_DIAGNOSTIC"].includes(task.kind);
    if (assessed && (p.kind !== "ASSESSMENT" || task.itemIds.length === 0)) failures.push(`assessment_task_binding_missing:${task.id}`);
    if (p.kind === "ASSESSMENT") {
      const bound = p.items.filter(i => task.itemIds.includes(i.itemId));
      if (bound.length !== task.itemIds.length || bound.length === 0) failures.push(`task_item_unresolved:${task.id}`);
      for (const item of bound) {
        const spec = p.specs.find(s => s.itemId === item.itemId && s.itemVersion === item.version);
        if (task.objectiveIds.some(id => !item.objectiveIds.includes(id))) failures.push(`task_item_objective_mismatch:${task.id}`);
        if (task.kind === "DELAYED_RETRIEVAL" && p.definition.purpose !== "RETENTION") failures.push(`retention_purpose_mismatch:${task.id}`);
        if (task.kind === "TRANSFER_TASK" && (p.definition.purpose !== "TRANSFER" || item.context !== "NEW")) failures.push(`transfer_purpose_context_mismatch:${task.id}`);
        if (task.kind === "PREREQUISITE_DIAGNOSTIC" && p.definition.purpose !== "DIAGNOSTIC") failures.push(`diagnostic_purpose_mismatch:${task.id}`);
        if (task.kind === "EXTENDED_REASONING" && (!["ANALYZE", "EVALUATE", "CREATE"].includes(item.cognitiveDemand) || item.itemType !== "WORKED_SOLUTION")) failures.push(`reasoning_task_mismatch:${task.id}`);
        if (task.scoring === "ANALYTIC_RUBRIC" && spec?.key.kind !== "RUBRIC") failures.push(`rubric_missing:${task.id}`);
        if (task.scoring === "KEYED" && (!spec || spec.key.kind === "RUBRIC")) failures.push(`keyed_task_mismatch:${task.id}`);
        if (task.scaffold === "NONE" && (item.hints.length || item.feedbackPolicy.hints !== "NONE")) failures.push(`task_independence_mismatch:${task.id}`);
      }
    } else if (task.itemIds.length) failures.push(`nonassessment_item_binding:${task.id}`);
    if (task.timing === "IN_LESSON" && task.scaffold === "NONE" && p.kind === "ACTIVITY" && p.definition.content.scaffolding !== "INDEPENDENT") failures.push(`independent_practice_scaffold_mismatch:${task.id}`);
    if (!task.optional && task.objectiveIds.some(id => blueprint.objectives.find(o => o.id === id)?.scope === "OPTIONAL_EXTENSION")) failures.push(`extension_gates_progress:${task.id}`);
  }
  for (const m of blueprint.misconceptions) {
    const instruction = byId.get(m.instructionResourceId)?.payload;
    const assessment = byId.get(m.assessmentResourceId)?.payload;
    if (instruction?.kind !== "LESSON" || !instruction.candidate.scenes.some(s => s.misconceptionIds.includes(m.id) && s.purpose === "ADDRESS_MISCONCEPTION")) failures.push(`misconception_instruction_missing:${m.id}`);
    if (assessment?.kind !== "ASSESSMENT" || !assessment.specs.some(s => s.misconceptionSignals.some(signal => signal.misconceptionId === m.id && signal.responsePattern === m.responsePattern))) failures.push(`misconception_signal_missing:${m.id}`);
  }
  const assessmentPayloads = artifacts.flatMap(a => a.payload.kind === "ASSESSMENT" ? [a.payload] : []);
  const secrets = protectedStrings(assessmentPayloads.flatMap(p => p.items), assessmentPayloads.flatMap(p => p.specs));
  try {
    assertLearnerSafe(reviewerAssessmentPreview(artifacts), secrets);
    for (const a of artifacts) {
      const plan = blueprint.resources.find(r => r.id === a.id);
      if (plan?.audience === "LEARNER" && a.payload.kind !== "ASSESSMENT") {
        // Lesson formative feedback is intentional; distinctive assessment secrets still cannot be copied into it.
        const serialized = JSON.stringify(a.payload);
        if (secrets.some(secret => serialized.includes(secret))) failures.push(`assessment_secret_in_resource:${a.id}`);
      }
    }
  } catch { failures.push("assessment_secret_in_preview"); }
  const publicBytes = Buffer.byteLength(JSON.stringify(artifacts.filter(a => blueprint.resources.find(r => r.id === a.id)?.audience === "LEARNER").map(a => a.payload.kind === "ASSESSMENT" ? reviewerAssessmentPreview([a]) : a.payload)));
  if (publicBytes > blueprint.support.offline.maxBytes) failures.push("offline_budget_exceeded");
  return { failures: [...new Set(failures)], assessmentBlueprint,
    criteria: EXCELLENCE_RUBRIC_V1.map(c => ({ criterionId: c.id, check: c.check, evidenceRequired: c.evidenceRequired, status: "NOT_EVALUATED" })),
    humanRequired: EXCELLENCE_RUBRIC_V1.filter(c => c.check !== "DETERMINISTIC").map(c => c.id),
    releaseBlockers: [...blueprint.unresolved, ...blueprint.objectives.filter(o => o.mapping === "PROPOSED").map(o => `OBJECTIVE_MAPPING_PROPOSED:${o.id}`), "EXACT_REVISION_HUMAN_REVIEW_REQUIRED", "EXPLICIT_RELEASE_AUTHORIZATION_REQUIRED", "RETENTION_POLICY_APPROVAL_REQUIRED"],
    isLearningEvidence: false,
  };
}
