import {
  appendAssistance,
  ASSISTANCE_CHANNELS,
  authorizeRelease,
  emptyAssistanceLedger,
  isIndependentAssessment,
  resolveDelivery,
  resolveFormIndependence,
  REVIEW_CHECKS,
  sealDefinition,
  sealForm,
  sealItem,
  type AssessmentDefinitionV2,
  type AssessmentEvidenceEnvelope,
  type AssistanceLedger,
  type AssistanceLedgerScope,
  type AssessmentFormV2,
  type AssessmentItemV2,
  type AssessmentReleaseV2,
  type AssessmentReviewV2,
  type ProtectedScoringSpec,
  type ReviewSubject,
} from "@/lib/assessment/v2";

export const AUTHOR = { kind: "AI" as const, id: "agent:item-writer" };
export const REVIEWER_A = { kind: "HUMAN" as const, userId: "reviewer-a", role: "ASSESSMENT_REVIEWER" as const };
export const REVIEWER_B = { kind: "HUMAN" as const, userId: "reviewer-b", role: "ASSESSMENT_REVIEWER" as const };
export const LEAD = { userId: "lead-1", role: "CURRICULUM_LEAD" };
export const SCHOOL = "school-1";
export const CURRICULUM = { releaseId: "g7-math-release", releaseIdentity: "sha256:curriculum-identity" };

const provenance = { authors: [AUTHOR], sourceRef: "test", curriculumSourceRefs: ["MOE-G7-NUM-1"] };
const emptyStimulus = { context: null, resourceIds: [], options: [], orderingElements: [], matchingLeft: [], matchingRight: [], expectedUnit: null, learnerVisibleCriteria: [] };
const policy = { hints: "ON_REQUEST" as const, explanation: "AFTER_RESPONSE" as const, correctAnswer: "AFTER_ATTEMPT_CLOSED" as const };

function base(itemId: string) {
  return {
    schemaVersion: "assessment.v2" as const, itemId, version: "1.0.0", objectiveIds: ["obj-compare"],
    misconceptionIds: [], difficulty: 3 as const, cognitiveDemand: "APPLY" as const, context: "REHEARSED" as const,
    hints: [{ hintId: "h1", text: "Line up the decimal points." }], feedbackPolicy: policy, provenance,
  };
}

export function specFor(itemId: string, key: ProtectedScoringSpec["key"], maxPoints = 1, extra: Partial<ProtectedScoringSpec> = {}): ProtectedScoringSpec {
  return {
    schemaVersion: "assessment.v2", itemId, itemVersion: "1.0.0", scoringVersion: "1", maxPoints, key,
    explanation: "Seven tenths is greater than sixty-five hundredths because 0.70 > 0.65.",
    misconceptionSignals: [{ responsePattern: "b", misconceptionId: "mc-longer-decimal-bigger" }],
    moderationNotes: ["Accept equivalent wording only with a place-value reason."],
    ...extra,
  };
}

export function buildItems() {
  const singleSpec = specFor("i-single", { kind: "SINGLE_SELECT", correctOptionId: "a" });
  const single = sealItem({
    ...base("i-single"), itemType: "SINGLE_SELECT", misconceptionIds: ["mc-longer-decimal-bigger"],
    stimulus: { ...emptyStimulus, prompt: "Which is greater?", options: [{ optionId: "a", text: "0.7" }, { optionId: "b", text: "0.65" }] },
  }, singleSpec);

  const numericSpec = specFor("i-numeric", { kind: "NUMERIC", key: { value: 7000, absoluteTolerance: 0, acceptedUnits: ["m"], wrongUnitCredit: 0.5 } });
  const numeric = sealItem({
    ...base("i-numeric"), itemType: "NUMERIC",
    stimulus: { ...emptyStimulus, prompt: "A road is 7 km long. How many metres?", expectedUnit: "m" },
  }, numericSpec);

  const orderingSpec = specFor("i-order", { kind: "ORDERING", correctOrder: ["e1", "e2", "e3", "e4"], partialCredit: "ADJACENT_PAIRS" });
  const ordering = sealItem({
    ...base("i-order"), itemType: "ORDERING",
    stimulus: { ...emptyStimulus, prompt: "Order from least to greatest.", orderingElements: [
      { optionId: "e1", text: "0.08" }, { optionId: "e2", text: "0.088" }, { optionId: "e3", text: "0.5" }, { optionId: "e4", text: "0.8" },
    ] },
  }, orderingSpec);

  const shortSpec = specFor("i-short", { kind: "SHORT_CONSTRUCTED", acceptedAnswers: ["460,003.025"], autoScore: "EXACT_NORMALIZED" });
  const short = sealItem({
    ...base("i-short"), itemType: "SHORT_CONSTRUCTED",
    stimulus: { ...emptyStimulus, prompt: "Write in standard form: four hundred sixty thousand, three and twenty-five thousandths." },
  }, shortSpec);

  const rubricSpec = specFor("i-worked", { kind: "RUBRIC", rubric: { rubricId: "r-compare", rubricVersion: "1", criteria: [
    { criterionId: "decision", title: "Decision", levels: [{ points: 0, descriptor: "Agrees with Kebeh" }, { points: 1, descriptor: "Says Kebeh is wrong" }] },
    { criterionId: "reason", title: "Reason", levels: [{ points: 0, descriptor: "No place-value reasoning" }, { points: 1, descriptor: "Compares tenths before hundredths" }] },
  ] } }, 2);
  const worked = sealItem({
    ...base("i-worked"), itemType: "WORKED_SOLUTION", cognitiveDemand: "ANALYZE", context: "NEW",
    stimulus: { ...emptyStimulus, prompt: "Kebeh says 0.7 is less than 0.65. Is she right? Explain." },
  }, rubricSpec);

  return {
    items: [single, numeric, ordering, short, worked],
    specs: [singleSpec, numericSpec, orderingSpec, shortSpec, rubricSpec],
    single, singleSpec, numeric, numericSpec, ordering, orderingSpec, short, shortSpec, worked, rubricSpec,
  };
}

