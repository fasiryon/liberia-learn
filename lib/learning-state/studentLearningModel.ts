import { createHash } from "crypto";
import {
  GRADE4_MATH_ONTOLOGY_RELEASE,
  deterministicReleaseIdentity,
} from "@/lib/learning-authority/governedGrade4Math";
import {
  GRADE4_MATH_MISCONCEPTION_POLICY,
  MISCONCEPTION_SIGNAL_POLICY_VERSION,
  resolveGovernedMisconceptionSignal,
} from "@/lib/learning-state/misconceptionPolicy";

export const STUDENT_LEARNING_MODEL_VERSION = "student-learning-model/1.0.0" as const;
export const MASTERY_REDUCER_VERSION = "mastery-reducer/1.0.0" as const;
export const RETENTION_MODEL_VERSION = "exponential-half-life/1.0.0" as const;
export const RETENTION_PROBE_MIN_INTERVAL_DAYS = 7 as const;
export const CANONICAL_MASTERY_EVENT_TYPE = "learning.canonical.mastery_update.v1" as const;
export const CANONICAL_MASTERY_EVENT_SOURCE = "governed-learning-authority" as const;

const DAY_MS = 86_400_000;

export type EvidenceContext = "DIAGNOSTIC" | "PRACTICE" | "TEACHER_OBSERVATION";
export type MasteryLevel = "UNKNOWN" | "INSUFFICIENT_EVIDENCE" | "EMERGING" | "DEVELOPING" | "SECURE";
export type ConfidenceLevel = "NONE" | "LOW" | "MEDIUM" | "HIGH";
export type RetentionStatus = "UNKNOWN" | "FRESH" | "DUE" | "AT_RISK";
export type MisconceptionStatus = "SUSPECTED" | "CONFIRMED" | "REJECTED" | "CONFLICTED";

export type LearnerStateScope = Readonly<{
  schoolId: string;
  studentId: string;
  studentUserId: string;
  conceptId: string;
  ontologyReleaseId: string;
  ontologyReleaseIdentity: string;
}>;

export type GovernedMasteryEvidence = Readonly<{
  type: "GOVERNED_EVIDENCE";
  schemaVersion: 1;
  reducerVersion: typeof MASTERY_REDUCER_VERSION;
  evidenceId: string;
  scope: LearnerStateScope;
  bindingId: string;
  itemId: string;
  itemVersion: string;
  evidencePolicyVersion: string;
  toolPolicyVersion: string;
  context: EvidenceContext;
  result: "CORRECT" | "INCORRECT";
  selectedAnswerIndex: number;
  independenceKey: string;
  occurredAt: string;
  serverScored: true;
  admissionDecision: "ACCEPTED";
  authority: "SERVER_GOVERNED_EVIDENCE_GATEWAY";
  retentionProbe: boolean;
  misconceptionSignalId: string | null;
  misconceptionPolicyVersion: typeof MISCONCEPTION_SIGNAL_POLICY_VERSION;
}>;

export type GovernedMisconceptionReview = Readonly<{
  type: "MISCONCEPTION_REVIEW";
  schemaVersion: 1;
  reducerVersion: typeof MASTERY_REDUCER_VERSION;
  reviewId: string;
  scope: LearnerStateScope;
  signalId: string;
  decision: "CONFIRMED" | "REJECTED";
  evidenceIds: readonly string[];
  actor: Readonly<{ userId: string; role: "TEACHER" | "ADMIN" }>;
  policyVersion: "misconception-review/1.0.0";
  occurredAt: string;
  authority: "AUTHORIZED_HUMAN_REVIEW";
}>;

export type CanonicalLearningStateEvent = GovernedMasteryEvidence | GovernedMisconceptionReview;

