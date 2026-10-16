/**
 * Structural and integrity validation for Assessment V2 content. Validation is a precondition for
 * review; it is never an approval. Every validator recomputes hashes rather than trusting stored ones.
 */
import { hashDefinition, hashForm, hashItem, hashScoringSpec } from "./hash";
import { itemTypeSpec } from "./itemTypes";
import {
  ASSESSMENT_PURPOSES,
  ASSESSMENT_V2_SCHEMA_VERSION,
  COGNITIVE_DEMANDS,
  ITEM_TYPES,
  type AssessmentDefinitionV2,
  type AssessmentFormV2,
  type AssessmentItemV2,
  type ProtectedScoringSpec,
} from "./types";

export type ValidationIssue = Readonly<{ code: string; path: string }>;
export type ValidationResult = Readonly<{ ok: boolean; issues: readonly ValidationIssue[] }>;

function result(issues: ValidationIssue[]): ValidationResult {
  return Object.freeze({ ok: issues.length === 0, issues: Object.freeze(issues) });
}

const nonEmpty = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";
const unique = (values: readonly string[]) => new Set(values).size === values.length;
const iso = (value: string) => Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;

/**
 * Fields that must never appear in learner-visible item content. A stimulus carrying one of
 * these names is rejected even if the value looks harmless, so a key cannot be smuggled into
 * an option or context field by an authoring tool.
 */
export const PROTECTED_FIELD_NAMES = Object.freeze([
  "answer", "answerKey", "correct", "correctIndex", "correctOptionId", "correctOptionIds", "correctOrder",
  "acceptedAnswers", "key", "scoringGuide", "rubric", "explanation", "moderationNotes", "misconceptionSignals",
  "pairs", "tolerance", "absoluteTolerance", "isCorrect", "correctAnswer",
]);

function findProtectedFieldNames(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => findProtectedFieldNames(entry, `${path}[${index}]`, issues));
    return;
  }
  if (value && typeof value === "object") {
    for (const [field, entry] of Object.entries(value)) {
      if (PROTECTED_FIELD_NAMES.includes(field)) issues.push({ code: "protected_field_in_learner_content", path: `${path}.${field}` });
      findProtectedFieldNames(entry, `${path}.${field}`, issues);
    }
  }
}

export function validateDefinition(definition: AssessmentDefinitionV2): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (definition.schemaVersion !== ASSESSMENT_V2_SCHEMA_VERSION) issues.push({ code: "schema_version_unsupported", path: "schemaVersion" });
  for (const field of ["definitionId", "version", "title", "subject"] as const) {
    if (!nonEmpty(definition[field])) issues.push({ code: "required", path: field });
  }
  if (!ASSESSMENT_PURPOSES.includes(definition.purpose)) issues.push({ code: "purpose_invalid", path: "purpose" });
  if (!Number.isInteger(definition.grade) || definition.grade < 1 || definition.grade > 12) issues.push({ code: "grade_invalid", path: "grade" });
  if (definition.objectiveIds.length === 0 || !unique(definition.objectiveIds)) issues.push({ code: "objectives_invalid", path: "objectiveIds" });
  const aligned = new Set([...definition.alignment.nationalObjectiveIds, ...definition.alignment.extensionObjectiveIds]);
  for (const objectiveId of definition.objectiveIds) {
    if (!aligned.has(objectiveId)) issues.push({ code: "objective_alignment_missing", path: `objectiveIds.${objectiveId}` });
  }
  for (const objectiveId of definition.alignment.nationalObjectiveIds) {
    if (definition.alignment.extensionObjectiveIds.includes(objectiveId)) issues.push({ code: "objective_both_national_and_extension", path: `alignment.${objectiveId}` });
  }
  if (!nonEmpty(definition.alignment.releaseId) || !nonEmpty(definition.alignment.releaseIdentity)) issues.push({ code: "curriculum_release_required", path: "alignment" });
  if (definition.timeLimitMinutes !== null && (!Number.isInteger(definition.timeLimitMinutes) || definition.timeLimitMinutes <= 0)) issues.push({ code: "time_limit_invalid", path: "timeLimitMinutes" });
  const { maxAttempts, cooldownMinutes } = definition.attemptPolicy;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) issues.push({ code: "attempt_policy_invalid", path: "attemptPolicy.maxAttempts" });
  if (!Number.isInteger(cooldownMinutes) || cooldownMinutes < 0) issues.push({ code: "attempt_policy_invalid", path: "attemptPolicy.cooldownMinutes" });
  if (definition.provenance.authors.length === 0) issues.push({ code: "provenance_authors_required", path: "provenance.authors" });
  if (definition.contentHash !== hashDefinition(definition)) issues.push({ code: "content_hash_mismatch", path: "contentHash" });
  return result(issues);
}

