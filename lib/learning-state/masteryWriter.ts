import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import {
  CANONICAL_MASTERY_EVENT_SOURCE,
  CANONICAL_MASTERY_EVENT_TYPE,
  MASTERY_REDUCER_VERSION,
  RETENTION_PROBE_MIN_INTERVAL_DAYS,
  createGovernedMisconceptionReview,
  replayStudentConceptState,
  validateCanonicalLearningStateEvent,
  type CanonicalLearningStateEvent,
  type GovernedMasteryEvidence,
  type LearnerStateScope,
  type MasteryUpdate,
} from "@/lib/learning-state/studentLearningModel";
import {
  deterministicReleaseIdentity,
  GRADE4_MATH_ONTOLOGY_RELEASE,
  validateOntologyRelease,
  type EvidenceAdmissionResult,
} from "@/lib/learning-authority/governedGrade4Math";
import {
  GRADE4_MATH_MISCONCEPTION_POLICY,
  MISCONCEPTION_SIGNAL_POLICY_VERSION,
  resolveGovernedMisconceptionSignal,
} from "@/lib/learning-state/misconceptionPolicy";

type AppendGovernedMasteryInput = Readonly<{
  schoolId: string;
  studentId: string;
  studentUserId: string;
  sessionId: string;
  itemId: string;
  itemVersion: string;
  selectedAnswerIndex: number;
  occurredAt: string;
  admission: EvidenceAdmissionResult;
}>;

export type CanonicalMasteryWriteResult = Readonly<{
  duplicate: boolean;
  update: MasteryUpdate;
}>;

export async function readCanonicalStudentConceptState(input: {
  scope: LearnerStateScope;
  asOf: string;
}) {
  const membership = await prisma.student.findFirst({
    where: {
      id: input.scope.studentId,
      userId: input.scope.studentUserId,
      user: { schoolId: input.scope.schoolId },
    },
    select: { id: true },
  });
  if (!membership) throw new Error("canonical_mastery_student_membership_invalid");
  const events = await loadConceptEvents(input.scope, input.asOf);
  return replayStudentConceptState(events, { asOf: input.asOf, expectedScope: input.scope });
}

function canonicalEventId(input: AppendGovernedMasteryInput): string {
  return "mastery-v1-" + createHash("sha256")
    .update([input.schoolId, input.studentId, input.studentUserId, input.sessionId, input.itemId, input.itemVersion].join(":"))
    .digest("hex");
}

export function createGovernedMasteryEvidence(input: AppendGovernedMasteryInput): GovernedMasteryEvidence {
  validateOntologyRelease(GRADE4_MATH_ONTOLOGY_RELEASE);
  if (input.admission.decision !== "ACCEPTED" || !input.admission.bindingId ||
    !input.admission.policyVersion || !input.admission.toolPolicyVersion) {
    throw new Error("canonical_mastery_requires_accepted_evidence");
  }
  const item = GRADE4_MATH_ONTOLOGY_RELEASE.items.find((candidate) => candidate.id === input.itemId);
  const binding = GRADE4_MATH_ONTOLOGY_RELEASE.bindings.find((candidate) => candidate.id === input.admission.bindingId);
  const evidencePolicy = GRADE4_MATH_ONTOLOGY_RELEASE.evidencePolicies.find((candidate) => candidate.id === binding?.evidencePolicyId);
  const toolPolicy = GRADE4_MATH_ONTOLOGY_RELEASE.toolPolicies.find((candidate) => candidate.id === binding?.toolPolicyId);
  if (!item || !binding || binding.itemId !== item.id || binding.itemVersion !== input.itemVersion ||
    item.version !== input.itemVersion || !Number.isInteger(input.selectedAnswerIndex) ||
    input.selectedAnswerIndex < 0 || input.selectedAnswerIndex >= item.options.length ||
    evidencePolicy?.version !== input.admission.policyVersion || toolPolicy?.version !== input.admission.toolPolicyVersion) {
    throw new Error("canonical_mastery_binding_invalid");
  }
  const releaseIdentity = deterministicReleaseIdentity(GRADE4_MATH_ONTOLOGY_RELEASE);
  const evidence: GovernedMasteryEvidence = Object.freeze({
    type: "GOVERNED_EVIDENCE",
    schemaVersion: 1,
    reducerVersion: MASTERY_REDUCER_VERSION,
    evidenceId: canonicalEventId(input),
    scope: Object.freeze({
      schoolId: input.schoolId,
      studentId: input.studentId,
      studentUserId: input.studentUserId,
      conceptId: binding.conceptId,
      ontologyReleaseId: GRADE4_MATH_ONTOLOGY_RELEASE.id,
      ontologyReleaseIdentity: releaseIdentity,
    }),
    bindingId: binding.id,
    itemId: item.id,
    itemVersion: item.version,
    evidencePolicyVersion: input.admission.policyVersion,
    toolPolicyVersion: input.admission.toolPolicyVersion,
    context: item.context,
    result: input.selectedAnswerIndex === item.correctIndex ? "CORRECT" : "INCORRECT",
    selectedAnswerIndex: input.selectedAnswerIndex,
    independenceKey: input.sessionId,
    occurredAt: input.occurredAt,
    serverScored: true,
    admissionDecision: "ACCEPTED",
    authority: "SERVER_GOVERNED_EVIDENCE_GATEWAY",
    retentionProbe: false,
    misconceptionSignalId: resolveGovernedMisconceptionSignal({
      ontologyReleaseId: GRADE4_MATH_ONTOLOGY_RELEASE.id,
      ontologyReleaseIdentity: releaseIdentity,
      bindingId: binding.id,
      itemId: item.id,
      itemVersion: item.version,
      selectedAnswerIndex: input.selectedAnswerIndex,
    }),
    misconceptionPolicyVersion: MISCONCEPTION_SIGNAL_POLICY_VERSION,
  });
  validateCanonicalLearningStateEvent(evidence);
  return evidence;
}

