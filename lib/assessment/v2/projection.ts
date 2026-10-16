/**
 * Learner-safe projection. Built by ALLOW-LIST: only named learner fields are copied, so a new
 * protected field added to an item or spec can never leak by default. Answer keys, scoring rules,
 * hidden explanations, rubric descriptors and moderation notes never appear before the item's
 * feedback policy permits disclosure, and never appear in offline packages.
 *
 * Ordering and matching elements are presented in a per-attempt deterministic order derived from a
 * hash, never in authored order (authored order is often the key).
 */
import { createHash } from "crypto";
import { itemTypeSpec } from "./itemTypes";
import type { DeliveryDecision } from "./release";
import type {
  AssessmentFormV2,
  AssessmentItemV2,
  ChoiceOption,
  FeedbackReleasePolicy,
  ProtectedScoringSpec,
} from "./types";

export const LEARNER_ASSESSMENT_PROJECTION_VERSION = "learner-assessment.v2" as const;

export type LearnerItemV2 = Readonly<{
  itemId: string;
  itemVersion: string;
  itemType: AssessmentItemV2["itemType"];
  responseKind: string;
  prompt: string;
  context: string | null;
  resourceIds: readonly string[];
  options: readonly ChoiceOption[];
  orderingElements: readonly ChoiceOption[];
  matchingLeft: readonly ChoiceOption[];
  matchingRight: readonly ChoiceOption[];
  expectedUnit: string | null;
  learnerVisibleCriteria: readonly string[];
  /** Number of hints; text is served one at a time on request and recorded as assistance. */
  hintCount: number;
  maxResponseChars: number;
  points: number;
}>;

export type LearnerFormV2 = Readonly<{
  projectionVersion: typeof LEARNER_ASSESSMENT_PROJECTION_VERSION;
  formId: string;
  formVersion: string;
  attemptId: string;
  label: DeliveryDecision["label"];
  official: boolean;
  items: readonly LearnerItemV2[];
}>;

function attemptOrder<T extends { optionId: string }>(values: readonly T[], attemptId: string, salt: string): T[] {
  const rank = (value: T) => createHash("sha256").update(`${attemptId}:${salt}:${value.optionId}`).digest("hex");
  return [...values].sort((a, b) => (rank(a) < rank(b) ? -1 : 1));
}

const copyOptions = (options: readonly ChoiceOption[]) => options.map((option) => Object.freeze({ optionId: option.optionId, text: option.text }));

export function projectItemForLearner(item: AssessmentItemV2, input: { attemptId: string; points: number }): LearnerItemV2 {
  const typeSpec = itemTypeSpec(item.itemType);
  return Object.freeze({
    itemId: item.itemId,
    itemVersion: item.version,
    itemType: item.itemType,
    responseKind: typeSpec.responseKind,
    prompt: item.stimulus.prompt,
    context: item.stimulus.context,
    resourceIds: [...item.stimulus.resourceIds],
    options: copyOptions(item.stimulus.options),
    orderingElements: copyOptions(attemptOrder(item.stimulus.orderingElements, input.attemptId, `${item.itemId}:ordering`)),
    matchingLeft: copyOptions(item.stimulus.matchingLeft),
    matchingRight: copyOptions(attemptOrder(item.stimulus.matchingRight, input.attemptId, `${item.itemId}:matching`)),
    expectedUnit: item.stimulus.expectedUnit,
    learnerVisibleCriteria: [...item.stimulus.learnerVisibleCriteria],
    hintCount: item.feedbackPolicy.hints === "ON_REQUEST" ? item.hints.length : 0,
    maxResponseChars: typeSpec.maxResponseChars,
    points: input.points,
  });
}

export function projectFormForLearner(input: {
  form: AssessmentFormV2;
  items: ReadonlyMap<string, AssessmentItemV2>;
  attemptId: string;
  delivery: DeliveryDecision;
}): LearnerFormV2 {
  if (!input.delivery.allowed) throw new Error(`assessment_delivery_denied:${input.delivery.reason}`);
  const refs = input.form.delivery.itemOrder === "FIXED"
    ? input.form.items
    : attemptOrder(input.form.items.map((ref) => ({ ...ref, optionId: ref.itemId })), input.attemptId, `${input.form.formId}:items`);
  return Object.freeze({
    projectionVersion: LEARNER_ASSESSMENT_PROJECTION_VERSION,
    formId: input.form.formId,
    formVersion: input.form.version,
    attemptId: input.attemptId,
    label: input.delivery.label,
    official: input.delivery.official,
    items: Object.freeze(refs.map((ref) => {
      const item = input.items.get(`${ref.itemId}@${ref.itemVersion}`);
      if (!item || item.itemHash !== ref.itemHash) throw new Error("assessment_projection_item_pin_mismatch");
      return projectItemForLearner(item, { attemptId: input.attemptId, points: ref.points });
    })),
  });
}

/**
 * Offline packages contain the pre-response projection only. Disclosures are never packaged:
 * a device holding the explanation or key before the learner answers would leak it to anyone with
 * the device. Official offline delivery requires the form to permit CAPTURE_ONLY.
 */