function validateKeyAgainstStimulus(item: AssessmentItemV2, spec: ProtectedScoringSpec, issues: ValidationIssue[]): void {
  const optionIds = new Set(item.stimulus.options.map((option) => option.optionId));
  const key = spec.key;
  switch (key.kind) {
    case "SINGLE_SELECT":
      if (item.stimulus.options.length < 2) issues.push({ code: "options_required", path: "stimulus.options" });
      if (!optionIds.has(key.correctOptionId)) issues.push({ code: "key_option_unknown", path: "key.correctOptionId" });
      break;
    case "MULTI_SELECT":
      if (item.stimulus.options.length < 2) issues.push({ code: "options_required", path: "stimulus.options" });
      if (key.correctOptionIds.length === 0 || !unique(key.correctOptionIds)) issues.push({ code: "key_options_invalid", path: "key.correctOptionIds" });
      for (const id of key.correctOptionIds) if (!optionIds.has(id)) issues.push({ code: "key_option_unknown", path: `key.correctOptionIds.${id}` });
      break;
    case "NUMERIC":
      if (!Number.isFinite(key.key.value) || !(key.key.absoluteTolerance >= 0)) issues.push({ code: "numeric_key_invalid", path: "key.key" });
      if (!(key.key.wrongUnitCredit >= 0 && key.key.wrongUnitCredit <= 1)) issues.push({ code: "numeric_unit_credit_invalid", path: "key.key.wrongUnitCredit" });
      if (item.stimulus.expectedUnit && key.key.acceptedUnits.length === 0) issues.push({ code: "numeric_units_required", path: "key.key.acceptedUnits" });
      break;
    case "ORDERING": {
      const elements = item.stimulus.orderingElements.map((element) => element.optionId);
      if (elements.length < 2 || key.correctOrder.length !== elements.length || !elements.every((id) => key.correctOrder.includes(id)) || !unique(key.correctOrder)) {
        issues.push({ code: "ordering_key_invalid", path: "key.correctOrder" });
      }
      break;
    }
    case "MATCHING": {
      const left = new Set(item.stimulus.matchingLeft.map((entry) => entry.optionId));
      const right = new Set(item.stimulus.matchingRight.map((entry) => entry.optionId));
      if (left.size === 0 || key.pairs.length !== left.size || !unique(key.pairs.map((pair) => pair.leftId))) issues.push({ code: "matching_key_invalid", path: "key.pairs" });
      for (const pair of key.pairs) if (!left.has(pair.leftId) || !right.has(pair.rightId)) issues.push({ code: "matching_key_unknown", path: `key.pairs.${pair.leftId}` });
      break;
    }
    case "SHORT_CONSTRUCTED":
      if (key.acceptedAnswers.length === 0 || key.acceptedAnswers.some((answer) => !nonEmpty(answer))) issues.push({ code: "short_answers_required", path: "key.acceptedAnswers" });
      break;
    case "RUBRIC": {
      const criteria = key.rubric.criteria;
      if (criteria.length === 0) issues.push({ code: "rubric_criteria_required", path: "key.rubric" });
      const rubricMax = criteria.reduce((sum, criterion) => sum + Math.max(0, ...criterion.levels.map((level) => level.points)), 0);
      if (rubricMax !== spec.maxPoints) issues.push({ code: "rubric_max_points_mismatch", path: "maxPoints" });
      break;
    }
  }
}

