import {
  deterministicReleaseIdentity,
  type CurriculumOntologyRelease,
} from "@/lib/learning-authority/governedGrade4Math";
import {
  MISCONCEPTION_SIGNAL_POLICY_VERSION,
  resolveGovernedMisconceptionSignal,
} from "@/lib/learning-state/misconceptionPolicy";
import {
  MASTERY_REDUCER_VERSION,
  type GovernedMasteryEvidence,
} from "@/lib/learning-state/studentLearningModel";

/** The provider-neutral append-only contract emitted by every learning modality. */
export const GOVERNED_EVIDENCE_CONTRACT_VERSION = "governed-learning-evidence/1.0.0" as const;

export type GovernedEvidenceType =
  | "LESSON_COMPLETION" | "CLASSWORK" | "HOMEWORK" | "PRACTICE" | "QUIZ"
  | "DIAGNOSTIC" | "EXAM_TEST" | "PROJECT" | "PRACTICAL" | "LAB"
  | "SIMULATION";

export type EvidenceModality =
  | "TEXT" | "AUDIO" | "VIDEO" | "INTERACTIVE" | "LAB_RUNTIME"
  | "OFFLINE_PACKET" | "TEACHER_RECORDED";

export type EvidenceOutcome = "COMPLETED" | "PARTIAL" | "FAILED" | "CORRECT" | "INCORRECT" | "OBSERVED";

export type EvidenceSignal = Readonly<{
  code: string;
  value: "PRESENT" | "ABSENT" | "CORRECTED" | "UNRESOLVED";
  detail?: string;
}>;

export type EvidencePerformance = Readonly<{
  outcome: EvidenceOutcome;
  score: number | null;
  maxScore: number | null;
  correct: boolean | null;
  selectedAnswerIndex?: number;
  signals: readonly EvidenceSignal[];
  payload?: Readonly<Record<string, unknown>>;
}>;

export type EvidenceProvenance = Readonly<{
  source: "ONLINE" | "OFFLINE" | "TEACHER" | "SYSTEM";
  actorId: string | null;
  actorRole: "STUDENT" | "TEACHER" | "ADMIN" | "SYSTEM";
  runtime: "WEB" | "MOBILE" | "LAB" | "IMPORT" | "SYNC";
  recordedAt: string;
  clientEventId: string | null;
  syncBatchId: string | null;
}>;

/** Metadata is descriptive input to governed policy; it is not a weighting formula. */
export type EvidenceStrengthMetadata = Readonly<{
  serverScored: boolean;
  humanVerified: boolean;
  assistanceUsed: boolean;
  retryCount: number;
  hintCount: number;
  independenceKey: string;
  directness: "DIRECT" | "INDIRECT" | "INFERRED";
  reliability: "UNASSESSED" | "REVIEWED" | "VERIFIED";
  policyRef: string;
}>;

export type GovernedEvidence = Readonly<{
  contractVersion: typeof GOVERNED_EVIDENCE_CONTRACT_VERSION;
  evidenceId: string;
  idempotencyKey: string;
  attemptId: string;
  tenantId: string;
  schoolId: string;
  learner: Readonly<{ studentId: string; studentUserId: string }>;
  objective: Readonly<{ conceptId: string; objectiveId: string }>;
  activity: Readonly<{ activityId: string; activityVersion: string }>;
  evidenceType: GovernedEvidenceType;
  modality: EvidenceModality;
  occurredAt: string;
  performance: EvidencePerformance;
  provenance: EvidenceProvenance;
  strength: EvidenceStrengthMetadata;
  offline: Readonly<{ isOffline: boolean; syncIdentity: string | null }>;
  curriculum: Readonly<{ ontologyReleaseId: string; ontologyReleaseIdentity: string }>;
  canonicalMasteryMutation: false;
}>;