export function buildDefinition(overrides: Partial<Omit<AssessmentDefinitionV2, "contentHash">> = {}): AssessmentDefinitionV2 {
  return sealDefinition({
    schemaVersion: "assessment.v2", definitionId: "def-compare", version: "1.0.0", title: "Comparing decimals",
    purpose: "FORMATIVE", grade: 7, subject: "MATH", objectiveIds: ["obj-compare"], prerequisiteObjectiveIds: ["obj-place-value"],
    alignment: { ...CURRICULUM, nationalObjectiveIds: ["obj-compare"], extensionObjectiveIds: [] },
    timeLimitMinutes: 30, permittedTools: [{ toolId: "calculator", mode: "PROHIBITED" }], permittedAccommodations: ["EXTENDED_TIME", "READ_ALOUD"],
    attemptPolicy: { maxAttempts: 2, cooldownMinutes: 60, reportedAttempt: "FIRST" }, provenance,
    ...overrides,
  });
}

export function buildForm(definition: AssessmentDefinitionV2, items: readonly AssessmentItemV2[], overrides: Partial<Omit<AssessmentFormV2, "formHash">> = {}): AssessmentFormV2 {
  const refs = items.map((item) => ({ itemId: item.itemId, itemVersion: item.version, itemHash: item.itemHash, points: 1 }));
  return sealForm({
    schemaVersion: "assessment.v2", formId: "form-compare", version: "1.0.0",
    definition: { definitionId: definition.definitionId, version: definition.version, contentHash: definition.contentHash },
    items: refs,
    delivery: { itemOrder: "FIXED", randomizationPolicyId: null, allowBacktracking: true, offlineDelivery: "CAPTURE_ONLY" },
    blueprint: { blueprintVersion: "1", totalPoints: refs.length, objectiveCoverage: [{ objectiveId: "obj-compare", minItems: 1 }] },
    ...overrides,
  });
}

export function approve(subject: ReviewSubject, actor: AssessmentReviewV2["actor"] = REVIEWER_A, at = "2026-10-01T10:00:00.000Z"): AssessmentReviewV2 {
  return {
    reviewId: `rev-${subjectKey(subject)}-${actor.kind === "HUMAN" ? actor.userId : actor.agentId}`,
    subject, actor, decision: actor.kind === "AI" ? "RECOMMEND_APPROVE" : "APPROVE", occurredAt: at,
    checks: REVIEW_CHECKS.map((check) => ({ check, outcome: "PASS" as const, note: "ok" })),
  };
}

function subjectKey(subject: ReviewSubject) {
  return subject.kind === "ITEM" ? subject.itemId : subject.kind === "FORM" ? subject.formId : subject.definitionId;
}

export const itemSubject = (item: AssessmentItemV2): ReviewSubject => ({ kind: "ITEM", itemId: item.itemId, version: item.version, hash: item.itemHash });
export const formSubject = (form: AssessmentFormV2): ReviewSubject => ({ kind: "FORM", formId: form.formId, version: form.version, hash: form.formHash });
export const definitionSubject = (definition: AssessmentDefinitionV2): ReviewSubject => ({ kind: "DEFINITION", definitionId: definition.definitionId, version: definition.version, hash: definition.contentHash });

export function approveAll(definition: AssessmentDefinitionV2, form: AssessmentFormV2, items: readonly AssessmentItemV2[]): AssessmentReviewV2[] {
  return [approve(definitionSubject(definition)), approve(formSubject(form)), ...items.map((item) => approve(itemSubject(item)))];
}

/** Points for the summative fixture set (recall/application/analysis/transfer mix the design gate requires). */
const SUMMATIVE_POINTS = [4, 7, 6, 3] as const;