export type StudentConceptState = Readonly<{
  modelVersion: typeof STUDENT_LEARNING_MODEL_VERSION;
  reducerVersion: typeof MASTERY_REDUCER_VERSION;
  scope: LearnerStateScope;
  asOf: string;
  replay: Readonly<{
    eventCount: number;
    inputDigest: string;
    deterministic: true;
  }>;
  mastery: Readonly<{
    observedScore: number | null;
    level: MasteryLevel;
    positiveStrength: number;
    negativeStrength: number;
  }>;
  confidence: Readonly<{
    score: number;
    level: ConfidenceLevel;
    distinctItems: number;
    independentOccasions: number;
    reasons: readonly string[];
  }>;
  retention: Readonly<{
    modelVersion: typeof RETENTION_MODEL_VERSION;
    estimatedRetainedMastery: number | null;
    status: RetentionStatus;
    halfLifeDays: 30;
    lastReinforcedAt: string | null;
    lastProbeAt: string | null;
    lastProbeResult: "CORRECT" | "INCORRECT" | null;
    assumption: "POLICY_ESTIMATE_NOT_OBSERVED_FORGETTING";
  }>;
  recency: Readonly<{
    firstEvidenceAt: string | null;
    lastEvidenceAt: string | null;
    ageDays: number | null;
  }>;
  conflict: Readonly<{
    present: boolean;
    score: number;
    positiveEvidenceIds: readonly string[];
    negativeEvidenceIds: readonly string[];
  }>;
  misconceptions: readonly Readonly<{
    signalId: string;
    status: MisconceptionStatus;
    signalEvidenceIds: readonly string[];
    confirmingReviewIds: readonly string[];
    rejectingReviewIds: readonly string[];
  }>[];
  teacherExplanation: readonly string[];
  authority: Readonly<{
    canonical: true;
    replayable: true;
    writer: "GOVERNED_MASTERY_WRITER";
    legacyCompatibility: "ONE_WAY_OUTPUT_ONLY";
    mayChangeAdministrativeGrade: false;
    clientMayWrite: false;
    deviceMayWrite: false;
    llmMayWrite: false;
  }>;
}>;

export type MasteryUpdate = Readonly<{
  event: CanonicalLearningStateEvent;
  state: StudentConceptState;
}>;

export function createGovernedMisconceptionReview(input: {
  reviewId: string;
  scope: LearnerStateScope;
  signalId: string;
  decision: "CONFIRMED" | "REJECTED";
  evidenceIds: readonly string[];
  actor: { userId: string; role: "TEACHER" | "ADMIN" };
  occurredAt: string;
}): GovernedMisconceptionReview {
  const review: GovernedMisconceptionReview = Object.freeze({
    type: "MISCONCEPTION_REVIEW",
    schemaVersion: 1,
    reducerVersion: MASTERY_REDUCER_VERSION,
    reviewId: input.reviewId,
    scope: Object.freeze({ ...input.scope }),
    signalId: input.signalId,
    decision: input.decision,
    evidenceIds: Object.freeze([...input.evidenceIds]),
    actor: Object.freeze({ ...input.actor }),
    policyVersion: "misconception-review/1.0.0",
    occurredAt: input.occurredAt,
    authority: "AUTHORIZED_HUMAN_REVIEW",
  });
  validateCanonicalLearningStateEvent(review);
  return review;
}

export type DecisionModelLearnerState = Readonly<{
  contractVersion: "decision-model-learner-state/1.0.0";
  authoritativeLearnerState: StudentConceptState;
  validCandidateActions: readonly never[];
  decisionIntelligence: Readonly<{
    uncertaintyReasons: readonly string[];
    conflictingEvidence: boolean;
    retentionStatus: RetentionStatus;
    confirmedMisconceptionIds: readonly string[];
  }>;
  governedPolicyResolution: Readonly<{
    ontologyReleaseId: string;
    ontologyReleaseIdentity: string;
    reducerVersion: typeof MASTERY_REDUCER_VERSION;
    retentionModelVersion: typeof RETENTION_MODEL_VERSION;
    actionPolicyStatus: "NOT_IMPLEMENTED_IN_THIS_MISSION";
    requiresDecisionAuthority: true;
  }>;
}>;

export type LearnerSafeStudentConceptState = Readonly<{
  modelVersion: typeof STUDENT_LEARNING_MODEL_VERSION;
  reducerVersion: typeof MASTERY_REDUCER_VERSION;
  asOf: string;
  mastery: StudentConceptState["mastery"];
  confidence: StudentConceptState["confidence"];
  retention: StudentConceptState["retention"];
  recency: StudentConceptState["recency"];
  conflict: Readonly<{ present: boolean; score: number }>;
  authority: Readonly<{
    canonical: true;
    mayChangeAdministrativeGrade: false;
    learnerMayWrite: false;
  }>;
}>;

