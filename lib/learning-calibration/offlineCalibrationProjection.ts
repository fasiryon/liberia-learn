import { createHash } from "crypto";
import {
  deduplicateGovernedEvidence, toCanonicalMasteryEvidence, validateGovernedEvidence, type GovernedEvidence,
} from "@/lib/learning-evidence/evidenceContract";
import { deterministicReleaseIdentity, type CurriculumOntologyRelease } from "@/lib/learning-authority/governedGrade4Math";
import type { CalibrationStage, LearnerCalibration, SufficiencyLevel } from "@/lib/learning-calibration/calibrationState";
import type { CompetencyEstimate } from "@/lib/learning-calibration/competencyEstimate";

/**
 * Offline calibration model.
 *
 *   cloud canonical        -> calibration is only ever computed server-side
 *   signed cached projection -> the device receives a signed, expiring,
 *                               learner-safe read projection
 *   queued observations    -> the device queues governed evidence with an
 *                             offline sync identity
 *   no device mastery writes -> the projection carries no writer and the
 *                               reconciler only returns evidence to replay
 *
 * The signer/verifier are injected so key custody stays with the existing
 * server signing infrastructure.
 */
export const OFFLINE_CALIBRATION_PROJECTION_VERSION = "offline-calibration-projection/1.0.0" as const;

export type OfflineCalibrationPayload = Readonly<{
  projectionVersion: typeof OFFLINE_CALIBRATION_PROJECTION_VERSION;
  calibrationId: string;
  learnerStateRevision: string;
  scope: LearnerCalibration["scope"];
  enrollmentGrade: number;
  stage: CalibrationStage;
  issuedAt: string;
  expiresAt: string;
  competencies: readonly Readonly<{
    conceptId: string;
    masteryLevel: CompetencyEstimate["mastery"]["level"];
    confidenceLevel: CompetencyEstimate["confidence"]["level"];
    retentionStatus: CompetencyEstimate["retention"]["status"];
    sufficiency: SufficiencyLevel;
    prerequisiteStatus: CompetencyEstimate["prerequisite"]["status"];
  }>[];
  authority: Readonly<{ readOnly: true; deviceMayWrite: false; canonicalSource: "CLOUD_STUDENT_LEARNING_MODEL" }>;
}>;

export type SignedOfflineCalibrationProjection = Readonly<{
  payload: OfflineCalibrationPayload;
  signature: string;
  keyId: string;
}>;

