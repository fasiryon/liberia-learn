/**
 * Assessment evidence envelope — versioned, append-only, tiered.
 *
 *   RAW_OBSERVATION               a learner interacted with or answered an item
 *   PROVISIONAL_FEEDBACK          non-authoritative checking (client check, AI suggestion)
 *   VERIFIED_ASSESSMENT_EVIDENCE  the response passed server/human scoring authority under a release
 *   MASTERY_ADMITTED_EVIDENCE     the learning authority admitted verified, independent evidence
 *
 * Tiers are not interchangeable. Each higher tier is a NEW envelope derived from an existing one
 * (`derivedFromEvidenceId`); nothing is updated in place. A tier can only be produced by its own
 * constructor, and the ledger re-checks every derivation, so a forged "admitted" envelope without a
 * verified parent, or with altered scope or points, is rejected.
 *
 * Independence (contract 1.1.0) is never taken from the client. A raw observation is UNVERIFIED, or
 * ASSISTED if the client itself declared help: a client declaration can only weaken evidence. At
 * verification the server reads the attempt's sealed assistance record (assistance.ts); only a
 * chain-valid, sealed, conflict-free, fully instrumented record with no assistance yields INDEPENDENT.
 * Seeing the answer or explanation before responding, revealing hints, using the AI tutor, a
 * prohibited tool or peer help makes the evidence ASSISTED. A missing or contradictory record leaves
 * it UNVERIFIED (contradictions are flagged for integrity review). Assisted and unverified evidence
 * can be verified as a true record of what happened, but neither is ever admitted to mastery.
 */
import { createHash } from "crypto";
import { canonicalizeJson } from "@/lib/curriculum/provenance/hash";
import { attestAssistance, type AssistanceAttestation, type AssistanceLedger } from "./assistance";
import { auditEvent, type AssessmentAuditEvent } from "./audit";
import { LL_SECOND_MARKING, LL_TUTOR_POLICY } from "@/lib/academic-policy/llAep001";
import { hashRelease } from "./hash";
import type { ScorerAuthority, ScoringOutcome } from "./scoring";
import { assertIsoTimestamp } from "./validator";
import type {
  Accommodation,
  AssessmentPurpose,
  AssessmentReleaseV2,
  DeliveryMode,
  ItemContext,
  ReleaseRevocation,
} from "./types";

export const ASSESSMENT_EVIDENCE_CONTRACT_VERSION = "assessment-evidence/1.1.0" as const;

export type EvidenceIndependence = "INDEPENDENT" | "ASSISTED" | "UNVERIFIED";

/**
 * Flags that mean the records disagree or cannot be trusted. Evidence carrying one of them needs a
 * human integrity review; a review can never make the evidence independent (reassessment is the remedy).
 */
export const INTEGRITY_REVIEW_FLAGS = [
  "assistance_declaration_ledger_conflict",
  "assistance_ledger_conflict",
  "assistance_ledger_chain_invalid",
  "assistance_record_scope_mismatch",
  "assistance_record_delivery_mismatch",
  "assistance_record_device_unbound",
  "assistance_record_offline_response_unsynced",
] as const;

export const EVIDENCE_TIERS = [
  "RAW_OBSERVATION",
  "PROVISIONAL_FEEDBACK",
  "VERIFIED_ASSESSMENT_EVIDENCE",
  "MASTERY_ADMITTED_EVIDENCE",
] as const;
export type EvidenceTier = (typeof EVIDENCE_TIERS)[number];

export type EvidenceScope = Readonly<{
  tenantId: string;
  schoolId: string;
  studentId: string;
  studentUserId: string;
  enrollmentId: string;
  classId: string | null;
}>;

export type AssessmentPins = Readonly<{
  definitionId: string;
  definitionVersion: string;
  definitionHash: string;
  formId: string;
  formVersion: string;
  formHash: string;
  itemId: string;
  itemVersion: string;
  itemHash: string;
  scoringSpecHash: string;
  /** Null for unreleased (reviewer preview) delivery. Such evidence can never be verified. */
  releaseId: string | null;
  releaseHash: string | null;
  curriculumReleaseId: string;
  curriculumReleaseIdentity: string;
}>;

export type DeliveryContext = Readonly<{
  mode: DeliveryMode;
  official: boolean;
  purpose: AssessmentPurpose;
  itemContext: ItemContext;
  runtime: "WEB" | "MOBILE" | "OFFLINE_DEVICE" | "PAPER_CAPTURE";
  accommodations: readonly Accommodation[];
  allowedToolIds: readonly string[];
}>;

export type AssistanceExposure = Readonly<{
  hintsRevealed: number;
  aiTutorUsed: boolean;
  explanationSeenBeforeResponse: boolean;
  answerRevealedBeforeResponse: boolean;
  prohibitedToolUsed: boolean;
  peerCollaboration: boolean;
}>;

export type CaptureProvenance = Readonly<{
  source: "ONLINE" | "OFFLINE";
  deviceId: string | null;
  clientEventId: string;
  /** Monotonic per attempt on the capturing device; replay order, never arrival order. */
  clientSequence: number;
  capturedAt: string;
  receivedAt: string;
  syncBatchId: string | null;
}>;