const contextStrength: Readonly<Record<EvidenceContext, number>> = Object.freeze({
  DIAGNOSTIC: 1,
  PRACTICE: 0.7,
  TEACHER_OBSERVATION: 0.9,
});

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function timestamp(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    throw new Error(`${label}_timestamp_invalid`);
  }
  return parsed;
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stable(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value: unknown): string {
  return createHash("sha256").update(stable(value)).digest("hex");
}

function eventId(event: CanonicalLearningStateEvent): string {
  return event.type === "GOVERNED_EVIDENCE" ? event.evidenceId : event.reviewId;
}

function validateScope(scope: LearnerStateScope): void {
  const keys: readonly (keyof LearnerStateScope)[] = [
    "schoolId", "studentId", "studentUserId", "conceptId", "ontologyReleaseId", "ontologyReleaseIdentity",
  ];
  for (const key of keys) {
    if (typeof scope?.[key] !== "string" || scope[key].length === 0) throw new Error(`scope_${key}_required`);
  }
}

function sameScope(left: LearnerStateScope, right: LearnerStateScope): boolean {
  return stable(left) === stable(right);
}

export function validateCanonicalLearningStateEvent(event: CanonicalLearningStateEvent): void {
  if (!event || (event.type !== "GOVERNED_EVIDENCE" && event.type !== "MISCONCEPTION_REVIEW")) {
    throw new Error("canonical_learning_event_type_invalid");
  }
  if (event.schemaVersion !== 1 || event.reducerVersion !== MASTERY_REDUCER_VERSION) {
    throw new Error("canonical_learning_event_version_unsupported");
  }
  validateScope(event.scope);
  timestamp(event.occurredAt, "canonical_learning_event");
  if (event.type === "GOVERNED_EVIDENCE") {
    if (!event.evidenceId || !event.bindingId || !event.itemId || !event.itemVersion ||
      !event.evidencePolicyVersion || !event.toolPolicyVersion || !event.independenceKey) {
      throw new Error("governed_evidence_identity_required");
    }
    if (event.authority !== "SERVER_GOVERNED_EVIDENCE_GATEWAY" ||
      event.serverScored !== true || event.admissionDecision !== "ACCEPTED") {
      throw new Error("governed_evidence_authority_invalid");
    }
    if (event.result !== "CORRECT" && event.result !== "INCORRECT") throw new Error("governed_evidence_result_invalid");
    if (typeof event.retentionProbe !== "boolean") throw new Error("governed_evidence_retention_probe_invalid");
    if (!Number.isInteger(event.selectedAnswerIndex) || event.selectedAnswerIndex < 0) {
      throw new Error("governed_evidence_answer_invalid");
    }
    if (!Object.prototype.hasOwnProperty.call(contextStrength, event.context)) throw new Error("governed_evidence_context_invalid");
    const releaseIdentity = deterministicReleaseIdentity(GRADE4_MATH_ONTOLOGY_RELEASE);
    if (event.scope.ontologyReleaseId !== GRADE4_MATH_ONTOLOGY_RELEASE.id ||
      event.scope.ontologyReleaseIdentity !== releaseIdentity) throw new Error("governed_evidence_release_invalid");
    const binding = GRADE4_MATH_ONTOLOGY_RELEASE.bindings.find((candidate) => candidate.id === event.bindingId);
    const item = GRADE4_MATH_ONTOLOGY_RELEASE.items.find((candidate) => candidate.id === event.itemId);
    const evidencePolicy = GRADE4_MATH_ONTOLOGY_RELEASE.evidencePolicies.find((candidate) => candidate.id === binding?.evidencePolicyId);
    const toolPolicy = GRADE4_MATH_ONTOLOGY_RELEASE.toolPolicies.find((candidate) => candidate.id === binding?.toolPolicyId);
    if (!binding || !item || binding.conceptId !== event.scope.conceptId || binding.itemId !== item.id ||
      binding.itemVersion !== event.itemVersion || item.version !== event.itemVersion || item.context !== event.context ||
      event.selectedAnswerIndex >= item.options.length || evidencePolicy?.version !== event.evidencePolicyVersion ||
      toolPolicy?.version !== event.toolPolicyVersion) {
      throw new Error("governed_evidence_binding_invalid");
    }
    if ((event.selectedAnswerIndex === item.correctIndex ? "CORRECT" : "INCORRECT") !== event.result) {
      throw new Error("governed_evidence_result_mismatch");
    }
    const expectedSignal = resolveGovernedMisconceptionSignal({
      ontologyReleaseId: event.scope.ontologyReleaseId,
      ontologyReleaseIdentity: event.scope.ontologyReleaseIdentity,
      bindingId: event.bindingId,
      itemId: event.itemId,
      itemVersion: event.itemVersion,
      selectedAnswerIndex: event.selectedAnswerIndex,
    });
    if (event.misconceptionPolicyVersion !== MISCONCEPTION_SIGNAL_POLICY_VERSION ||
      event.misconceptionSignalId !== expectedSignal) throw new Error("governed_evidence_misconception_policy_invalid");
  } else {
    if (event.scope.ontologyReleaseId !== GRADE4_MATH_ONTOLOGY_RELEASE.id ||
      event.scope.ontologyReleaseIdentity !== deterministicReleaseIdentity(GRADE4_MATH_ONTOLOGY_RELEASE)) {
      throw new Error("misconception_review_release_invalid");
    }
    if (!event.reviewId || !event.signalId || !event.actor.userId ||
      !["TEACHER", "ADMIN"].includes(event.actor.role) ||
      event.authority !== "AUTHORIZED_HUMAN_REVIEW" ||
      event.policyVersion !== "misconception-review/1.0.0" ||
      event.evidenceIds.length === 0 ||
      (event.decision !== "CONFIRMED" && event.decision !== "REJECTED") ||
      !GRADE4_MATH_MISCONCEPTION_POLICY.definitions.some((definition) => definition.id === event.signalId)) {
      throw new Error("misconception_review_authority_invalid");
    }
  }
}