export type ProjectionSigner = (serialized: string) => Readonly<{ signature: string; keyId: string }>;
export type ProjectionVerifier = (serialized: string, signature: string, keyId: string) => boolean;

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => `${JSON.stringify(key)}:${stable(child)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function serializeOfflineCalibrationPayload(payload: OfflineCalibrationPayload): string {
  return stable(payload);
}

export function buildSignedOfflineCalibrationProjection(input: {
  calibration: LearnerCalibration;
  estimates: readonly CompetencyEstimate[];
  issuedAt: string;
  ttlHours: number;
  sign: ProjectionSigner;
}): SignedOfflineCalibrationProjection {
  if (!Number.isFinite(input.ttlHours) || input.ttlHours <= 0 || input.ttlHours > 24 * 14) throw new Error("offline_projection_ttl_invalid");
  const issued = Date.parse(input.issuedAt);
  if (!Number.isFinite(issued)) throw new Error("offline_projection_issued_at_invalid");
  const payload: OfflineCalibrationPayload = Object.freeze({
    projectionVersion: OFFLINE_CALIBRATION_PROJECTION_VERSION,
    calibrationId: input.calibration.id,
    learnerStateRevision: input.calibration.learnerStateRevision,
    scope: input.calibration.scope,
    enrollmentGrade: input.calibration.enrollment.grade,
    stage: input.calibration.stage,
    issuedAt: input.issuedAt,
    expiresAt: new Date(issued + input.ttlHours * 3_600_000).toISOString(),
    competencies: Object.freeze(input.estimates.map((estimate) => Object.freeze({
      conceptId: estimate.conceptId,
      masteryLevel: estimate.mastery.level,
      confidenceLevel: estimate.confidence.level,
      retentionStatus: estimate.retention.status,
      sufficiency: estimate.sufficiency.level,
      prerequisiteStatus: estimate.prerequisite.status,
    }))),
    authority: Object.freeze({ readOnly: true as const, deviceMayWrite: false as const, canonicalSource: "CLOUD_STUDENT_LEARNING_MODEL" as const }),
  });
  const { signature, keyId } = input.sign(serializeOfflineCalibrationPayload(payload));
  if (!signature || !keyId) throw new Error("offline_projection_signature_missing");
  return Object.freeze({ payload, signature, keyId });
}

export type ProjectionTrust = "TRUSTED" | "EXPIRED" | "INVALID_SIGNATURE" | "STALE_REVISION";

/** Device-side check before using a cached projection to drive offline UI. */
export function verifyOfflineCalibrationProjection(input: {
  projection: SignedOfflineCalibrationProjection;
  verify: ProjectionVerifier;
  now: string;
  /** When online, the server's current revision; a mismatch means re-fetch. */
  currentRevision?: string;
}): ProjectionTrust {
  const { projection } = input;
  if (projection.payload.projectionVersion !== OFFLINE_CALIBRATION_PROJECTION_VERSION ||
    projection.payload.authority.deviceMayWrite !== false) return "INVALID_SIGNATURE";
  let valid = false;
  try { valid = input.verify(serializeOfflineCalibrationPayload(projection.payload), projection.signature, projection.keyId); } catch { valid = false; }
  if (!valid) return "INVALID_SIGNATURE";
  if (Date.parse(input.now) >= Date.parse(projection.payload.expiresAt)) return "EXPIRED";
  if (input.currentRevision !== undefined && input.currentRevision !== projection.payload.learnerStateRevision) return "STALE_REVISION";
  return "TRUSTED";
}

export type OfflineReplayResult = Readonly<{
  /** Evidence the server admits for canonical/corroborating replay. */
  accepted: readonly GovernedEvidence[];
  duplicateIds: readonly string[];
  rejected: readonly Readonly<{ evidenceId: string; reason: string }>[];
  /** The device projection is now superseded; the server recomputes calibration. */
  projectionSuperseded: boolean;
  replayDigest: string;
}>;

const OFFLINE_SCORABLE_TYPES: ReadonlySet<GovernedEvidence["evidenceType"]> = new Set(["PRACTICE", "QUIZ", "DIAGNOSTIC"]);

/**
 * Re-admit one queued record on the server. Trust a device can only assert
 * (server scoring, human verification, reviewed reliability, teacher source)
 * is discarded; a record the release can score is re-scored against the
 * governed item, and a device result that disagrees is rejected.
 */
function readmitOfflineEvidence(evidence: GovernedEvidence, release: CurriculumOntologyRelease): GovernedEvidence {
  if (evidence.provenance.source !== "OFFLINE" || evidence.provenance.actorRole !== "STUDENT") throw new Error("offline_provenance_invalid");
  const untrusted: GovernedEvidence = Object.freeze({
    ...evidence,
    strength: Object.freeze({ ...evidence.strength, serverScored: false, humanVerified: false, reliability: "UNASSESSED" as const }),
  });
  // Scorability depends on the item type and the selected answer, never on the device's own result.
  const { selectedAnswerIndex, correct } = untrusted.performance;
  if (!OFFLINE_SCORABLE_TYPES.has(untrusted.evidenceType) || selectedAnswerIndex === undefined) return untrusted;
  // A device that reported no result gets the server's answer key; one that did is checked against it
  // (evidence_result_mismatch). An item the release does not bind is rejected either way.
  const item = release.items.find((candidate) => candidate.id === untrusted.activity.activityId && candidate.version === untrusted.activity.activityVersion);
  const claimed = correct ?? (item !== undefined && selectedAnswerIndex === item.correctIndex);
  const rescored = toCanonicalMasteryEvidence({
    ...untrusted,
    performance: { ...untrusted.performance, correct: claimed },
    strength: { ...untrusted.strength, serverScored: true },
  }, release);
  return Object.freeze({
    ...untrusted,
    performance: Object.freeze({ ...untrusted.performance, correct: rescored.result === "CORRECT", outcome: rescored.result }),
    strength: Object.freeze({ ...untrusted.strength, serverScored: true }),
  });
}

/**
 * Server-side admission of queued offline observations. The projection is
 * authenticated before its scope is used as the admission boundary (expiry
 * does not block: a queue legitimately outlives the cached projection, and the
 * scope is still the server's own signed statement). Every record is
 * re-admitted through readmitOfflineEvidence. Replays of the same queue are
 * idempotent; conflicting duplicates and cross-learner records are rejected.
 * The result is evidence to replay, never a mastery value.
 */
export function reconcileOfflineObservations(input: {
  projection: SignedOfflineCalibrationProjection;
  verify: ProjectionVerifier;
  release: CurriculumOntologyRelease;
  queued: readonly GovernedEvidence[];
  alreadyAdmittedIdempotencyKeys: ReadonlySet<string>;
}): OfflineReplayResult {
  const { projection } = input;
  let authentic = false;
  try {
    authentic = projection.payload.projectionVersion === OFFLINE_CALIBRATION_PROJECTION_VERSION &&
      projection.payload.authority.deviceMayWrite === false &&
      input.verify(serializeOfflineCalibrationPayload(projection.payload), projection.signature, projection.keyId);
  } catch { authentic = false; }
  if (!authentic) throw new Error("offline_projection_untrusted");
  const { scope } = projection.payload;
  if (input.release.id !== scope.ontologyReleaseId || deterministicReleaseIdentity(input.release) !== scope.ontologyReleaseIdentity) {
    throw new Error("offline_projection_release_mismatch");
  }
  const rejected: { evidenceId: string; reason: string }[] = [];
  const candidates: GovernedEvidence[] = [];
  for (const queued of input.queued) {
    let evidence: GovernedEvidence;
    try { validateGovernedEvidence(queued); } catch (error) {
      rejected.push({ evidenceId: queued.evidenceId, reason: (error as Error).message }); continue;
    }
    if (!queued.offline.isOffline || !queued.offline.syncIdentity) { rejected.push({ evidenceId: queued.evidenceId, reason: "offline_identity_required" }); continue; }
    if (queued.schoolId !== scope.schoolId || queued.learner.studentId !== scope.studentId ||
      queued.learner.studentUserId !== scope.studentUserId) { rejected.push({ evidenceId: queued.evidenceId, reason: "offline_learner_mismatch" }); continue; }
    if (queued.curriculum.ontologyReleaseId !== scope.ontologyReleaseId ||
      queued.curriculum.ontologyReleaseIdentity !== scope.ontologyReleaseIdentity) { rejected.push({ evidenceId: queued.evidenceId, reason: "offline_release_mismatch" }); continue; }
    try { evidence = readmitOfflineEvidence(queued, input.release); } catch (error) {
      rejected.push({ evidenceId: queued.evidenceId, reason: (error as Error).message }); continue;
    }
    candidates.push(evidence);
  }
  // Conflicting payloads under one idempotency key are a hard failure for that key.
  const groups = new Map<string, GovernedEvidence[]>();
  for (const evidence of candidates) groups.set(evidence.idempotencyKey, [...(groups.get(evidence.idempotencyKey) ?? []), evidence]);
  const accepted: GovernedEvidence[] = [];
  const duplicateIds: string[] = [];
  for (const [key, group] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    let unique: readonly GovernedEvidence[];
    try { unique = deduplicateGovernedEvidence(group); } catch {
      for (const evidence of group) rejected.push({ evidenceId: evidence.evidenceId, reason: "evidence_idempotency_conflict" });
      continue;
    }
    if (group.length > 1) duplicateIds.push(...group.slice(1).map((evidence) => evidence.evidenceId));
    if (input.alreadyAdmittedIdempotencyKeys.has(key)) { duplicateIds.push(unique[0].evidenceId); continue; }
    accepted.push(unique[0]);
  }
  return Object.freeze({
    accepted: Object.freeze(accepted),
    duplicateIds: Object.freeze(duplicateIds.sort()),
    rejected: Object.freeze(rejected.map((entry) => Object.freeze(entry))),
    projectionSuperseded: accepted.length > 0,
    replayDigest: createHash("sha256").update(stable(accepted.map((evidence) => evidence.idempotencyKey))).digest("hex"),
  });
}