export type ScoringRecord = Readonly<{
  status: "UNSCORED" | "PROVISIONAL" | "SCORED" | "BLANK" | "PENDING_HUMAN_MODERATION" | "INVALID_RESPONSE";
  scorerAuthority: ScorerAuthority | "CLIENT_CHECK" | "AI_SUGGESTION" | null;
  points: number | null;
  maxPoints: number | null;
  scoringVersion: string | null;
  scoringSpecHash: string | null;
  moderation: Readonly<{
    policyId: string;
    policyVersion: string;
    moderatorId: string;
    aiSuggestionConsulted: boolean;
    /** High-stakes constructed responses need independent second marking (LL-AEP-001). */
    secondMarkerRequired: boolean;
    /** SINGLE = one marker; AGREED = two markers within tolerance; RECONCILED = examiner resolved a disagreement. */
    marking: "SINGLE" | "AGREED" | "RECONCILED";
  }> | null;
}>;

export type AdmissionRecord = Readonly<{
  authority: "LEARNING_AUTHORITY_ADMISSION";
  policyId: string;
  policyVersion: string;
  admittedAt: string;
}>;

export type AssessmentEvidenceEnvelope = Readonly<{
  contractVersion: typeof ASSESSMENT_EVIDENCE_CONTRACT_VERSION;
  tier: EvidenceTier;
  evidenceId: string;
  idempotencyKey: string;
  derivedFromEvidenceId: string | null;
  scope: EvidenceScope;
  pins: AssessmentPins;
  attempt: Readonly<{ attemptId: string; sessionId: string; responseSequence: number }>;
  objectiveIds: readonly string[];
  /** Reference to the stored response, never the response body (keeps envelopes small and private). */
  response: Readonly<{ responseId: string; responseDigest: string }> | null;
  occurredAt: string;
  delivery: DeliveryContext;
  /** Union of the client declaration and the server assistance record; it only ever grows. */
  assistance: AssistanceExposure;
  independence: EvidenceIndependence;
  /** The assistance-record state independence was read from. Null on raw observations and when no record exists. */
  assistanceAttestation: AssistanceAttestation | null;
  /**
   * Integrity findings, e.g. AI tutor or hint use during an independent assessment, where the tutor
   * is blocked (LL-AEP-001), or a missing or contradictory assistance record. Recorded for teacher
   * review; never silently cleared.
   */
  integrityFlags: readonly string[];
  capture: CaptureProvenance;
  scoring: ScoringRecord;
  admission: AdmissionRecord | null;
  recordedBy: Readonly<{ kind: "SYSTEM" | "HUMAN"; id: string; role: string | null }>;
  recordedAt: string;
  evidenceHash: string;
}>;

type Unsealed = Omit<AssessmentEvidenceEnvelope, "evidenceHash">;

export function hashEvidence(envelope: Unsealed | AssessmentEvidenceEnvelope): string {
  const { evidenceHash: _ignored, ...rest } = envelope as AssessmentEvidenceEnvelope;
  return createHash("sha256").update(canonicalizeJson({ domain: "liberialearn.assessment.v2.evidence.sha256", rest }), "utf8").digest("hex");
}

function seal(envelope: Unsealed): AssessmentEvidenceEnvelope {
  return Object.freeze({ ...envelope, evidenceHash: hashEvidence(envelope) });
}

const EXPOSURE_FLAGS = ["aiTutorUsed", "explanationSeenBeforeResponse", "answerRevealedBeforeResponse", "prohibitedToolUsed", "peerCollaboration"] as const;

function assertExposure(assistance: AssistanceExposure): void {
  if (!assistance || typeof assistance !== "object" || !Number.isInteger(assistance.hintsRevealed) || assistance.hintsRevealed < 0
    || EXPOSURE_FLAGS.some((flag) => typeof assistance[flag] !== "boolean")) throw new Error("assessment_assistance_invalid");
}

/**
 * Whether an exposure record shows assistance. "INDEPENDENT" here means only "this record shows none";
 * it is never by itself proof of independent work (see verifyObservation).
 */
export function classifyIndependence(assistance: AssistanceExposure): "INDEPENDENT" | "ASSISTED" {
  assertExposure(assistance);
  const assisted = assistance.hintsRevealed > 0 || assistance.aiTutorUsed || assistance.explanationSeenBeforeResponse
    || assistance.answerRevealedBeforeResponse || assistance.prohibitedToolUsed || assistance.peerCollaboration;
  return assisted ? "ASSISTED" : "INDEPENDENT";
}

/**
 * Independent assessment = any OFFICIAL delivery, or a purpose that measures what the learner can do
 * alone. In these deliveries the AI Tutor gives no answers, hints or explanations (LL-AEP-001).
 */
const INDEPENDENT_PURPOSES: readonly AssessmentPurpose[] = ["DIAGNOSTIC", "SUMMATIVE", "RETENTION", "TRANSFER", "EXAMINATION"];

export function isIndependentAssessment(delivery: Pick<DeliveryContext, "mode" | "official" | "purpose">): boolean {
  return delivery.official || delivery.mode === "OFFICIAL" || INDEPENDENT_PURPOSES.includes(delivery.purpose);
}

export function tutorAccessFor(delivery: Pick<DeliveryContext, "mode" | "official" | "purpose">): "BLOCKED" | "INSTRUCTIONAL" {
  return isIndependentAssessment(delivery) ? LL_TUTOR_POLICY.independentAssessment : LL_TUTOR_POLICY.learningMode;
}