export function validateItem(item: AssessmentItemV2, spec: ProtectedScoringSpec): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (item.schemaVersion !== ASSESSMENT_V2_SCHEMA_VERSION || spec.schemaVersion !== ASSESSMENT_V2_SCHEMA_VERSION) issues.push({ code: "schema_version_unsupported", path: "schemaVersion" });
  if (!nonEmpty(item.itemId) || !nonEmpty(item.version)) issues.push({ code: "required", path: "itemId" });
  if (!ITEM_TYPES.includes(item.itemType)) {
    issues.push({ code: "item_type_invalid", path: "itemType" });
    return result(issues);
  }
  if (!nonEmpty(item.stimulus.prompt)) issues.push({ code: "prompt_required", path: "stimulus.prompt" });
  if (item.objectiveIds.length === 0) issues.push({ code: "objectives_required", path: "objectiveIds" });
  if (!COGNITIVE_DEMANDS.includes(item.cognitiveDemand)) issues.push({ code: "cognitive_demand_invalid", path: "cognitiveDemand" });
  if (![1, 2, 3, 4, 5].includes(item.difficulty)) issues.push({ code: "difficulty_invalid", path: "difficulty" });
  if (item.provenance.authors.length === 0) issues.push({ code: "provenance_authors_required", path: "provenance.authors" });
  if (spec.itemId !== item.itemId || spec.itemVersion !== item.version) issues.push({ code: "spec_item_mismatch", path: "spec" });
  if (!(spec.maxPoints > 0)) issues.push({ code: "max_points_invalid", path: "spec.maxPoints" });
  const typeSpec = itemTypeSpec(item.itemType);
  if (!typeSpec.acceptedKeyKinds.includes(spec.key.kind)) issues.push({ code: "key_kind_not_allowed_for_type", path: "spec.key.kind" });
  else validateKeyAgainstStimulus(item, spec, issues);
  // Hints and the stimulus are learner-visible; neither may carry protected material.
  findProtectedFieldNames(item.stimulus, "stimulus", issues);
  findProtectedFieldNames(item.hints, "hints", issues);
  if (item.scoringSpecHash !== hashScoringSpec(spec)) issues.push({ code: "scoring_spec_hash_mismatch", path: "scoringSpecHash" });
  if (item.itemHash !== hashItem(item)) issues.push({ code: "item_hash_mismatch", path: "itemHash" });
  return result(issues);
}

export function validateForm(
  form: AssessmentFormV2,
  definition: AssessmentDefinitionV2,
  items: ReadonlyMap<string, AssessmentItemV2>,
): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (form.definition.definitionId !== definition.definitionId || form.definition.version !== definition.version || form.definition.contentHash !== definition.contentHash) {
    issues.push({ code: "form_definition_pin_mismatch", path: "definition" });
  }
  if (form.items.length === 0) issues.push({ code: "form_items_required", path: "items" });
  if (!unique(form.items.map((ref) => ref.itemId))) issues.push({ code: "form_duplicate_item", path: "items" });
  if (form.delivery.itemOrder === "RANDOMIZED_BY_POLICY" && !nonEmpty(form.delivery.randomizationPolicyId)) issues.push({ code: "randomization_policy_required", path: "delivery" });
  const objectiveCounts = new Map<string, number>();
  for (const ref of form.items) {
    const item = items.get(`${ref.itemId}@${ref.itemVersion}`);
    if (!item) {
      issues.push({ code: "form_item_missing", path: `items.${ref.itemId}` });
      continue;
    }
    if (item.itemHash !== ref.itemHash) issues.push({ code: "form_item_hash_mismatch", path: `items.${ref.itemId}` });
    if (!(ref.points > 0)) issues.push({ code: "form_item_points_invalid", path: `items.${ref.itemId}` });
    for (const objectiveId of item.objectiveIds) {
      if (!definition.objectiveIds.includes(objectiveId)) issues.push({ code: "form_item_objective_outside_definition", path: `items.${ref.itemId}` });
      objectiveCounts.set(objectiveId, (objectiveCounts.get(objectiveId) ?? 0) + 1);
    }
  }
  const total = form.items.reduce((sum, ref) => sum + ref.points, 0);
  if (total !== form.blueprint.totalPoints) issues.push({ code: "blueprint_total_mismatch", path: "blueprint.totalPoints" });
  for (const coverage of form.blueprint.objectiveCoverage) {
    if ((objectiveCounts.get(coverage.objectiveId) ?? 0) < coverage.minItems) issues.push({ code: "blueprint_objective_under_covered", path: `blueprint.${coverage.objectiveId}` });
  }
  if (form.formHash !== hashForm(form)) issues.push({ code: "form_hash_mismatch", path: "formHash" });
  return result(issues);
}

export function assertIsoTimestamp(value: string, name: string): void {
  if (!iso(value)) throw new Error(`assessment_${name}_timestamp_invalid`);
}