function uniqueEvents(events: readonly CanonicalLearningStateEvent[]): CanonicalLearningStateEvent[] {
  const byId = new Map<string, CanonicalLearningStateEvent>();
  for (const event of events) {
    validateCanonicalLearningStateEvent(event);
    const id = eventId(event);
    const prior = byId.get(id);
    if (prior && digest(prior) !== digest(event)) throw new Error("canonical_learning_event_duplicate_conflict");
    byId.set(id, event);
  }
  return [...byId.values()].sort((left, right) =>
    timestamp(left.occurredAt, "canonical_learning_event") - timestamp(right.occurredAt, "canonical_learning_event") ||
    (eventId(left) < eventId(right) ? -1 : eventId(left) > eventId(right) ? 1 : 0)
  );
}

function confidenceLevel(score: number): ConfidenceLevel {
  if (score === 0) return "NONE";
  if (score < 0.5) return "LOW";
  if (score < 0.75) return "MEDIUM";
  return "HIGH";
}

function masteryLevel(score: number | null, confidence: number): MasteryLevel {
  if (score === null) return "UNKNOWN";
  if (confidence < 0.5) return "INSUFFICIENT_EVIDENCE";
  if (score >= 0.8 && confidence >= 0.65) return "SECURE";
  if (score >= 0.6) return "DEVELOPING";
  return "EMERGING";
}