function integrityFlagsFor(delivery: DeliveryContext, assistance: AssistanceExposure): readonly string[] {
  if (!isIndependentAssessment(delivery)) return Object.freeze([]);
  const flags: string[] = [];
  if (assistance.aiTutorUsed) flags.push("ai_tutor_used_during_independent_assessment");
  if (assistance.hintsRevealed > 0) flags.push("hints_used_during_independent_assessment");
  if (assistance.answerRevealedBeforeResponse || assistance.explanationSeenBeforeResponse) flags.push("answer_material_exposed_during_independent_assessment");
  if (assistance.prohibitedToolUsed) flags.push("prohibited_tool_used");
  if (assistance.peerCollaboration) flags.push("peer_collaboration_during_independent_assessment");
  return Object.freeze(flags);
}

export function observationIdempotencyKey(input: { studentId: string; attemptId: string; itemId: string; itemVersion: string; responseSequence: number }): string {
  return createHash("sha256").update(canonicalizeJson({ domain: "liberialearn.assessment.v2.observation", ...input })).digest("hex");
}

const CLOCK_SKEW_MS = 5 * 60_000;

const derivedKey = (parent: AssessmentEvidenceEnvelope, tier: EvidenceTier) =>
  createHash("sha256").update(`${parent.idempotencyKey}:${tier}`).digest("hex");

// ─── Boundary: what a client may submit ─────────────────────────────────────────────────────────

/**
 * Fields a client (browser, device, sync payload) may never assert. Scores, tiers, independence
 * and admission are computed on the server; their presence in a submission is a forgery attempt.
 */
const CLIENT_FORBIDDEN_FIELDS = ["tier", "score", "points", "maxPoints", "correct", "isCorrect", "scoring", "scorerAuthority", "admission", "independence", "assistanceAttestation", "official", "evidenceHash", "verified", "mastery"] as const;

export type ClientObservationSubmission = Readonly<{
  attemptId: string;
  itemId: string;
  itemVersion: string;
  responseSequence: number;
  responseId: string;
  responseDigest: string;
  /** Optional echo of identity. If present it must match the session; it is never trusted. */
  studentId?: string;
  schoolId?: string;
  /**
   * Assistance the client itself reports. It can only weaken the evidence (any help → ASSISTED);
   * reporting none proves nothing (the observation stays UNVERIFIED until the server record is read).
   */
  assistance: AssistanceExposure;
  capture: Omit<CaptureProvenance, "receivedAt">;
}>;

/** Server-resolved facts about the attempt and the authenticated learner. */
export type ServerAttemptContext = Readonly<{
  session: Readonly<{ studentId: string; studentUserId: string; schoolId: string; tenantId: string }>;
  attempt: Readonly<{ attemptId: string; sessionId: string; studentId: string; schoolId: string; enrollmentId: string; classId: string | null; status: "OPEN" | "SUBMITTED" | "CLOSED"; submittedAt?: string | null }>;
  pins: AssessmentPins;
  objectiveIds: readonly string[];
  delivery: DeliveryContext;
  receivedAt: string;
}>;

export function acceptClientObservation(submission: ClientObservationSubmission, context: ServerAttemptContext): AssessmentEvidenceEnvelope {
  for (const field of CLIENT_FORBIDDEN_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(submission, field)) throw new Error("assessment_client_asserted_scoring_forbidden");
  }
  const { session, attempt } = context;
  if (submission.studentId !== undefined && submission.studentId !== session.studentId) throw new Error("assessment_scope_substitution");
  if (submission.schoolId !== undefined && submission.schoolId !== session.schoolId) throw new Error("assessment_scope_substitution");
  if (attempt.studentId !== session.studentId || attempt.schoolId !== session.schoolId) throw new Error("assessment_attempt_not_owned");
  if (attempt.attemptId !== submission.attemptId) throw new Error("assessment_attempt_mismatch");
  if (attempt.status === "CLOSED") throw new Error("assessment_attempt_closed");
  if (submission.itemId !== context.pins.itemId || submission.itemVersion !== context.pins.itemVersion) throw new Error("assessment_item_version_mismatch");
  if (!Number.isInteger(submission.responseSequence) || submission.responseSequence < 0) throw new Error("assessment_response_sequence_invalid");
  if (submission.capture.source === "OFFLINE" && !submission.capture.deviceId) throw new Error("assessment_offline_device_required");
  assertIsoTimestamp(submission.capture.capturedAt, "captured_at");
  assertIsoTimestamp(context.receivedAt, "received_at");
  // A device clock cannot place a response after the server received it (5-minute skew allowance).
  if (Date.parse(submission.capture.capturedAt) > Date.parse(context.receivedAt) + CLOCK_SKEW_MS) throw new Error("assessment_capture_time_in_future");
  // After submission only an offline queue may still deliver responses, and only those captured before
  // the submission. An online client has no queue, so a late online response is refused outright.
  if (attempt.status === "SUBMITTED" && !(submission.capture.source === "OFFLINE" && attempt.submittedAt && submission.capture.capturedAt <= attempt.submittedAt)) throw new Error("assessment_attempt_already_submitted");

  const idempotencyKey = observationIdempotencyKey({
    studentId: session.studentId, attemptId: attempt.attemptId, itemId: submission.itemId,
    itemVersion: submission.itemVersion, responseSequence: submission.responseSequence,
  });
  return seal({
    contractVersion: ASSESSMENT_EVIDENCE_CONTRACT_VERSION,
    tier: "RAW_OBSERVATION",
    evidenceId: `obs_${idempotencyKey.slice(0, 32)}`,
    idempotencyKey,
    derivedFromEvidenceId: null,
    scope: { tenantId: session.tenantId, schoolId: session.schoolId, studentId: session.studentId, studentUserId: session.studentUserId, enrollmentId: attempt.enrollmentId, classId: attempt.classId },
    pins: context.pins,
    attempt: { attemptId: attempt.attemptId, sessionId: attempt.sessionId, responseSequence: submission.responseSequence },
    objectiveIds: [...context.objectiveIds],
    response: { responseId: submission.responseId, responseDigest: submission.responseDigest },
    occurredAt: submission.capture.capturedAt,
    delivery: context.delivery,
    assistance: submission.assistance,
    // A client declaration can only weaken evidence; "no help" from the client proves nothing.
    independence: classifyIndependence(submission.assistance) === "ASSISTED" ? "ASSISTED" : "UNVERIFIED",
    assistanceAttestation: null,
    integrityFlags: integrityFlagsFor(context.delivery, submission.assistance),
    capture: { ...submission.capture, receivedAt: context.receivedAt },
    scoring: { status: "UNSCORED", scorerAuthority: null, points: null, maxPoints: null, scoringVersion: null, scoringSpecHash: null, moderation: null },
    admission: null,
    recordedBy: { kind: "SYSTEM", id: "assessment-evidence-gateway", role: null },
    recordedAt: context.receivedAt,
  });
}

