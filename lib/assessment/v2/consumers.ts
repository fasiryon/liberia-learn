/**
 * Downstream consumer ports. Each consumer states which evidence tier it may read; none of these
 * functions writes anything. Activation of any downstream write (mastery, gradebook, report card,
 * promotion) is a separate, authorized change: `ASSESSMENT_V2_DOWNSTREAM_WRITES_ENABLED` is a
 * literal `false` that callers must check, and tests pin it.
 *
 *   Student Learning Model     MASTERY_ADMITTED_EVIDENCE only, via the governed evidence contract
 *   Learning Orchestrator      may read RAW / PROVISIONAL / VERIFIED diagnostics for recommendations,
 *                              always labelled `masteryClaim: false`
 *   Teacher gradebook          VERIFIED or ADMITTED, OFFICIAL delivery, under a versioned grading
 *                              policy; never AI-scored, never unreleased, never revoked
 *   Report cards / promotion   consume finalized academic records (see Academic Records V2), not
 *                              assessment evidence directly
 */
import {
  GOVERNED_EVIDENCE_CONTRACT_VERSION,
  type GovernedEvidence,
  type GovernedEvidenceType,
} from "@/lib/learning-evidence/evidenceContract";
import { effectiveStanding, type AssessmentEvidenceEnvelope, type EvidenceTier } from "./evidence";
import type { AssessmentPurpose, ReleaseRevocation } from "./types";

export const ASSESSMENT_V2_DOWNSTREAM_WRITES_ENABLED = false as const;

// ─── Student Learning Model ─────────────────────────────────────────────────────────────────────

export function evidenceForStudentLearningModel(envelopes: readonly AssessmentEvidenceEnvelope[], revocations: readonly ReleaseRevocation[]): readonly AssessmentEvidenceEnvelope[] {
  return Object.freeze(envelopes.filter((envelope) => envelope.tier === "MASTERY_ADMITTED_EVIDENCE"
    && envelope.admission !== null
    && effectiveStanding(envelope, revocations).tier === "MASTERY_ADMITTED_EVIDENCE"));
}

const EVIDENCE_TYPE_FOR_PURPOSE: Record<AssessmentPurpose, GovernedEvidenceType> = {
  DIAGNOSTIC: "DIAGNOSTIC",
  FORMATIVE: "QUIZ",
  SUMMATIVE: "EXAM_TEST",
  RETENTION: "QUIZ",
  TRANSFER: "QUIZ",
  EXAMINATION: "EXAM_TEST",
  PERFORMANCE: "PROJECT",
};

/**
 * Compatibility adapter to the existing provider-neutral learning evidence contract
 * (lib/learning-evidence/evidenceContract.ts). Only admitted evidence maps. The existing contract
 * keeps `canonicalMasteryMutation: false`; its own `toCanonicalMasteryEvidence` still decides,
 * against a released ontology, whether a mastery write is possible.
 */
export function toGovernedLearningEvidence(envelope: AssessmentEvidenceEnvelope, input: {
  objectiveId: string;
  conceptId: string;
}): GovernedEvidence {
  if (envelope.tier !== "MASTERY_ADMITTED_EVIDENCE" || !envelope.admission) throw new Error("assessment_slm_requires_admitted_evidence");
  if (!envelope.objectiveIds.includes(input.objectiveId)) throw new Error("assessment_slm_objective_not_admitted");
  const { scoring, capture } = envelope;
  const fullCredit = scoring.points !== null && scoring.maxPoints !== null && scoring.points >= scoring.maxPoints;
  const outcome: GovernedEvidence["performance"]["outcome"] = scoring.points === 0 ? "INCORRECT" : fullCredit ? "CORRECT" : "PARTIAL";
  const evidence: GovernedEvidence = {
    contractVersion: GOVERNED_EVIDENCE_CONTRACT_VERSION,
    evidenceId: envelope.evidenceId,
    idempotencyKey: envelope.idempotencyKey,
    attemptId: envelope.attempt.attemptId,
    tenantId: envelope.scope.tenantId,
    schoolId: envelope.scope.schoolId,
    learner: { studentId: envelope.scope.studentId, studentUserId: envelope.scope.studentUserId },
    objective: { conceptId: input.conceptId, objectiveId: input.objectiveId },
    activity: { activityId: envelope.pins.itemId, activityVersion: envelope.pins.itemVersion },
    evidenceType: EVIDENCE_TYPE_FOR_PURPOSE[envelope.delivery.purpose],
    modality: capture.source === "OFFLINE" ? "OFFLINE_PACKET" : envelope.delivery.runtime === "PAPER_CAPTURE" ? "TEACHER_RECORDED" : "INTERACTIVE",
    occurredAt: envelope.occurredAt,
    performance: { outcome, score: scoring.points, maxScore: scoring.maxPoints, correct: fullCredit, signals: [] },
    provenance: {
      source: capture.source, actorId: envelope.scope.studentUserId, actorRole: "STUDENT",
      runtime: capture.source === "OFFLINE" ? "SYNC" : "WEB", recordedAt: envelope.recordedAt,
      clientEventId: capture.clientEventId, syncBatchId: capture.syncBatchId,
    },
    strength: {
      serverScored: scoring.scorerAuthority === "SERVER_KEYED",
      humanVerified: scoring.scorerAuthority === "HUMAN_MODERATOR",
      assistanceUsed: false,
      retryCount: 0,
      hintCount: 0,
      independenceKey: `${envelope.attempt.attemptId}:${envelope.pins.itemId}`,
      directness: "DIRECT",
      reliability: "VERIFIED",
      policyRef: `${envelope.admission.policyId}@${envelope.admission.policyVersion}`,
    },
    offline: { isOffline: capture.source === "OFFLINE", syncIdentity: capture.source === "OFFLINE" ? capture.syncBatchId ?? capture.clientEventId : null },
    curriculum: { ontologyReleaseId: envelope.pins.curriculumReleaseId, ontologyReleaseIdentity: envelope.pins.curriculumReleaseIdentity },
    canonicalMasteryMutation: false,
  };
  return Object.freeze(evidence);
}