const evidenceTypes = new Set<GovernedEvidenceType>([
  "LESSON_COMPLETION", "CLASSWORK", "HOMEWORK", "PRACTICE", "QUIZ", "DIAGNOSTIC",
  "EXAM_TEST", "PROJECT", "PRACTICAL", "LAB", "SIMULATION",
]);

function required(value: unknown, name: string): asserts value is string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`evidence_${name}_required`);
}

function iso(value: string, name: string): void {
  if (!Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
    throw new Error(`evidence_${name}_timestamp_invalid`);
  }
}

export function validateGovernedEvidence(evidence: GovernedEvidence): void {
  if (evidence.contractVersion !== GOVERNED_EVIDENCE_CONTRACT_VERSION) throw new Error("evidence_contract_version_unsupported");
  for (const [value, name] of [
    [evidence.evidenceId, "id"], [evidence.idempotencyKey, "idempotency"], [evidence.attemptId, "attempt"],
    [evidence.tenantId, "tenant"], [evidence.schoolId, "school"], [evidence.learner.studentId, "student"],
    [evidence.learner.studentUserId, "student_user"], [evidence.objective.conceptId, "concept"],
    [evidence.objective.objectiveId, "objective"], [evidence.activity.activityId, "activity"],
    [evidence.activity.activityVersion, "activity_version"], [evidence.strength.independenceKey, "independence"],
    [evidence.strength.policyRef, "policy_ref"],
  ] as const) required(value, name);
  if (!evidenceTypes.has(evidence.evidenceType)) throw new Error("evidence_type_invalid");
  if (evidence.canonicalMasteryMutation !== false) throw new Error("evidence_canonical_mutation_forbidden");
  if (evidence.offline.isOffline && !evidence.offline.syncIdentity) throw new Error("offline_sync_identity_required");
  if (!Number.isInteger(evidence.strength.retryCount) || evidence.strength.retryCount < 0) throw new Error("evidence_retry_count_invalid");
  if (!Number.isInteger(evidence.strength.hintCount) || evidence.strength.hintCount < 0) throw new Error("evidence_hint_count_invalid");
  if (evidence.performance.score !== null && (!Number.isFinite(evidence.performance.score) || evidence.performance.score < 0)) throw new Error("evidence_score_invalid");
  if (evidence.performance.maxScore !== null && (!Number.isFinite(evidence.performance.maxScore) || evidence.performance.maxScore <= 0)) throw new Error("evidence_max_score_invalid");
  if (evidence.performance.selectedAnswerIndex !== undefined && (!Number.isInteger(evidence.performance.selectedAnswerIndex) || evidence.performance.selectedAnswerIndex < 0)) throw new Error("evidence_answer_invalid");
  iso(evidence.occurredAt, "occurred");
  iso(evidence.provenance.recordedAt, "recorded");
}

export function createGovernedEvidence(input: Omit<GovernedEvidence, "contractVersion" | "canonicalMasteryMutation">): GovernedEvidence {
  const evidence = Object.freeze({
    ...input,
    contractVersion: GOVERNED_EVIDENCE_CONTRACT_VERSION,
    canonicalMasteryMutation: false as const,
    learner: Object.freeze({ ...input.learner }),
    objective: Object.freeze({ ...input.objective }),
    activity: Object.freeze({ ...input.activity }),
    performance: Object.freeze({ ...input.performance, signals: Object.freeze([...input.performance.signals]) }),
    provenance: Object.freeze({ ...input.provenance }),
    strength: Object.freeze({ ...input.strength }),
    offline: Object.freeze({ ...input.offline }),
    curriculum: Object.freeze({ ...input.curriculum }),
  }) as GovernedEvidence;
  validateGovernedEvidence(evidence);
  return evidence;
}