// ─── Tier constructors ──────────────────────────────────────────────────────────────────────────

export function createProvisionalFeedback(raw: AssessmentEvidenceEnvelope, input: {
  authority: "CLIENT_CHECK" | "AI_SUGGESTION";
  recordedAt: string;
}): AssessmentEvidenceEnvelope {
  if (raw.tier !== "RAW_OBSERVATION") throw new Error("assessment_evidence_parent_tier_invalid");
  assertIsoTimestamp(input.recordedAt, "recorded_at");
  const idempotencyKey = derivedKey(raw, "PROVISIONAL_FEEDBACK");
  return seal({
    ...raw,
    tier: "PROVISIONAL_FEEDBACK",
    evidenceId: `prov_${idempotencyKey.slice(0, 32)}`,
    idempotencyKey,
    derivedFromEvidenceId: raw.evidenceId,
    scoring: { status: "PROVISIONAL", scorerAuthority: input.authority, points: null, maxPoints: null, scoringVersion: null, scoringSpecHash: null, moderation: null },
    recordedBy: { kind: "SYSTEM", id: "assessment-provisional-feedback", role: null },
    recordedAt: input.recordedAt,
  });
}

/**
 * Whether the record can speak for an offline response: the device is accepted, the sync service's
 * FINALIZED acknowledgement covers the response's capture sequence, and the response arrived before
 * finalization. Online responses are always covered by a final record.
 */
function offlineResponseCovered(attestation: AssistanceAttestation, envelope: Pick<AssessmentEvidenceEnvelope, "capture">): "COVERED" | "DEVICE_UNBOUND" | "UNSYNCED" {
  if (envelope.capture.source !== "OFFLINE") return "COVERED";
  const deviceId = envelope.capture.deviceId ?? "";
  if (!attestation.offlineDeviceIds.includes(deviceId)) return "DEVICE_UNBOUND";
  const ack = attestation.syncedThrough.find((device) => device.deviceId === deviceId);
  if (!ack || attestation.finalizedAt === null || envelope.capture.clientSequence > ack.syncedThroughSequence
    || Date.parse(envelope.capture.receivedAt) > Date.parse(attestation.finalizedAt)) return "UNSYNCED";
  return "COVERED";
}

/** The assistance record belongs to exactly this learner, attempt, delivery session and release. */
function assistanceRecordBoundTo(ledger: AssistanceLedger, envelope: AssessmentEvidenceEnvelope): boolean {
  const scope = ledger.scope;
  return scope.tenantId === envelope.scope.tenantId && scope.schoolId === envelope.scope.schoolId && scope.studentId === envelope.scope.studentId
    && scope.attemptId === envelope.attempt.attemptId && scope.sessionId === envelope.attempt.sessionId
    && scope.releaseId === envelope.pins.releaseId && scope.releaseHash === envelope.pins.releaseHash;
}

const maxExposure = (a: AssistanceExposure, b: AssistanceExposure): AssistanceExposure => Object.freeze({
  hintsRevealed: Math.max(a.hintsRevealed, b.hintsRevealed),
  aiTutorUsed: a.aiTutorUsed || b.aiTutorUsed,
  explanationSeenBeforeResponse: a.explanationSeenBeforeResponse || b.explanationSeenBeforeResponse,
  answerRevealedBeforeResponse: a.answerRevealedBeforeResponse || b.answerRevealedBeforeResponse,
  prohibitedToolUsed: a.prohibitedToolUsed || b.prohibitedToolUsed,
  peerCollaboration: a.peerCollaboration || b.peerCollaboration,
});

/**
 * Server-side independence decision for one response (handoff A.4). The client declaration can only
 * add assistance; the sealed server record is the only source of INDEPENDENT. A record for another
 * scope is treated as missing; disagreement between declaration and record is flagged for review.
 */
