import {
  deterministicReleaseIdentity, validateOntologyRelease, type CurriculumOntologyRelease,
} from "@/lib/learning-authority/governedGrade4Math";
import { createGovernedEvidence, type GovernedEvidence } from "@/lib/learning-evidence/evidenceContract";
import type { CalibrationStage, LearnerCalibration } from "@/lib/learning-calibration/calibrationState";
import type { CompetencyEstimate } from "@/lib/learning-calibration/competencyEstimate";

/**
 * Placement orchestration: enrollment grade is not instructional readiness.
 *
 * The server-authoritative placement session (lib/placementAuthority) scores
 * generic items and estimates a grade band. This module turns that result into
 * two separate, read-only things:
 *
 *   1. Provisional competency evidence: placement items that a published
 *      release explicitly binds to a governed concept become governed DIAGNOSTIC
 *      evidence. They are INDIRECT (not release items) so they never replay
 *      into canonical mastery; they inform evidence sufficiency only.
 *   2. Instructional readiness: per-subject and per-competency readiness that
 *      sits beside, and never replaces, the official enrollment grade. Changing
 *      the official grade still requires the existing human placement
 *      confirmation (PLACEMENT_CONFIRM).
 *
 * Unbound placement items are never mapped by title or difficulty guesswork.
 */
export const PLACEMENT_READINESS_POLICY_VERSION = "placement-readiness-policy/1.0.0" as const;

export type PlacementConceptBinding = Readonly<{
  /** Placement item-bank key or AI item identity version, as stored server-side. */
  placementItemKey: string;
  conceptId: string;
  objectiveId: string;
  /** Who approved this mapping; unbound items stay subject-level only. */
  approvedBy: string;
}>;

export type ScoredPlacementResponse = Readonly<{
  placementItemKey: string;
  itemVersion: string;
  difficulty: number;
  isCorrect: boolean;
  answeredAt: string;
}>;

export type PlacementEvidenceResult = Readonly<{
  policyVersion: typeof PLACEMENT_READINESS_POLICY_VERSION;
  evidence: readonly GovernedEvidence[];
  unboundItemKeys: readonly string[];
}>;

export function placementToGovernedEvidence(input: {
  placementSessionId: string;
  tenantId: string;
  schoolId: string;
  learner: Readonly<{ studentId: string; studentUserId: string }>;
  release: CurriculumOntologyRelease;
  bindings: readonly PlacementConceptBinding[];
  responses: readonly ScoredPlacementResponse[];
}): PlacementEvidenceResult {
  validateOntologyRelease(input.release);
  if (!input.placementSessionId.trim()) throw new Error("placement_session_required");
  const identity = deterministicReleaseIdentity(input.release);
  const byKey = new Map<string, PlacementConceptBinding>();
  for (const binding of input.bindings) {
    if (!input.release.concepts.some((concept) => concept.id === binding.conceptId)) throw new Error("placement_binding_concept_not_released");
    if (!binding.approvedBy.trim()) throw new Error("placement_binding_approval_required");
    if (byKey.has(binding.placementItemKey)) throw new Error("placement_binding_duplicate");
    byKey.set(binding.placementItemKey, binding);
  }
  const unbound = new Set<string>();
  const evidence: GovernedEvidence[] = [];
  for (const response of input.responses) {
    const binding = byKey.get(response.placementItemKey);
    if (!binding) { unbound.add(response.placementItemKey); continue; }
    const id = `placement:${input.placementSessionId}:${response.placementItemKey}@${response.itemVersion}`;
    evidence.push(createGovernedEvidence({
      evidenceId: id,
      idempotencyKey: id,
      attemptId: input.placementSessionId,
      tenantId: input.tenantId,
      schoolId: input.schoolId,
      learner: input.learner,
      objective: { conceptId: binding.conceptId, objectiveId: binding.objectiveId },
      activity: { activityId: `placement-item:${response.placementItemKey}`, activityVersion: response.itemVersion },
      evidenceType: "DIAGNOSTIC",
      modality: "INTERACTIVE",
      occurredAt: response.answeredAt,
      performance: {
        outcome: response.isCorrect ? "CORRECT" : "INCORRECT",
        score: null, maxScore: null, correct: response.isCorrect, signals: [],
        payload: { placementDifficulty: response.difficulty },
      },
      provenance: {
        source: "SYSTEM", actorId: null, actorRole: "SYSTEM", runtime: "WEB",
        recordedAt: response.answeredAt, clientEventId: null, syncBatchId: null,
      },
      strength: {
        serverScored: true, humanVerified: false, assistanceUsed: false, retryCount: 0, hintCount: 0,
        // One placement sitting is one occasion, however many items it holds.
        independenceKey: `placement:${input.placementSessionId}`,
        directness: "INDIRECT",
        reliability: "UNASSESSED",
        policyRef: PLACEMENT_READINESS_POLICY_VERSION,
      },
      offline: { isOffline: false, syncIdentity: null },
      curriculum: { ontologyReleaseId: input.release.id, ontologyReleaseIdentity: identity },
    }));
  }
  return Object.freeze({
    policyVersion: PLACEMENT_READINESS_POLICY_VERSION,
    evidence: Object.freeze(evidence),
    unboundItemKeys: Object.freeze([...unbound].sort()),
  });
}