/** Boundary helper for batch/sync ingestion: duplicate identities are replay-safe only when their payloads agree. */
export function deduplicateGovernedEvidence(events: readonly GovernedEvidence[]): readonly GovernedEvidence[] {
  const byIdempotency = new Map<string, GovernedEvidence>();
  for (const event of events) {
    validateGovernedEvidence(event);
    const prior = byIdempotency.get(event.idempotencyKey);
    if (prior && JSON.stringify(prior) !== JSON.stringify(event)) throw new Error("evidence_idempotency_conflict");
    byIdempotency.set(event.idempotencyKey, event);
  }
  return Object.freeze([...byIdempotency.values()]);
}

/**
 * Adapter for the currently supported scored-item path. Other evidence types
 * remain governed evidence until a released policy supplies a mastery adapter.
 * This keeps labs and interactive runtimes from gaining a special-case writer.
 */
export function toCanonicalMasteryEvidence(
  evidence: GovernedEvidence,
  release: CurriculumOntologyRelease,
): GovernedMasteryEvidence {
  validateGovernedEvidence(evidence);
  if (!["PRACTICE", "QUIZ", "DIAGNOSTIC"].includes(evidence.evidenceType) || evidence.performance.selectedAnswerIndex === undefined || evidence.performance.correct === null || !evidence.strength.serverScored) {
    throw new Error("evidence_mastery_adapter_not_available");
  }
  const identity = deterministicReleaseIdentity(release);
  if (evidence.curriculum.ontologyReleaseId !== release.id || evidence.curriculum.ontologyReleaseIdentity !== identity) throw new Error("evidence_release_invalid");
  const binding = release.bindings.find((candidate) => candidate.itemId === evidence.activity.activityId && candidate.itemVersion === evidence.activity.activityVersion && candidate.conceptId === evidence.objective.conceptId);
  const item = release.items.find((candidate) => candidate.id === evidence.activity.activityId && candidate.version === evidence.activity.activityVersion);
  const policy = binding && release.evidencePolicies.find((candidate) => candidate.id === binding.evidencePolicyId);
  const toolPolicy = binding && release.toolPolicies.find((candidate) => candidate.id === binding.toolPolicyId);
  if (!binding || !item || !policy || !toolPolicy || item.context !== (evidence.evidenceType === "DIAGNOSTIC" ? "DIAGNOSTIC" : "PRACTICE") || evidence.performance.selectedAnswerIndex >= item.options.length) throw new Error("evidence_mastery_binding_invalid");
  const result = evidence.performance.selectedAnswerIndex === item.correctIndex ? "CORRECT" : "INCORRECT";
  if ((evidence.performance.correct ? "CORRECT" : "INCORRECT") !== result) throw new Error("evidence_result_mismatch");
  return Object.freeze({
    type: "GOVERNED_EVIDENCE", schemaVersion: 1, reducerVersion: MASTERY_REDUCER_VERSION,
    evidenceId: evidence.evidenceId,
    scope: { schoolId: evidence.schoolId, studentId: evidence.learner.studentId, studentUserId: evidence.learner.studentUserId, conceptId: evidence.objective.conceptId, ontologyReleaseId: release.id, ontologyReleaseIdentity: identity },
    bindingId: binding.id, itemId: item.id, itemVersion: item.version,
    evidencePolicyVersion: policy.version, toolPolicyVersion: toolPolicy.version,
    context: item.context, result, selectedAnswerIndex: evidence.performance.selectedAnswerIndex,
    independenceKey: evidence.strength.independenceKey, occurredAt: evidence.occurredAt,
    serverScored: true, admissionDecision: "ACCEPTED", authority: "SERVER_GOVERNED_EVIDENCE_GATEWAY",
    retentionProbe: false, misconceptionSignalId: resolveGovernedMisconceptionSignal({ ontologyReleaseId: release.id, ontologyReleaseIdentity: identity, bindingId: binding.id, itemId: item.id, itemVersion: item.version, selectedAnswerIndex: evidence.performance.selectedAnswerIndex }),
    misconceptionPolicyVersion: MISCONCEPTION_SIGNAL_POLICY_VERSION,
  });
}