function resolveIndependence(raw: AssessmentEvidenceEnvelope, ledger: AssistanceLedger | null): Readonly<{
  independence: EvidenceIndependence; assistance: AssistanceExposure; attestation: AssistanceAttestation | null; flags: readonly string[];
}> {
  const flags: string[] = [];
  const declaredAssisted = raw.independence === "ASSISTED";
  let record = ledger;
  if (record && !assistanceRecordBoundTo(record, raw)) {
    flags.push("assistance_record_scope_mismatch");
    record = null;
  }
  if (!record) {
    if (!ledger) flags.push("assistance_record_missing");
    return { independence: declaredAssisted ? "ASSISTED" : "UNVERIFIED", assistance: raw.assistance, attestation: null, flags };
  }
  const { attestation, classification } = attestAssistance(record, raw.pins.itemId);
  flags.push(...classification.reasons);
  // The record must have been opened for this kind of delivery, and an offline response must come
  // from a device the record accepts capture from; otherwise the record says nothing about it.
  if (attestation.independentDelivery !== isIndependentAssessment(raw.delivery)) flags.push("assistance_record_delivery_mismatch");
  const coverage = offlineResponseCovered(attestation, raw);
  if (coverage === "DEVICE_UNBOUND") flags.push("assistance_record_device_unbound");
  // Only meaningful once the record is final; before that the record is UNVERIFIED anyway.
  if (coverage === "UNSYNCED" && attestation.final) flags.push("assistance_record_offline_response_unsynced");
  const recordUsable = !flags.includes("assistance_record_delivery_mismatch") && !flags.includes("assistance_record_device_unbound")
    && !flags.includes("assistance_record_offline_response_unsynced");
  let independence: EvidenceIndependence;
  if (classification.status === "ASSISTED") {
    independence = "ASSISTED";
    if (!declaredAssisted) flags.push("assistance_declaration_ledger_conflict");
  } else if (declaredAssisted) {
    independence = "ASSISTED";
    if (classification.status === "INDEPENDENT") flags.push("assistance_declaration_ledger_conflict");
  } else {
    independence = recordUsable ? classification.status : "UNVERIFIED";
  }
  return { independence, assistance: maxExposure(raw.assistance, classification.exposure), attestation, flags };
}

export function requiresIntegrityReview(envelope: Pick<AssessmentEvidenceEnvelope, "integrityFlags">): boolean {
  return envelope.integrityFlags.some((flag) => (INTEGRITY_REVIEW_FLAGS as readonly string[]).includes(flag));
}

export function verifyObservation(raw: AssessmentEvidenceEnvelope, input: {
  outcome: ScoringOutcome;
  release: AssessmentReleaseV2 | null;
  revocations: readonly ReleaseRevocation[];
  moderation: ScoringRecord["moderation"];
  recordedBy: AssessmentEvidenceEnvelope["recordedBy"];
  recordedAt: string;
  /**
   * The attempt's server-side assistance record, as loaded from authoritative storage. Required:
   * pass `null` when none exists, which leaves the evidence UNVERIFIED.
   */
  assistanceLedger: AssistanceLedger | null;
}): Readonly<{ evidence: AssessmentEvidenceEnvelope; audit: AssessmentAuditEvent; integrityReview: AssessmentAuditEvent | null }> {
  if (raw.tier !== "RAW_OBSERVATION") throw new Error("assessment_evidence_parent_tier_invalid");
  if (raw.evidenceHash !== hashEvidence(raw)) throw new Error("assessment_evidence_tampered");
  if (raw.contractVersion !== ASSESSMENT_EVIDENCE_CONTRACT_VERSION) throw new Error("assessment_evidence_contract_unsupported");
  if (raw.independence === "INDEPENDENT" || raw.assistanceAttestation !== null) throw new Error("assessment_raw_observation_invalid");
  if (input.assistanceLedger === undefined) throw new Error("assessment_assistance_record_required");
  const { outcome, release } = input;
  // Second-marking checks come first so a single-marked high-stakes score is refused for that reason.
  if (input.moderation?.secondMarkerRequired && input.moderation.marking === "SINGLE") throw new Error("assessment_second_marking_required");
  if (outcome.scorerAuthority === "HUMAN_MODERATOR" && input.moderation && input.moderation.secondMarkerRequired === false
    && (LL_SECOND_MARKING.highStakesPurposes as readonly string[]).includes(raw.delivery.purpose)) throw new Error("assessment_second_marking_required");
  if ((outcome.status !== "SCORED" && outcome.status !== "BLANK") || outcome.points === null || !outcome.scorerAuthority) throw new Error("assessment_outcome_not_scored");
  if (outcome.itemId !== raw.pins.itemId || outcome.itemVersion !== raw.pins.itemVersion || outcome.itemHash !== raw.pins.itemHash || outcome.scoringSpecHash !== raw.pins.scoringSpecHash) {
    throw new Error("assessment_outcome_pin_mismatch");
  }
  if (outcome.scorerAuthority === "HUMAN_MODERATOR" && !input.moderation) throw new Error("assessment_moderation_record_required");
  if (raw.delivery.mode === "REVIEWER_PREVIEW" || !release || raw.pins.releaseId === null) throw new Error("assessment_unreleased_evidence_cannot_be_verified");
  if (release.releaseHash !== hashRelease(release) || release.releaseId !== raw.pins.releaseId || release.releaseHash !== raw.pins.releaseHash) throw new Error("assessment_release_pin_mismatch");
  if (input.revocations.some((revocation) => revocation.releaseId === release.releaseId)) throw new Error("assessment_release_revoked");
  const releasedItem = release.items.find((item) => item.itemId === raw.pins.itemId && item.itemVersion === raw.pins.itemVersion);
  if (!releasedItem || releasedItem.itemHash !== raw.pins.itemHash || releasedItem.scoringSpecHash !== raw.pins.scoringSpecHash) throw new Error("assessment_item_not_in_release");
  if (release.form.formId !== raw.pins.formId || release.form.formHash !== raw.pins.formHash) throw new Error("assessment_form_not_in_release");
  if (raw.delivery.official && !release.permittedModes.includes("OFFICIAL")) throw new Error("assessment_official_mode_not_released");
  if (release.schoolId !== null && release.schoolId !== raw.scope.schoolId) throw new Error("assessment_release_school_scope_mismatch");
  assertIsoTimestamp(input.recordedAt, "recorded_at");

  const resolved = resolveIndependence(raw, input.assistanceLedger);
  const integrityFlags = Object.freeze([...new Set([...raw.integrityFlags, ...integrityFlagsFor(raw.delivery, resolved.assistance), ...resolved.flags])]);
  const idempotencyKey = derivedKey(raw, "VERIFIED_ASSESSMENT_EVIDENCE");
  const evidence = seal({
    ...raw,
    tier: "VERIFIED_ASSESSMENT_EVIDENCE",
    assistance: resolved.assistance,
    independence: resolved.independence,
    assistanceAttestation: resolved.attestation,
    integrityFlags,
    evidenceId: `ver_${idempotencyKey.slice(0, 32)}`,
    idempotencyKey,
    derivedFromEvidenceId: raw.evidenceId,
    scoring: {
      status: outcome.status, scorerAuthority: outcome.scorerAuthority, points: outcome.points, maxPoints: outcome.maxPoints,
      scoringVersion: outcome.scoringVersion, scoringSpecHash: outcome.scoringSpecHash, moderation: input.moderation,
    },
    recordedBy: input.recordedBy,
    recordedAt: input.recordedAt,
  });
  return Object.freeze({
    evidence,
    audit: auditEvent({
      type: "assessment.evidence.verified", subjectRef: evidence.evidenceId,
      actor: { kind: input.recordedBy.kind, id: input.recordedBy.id, role: input.recordedBy.role },
      schoolId: raw.scope.schoolId, occurredAt: input.recordedAt,
      details: { attemptId: raw.attempt.attemptId, itemId: raw.pins.itemId, independence: evidence.independence, official: raw.delivery.official },
    }),
    integrityReview: requiresIntegrityReview(evidence)
      ? auditEvent({
        type: "assessment.evidence.integrity_review_required", subjectRef: evidence.evidenceId,
        actor: { kind: "SYSTEM", id: "assessment-integrity", role: null },
        schoolId: raw.scope.schoolId, occurredAt: input.recordedAt,
        details: { attemptId: raw.attempt.attemptId, itemId: raw.pins.itemId, flags: evidence.integrityFlags.join(",") },
      })
      : null,
  });
}