export function replayStudentConceptState(
  inputEvents: readonly CanonicalLearningStateEvent[],
  options: { asOf: string; expectedScope?: LearnerStateScope }
): StudentConceptState {
  const asOfMs = timestamp(options.asOf, "as_of");
  const events = uniqueEvents(inputEvents);
  const scope = options.expectedScope ?? events[0]?.scope;
  if (!scope) throw new Error("student_concept_scope_required");
  validateScope(scope);
  if (scope.ontologyReleaseId !== GRADE4_MATH_ONTOLOGY_RELEASE.id ||
    scope.ontologyReleaseIdentity !== deterministicReleaseIdentity(GRADE4_MATH_ONTOLOGY_RELEASE) ||
    !GRADE4_MATH_ONTOLOGY_RELEASE.concepts.some((concept) => concept.id === scope.conceptId)) {
    throw new Error("student_concept_scope_not_governed");
  }
  for (const event of events) {
    if (!sameScope(event.scope, scope)) throw new Error("canonical_learning_event_scope_mismatch");
    if (timestamp(event.occurredAt, "canonical_learning_event") > asOfMs) {
      throw new Error("canonical_learning_event_after_as_of");
    }
  }

  const evidence = events.filter((event): event is GovernedMasteryEvidence => event.type === "GOVERNED_EVIDENCE");
  const reviews = events.filter((event): event is GovernedMisconceptionReview => event.type === "MISCONCEPTION_REVIEW");
  for (let index = 0; index < evidence.length; index += 1) {
    if (!evidence[index].retentionProbe) continue;
    const priorSuccess = evidence.slice(0, index).filter((candidate) => candidate.result === "CORRECT").at(-1);
    const eligiblePrior = priorSuccess !== undefined && priorSuccess.independenceKey !== evidence[index].independenceKey &&
      timestamp(evidence[index].occurredAt, "retention_probe") - timestamp(priorSuccess.occurredAt, "retention_prior") >=
        RETENTION_PROBE_MIN_INTERVAL_DAYS * DAY_MS;
    if (!eligiblePrior) throw new Error("retention_probe_not_eligible");
  }
  const evidenceById = new Map(evidence.map((event) => [event.evidenceId, event]));
  for (const review of reviews) {
    const reviewAt = timestamp(review.occurredAt, "misconception_review");
    for (const reference of review.evidenceIds) {
      const referenced = evidenceById.get(reference);
      if (!referenced || referenced.misconceptionSignalId !== review.signalId ||
        timestamp(referenced.occurredAt, "misconception_evidence") > reviewAt) {
        throw new Error("misconception_review_evidence_invalid");
      }
    }
  }
  const positive = evidence.filter((event) => event.result === "CORRECT");
  const negative = evidence.filter((event) => event.result === "INCORRECT");
  const positiveStrength = positive.reduce((sum, event) => sum + contextStrength[event.context], 0);
  const negativeStrength = negative.reduce((sum, event) => sum + contextStrength[event.context], 0);
  const totalStrength = positiveStrength + negativeStrength;
  const observedScore = totalStrength === 0 ? null : round(positiveStrength / totalStrength);
  const distinctItems = new Set(evidence.map((event) => `${event.itemId}@${event.itemVersion}`)).size;
  const independentOccasions = new Set(evidence.map((event) => event.independenceKey)).size;
  const distinctContexts = new Set(evidence.map((event) => event.context)).size;
  const conflictScore = totalStrength === 0 ? 0 : round(2 * Math.min(positiveStrength, negativeStrength) / totalStrength);
  const quantity = 1 - Math.exp(-totalStrength / 3);
  const diversity = Math.min(1, 0.55 + Math.max(0, distinctItems - 1) * 0.2 + Math.max(0, distinctContexts - 1) * 0.1);
  const independence = Math.min(1, 0.55 + Math.max(0, independentOccasions - 1) * 0.15);
  let confidenceScore = round(quantity * diversity * independence * (1 - 0.5 * conflictScore));
  if (distinctItems <= 1) confidenceScore = Math.min(confidenceScore, 0.45);

  const reasons: string[] = [];
  if (evidence.length === 0) reasons.push("NO_EVIDENCE");
  if (evidence.length > 0 && totalStrength < 2) reasons.push("SPARSE_EVIDENCE");
  if (distinctItems === 1) reasons.push("SINGLE_ITEM_COVERAGE");
  if (independentOccasions <= 1 && evidence.length > 0) reasons.push("SINGLE_OCCASION");
  if (conflictScore > 0) reasons.push("CONFLICTING_EVIDENCE");

  const lastEvidence = evidence.at(-1) ?? null;
  const lastCorrect = positive.at(-1) ?? null;
  const ageDays = lastEvidence ? round((asOfMs - timestamp(lastEvidence.occurredAt, "evidence")) / DAY_MS) : null;
  const reinforcementAge = lastCorrect ? Math.max(0, (asOfMs - timestamp(lastCorrect.occurredAt, "reinforcement")) / DAY_MS) : null;
  const reinforcementAgeDays = reinforcementAge === null ? null : round(reinforcementAge);
  const retained = observedScore === null || reinforcementAge === null
    ? null
    : round(observedScore * Math.pow(0.5, reinforcementAge / 30));
  const retentionStatus: RetentionStatus = retained === null
    ? "UNKNOWN"
    : reinforcementAge <= 14 ? "FRESH" : reinforcementAge <= 30 ? "DUE" : "AT_RISK";
  if (retentionStatus === "DUE" || retentionStatus === "AT_RISK") reasons.push("STALE_EVIDENCE");
  const probes = evidence.filter((event) => event.retentionProbe);
  const lastProbe = probes.at(-1) ?? null;

  const signals = new Map<string, GovernedMasteryEvidence[]>();
  for (const event of evidence) {
    if (!event.misconceptionSignalId) continue;
    signals.set(event.misconceptionSignalId, [...(signals.get(event.misconceptionSignalId) ?? []), event]);
  }
  const misconceptions = [...signals.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([signalId, signalEvidence]) => {
    const evidenceIds = new Set(signalEvidence.map((event) => event.evidenceId));
    const applicableReviews = reviews.filter((review) => review.signalId === signalId && review.evidenceIds.every((id) => evidenceIds.has(id)));
    const confirming = applicableReviews.filter((review) => review.decision === "CONFIRMED").map((review) => review.reviewId);
    const rejecting = applicableReviews.filter((review) => review.decision === "REJECTED").map((review) => review.reviewId);
    const status: MisconceptionStatus = confirming.length && rejecting.length
      ? "CONFLICTED" : confirming.length ? "CONFIRMED" : rejecting.length ? "REJECTED" : "SUSPECTED";
    return Object.freeze({
      signalId,
      status,
      signalEvidenceIds: Object.freeze([...evidenceIds].sort()),
      confirmingReviewIds: Object.freeze(confirming.sort()),
      rejectingReviewIds: Object.freeze(rejecting.sort()),
    });
  });

  const explanation: string[] = [];
  if (observedScore === null) explanation.push("No governed evidence is available for this concept yet; mastery and retention remain unknown.");
  else explanation.push(`Observed performance is ${Math.round(observedScore * 100)}% across ${evidence.length} governed evidence event${evidence.length === 1 ? "" : "s"}.`);
  if (distinctItems === 1) explanation.push("Evidence covers one released item, so confidence remains limited even after repetition.");
  if (conflictScore > 0) explanation.push(`Evidence conflicts: ${positive.length} positive and ${negative.length} negative result${negative.length === 1 ? "" : "s"} are preserved.`);
  if (retentionStatus !== "UNKNOWN") explanation.push(`Retention is a policy estimate (${retentionStatus.toLowerCase()}) based on the latest success ${reinforcementAgeDays} day${reinforcementAgeDays === 1 ? "" : "s"} ago; the latest evidence was ${ageDays} day${ageDays === 1 ? "" : "s"} ago as of ${options.asOf}. It is not an observed fact or an administrative grade decision.`);
  if (lastProbe) explanation.push(`The latest governed retrieval probe was ${lastProbe.result.toLowerCase()} on ${lastProbe.occurredAt}.`);
  for (const signal of misconceptions) {
    const label = GRADE4_MATH_MISCONCEPTION_POLICY.definitions.find((definition) => definition.id === signal.signalId)?.label ?? signal.signalId;
    explanation.push(`Misconception signal "${label}" is ${signal.status.toLowerCase()} under governed review.`);
  }

  return Object.freeze({
    modelVersion: STUDENT_LEARNING_MODEL_VERSION,
    reducerVersion: MASTERY_REDUCER_VERSION,
    scope: Object.freeze({ ...scope }),
    asOf: options.asOf,
    replay: Object.freeze({ eventCount: events.length, inputDigest: digest(events), deterministic: true as const }),
    mastery: Object.freeze({ observedScore, level: masteryLevel(observedScore, confidenceScore), positiveStrength: round(positiveStrength), negativeStrength: round(negativeStrength) }),
    confidence: Object.freeze({ score: confidenceScore, level: confidenceLevel(confidenceScore), distinctItems, independentOccasions, reasons: Object.freeze(reasons) }),
    retention: Object.freeze({
      modelVersion: RETENTION_MODEL_VERSION,
      estimatedRetainedMastery: retained,
      status: retentionStatus,
      halfLifeDays: 30 as const,
      lastReinforcedAt: lastCorrect?.occurredAt ?? null,
      lastProbeAt: lastProbe?.occurredAt ?? null,
      lastProbeResult: lastProbe?.result ?? null,
      assumption: "POLICY_ESTIMATE_NOT_OBSERVED_FORGETTING" as const,
    }),
    recency: Object.freeze({ firstEvidenceAt: evidence[0]?.occurredAt ?? null, lastEvidenceAt: lastEvidence?.occurredAt ?? null, ageDays }),
    conflict: Object.freeze({
      present: positive.length > 0 && negative.length > 0,
      score: conflictScore,
      positiveEvidenceIds: Object.freeze(positive.map((event) => event.evidenceId)),
      negativeEvidenceIds: Object.freeze(negative.map((event) => event.evidenceId)),
    }),
    misconceptions: Object.freeze(misconceptions),
    teacherExplanation: Object.freeze(explanation),
    authority: Object.freeze({
      canonical: true as const,
      replayable: true as const,
      writer: "GOVERNED_MASTERY_WRITER" as const,
      legacyCompatibility: "ONE_WAY_OUTPUT_ONLY" as const,
      mayChangeAdministrativeGrade: false as const,
      clientMayWrite: false as const,
      deviceMayWrite: false as const,
      llmMayWrite: false as const,
    }),
  });
}

