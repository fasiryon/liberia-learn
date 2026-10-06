import { createHash } from "crypto";
import { Prisma, type GovernedLearningEvidence, type StudentConceptState } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  admitEvidence,
  deterministicReleaseIdentity,
  GRADE4_MATH_ONTOLOGY_RELEASE,
  type DiagnosticKind,
  type EvidenceAdmissionContext,
  type RawLearningObservation,
} from "@/lib/learning-authority/governedGrade4Math";

export const STUDENT_CONCEPT_REDUCER_VERSION = "g4-fractions-concept-state-v1";
const WILSON_Z = 1.96;
const MAX_TRANSACTION_ATTEMPTS = 3;
const TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 10_000,
  timeout: 30_000,
} as const;

export class StudentConceptStateError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "StudentConceptStateError";
  }
}

export type ReducerEvidence = Readonly<{
  id: string;
  bindingId: string;
  context: string;
  correct: boolean;
  diagnosticKind: string | null;
  ledgerSequence: number;
  observedAt: Date;
}>;

export type ReducedConceptState = Readonly<{
  masteryEstimate: number;
  confidence: number;
  uncertainty: number;
  evidenceCount: number;
  firstObservedAt: Date;
  lastObservedAt: Date;
  lastPracticedAt: Date | null;
  evidenceState: "INSUFFICIENT" | "ADEQUATE";
  reasonCodes: string[];
  throughEvidenceSequence: number;
  stateHash: string;
}>;

type ApplyEvidenceInput = Readonly<{
  observation: RawLearningObservation;
  admissionContext: EvidenceAdmissionContext;
  answerIndex: number;
  diagnosticKind?: DiagnosticKind | null;
  observedAt?: Date;
}>;

type ApplyEvidenceResult = Readonly<{
  duplicate: boolean;
  evidenceId: string;
  state: StudentConceptState;
}>;