export type MasteryAdmissionPolicy = Readonly<{
  policyId: string;
  version: string;
  admissiblePurposes: readonly AssessmentPurpose[];
  /** When true only OFFICIAL deliveries are admitted; practice stays verified-only. */
  requireOfficialDelivery: boolean;
  /** Objectives this policy governs; evidence for other objectives is not admitted. */
  objectiveIds: readonly string[];
}>;

export function admitToMastery(verified: AssessmentEvidenceEnvelope, input: {
  policy: MasteryAdmissionPolicy | null;
  revocations: readonly ReleaseRevocation[];
  admittedAt: string;
  /** The attempt's assistance record, re-read from authoritative storage at admission time. */
  assistanceLedger: AssistanceLedger | null;
}): Readonly<{ evidence: AssessmentEvidenceEnvelope; audit: AssessmentAuditEvent }> {
  if (verified.tier !== "VERIFIED_ASSESSMENT_EVIDENCE") throw new Error("assessment_evidence_parent_tier_invalid");
  if (verified.evidenceHash !== hashEvidence(verified)) throw new Error("assessment_evidence_tampered");
  if (verified.contractVersion !== ASSESSMENT_EVIDENCE_CONTRACT_VERSION) throw new Error("assessment_evidence_contract_unsupported");
  const { policy } = input;
  if (!policy) throw new Error("assessment_admission_policy_required");
  if (verified.independence !== "INDEPENDENT" || verified.assistanceAttestation?.status !== "INDEPENDENT") throw new Error("assessment_assisted_evidence_not_admissible");
  // Re-read the record: independence must still hold for exactly the state that was attested.
  assertIndependenceAttested(verified, input.assistanceLedger);
  if (!policy.admissiblePurposes.includes(verified.delivery.purpose)) throw new Error("assessment_purpose_not_admissible");
  if (policy.requireOfficialDelivery && !verified.delivery.official) throw new Error("assessment_unofficial_delivery_not_admissible");
  if (!verified.objectiveIds.some((objectiveId) => policy.objectiveIds.includes(objectiveId))) throw new Error("assessment_objective_not_governed_by_policy");
  if (verified.pins.releaseId && input.revocations.some((revocation) => revocation.releaseId === verified.pins.releaseId)) throw new Error("assessment_release_revoked");
  assertIsoTimestamp(input.admittedAt, "admitted_at");
  const idempotencyKey = derivedKey(verified, "MASTERY_ADMITTED_EVIDENCE");
  const evidence = seal({
    ...verified,
    tier: "MASTERY_ADMITTED_EVIDENCE",
    evidenceId: `adm_${idempotencyKey.slice(0, 32)}`,
    idempotencyKey,
    derivedFromEvidenceId: verified.evidenceId,
    objectiveIds: verified.objectiveIds.filter((objectiveId) => policy.objectiveIds.includes(objectiveId)),
    admission: { authority: "LEARNING_AUTHORITY_ADMISSION", policyId: policy.policyId, policyVersion: policy.version, admittedAt: input.admittedAt },
    recordedBy: { kind: "SYSTEM", id: "learning-authority-admission", role: null },
    recordedAt: input.admittedAt,
  });
  return Object.freeze({
    evidence,
    audit: auditEvent({
      type: "assessment.evidence.admitted", subjectRef: evidence.evidenceId,
      actor: { kind: "SYSTEM", id: "learning-authority-admission", role: null },
      schoolId: verified.scope.schoolId, occurredAt: input.admittedAt,
      details: { policy: `${policy.policyId}@${policy.version}`, derivedFrom: verified.evidenceId },
    }),
  });
}