export function toDecisionModelLearnerState(state: StudentConceptState): DecisionModelLearnerState {
  return Object.freeze({
    contractVersion: "decision-model-learner-state/1.0.0" as const,
    authoritativeLearnerState: state,
    validCandidateActions: Object.freeze([]) as readonly never[],
    decisionIntelligence: Object.freeze({
      uncertaintyReasons: state.confidence.reasons,
      conflictingEvidence: state.conflict.present,
      retentionStatus: state.retention.status,
      confirmedMisconceptionIds: Object.freeze(state.misconceptions.filter((entry) => entry.status === "CONFIRMED").map((entry) => entry.signalId)),
    }),
    governedPolicyResolution: Object.freeze({
      ontologyReleaseId: state.scope.ontologyReleaseId,
      ontologyReleaseIdentity: state.scope.ontologyReleaseIdentity,
      reducerVersion: MASTERY_REDUCER_VERSION,
      retentionModelVersion: RETENTION_MODEL_VERSION,
      actionPolicyStatus: "NOT_IMPLEMENTED_IN_THIS_MISSION" as const,
      requiresDecisionAuthority: true as const,
    }),
  });
}

export function toLearnerSafeStudentConceptState(state: StudentConceptState): LearnerSafeStudentConceptState {
  return Object.freeze({
    modelVersion: state.modelVersion,
    reducerVersion: state.reducerVersion,
    asOf: state.asOf,
    mastery: state.mastery,
    confidence: state.confidence,
    retention: state.retention,
    recency: state.recency,
    conflict: Object.freeze({ present: state.conflict.present, score: state.conflict.score }),
    authority: Object.freeze({
      canonical: true as const,
      mayChangeAdministrativeGrade: false as const,
      learnerMayWrite: false as const,
    }),
  });
}

export function projectLegacyMasteryRead(state: StudentConceptState): Readonly<{
  levelPercent: number | null;
  source: "CANONICAL_ONE_WAY_PROJECTION";
  writable: false;
}> {
  return Object.freeze({
    levelPercent: state.mastery.observedScore === null ? null : Math.round(state.mastery.observedScore * 100),
    source: "CANONICAL_ONE_WAY_PROJECTION" as const,
    writable: false as const,
  });
}