export type CompetencyReadiness = "READY_AT_GRADE" | "PREREQUISITE_GAP" | "NOT_YET_EVIDENCED" | "EXTENSION_READY" | "NEEDS_PRACTICE";

export type InstructionalReadiness = Readonly<{
  policyVersion: typeof PLACEMENT_READINESS_POLICY_VERSION;
  enrollment: Readonly<{ grade: number; source: "STUDENT_RECORD"; changedByReadiness: false }>;
  subject: Readonly<{
    subject: string;
    releaseGrade: number;
    /** Placement estimate, if any; descriptive only. */
    placementIndicatedGrade: number | null;
    placementConfidence: "high" | "medium" | "low" | null;
    relationToEnrollment: "BELOW" | "AT" | "ABOVE" | "UNKNOWN";
    calibrationStage: CalibrationStage;
  }>;
  competencies: readonly Readonly<{ conceptId: string; readiness: CompetencyReadiness; reasons: readonly string[] }>[];
  officialGradeChange: "REQUIRES_HUMAN_PLACEMENT_CONFIRMATION";
  authority: Readonly<{ mayChangeAdministrativeGrade: false; mayWriteCanonicalMastery: false }>;
}>;

export function deriveInstructionalReadiness(input: {
  enrollmentGrade: number;
  calibration: LearnerCalibration;
  estimates: readonly CompetencyEstimate[];
  placement?: Readonly<{ recommendedGrade: number; confidence: "high" | "medium" | "low" }> | null;
}): InstructionalReadiness {
  if (input.calibration.enrollment.grade !== input.enrollmentGrade) throw new Error("readiness_enrollment_grade_mismatch");
  const placement = input.placement ?? null;
  const relation = placement === null ? "UNKNOWN" as const
    : placement.recommendedGrade < input.enrollmentGrade ? "BELOW" as const
      : placement.recommendedGrade > input.enrollmentGrade ? "ABOVE" as const : "AT" as const;
  const competencies = input.estimates.map((estimate) => {
    const reasons: string[] = [];
    let readiness: CompetencyReadiness;
    if (estimate.prerequisite.status === "UNMET") {
      readiness = "PREREQUISITE_GAP"; reasons.push(...estimate.prerequisite.unmetConceptIds.map((id) => `UNMET_PREREQUISITE:${id}`));
    } else if (estimate.mastery.estimate === null || estimate.sufficiency.level === "NONE") {
      readiness = "NOT_YET_EVIDENCED"; reasons.push("NO_CANONICAL_MASTERY_ESTIMATE");
    } else if (estimate.mastery.level === "SECURE" && estimate.sufficiency.level === "SUFFICIENT" && estimate.misconception.state === "NONE") {
      readiness = "EXTENSION_READY"; reasons.push("SECURE_WITH_SUFFICIENT_EVIDENCE");
    } else if (estimate.mastery.level === "EMERGING") {
      readiness = "NEEDS_PRACTICE"; reasons.push("EMERGING_MASTERY");
    } else {
      readiness = "READY_AT_GRADE"; reasons.push("GRADE_LEVEL_INSTRUCTION");
    }
    if (estimate.sufficiency.level !== "SUFFICIENT") reasons.push(`SUFFICIENCY_${estimate.sufficiency.level}`);
    return Object.freeze({ conceptId: estimate.conceptId, readiness, reasons: Object.freeze(reasons) });
  });
  return Object.freeze({
    policyVersion: PLACEMENT_READINESS_POLICY_VERSION,
    enrollment: Object.freeze({ grade: input.enrollmentGrade, source: "STUDENT_RECORD" as const, changedByReadiness: false as const }),
    subject: Object.freeze({
      subject: input.calibration.scope.subject,
      releaseGrade: input.calibration.scope.releaseGrade,
      placementIndicatedGrade: placement?.recommendedGrade ?? null,
      placementConfidence: placement?.confidence ?? null,
      relationToEnrollment: relation,
      calibrationStage: input.calibration.stage,
    }),
    competencies: Object.freeze(competencies),
    officialGradeChange: "REQUIRES_HUMAN_PLACEMENT_CONFIRMATION" as const,
    authority: Object.freeze({ mayChangeAdministrativeGrade: false as const, mayWriteCanonicalMastery: false as const }),
  });
}