// ─── Append-only ledger ─────────────────────────────────────────────────────────────────────────

export type EvidenceLedger = Readonly<{ entries: readonly AssessmentEvidenceEnvelope[] }>;

export const emptyLedger = (): EvidenceLedger => Object.freeze({ entries: Object.freeze([]) });

const PARENT_TIER: Record<EvidenceTier, EvidenceTier | null> = {
  RAW_OBSERVATION: null,
  PROVISIONAL_FEEDBACK: "RAW_OBSERVATION",
  VERIFIED_ASSESSMENT_EVIDENCE: "RAW_OBSERVATION",
  MASTERY_ADMITTED_EVIDENCE: "VERIFIED_ASSESSMENT_EVIDENCE",
};

const exposureAtLeast = (child: AssistanceExposure, parent: AssistanceExposure) =>
  child.hintsRevealed >= parent.hintsRevealed && EXPOSURE_FLAGS.every((flag) => child[flag] || !parent[flag]);

/**
 * Fields a derived envelope may not change relative to its parent. The one permitted change is at
 * verification: independence may be resolved from UNVERIFIED with a server attestation, recorded
 * exposure and integrity flags may only grow, and ASSISTED is never upgraded.
 */
function inheritsParent(child: AssessmentEvidenceEnvelope, parent: AssessmentEvidenceEnvelope): boolean {
  const same = (a: unknown, b: unknown) => canonicalizeJson(a) === canonicalizeJson(b);
  if (!same(child.scope, parent.scope) || !same(child.pins, parent.pins) || !same(child.attempt, parent.attempt)
    || !same(child.response, parent.response) || !same(child.delivery, parent.delivery)
    || !same(child.capture, parent.capture) || child.occurredAt !== parent.occurredAt) return false;
  if (child.tier === "VERIFIED_ASSESSMENT_EVIDENCE") {
    if (!exposureAtLeast(child.assistance, parent.assistance)) return false;
    if (!parent.integrityFlags.every((flag) => child.integrityFlags.includes(flag))) return false;
    if (parent.independence === "ASSISTED" && child.independence !== "ASSISTED") return false;
    if (parent.independence === "INDEPENDENT") return false;
    const attestation = child.assistanceAttestation;
    if (attestation && (attestation.attemptId !== child.attempt.attemptId || attestation.sessionId !== child.attempt.sessionId || attestation.itemId !== child.pins.itemId)) return false;
    if (child.independence === "INDEPENDENT" && (attestation?.status !== "INDEPENDENT" || classifyIndependence(child.assistance) !== "INDEPENDENT")) return false;
    if (child.independence === "UNVERIFIED" && classifyIndependence(child.assistance) !== "INDEPENDENT") return false;
    return child.admission === null;
  }
  if (!same(child.assistance, parent.assistance) || child.independence !== parent.independence
    || !same(child.integrityFlags, parent.integrityFlags) || !same(child.assistanceAttestation, parent.assistanceAttestation)) return false;
  if (child.tier === "MASTERY_ADMITTED_EVIDENCE") {
    return same(child.scoring, parent.scoring) && child.objectiveIds.every((objectiveId) => parent.objectiveIds.includes(objectiveId)) && child.admission !== null;
  }
  return child.admission === null;
}

/**
 * Appends one envelope. Exact replays (same idempotency key, same hash) are no-ops; a different
 * payload under the same key is a conflict. Derived envelopes must reference a parent already in the
 * ledger, of the right tier, and must not alter inherited facts.
 */
/**
 * Re-reads the assistance record for an envelope that claims INDEPENDENT. The envelope hash is not a
 * signature, so the claim is never accepted on the envelope's word alone.
 */
function assertIndependenceAttested(envelope: AssessmentEvidenceEnvelope, record: AssistanceLedger | null | undefined): void {
  if (envelope.independence !== "INDEPENDENT") return;
  const claimed = envelope.assistanceAttestation;
  if (!claimed || claimed.status !== "INDEPENDENT") throw new Error("assessment_assisted_evidence_not_admissible");
  if (!record) throw new Error("assessment_assistance_record_missing");
  if (!assistanceRecordBoundTo(record, envelope)) throw new Error("assessment_assistance_record_scope_mismatch");
  const current = attestAssistance(record, envelope.pins.itemId).attestation;
  if (current.headHash !== claimed.headHash || current.headSequence !== claimed.headSequence || current.status !== "INDEPENDENT"
    || current.independentDelivery !== isIndependentAssessment(envelope.delivery)
    || offlineResponseCovered(current, envelope) !== "COVERED") {
    throw new Error("assessment_assistance_attestation_stale");
  }
}