// ─── Learning Orchestrator ──────────────────────────────────────────────────────────────────────

export type OrchestratorSignal = Readonly<{
  evidenceId: string;
  studentId: string;
  objectiveIds: readonly string[];
  tier: EvidenceTier;
  purpose: AssessmentPurpose;
  independence: "INDEPENDENT" | "ASSISTED";
  fractionCorrect: number | null;
  /** Recommendations may use these signals; they must never be reported as mastery. */
  masteryClaim: false;
}>;

export function signalsForOrchestrator(envelopes: readonly AssessmentEvidenceEnvelope[], revocations: readonly ReleaseRevocation[]): readonly OrchestratorSignal[] {
  return Object.freeze(envelopes
    .filter((envelope) => effectiveStanding(envelope, revocations).tier !== "INVALIDATED")
    .map((envelope) => Object.freeze({
      evidenceId: envelope.evidenceId,
      studentId: envelope.scope.studentId,
      objectiveIds: envelope.objectiveIds,
      tier: envelope.tier,
      purpose: envelope.delivery.purpose,
      independence: envelope.independence,
      fractionCorrect: envelope.scoring.points !== null && envelope.scoring.maxPoints ? envelope.scoring.points / envelope.scoring.maxPoints : null,
      masteryClaim: false as const,
    })));
}

// ─── Gradebook ──────────────────────────────────────────────────────────────────────────────────

export type GradingPolicyRef = Readonly<{ schoolId: string; policyId: string; version: string; status: "APPROVED" | "DRAFT" }>;

export type GradebookEligibility = Readonly<{ eligible: boolean; reason: string }>;

export function gradebookEligibility(envelope: AssessmentEvidenceEnvelope, input: {
  gradingPolicy: GradingPolicyRef | null;
  revocations: readonly ReleaseRevocation[];
}): GradebookEligibility {
  const no = (reason: string) => Object.freeze({ eligible: false, reason });
  const standing = effectiveStanding(envelope, input.revocations);
  if (!input.gradingPolicy) return no("grading_policy_missing");
  if (input.gradingPolicy.status !== "APPROVED") return no("grading_policy_not_approved");
  if (input.gradingPolicy.schoolId !== envelope.scope.schoolId) return no("grading_policy_school_mismatch");
  if (standing.tier === "INVALIDATED") return no("release_revoked");
  if (standing.tier !== "VERIFIED_ASSESSMENT_EVIDENCE" && standing.tier !== "MASTERY_ADMITTED_EVIDENCE") return no("evidence_not_verified");
  if (!standing.official) return no("delivery_not_official");
  if (envelope.scoring.scorerAuthority !== "SERVER_KEYED" && envelope.scoring.scorerAuthority !== "HUMAN_MODERATOR") return no("scorer_not_authoritative");
  const moderation = envelope.scoring.moderation;
  if (moderation?.secondMarkerRequired && moderation.marking === "SINGLE") return no("second_marking_unreconciled");
  if (envelope.integrityFlags.length > 0) return no("integrity_review_required");
  return Object.freeze({ eligible: true, reason: "official_verified_score" });
}

// ─── Missing evidence is not zero ───────────────────────────────────────────────────────────────

export type ObjectiveEvidenceSummary =
  | Readonly<{ status: "NO_EVIDENCE"; objectiveId: string }>
  | Readonly<{ status: "ONLY_UNVERIFIED"; objectiveId: string; observationCount: number }>
  | Readonly<{ status: "VERIFIED"; objectiveId: string; verifiedCount: number; independentCount: number; pointsEarned: number; pointsPossible: number }>;

export function summarizeObjectiveEvidence(envelopes: readonly AssessmentEvidenceEnvelope[], objectiveId: string, revocations: readonly ReleaseRevocation[]): ObjectiveEvidenceSummary {
  const relevant = envelopes.filter((envelope) => envelope.objectiveIds.includes(objectiveId) && effectiveStanding(envelope, revocations).tier !== "INVALIDATED");
  if (relevant.length === 0) return Object.freeze({ status: "NO_EVIDENCE", objectiveId });
  const verified = relevant.filter((envelope) => envelope.tier === "VERIFIED_ASSESSMENT_EVIDENCE");
  if (verified.length === 0) return Object.freeze({ status: "ONLY_UNVERIFIED", objectiveId, observationCount: relevant.length });
  return Object.freeze({
    status: "VERIFIED",
    objectiveId,
    verifiedCount: verified.length,
    independentCount: verified.filter((envelope) => envelope.independence === "INDEPENDENT").length,
    pointsEarned: verified.reduce((sum, envelope) => sum + (envelope.scoring.points ?? 0), 0),
    pointsPossible: verified.reduce((sum, envelope) => sum + (envelope.scoring.maxPoints ?? 0), 0),
  });
}