/** buildItems() adjusted to satisfy the summative design gate, as the LL-AEP-001 suite does. */
function summativeItems() {
  const built = buildItems();
  const variant = (item: AssessmentItemV2, spec: ProtectedScoringSpec, extra: Partial<AssessmentItemV2>) => {
    const { itemHash: _h, scoringSpecHash: _s, ...rest } = item;
    return sealItem({ ...rest, ...extra }, spec);
  };
  const single = variant(built.single, built.singleSpec, { cognitiveDemand: "RECALL" });
  const ordering = variant(built.ordering, built.orderingSpec, { cognitiveDemand: "ANALYZE" });
  return { ...built, single, ordering, items: [single, built.numeric, ordering, built.worked], specs: [built.singleSpec, built.numericSpec, built.orderingSpec, built.rubricSpec] };
}

export function buildReleased(overrides: { permittedModes?: AssessmentReleaseV2["permittedModes"]; schoolId?: string | null; actor?: { userId: string; role: string }; purpose?: AssessmentDefinitionV2["purpose"] } = {}) {
  const definition = buildDefinition(overrides.purpose ? { purpose: overrides.purpose } : {});
  const highStakes = definition.purpose === "SUMMATIVE" || definition.purpose === "EXAMINATION";
  const built = highStakes ? summativeItems() : buildItems();
  const form = highStakes ? buildForm(definition, built.items, {
    items: built.items.map((item, index) => ({ itemId: item.itemId, itemVersion: item.version, itemHash: item.itemHash, points: SUMMATIVE_POINTS[index] })),
    blueprint: { blueprintVersion: "1", totalPoints: SUMMATIVE_POINTS.reduce((a, b) => a + b, 0), objectiveCoverage: [{ objectiveId: "obj-compare", minItems: 1 }] },
  }) : buildForm(definition, built.items);
  // High-stakes releases need two approvals per subject and a recorded blueprint exception for this small fixture form.
  const subjects = [definitionSubject(definition), formSubject(form), ...built.items.map(itemSubject)];
  const reviews = highStakes ? [...subjects.map((subject) => approve(subject, REVIEWER_A)), ...subjects.map((subject) => approve(subject, REVIEWER_B))] : approveAll(definition, form, built.items);
  const { release } = authorizeRelease({
    releaseId: "rel-1", definition, form, items: built.items, specs: built.specs, reviews,
    blueprintException: highStakes ? { reason: "Small test fixture form", basis: "subject structure", approvedBy: "lead-1" } : null,
    permittedModes: overrides.permittedModes ?? ["OFFICIAL", "PRACTICE_UNOFFICIAL"],
    effectiveFrom: "2026-10-01T00:00:00.000Z", effectiveUntil: "2027-07-31T00:00:00.000Z",
    schoolId: overrides.schoolId === undefined ? SCHOOL : overrides.schoolId,
    actor: overrides.actor ?? LEAD, authorizedAt: "2026-10-02T00:00:00.000Z",
  });
  const itemMap = new Map(built.items.map((item) => [`${item.itemId}@${item.version}`, item]));
  return { ...built, definition, form, reviews, release, itemMap };
}

/**
 * A clean, sealed server assistance record for the attempt an envelope belongs to: opened before the
 * attempt, every channel instrumented, no assistance, sealed at submission. Deterministic, so the
 * record handed to verification and to admission has the same head. Null for unreleased delivery.
 */
export function sealedAssistanceRecord(envelope: Pick<AssessmentEvidenceEnvelope, "scope" | "attempt" | "pins" | "delivery">): AssistanceLedger | null {
  if (envelope.pins.releaseId === null || envelope.pins.releaseHash === null) return null;
  const scope: AssistanceLedgerScope = {
    tenantId: envelope.scope.tenantId, schoolId: envelope.scope.schoolId, studentId: envelope.scope.studentId,
    attemptId: envelope.attempt.attemptId, sessionId: envelope.attempt.sessionId,
    releaseId: envelope.pins.releaseId, releaseHash: envelope.pins.releaseHash,
  };
  const opened = appendAssistance(emptyAssistanceLedger(scope), {
    scope, recordedAt: "2026-10-31T00:00:00.000Z",
    event: { type: "OPENED", availableChannels: [...ASSISTANCE_CHANNELS], instrumentedChannels: [...ASSISTANCE_CHANNELS], independentDelivery: isIndependentAssessment(envelope.delivery), offlineDeviceIds: ["tablet-7"] },
  }).ledger;
  return appendAssistance(opened, { scope, recordedAt: "2026-11-05T00:00:00.000Z", event: { type: "SEALED", reason: "SUBMITTED" } }).ledger;
}

/** An issued independence decision for a released form of this purpose, delivered as practice. */
export function practiceDecision(purpose: AssessmentDefinitionV2["purpose"] = "FORMATIVE") {
  const released = buildReleased({ purpose });
  const delivery = resolveDelivery({ mode: "PRACTICE_UNOFFICIAL", now: "2026-11-01T00:00:00.000Z", requester: { role: "STUDENT", schoolId: SCHOOL }, release: released.release, revocations: [], expectedCurriculum: CURRICULUM });
  return resolveFormIndependence({ form: released.form, definition: released.definition, release: released.release, delivery });
}