export function appendEvidence(ledger: EvidenceLedger, envelope: AssessmentEvidenceEnvelope, options: {
  /** Required to append VERIFIED or ADMITTED evidence that claims INDEPENDENT; re-read from authoritative storage. */
  assistanceLedger?: AssistanceLedger | null;
} = {}): Readonly<{ ledger: EvidenceLedger; appended: boolean }> {
  if (envelope.contractVersion !== ASSESSMENT_EVIDENCE_CONTRACT_VERSION) throw new Error("assessment_evidence_contract_unsupported");
  if (!EVIDENCE_TIERS.includes(envelope.tier)) throw new Error("assessment_evidence_tier_invalid");
  if (envelope.evidenceHash !== hashEvidence(envelope)) throw new Error("assessment_evidence_tampered");
  const prior = ledger.entries.find((entry) => entry.idempotencyKey === envelope.idempotencyKey);
  if (prior) {
    if (prior.evidenceHash === envelope.evidenceHash) return Object.freeze({ ledger, appended: false });
    // Offline re-delivery of the same response is common; a different payload is not.
    throw new Error("assessment_evidence_idempotency_conflict");
  }
  if (ledger.entries.some((entry) => entry.evidenceId === envelope.evidenceId)) throw new Error("assessment_evidence_id_conflict");
  const parentTier = PARENT_TIER[envelope.tier];
  if (parentTier === null) {
    if (envelope.derivedFromEvidenceId !== null || envelope.scoring.status !== "UNSCORED" || envelope.admission !== null
      || envelope.independence === "INDEPENDENT" || envelope.assistanceAttestation !== null) throw new Error("assessment_raw_observation_invalid");
  } else {
    const parent = ledger.entries.find((entry) => entry.evidenceId === envelope.derivedFromEvidenceId);
    if (!parent) throw new Error("assessment_evidence_parent_missing");
    if (parent.tier !== parentTier) throw new Error("assessment_evidence_parent_tier_invalid");
    if (!inheritsParent(envelope, parent)) throw new Error("assessment_evidence_derivation_altered");
    if (envelope.tier === "VERIFIED_ASSESSMENT_EVIDENCE" && ((envelope.scoring.status !== "SCORED" && envelope.scoring.status !== "BLANK") || !["SERVER_KEYED", "HUMAN_MODERATOR"].includes(envelope.scoring.scorerAuthority ?? ""))) {
      throw new Error("assessment_verified_requires_scoring_authority");
    }
    if (envelope.tier === "MASTERY_ADMITTED_EVIDENCE" && (envelope.independence !== "INDEPENDENT" || envelope.assistanceAttestation?.status !== "INDEPENDENT")) {
      throw new Error("assessment_assisted_evidence_not_admissible");
    }
    if (envelope.tier === "PROVISIONAL_FEEDBACK" && envelope.scoring.status !== "PROVISIONAL") throw new Error("assessment_provisional_must_stay_provisional");
    assertIndependenceAttested(envelope, options.assistanceLedger);
  }
  return Object.freeze({ ledger: Object.freeze({ entries: Object.freeze([...ledger.entries, envelope]) }), appended: true });
}

/**
 * Deterministic replay order for offline/out-of-order delivery: by attempt, then the capturing
 * device's sequence. Two different responses claiming the same (attempt, item, sequence) are
 * reported as conflicts for human resolution; there is no last-write-wins.
 */
export function orderForReplay(envelopes: readonly AssessmentEvidenceEnvelope[]): Readonly<{
  ordered: readonly AssessmentEvidenceEnvelope[];
  conflicts: readonly Readonly<{ attemptId: string; itemId: string; responseSequence: number; evidenceIds: readonly string[] }>[];
}> {
  const ordered = [...envelopes].sort((a, b) =>
    a.attempt.attemptId !== b.attempt.attemptId ? (a.attempt.attemptId < b.attempt.attemptId ? -1 : 1)
      : a.capture.clientSequence !== b.capture.clientSequence ? a.capture.clientSequence - b.capture.clientSequence
        : a.attempt.responseSequence - b.attempt.responseSequence || (a.evidenceId < b.evidenceId ? -1 : a.evidenceId > b.evidenceId ? 1 : 0));
  const groups = new Map<string, AssessmentEvidenceEnvelope[]>();
  for (const envelope of ordered.filter((entry) => entry.tier === "RAW_OBSERVATION")) {
    const key = `${envelope.attempt.attemptId}|${envelope.pins.itemId}|${envelope.attempt.responseSequence}`;
    groups.set(key, [...(groups.get(key) ?? []), envelope]);
  }
  const conflicts = [...groups.values()]
    .filter((group) => new Set(group.map((entry) => entry.response?.responseDigest)).size > 1)
    .map((group) => Object.freeze({ attemptId: group[0].attempt.attemptId, itemId: group[0].pins.itemId, responseSequence: group[0].attempt.responseSequence, evidenceIds: group.map((entry) => entry.evidenceId) }));
  return Object.freeze({ ordered: Object.freeze(ordered), conflicts: Object.freeze(conflicts) });
}

/**
 * Effective standing of an envelope after release revocations. Revocation never deletes evidence:
 * it is either invalidated or retained as unofficial, as the revocation record directs.
 */
export function effectiveStanding(envelope: AssessmentEvidenceEnvelope, revocations: readonly ReleaseRevocation[]): Readonly<{
  tier: EvidenceTier | "INVALIDATED";
  official: boolean;
}> {
  const revocation = envelope.pins.releaseId ? revocations.find((entry) => entry.releaseId === envelope.pins.releaseId) : undefined;
  if (!revocation) return Object.freeze({ tier: envelope.tier, official: envelope.delivery.official });
  if (revocation.evidenceDisposition === "INVALIDATE") return Object.freeze({ tier: "INVALIDATED", official: false });
  return Object.freeze({ tier: envelope.tier === "MASTERY_ADMITTED_EVIDENCE" ? "VERIFIED_ASSESSMENT_EVIDENCE" : envelope.tier, official: false });
}