type CanonicalEventRow = {
  id: string;
  eventType: string;
  source: string | null;
  schoolId: string | null;
  studentId: string | null;
  userId: string | null;
  actorId: string | null;
  actorRole: string | null;
  calculationVersion: string | null;
  occurredAt: Date | string;
  metadata: unknown;
};

function parseCanonicalEvent(row: CanonicalEventRow): CanonicalLearningStateEvent {
  if (row.eventType !== CANONICAL_MASTERY_EVENT_TYPE || row.source !== CANONICAL_MASTERY_EVENT_SOURCE ||
    row.calculationVersion !== MASTERY_REDUCER_VERSION) throw new Error("canonical_mastery_event_envelope_invalid");
  const metadata = row.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata) || !("canonicalEvent" in metadata)) {
    throw new Error("canonical_mastery_event_malformed");
  }
  const event = (metadata as { canonicalEvent: CanonicalLearningStateEvent }).canonicalEvent;
  validateCanonicalLearningStateEvent(event);
  const expectedId = event.type === "GOVERNED_EVIDENCE" ? event.evidenceId : event.reviewId;
  const rowOccurredAt = (row.occurredAt instanceof Date ? row.occurredAt : new Date(row.occurredAt)).toISOString();
  if (row.id !== expectedId || row.schoolId !== event.scope.schoolId || row.studentId !== event.scope.studentId ||
    row.userId !== event.scope.studentUserId || rowOccurredAt !== event.occurredAt) {
    throw new Error("canonical_mastery_event_envelope_invalid");
  }
  if (event.type === "GOVERNED_EVIDENCE" &&
    (row.actorId !== "governed-learning-authority" || row.actorRole !== "SYSTEM")) {
    throw new Error("canonical_mastery_event_envelope_invalid");
  }
  if (event.type === "MISCONCEPTION_REVIEW" &&
    (row.actorId !== event.actor.userId || row.actorRole !== event.actor.role)) {
    throw new Error("canonical_mastery_event_envelope_invalid");
  }
  return event;
}

function assertExistingAttempt(existing: {
  id: string;
  eventType: string;
  source: string | null;
  schoolId: string | null;
  studentId: string | null;
  userId: string | null;
  calculationVersion: string | null;
  actorId: string | null;
  actorRole: string | null;
  occurredAt: Date | string;
  metadata: unknown;
}, expected: GovernedMasteryEvidence): GovernedMasteryEvidence {
  if (existing.eventType !== CANONICAL_MASTERY_EVENT_TYPE ||
    existing.source !== CANONICAL_MASTERY_EVENT_SOURCE ||
    existing.schoolId !== expected.scope.schoolId ||
    existing.studentId !== expected.scope.studentId ||
    existing.userId !== expected.scope.studentUserId ||
    existing.calculationVersion !== MASTERY_REDUCER_VERSION) {
    throw new Error("canonical_mastery_event_id_collision");
  }
  const event = parseCanonicalEvent(existing);
  if (event.type !== "GOVERNED_EVIDENCE" || event.evidenceId !== expected.evidenceId ||
    event.independenceKey !== expected.independenceKey || event.bindingId !== expected.bindingId ||
    event.itemId !== expected.itemId || event.itemVersion !== expected.itemVersion) {
    throw new Error("canonical_mastery_event_id_collision");
  }
  return event;
}