function rounded(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalFingerprint(input: ApplyEvidenceInput, correct: boolean) {
  return sha256(JSON.stringify({
    actorUserId: input.observation.authenticatedUserId,
    answerIndex: input.answerIndex,
    conceptSource: input.observation.source,
    context: input.observation.context,
    correct,
    diagnosticKind: input.diagnosticKind ?? null,
    hintsUsed: input.observation.hintsUsed,
    itemId: input.observation.itemId,
    itemVersion: input.observation.itemVersion,
    learnerUserId: input.observation.studentUserId,
    ontologyReleaseIdentity: deterministicReleaseIdentity(GRADE4_MATH_ONTOLOGY_RELEASE),
    schoolId: input.observation.schoolId,
    studentId: input.observation.studentId,
    toolsUsed: [...input.observation.toolsUsed].sort(),
  }));
}

function stateHash(input: Omit<ReducedConceptState, "stateHash">) {
  return sha256(JSON.stringify({
    algorithmVersion: STUDENT_CONCEPT_REDUCER_VERSION,
    confidence: input.confidence,
    evidenceCount: input.evidenceCount,
    evidenceState: input.evidenceState,
    firstObservedAt: input.firstObservedAt.toISOString(),
    lastObservedAt: input.lastObservedAt.toISOString(),
    lastPracticedAt: input.lastPracticedAt?.toISOString() ?? null,
    masteryEstimate: input.masteryEstimate,
    reasonCodes: input.reasonCodes,
    throughEvidenceSequence: input.throughEvidenceSequence,
    uncertainty: input.uncertainty,
  }));
}

/**
 * Deterministic V1 reducer. The Wilson midpoint is a deliberately conservative
 * item-response estimate, not a claim of proficiency. Confidence describes
 * interval precision; uncertainty is the interval width. Current release
 * structure cannot establish mastery because each concept has one binding.
 */
export function reduceConceptEvidence(
  evidence: readonly ReducerEvidence[],
  algorithmVersion = STUDENT_CONCEPT_REDUCER_VERSION,
): ReducedConceptState {
  if (algorithmVersion !== STUDENT_CONCEPT_REDUCER_VERSION) {
    throw new StudentConceptStateError("student_concept_algorithm_version_unsupported", 409);
  }
  if (evidence.length === 0) {
    throw new StudentConceptStateError("accepted_evidence_required");
  }
  const ordered = [...evidence].sort((left, right) =>
    left.observedAt.getTime() - right.observedAt.getTime() ||
    left.id.localeCompare(right.id)
  );
  if (ordered.some((entry, index) =>
    !entry.id || !entry.bindingId || !Number.isInteger(entry.ledgerSequence) ||
    entry.ledgerSequence <= 0 || (index > 0 && entry.id === ordered[index - 1].id)
  )) {
    throw new StudentConceptStateError("accepted_evidence_invalid");
  }

  const count = ordered.length;
  const correctCount = ordered.filter((entry) => entry.correct).length;
  const observedAccuracy = correctCount / count;
  const zSquared = WILSON_Z * WILSON_Z;
  const denominator = 1 + zSquared / count;
  const center = (observedAccuracy + zSquared / (2 * count)) / denominator;
  const halfWidth = WILSON_Z * Math.sqrt(
    (observedAccuracy * (1 - observedAccuracy)) / count + zSquared / (4 * count * count)
  ) / denominator;
  const lower = Math.max(0, center - halfWidth);
  const upper = Math.min(1, center + halfWidth);
  const uncertainty = rounded(upper - lower);
  const firstObservedAt = ordered[0].observedAt;
  const lastObservedAt = ordered[ordered.length - 1].observedAt;
  const lastPractice = [...ordered].reverse().find((entry) => entry.context === "PRACTICE");
  const distinctBindings = new Set(ordered.map((entry) => entry.bindingId)).size;
  const distinctSessions = new Set(ordered.map((entry) => entry.diagnosticKind ? entry.id : entry.id)).size;
  const spaced = lastObservedAt.getTime() - firstObservedAt.getTime() >= 24 * 60 * 60 * 1000;
  const reasonCodes = [
    ...(count < 3 ? ["TOO_FEW_ACCEPTED_OBSERVATIONS"] : []),
    ...(distinctSessions < 3 ? ["TOO_FEW_INDEPENDENT_SESSIONS"] : []),
    ...(distinctBindings < 2 ? ["SINGLE_BINDING"] : []),
    ...(!spaced ? ["NOT_SPACED_24_HOURS"] : []),
    ...(correctCount > 0 && correctCount < count ? ["CONFLICTING_EVIDENCE"] : []),
    "NO_GOVERNED_CUMULATIVE_ITEM",
  ];
  const evidenceState = count >= 3 && distinctSessions >= 3 && distinctBindings >= 2 && spaced
    ? "ADEQUATE"
    : "INSUFFICIENT";
  const withoutHash = {
    masteryEstimate: rounded(center),
    confidence: rounded(1 - uncertainty),
    uncertainty,
    evidenceCount: count,
    firstObservedAt,
    lastObservedAt,
    lastPracticedAt: lastPractice?.observedAt ?? null,
    evidenceState,
    reasonCodes,
    throughEvidenceSequence: Math.max(...ordered.map((entry) => entry.ledgerSequence)),
  } as const;
  return { ...withoutHash, stateHash: stateHash(withoutHash) };
}

function isRetryable(error: unknown) {
  return error instanceof StudentConceptStateError && error.message === "student_concept_state_revision_conflict" ||
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

function isUniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function applyInTransaction(tx: Prisma.TransactionClient, input: ApplyEvidenceInput): Promise<ApplyEvidenceResult> {
  const release = GRADE4_MATH_ONTOLOGY_RELEASE;
  const releaseIdentity = deterministicReleaseIdentity(release);
  const item = release.items.find((candidate) => candidate.id === input.observation.itemId);
  if (!item || item.version !== input.observation.itemVersion || !Number.isInteger(input.answerIndex) ||
    input.answerIndex < 0 || input.answerIndex >= item.options.length) {
    throw new StudentConceptStateError("governed_item_or_answer_invalid");
  }
  const admission = admitEvidence(input.observation, input.admissionContext, release);
  if (admission.decision !== "ACCEPTED" || !admission.bindingId || !admission.policyVersion || !admission.toolPolicyVersion) {
    throw new StudentConceptStateError(
      admission.decision === "PROVISIONAL" ? "provisional_evidence_cannot_update_concept_state" : admission.reason,
      admission.decision === "REJECTED" ? 403 : 409,
    );
  }
  const binding = release.bindings.find((candidate) => candidate.id === admission.bindingId);
  const concept = release.concepts.find((candidate) => candidate.id === binding?.conceptId);
  const evidencePolicy = release.evidencePolicies.find((candidate) => candidate.id === binding?.evidencePolicyId);
  const toolPolicy = release.toolPolicies.find((candidate) => candidate.id === binding?.toolPolicyId);
  if (!binding || !concept || !evidencePolicy || !toolPolicy) {
    throw new StudentConceptStateError("governed_release_binding_invalid", 409);
  }
  if (input.diagnosticKind && item.context !== "DIAGNOSTIC") {
    throw new StudentConceptStateError("diagnostic_kind_context_mismatch");
  }

  const partition = [
    input.observation.schoolId,
    input.observation.studentId,
    releaseIdentity,
    concept.id,
    concept.revision,
  ].join(":");
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${partition}, 0))`;

  const currentLearner = await tx.student.findFirst({
    where: {
      id: input.observation.studentId,
      userId: input.observation.studentUserId,
      deletedAt: null,
      user: { id: input.observation.studentUserId, schoolId: input.observation.schoolId },
      OR: [
        { academicEnrollments: { some: { schoolId: input.observation.schoolId, status: "ACTIVE" } } },
        { enrollments: { some: { Class: { schoolId: input.observation.schoolId } } } },
      ],
    },
    select: { id: true, userId: true },
  });
  if (!currentLearner || currentLearner.userId !== input.observation.studentUserId) {
    throw new StudentConceptStateError("current_tenant_enrollment_required", 403);
  }

  const fingerprint = canonicalFingerprint(input, input.answerIndex === item.correctIndex);
  const existingEvidence = await tx.governedLearningEvidence.findUnique({
    where: {
      GovernedEvidence_school_student_idempotency_key: {
        schoolId: input.observation.schoolId,
        studentId: input.observation.studentId,
        idempotencyKey: input.observation.idempotencyKey,
      },
    },
  });
  if (existingEvidence) {
    if (existingEvidence.observationFingerprint !== fingerprint) {
      throw new StudentConceptStateError("idempotency_key_payload_mismatch", 409);
    }
    const state = await tx.studentConceptState.findUnique({
      where: {
        StudentConceptState_partition_key: {
          schoolId: existingEvidence.schoolId,
          studentId: existingEvidence.studentId,
          ontologyReleaseIdentity: existingEvidence.ontologyReleaseIdentity,
          conceptId: existingEvidence.conceptId,
          conceptRevision: existingEvidence.conceptRevision,
        },
      },
    });
    if (!state) throw new StudentConceptStateError("accepted_evidence_state_missing", 500);
    return { duplicate: true, evidenceId: existingEvidence.id, state };
  }

  const existingRows = await tx.governedLearningEvidence.findMany({
    where: {
      schoolId: input.observation.schoolId,
      studentId: input.observation.studentId,
      ontologyReleaseIdentity: releaseIdentity,
      conceptId: concept.id,
      conceptRevision: concept.revision,
    },
    orderBy: [{ ledgerSequence: "asc" }, { id: "asc" }],
  });
  const ledgerSequence = (existingRows.at(-1)?.ledgerSequence ?? 0) + 1;
  const evidenceId = "gle-" + sha256([
    input.observation.schoolId,
    input.observation.studentId,
    input.observation.idempotencyKey,
  ].join(":"));
  const observedAt = input.observedAt ?? new Date();
  const evidence = await tx.governedLearningEvidence.create({
    data: {
      id: evidenceId,
      schoolId: input.observation.schoolId,
      studentId: input.observation.studentId,
      learnerUserId: input.observation.studentUserId,
      actorUserId: input.observation.authenticatedUserId,
      actorRole: "STUDENT",
      ontologyReleaseId: release.id,
      ontologyReleaseIdentity: releaseIdentity,
      conceptId: concept.id,
      conceptRevision: concept.revision,
      bindingId: binding.id,
      itemId: item.id,
      itemVersion: item.version,
      evidencePolicyId: evidencePolicy.id,
      evidencePolicyVersion: evidencePolicy.version,
      toolPolicyId: toolPolicy.id,
      toolPolicyVersion: toolPolicy.version,
      context: item.context,
      source: input.observation.source,
      diagnosticKind: input.diagnosticKind ?? null,
      correct: input.answerIndex === item.correctIndex,
      idempotencyKey: input.observation.idempotencyKey,
      observationFingerprint: fingerprint,
      ledgerSequence,
      observedAt,
    },
  });
  const reduced = reduceConceptEvidence([...existingRows, evidence]);
  const stateId = "scs-" + sha256(partition);
  const currentState = await tx.studentConceptState.findUnique({ where: { id: stateId } });
  const priorRevision = currentState?.stateRevision ?? 0;
  const stateData = {
    schoolId: input.observation.schoolId,
    studentId: input.observation.studentId,
    ontologyReleaseId: release.id,
    ontologyReleaseIdentity: releaseIdentity,
    conceptId: concept.id,
    conceptRevision: concept.revision,
    masteryEstimate: reduced.masteryEstimate,
    confidence: reduced.confidence,
    uncertainty: reduced.uncertainty,
    evidenceCount: reduced.evidenceCount,
    firstObservedAt: reduced.firstObservedAt,
    lastObservedAt: reduced.lastObservedAt,
    lastPracticedAt: reduced.lastPracticedAt,
    stateRevision: priorRevision + 1,
    algorithmVersion: STUDENT_CONCEPT_REDUCER_VERSION,
    evidenceState: reduced.evidenceState,
    reasonCodes: reduced.reasonCodes,
    throughEvidenceSequence: reduced.throughEvidenceSequence,
    stateHash: reduced.stateHash,
  };
  let state: StudentConceptState;
  if (currentState) {
    const changed = await tx.studentConceptState.updateMany({
      where: { id: stateId, stateRevision: priorRevision },
      data: stateData,
    });
    if (changed.count !== 1) {
      throw new StudentConceptStateError("student_concept_state_revision_conflict", 409);
    }
    state = await tx.studentConceptState.findUniqueOrThrow({ where: { id: stateId } });
  } else {
    state = await tx.studentConceptState.create({ data: { id: stateId, ...stateData } });
  }

  const reason = [
    `Accepted ${item.context.toLowerCase()} evidence ${evidence.id} was server-scored as ${evidence.correct ? "correct" : "incorrect"}.`,
    `The bounded estimate moved from ${currentState?.masteryEstimate ?? "none"} to ${state.masteryEstimate}.`,
    `Confidence moved from ${currentState?.confidence ?? "none"} to ${state.confidence}; state remains ${state.evidenceState.toLowerCase()}.`,
  ].join(" ");
  await tx.masteryUpdate.create({
    data: {
      id: "mu-" + sha256(evidence.id),
      stateId,
      schoolId: state.schoolId,
      studentId: state.studentId,
      acceptedEvidenceId: evidence.id,
      ontologyReleaseId: state.ontologyReleaseId,
      ontologyReleaseIdentity: state.ontologyReleaseIdentity,
      conceptId: state.conceptId,
      conceptRevision: state.conceptRevision,
      priorRevision,
      newRevision: state.stateRevision,
      algorithmVersion: STUDENT_CONCEPT_REDUCER_VERSION,
      policyVersion: admission.policyVersion,
      priorEstimate: currentState?.masteryEstimate ?? null,
      newEstimate: state.masteryEstimate,
      priorConfidence: currentState?.confidence ?? null,
      newConfidence: state.confidence,
      priorUncertainty: currentState?.uncertainty ?? null,
      newUncertainty: state.uncertainty,
      reason,
      reasonCodes: reduced.reasonCodes,
      stateHash: reduced.stateHash,
    },
  });
  await tx.learningEvent.create({
    data: {
      id: evidence.id + "-audit",
      schoolId: state.schoolId,
      userId: input.observation.studentUserId,
      studentId: state.studentId,
      actorType: "user",
      actorId: input.observation.authenticatedUserId,
      actorRole: "STUDENT",
      targetType: "student_concept_state",
      targetId: state.id,
      eventType: "learning.concept_state.updated",
      source: "studentConceptState.applyAcceptedEvidence",
      status: "accepted_evidence_applied",
      dedupeKey: input.observation.idempotencyKey,
      calculationVersion: STUDENT_CONCEPT_REDUCER_VERSION,
      metadata: {
        acceptedEvidenceId: evidence.id,
        evidenceDecision: admission.decision,
        learningEventIsCanonicalEvidence: false,
        newRevision: state.stateRevision,
        ontologyReleaseIdentity: releaseIdentity,
        stateHash: state.stateHash,
      },
    },
  });
  return { duplicate: false, evidenceId: evidence.id, state };
}

/** The only application writer for StudentConceptState and MasteryUpdate. */
export async function applyAcceptedGrade4MathEvidence(input: ApplyEvidenceInput): Promise<ApplyEvidenceResult> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction((tx) => applyInTransaction(tx, input), TRANSACTION_OPTIONS);
    } catch (error) {
      lastError = error;
      if (isUniqueConflict(error)) {
        continue;
      }
      if (!isRetryable(error) || attempt === MAX_TRANSACTION_ATTEMPTS) throw error;
    }
  }
  throw lastError;
}

export function projectConceptStateForLegacyReader(state: StudentConceptState) {
  return Object.freeze({
    source: "StudentConceptState" as const,
    subject: "MATH" as const,
    strandKey: state.conceptId,
    currentScore: state.masteryEstimate,
    baselineConfidence: state.confidence,
    masteryState: "NOT_ESTABLISHED" as const,
    proficiencyState: "NOT_ESTABLISHED" as const,
    readOnly: true as const,
  });
}

export function verifyConceptStateReplay(input: {
  evidence: readonly ReducerEvidence[];
  persisted: Pick<StudentConceptState, "algorithmVersion" | "stateHash">;
}) {
  const replayed = reduceConceptEvidence(input.evidence, input.persisted.algorithmVersion);
  return Object.freeze({
    matches: replayed.stateHash === input.persisted.stateHash,
    expectedStateHash: replayed.stateHash,
    persistedStateHash: input.persisted.stateHash,
    repaired: false as const,
    replayed,
  });
}