export function buildOfflineAssessmentPackage(input: {
  form: AssessmentFormV2;
  items: ReadonlyMap<string, AssessmentItemV2>;
  attemptId: string;
  delivery: DeliveryDecision;
}): Readonly<{ kind: "OFFLINE_ASSESSMENT_PACKAGE"; capture: "CAPTURE_ONLY"; scoring: "SERVER_AFTER_SYNC"; form: LearnerFormV2 }> {
  if (input.form.delivery.offlineDelivery !== "CAPTURE_ONLY") throw new Error("assessment_offline_delivery_prohibited");
  if (input.delivery.mode === "REVIEWER_PREVIEW") throw new Error("assessment_offline_preview_prohibited");
  return Object.freeze({ kind: "OFFLINE_ASSESSMENT_PACKAGE", capture: "CAPTURE_ONLY", scoring: "SERVER_AFTER_SYNC", form: projectFormForLearner(input) });
}

export type DisclosurePhase = "BEFORE_RESPONSE" | "AFTER_RESPONSE" | "AFTER_ATTEMPT_CLOSED" | "AFTER_RELEASE_WINDOW";

const PHASE_RANK: Record<DisclosurePhase, number> = { BEFORE_RESPONSE: 0, AFTER_RESPONSE: 1, AFTER_ATTEMPT_CLOSED: 2, AFTER_RELEASE_WINDOW: 3 };

function permits(policy: FeedbackReleasePolicy["explanation"], phase: DisclosurePhase): boolean {
  if (policy === "NEVER") return false;
  return PHASE_RANK[phase] >= PHASE_RANK[policy];
}

/**
 * Post-response disclosure, decided on the server from the item policy and the attempt phase.
 * The returned object is the ONLY path by which explanation or key material reaches a learner.
 */
export function learnerDisclosure(item: AssessmentItemV2, spec: ProtectedScoringSpec, phase: DisclosurePhase): Readonly<{
  explanation: string | null;
  correctResponse: string | null;
}> {
  if (spec.itemId !== item.itemId || spec.itemVersion !== item.version) throw new Error("assessment_spec_item_mismatch");
  const explanation = permits(item.feedbackPolicy.explanation, phase) ? spec.explanation : null;
  let correctResponse: string | null = null;
  if (permits(item.feedbackPolicy.correctAnswer, phase)) {
    const key = spec.key;
    if (key.kind === "SINGLE_SELECT") correctResponse = item.stimulus.options.find((option) => option.optionId === key.correctOptionId)?.text ?? null;
    else if (key.kind === "MULTI_SELECT") correctResponse = item.stimulus.options.filter((option) => key.correctOptionIds.includes(option.optionId)).map((option) => option.text).join("; ");
    else if (key.kind === "NUMERIC") correctResponse = `${key.key.value}${key.key.acceptedUnits[0] ? ` ${key.key.acceptedUnits[0]}` : ""}`;
    else if (key.kind === "SHORT_CONSTRUCTED") correctResponse = key.acceptedAnswers[0] ?? null;
    // Ordering, matching and rubric items disclose through the explanation only.
  }
  return Object.freeze({ explanation, correctResponse });
}

/** Strings that must never appear in a pre-response learner payload for these items. */
export function protectedStrings(items: readonly AssessmentItemV2[], specs: readonly ProtectedScoringSpec[]): string[] {
  const secrets: string[] = [];
  for (const spec of specs) {
    const item = items.find((candidate) => candidate.itemId === spec.itemId && candidate.version === spec.itemVersion);
    const visible = item ? JSON.stringify(item.stimulus) : "";
    const add = (value: string | null | undefined) => {
      const text = value?.trim();
      // Short values (an option id, "3") can legitimately occur in learner text; only flag
      // distinctive secret strings that are not already part of the learner-visible stimulus.
      if (text && text.length >= 3 && !visible.includes(text)) secrets.push(text);
    };
    add(spec.explanation);
    spec.moderationNotes.forEach(add);
    if (spec.key.kind === "SHORT_CONSTRUCTED") spec.key.acceptedAnswers.forEach(add);
    if (spec.key.kind === "RUBRIC") spec.key.rubric.criteria.forEach((criterion) => criterion.levels.forEach((level) => add(level.descriptor)));
  }
  return secrets;
}

const LEAK_FIELD_PATTERN = /"(correctIndex|correctOptionIds?|correctOrder|acceptedAnswers|answerKey|scoringGuide|rubric|explanation|moderationNotes|misconceptionSignals|isCorrect|correctAnswer|absoluteTolerance|pairs)"\s*:/;

/** Throws if a learner payload carries protected field names or protected strings. */
export function assertLearnerSafe(payload: unknown, secrets: readonly string[]): void {
  const serialized = JSON.stringify(payload);
  const field = LEAK_FIELD_PATTERN.exec(serialized);
  if (field) throw new Error(`assessment_learner_payload_leak_field:${field[1]}`);
  for (const secret of secrets) if (serialized.includes(secret)) throw new Error("assessment_learner_payload_leak_value");
}