async function loadConceptEvents(scope: LearnerStateScope, asOf: string): Promise<CanonicalLearningStateEvent[]> {
  const rows = await prisma.learningEvent.findMany({
    where: {
      eventType: CANONICAL_MASTERY_EVENT_TYPE,
      source: CANONICAL_MASTERY_EVENT_SOURCE,
      schoolId: scope.schoolId,
      studentId: scope.studentId,
      userId: scope.studentUserId,
      occurredAt: { lte: new Date(asOf) },
    },
    orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
    select: {
      id: true, eventType: true, source: true, schoolId: true, studentId: true, userId: true,
      actorId: true, actorRole: true, calculationVersion: true, occurredAt: true, metadata: true,
    },
  });
  return rows.map(parseCanonicalEvent).filter((event) =>
    event.scope.conceptId === scope.conceptId &&
    event.scope.ontologyReleaseIdentity === scope.ontologyReleaseIdentity
  );
}

export async function appendCanonicalMasteryUpdate(input: AppendGovernedMasteryInput): Promise<CanonicalMasteryWriteResult> {
  const membership = await prisma.student.findFirst({
    where: { id: input.studentId, userId: input.studentUserId, user: { schoolId: input.schoolId } },
    select: { id: true },
  });
  if (!membership) throw new Error("canonical_mastery_student_membership_invalid");
  let evidence = createGovernedMasteryEvidence(input);
  const prior = await loadConceptEvents(evidence.scope, input.occurredAt);
  const priorSuccess = [...prior].reverse().find((event): event is GovernedMasteryEvidence =>
    event.type === "GOVERNED_EVIDENCE" && event.evidenceId !== evidence.evidenceId && event.result === "CORRECT"
  );
  const eligibleProbe = priorSuccess !== undefined &&
    Date.parse(evidence.occurredAt) - Date.parse(priorSuccess.occurredAt) >= RETENTION_PROBE_MIN_INTERVAL_DAYS * 86_400_000;
  evidence = Object.freeze({ ...evidence, retentionProbe: eligibleProbe });
  validateCanonicalLearningStateEvent(evidence);
  let duplicate = false;
  let persistedEvidence = evidence;
  try {
    await prisma.learningEvent.create({
      data: {
        id: evidence.evidenceId,
        schoolId: evidence.scope.schoolId,
        userId: evidence.scope.studentUserId,
        studentId: evidence.scope.studentId,
        actorType: "system",
        actorId: "governed-learning-authority",
        actorRole: "SYSTEM",
        targetType: "student_concept_state",
        targetId: `${evidence.scope.studentId}:${evidence.scope.conceptId}`,
        eventType: CANONICAL_MASTERY_EVENT_TYPE,
        source: CANONICAL_MASTERY_EVENT_SOURCE,
        status: "accepted",
        occurredAt: new Date(evidence.occurredAt),
        dedupeKey: evidence.independenceKey,
        subject: "MATH",
        grade: 4,
        curriculumVersion: GRADE4_MATH_ONTOLOGY_RELEASE.version,
        assessmentVersion: evidence.itemVersion,
        calculationVersion: MASTERY_REDUCER_VERSION,
        metadata: { canonicalEvent: evidence },
      },
    });
  } catch (error: unknown) {
    if (!(typeof error === "object" && error !== null && "code" in error && error.code === "P2002")) throw error;
    const existing = await prisma.learningEvent.findUnique({
      where: { id: evidence.evidenceId },
      select: {
        id: true, eventType: true, source: true, schoolId: true, studentId: true,
        userId: true, actorId: true, actorRole: true, calculationVersion: true, occurredAt: true, metadata: true,
      },
    });
    if (!existing) throw new Error("canonical_mastery_duplicate_missing");
    persistedEvidence = assertExistingAttempt(existing, evidence);
    duplicate = true;
  }

  const events = await loadConceptEvents(evidence.scope, input.occurredAt);
  const state = replayStudentConceptState(events, { asOf: input.occurredAt, expectedScope: evidence.scope });
  return Object.freeze({ duplicate, update: Object.freeze({ event: persistedEvidence, state }) });
}

export async function appendGovernedMisconceptionReview(input: {
  scope: LearnerStateScope;
  signalId: string;
  decision: "CONFIRMED" | "REJECTED";
  evidenceIds: readonly string[];
  actorUserId: string;
  occurredAt: string;
}): Promise<CanonicalMasteryWriteResult> {
  if (!GRADE4_MATH_MISCONCEPTION_POLICY.definitions.some((signal) => signal.id === input.signalId)) {
    throw new Error("misconception_signal_not_governed");
  }
  const actor = await prisma.user.findFirst({
    where: { id: input.actorUserId, schoolId: input.scope.schoolId, role: { in: ["TEACHER", "ADMIN"] } },
    select: { id: true, role: true },
  });
  if (!actor || (actor.role !== "TEACHER" && actor.role !== "ADMIN")) {
    throw new Error("misconception_review_actor_unauthorized");
  }
  const prior = await loadConceptEvents(input.scope, input.occurredAt);
  replayStudentConceptState(prior, { asOf: input.occurredAt, expectedScope: input.scope });
  const referenced = prior.filter((event): event is GovernedMasteryEvidence =>
    event.type === "GOVERNED_EVIDENCE" && input.evidenceIds.includes(event.evidenceId)
  );
  if (referenced.length !== new Set(input.evidenceIds).size ||
    referenced.some((event) => event.misconceptionSignalId !== input.signalId)) {
    throw new Error("misconception_review_evidence_invalid");
  }
  const reviewId = "misconception-review-v1-" + createHash("sha256")
    .update([
      input.scope.schoolId, input.scope.studentId, input.scope.conceptId, input.signalId,
      input.decision, [...input.evidenceIds].sort().join(","), actor.id,
    ].join(":"))
    .digest("hex");
  const review = createGovernedMisconceptionReview({
    reviewId,
    scope: input.scope,
    signalId: input.signalId,
    decision: input.decision,
    evidenceIds: [...new Set(input.evidenceIds)].sort(),
    actor: { userId: actor.id, role: actor.role },
    occurredAt: input.occurredAt,
  });
  let duplicate = false;
  let persistedReview = review;
  try {
    await prisma.learningEvent.create({
      data: {
        id: review.reviewId,
        schoolId: review.scope.schoolId,
        userId: review.scope.studentUserId,
        studentId: review.scope.studentId,
        actorType: "user",
        actorId: review.actor.userId,
        actorRole: review.actor.role,
        targetType: "student_concept_misconception",
        targetId: `${review.scope.studentId}:${review.signalId}`,
        eventType: CANONICAL_MASTERY_EVENT_TYPE,
        source: CANONICAL_MASTERY_EVENT_SOURCE,
        status: review.decision.toLowerCase(),
        occurredAt: new Date(review.occurredAt),
        dedupeKey: review.reviewId,
        subject: "MATH",
        grade: 4,
        curriculumVersion: GRADE4_MATH_ONTOLOGY_RELEASE.version,
        calculationVersion: MASTERY_REDUCER_VERSION,
        metadata: { canonicalEvent: review },
      },
    });
  } catch (error: unknown) {
    if (!(typeof error === "object" && error !== null && "code" in error && error.code === "P2002")) throw error;
    const existing = await prisma.learningEvent.findUnique({
      where: { id: review.reviewId },
      select: {
        id: true, eventType: true, source: true, schoolId: true, studentId: true, userId: true,
        actorId: true, actorRole: true, calculationVersion: true, occurredAt: true, metadata: true,
      },
    });
    const stored = existing ? parseCanonicalEvent(existing) : null;
    if (!stored || stored.type !== "MISCONCEPTION_REVIEW" ||
      stored.reviewId !== review.reviewId || stored.signalId !== review.signalId || stored.decision !== review.decision ||
      stored.actor.userId !== review.actor.userId || stored.actor.role !== review.actor.role ||
      stored.policyVersion !== review.policyVersion ||
      JSON.stringify([...stored.evidenceIds].sort()) !== JSON.stringify([...review.evidenceIds].sort()) ||
      stored.scope.schoolId !== review.scope.schoolId || stored.scope.studentId !== review.scope.studentId ||
      stored.scope.studentUserId !== review.scope.studentUserId || stored.scope.conceptId !== review.scope.conceptId ||
      stored.scope.ontologyReleaseId !== review.scope.ontologyReleaseId ||
      stored.scope.ontologyReleaseIdentity !== review.scope.ontologyReleaseIdentity) {
      throw new Error("canonical_mastery_event_id_collision");
    }
    persistedReview = stored;
    duplicate = true;
  }
  const events = await loadConceptEvents(input.scope, input.occurredAt);
  const state = replayStudentConceptState(events, { asOf: input.occurredAt, expectedScope: input.scope });
  return Object.freeze({ duplicate, update: Object.freeze({ event: persistedReview, state }) });
}
