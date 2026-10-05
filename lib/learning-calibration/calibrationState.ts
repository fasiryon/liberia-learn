import { createHash } from "crypto";
import {
  deterministicReleaseIdentity, validateOntologyRelease, type CurriculumOntologyRelease,
} from "@/lib/learning-authority/governedGrade4Math";
import { learnerStateRevision } from "@/lib/learning-authority/learningOrchestrator";
import type { StudentConceptState } from "@/lib/learning-state/studentLearningModel";
import { deduplicateGovernedEvidence, type GovernedEvidence } from "@/lib/learning-evidence/evidenceContract";
import {
  assessEvidenceQuality, EVIDENCE_QUALITY_POLICY_V1, type CorroborationClass, type EvidenceQualityAssessment,
} from "@/lib/learning-calibration/evidenceQualityPolicy";
import { buildCompetencyEstimate, type CompetencyEstimate } from "@/lib/learning-calibration/competencyEstimate";

/**
 * Learner calibration lifecycle.
 *
 * Calibration answers "how much does the platform know about this learner in
 * this governed release?" It is derived from evidence sufficiency at an
 * explicit as-of time, never from elapsed calendar days since enrollment. It
 * does not estimate mastery, does not write state, and never changes the
 * official enrollment grade.
 */
export const CALIBRATION_POLICY_VERSION = "learner-calibration-policy/1.0.0" as const;

export type CalibrationStage = "INITIAL" | "PROVISIONAL" | "CALIBRATING" | "STABLE";
export type SufficiencyLevel = "NONE" | "INSUFFICIENT" | "PARTIAL" | "SUFFICIENT";

export type EvidenceSufficiency = Readonly<{
  policyVersion: typeof CALIBRATION_POLICY_VERSION;
  level: SufficiencyLevel;
  effectiveOccasions: number;
  canonicalOccasions: number;
  corroboration: Readonly<Record<CorroborationClass, number>>;
  corroborationAgreement: "AGREES" | "DISAGREES" | "NOT_COMPARABLE";
  corroboratingEvidenceIds: readonly string[];
  reasons: readonly string[];
}>;

export const CALIBRATION_POLICY_V1 = Object.freeze({
  version: CALIBRATION_POLICY_VERSION,
  status: "STARTING_HYPOTHESIS_REQUIRES_EDUCATIONAL_REVIEW" as const,
  /** Distinct-occasion credit for sufficiency counting only (never a grade weight). */
  occasionCredit: Object.freeze({ STRONG: 1, MODERATE: 0.5, WEAK: 0, EXCLUDED: 0 } as const),
  minOccasions: 2,
  sufficientOccasions: 3,
  staleCanonicalDays: 60,
  conflictLimit: 0.5,
  disagreementGap: 0.5,
  stableSufficientShare: 2 / 3,
});

export type CalibrationPolicy = typeof CALIBRATION_POLICY_V1;

export type LearnerCalibration = Readonly<{
  policyVersion: typeof CALIBRATION_POLICY_VERSION;
  id: string;
  asOf: string;
  scope: Readonly<{
    schoolId: string; studentId: string; studentUserId: string;
    ontologyReleaseId: string; ontologyReleaseIdentity: string; subject: string; releaseGrade: number;
  }>;
  /** Official enrollment grade, echoed for display. Calibration can never change it. */
  enrollment: Readonly<{ grade: number; source: "STUDENT_RECORD"; mutableByCalibration: false }>;
  learnerStateRevision: string;
  stage: CalibrationStage;
  sufficientShare: number;
  competencies: readonly Readonly<{ conceptId: string; sufficiency: EvidenceSufficiency }>[];
  reasons: readonly string[];
  authority: Readonly<{
    derivedFromGovernedEvidence: true;
    mayWriteCanonicalMastery: false;
    mayChangeAdministrativeGrade: false;
    deviceMayWrite: false;
    llmMayWrite: false;
  }>;
}>;

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export function assessEvidenceSufficiency(input: {
  state: StudentConceptState;
  corroborating: readonly EvidenceQualityAssessment[];
  policy?: CalibrationPolicy;
}): EvidenceSufficiency {
  const policy = input.policy ?? CALIBRATION_POLICY_V1;
  if (policy.version !== CALIBRATION_POLICY_VERSION) throw new Error("calibration_policy_version_unsupported");
  const { state } = input;
  const canonicalIds = new Set([...state.conflict.positiveEvidenceIds, ...state.conflict.negativeEvidenceIds]);
  const counts: Record<CorroborationClass, number> = { STRONG: 0, MODERATE: 0, WEAK: 0, EXCLUDED: 0 };
  // One credit per independent occasion: the best-classed record for that occasion counts.
  const rank: Record<CorroborationClass, number> = { STRONG: 3, MODERATE: 2, WEAK: 1, EXCLUDED: 0 };
  const byOccasion = new Map<string, EvidenceQualityAssessment>();
  for (const assessment of input.corroborating) {
    if (assessment.conceptId !== state.scope.conceptId) throw new Error("corroborating_evidence_concept_mismatch");
    // Evidence already replayed canonically is never counted twice.
    if (canonicalIds.has(assessment.evidenceId)) continue;
    counts[assessment.corroboration] += 1;
    const prior = byOccasion.get(assessment.independenceKey);
    if (!prior || rank[assessment.corroboration] > rank[prior.corroboration]) byOccasion.set(assessment.independenceKey, assessment);
  }
  const canonicalOccasions = state.confidence.independentOccasions;
  const corroborationCredit = [...byOccasion.values()].reduce((sum, entry) => sum + policy.occasionCredit[entry.corroboration], 0);
  const effectiveOccasions = round(canonicalOccasions + corroborationCredit);
  const usable = [...byOccasion.values()].filter((entry) =>
    (entry.corroboration === "STRONG" || entry.corroboration === "MODERATE") && entry.observedOutcome !== null);
  const corroboratedMean = usable.length
    ? usable.reduce((sum, entry) => sum + (entry.observedOutcome ?? 0), 0) / usable.length : null;
  const agreement = corroboratedMean === null || state.mastery.observedScore === null
    ? "NOT_COMPARABLE" as const
    : Math.abs(corroboratedMean - state.mastery.observedScore) >= policy.disagreementGap ? "DISAGREES" as const : "AGREES" as const;

  const reasons: string[] = [];
  const anyEvidence = canonicalOccasions > 0 || input.corroborating.some((entry) => !canonicalIds.has(entry.evidenceId));
  let level: SufficiencyLevel;
  if (!anyEvidence) {
    level = "NONE"; reasons.push("NO_EVIDENCE");
  } else if (effectiveOccasions < policy.minOccasions) {
    level = "INSUFFICIENT";
    reasons.push(effectiveOccasions === 0 ? "ONLY_WEAK_OR_EXCLUDED_EVIDENCE" : "TOO_FEW_INDEPENDENT_OCCASIONS");
    if (state.recency.ageDays !== null && state.recency.ageDays > policy.staleCanonicalDays) reasons.push("STALE_EVIDENCE");
  } else {
    if (canonicalOccasions === 0) reasons.push("NO_CANONICAL_EVIDENCE");
    if (effectiveOccasions < policy.sufficientOccasions) reasons.push("TOO_FEW_INDEPENDENT_OCCASIONS");
    if (state.recency.ageDays !== null && state.recency.ageDays > policy.staleCanonicalDays) reasons.push("STALE_EVIDENCE");
    if (state.conflict.score >= policy.conflictLimit) reasons.push("CONTRADICTORY_EVIDENCE");
    if (agreement === "DISAGREES") reasons.push("CORROBORATION_DISAGREES");
    level = reasons.length ? "PARTIAL" : "SUFFICIENT";
  }
  return Object.freeze({
    policyVersion: CALIBRATION_POLICY_VERSION,
    level,
    effectiveOccasions,
    canonicalOccasions,
    corroboration: Object.freeze(counts),
    corroborationAgreement: agreement,
    corroboratingEvidenceIds: Object.freeze([...byOccasion.values()].map((entry) => entry.evidenceId).sort()),
    reasons: Object.freeze(reasons),
  });
}

function stageFor(levels: readonly SufficiencyLevel[], policy: CalibrationPolicy): { stage: CalibrationStage; share: number } {
  const share = round(levels.filter((level) => level === "SUFFICIENT").length / levels.length);
  if (levels.every((level) => level === "NONE")) return { stage: "INITIAL", share };
  if (levels.every((level) => level === "NONE" || level === "INSUFFICIENT")) return { stage: "PROVISIONAL", share };
  if (share >= policy.stableSufficientShare - 1e-9) return { stage: "STABLE", share };
  return { stage: "CALIBRATING", share };
}

/**
 * Derive calibration and per-competency estimates for one learner and one
 * published release. `corroboratingEvidence` is governed-contract evidence
 * (homework, labs, teacher records, prior-history imports) that has no
 * canonical mastery adapter; it informs sufficiency only.
 */
export function calibrateLearner(input: {
  states: readonly StudentConceptState[];
  release: CurriculumOntologyRelease;
  enrollmentGrade: number;
  corroboratingEvidence?: readonly GovernedEvidence[];
  asOf: string;
  policy?: CalibrationPolicy;
}): { calibration: LearnerCalibration; estimates: readonly CompetencyEstimate[] } {
  const policy = input.policy ?? CALIBRATION_POLICY_V1;
  validateOntologyRelease(input.release);
  if (!Number.isInteger(input.enrollmentGrade) || input.enrollmentGrade < 1 || input.enrollmentGrade > 12) {
    throw new Error("calibration_enrollment_grade_invalid");
  }
  const revision = learnerStateRevision(input.states, input.release);
  const identity = deterministicReleaseIdentity(input.release);
  const first = input.states[0].scope;
  for (const state of input.states) {
    if (state.asOf !== input.asOf) throw new Error("calibration_state_as_of_mismatch");
  }
  const corroborating = deduplicateGovernedEvidence(input.corroboratingEvidence ?? []);
  const assessments = corroborating.map((evidence) => {
    if (evidence.schoolId !== first.schoolId || evidence.learner.studentId !== first.studentId ||
      evidence.learner.studentUserId !== first.studentUserId) throw new Error("corroborating_evidence_identity_mismatch");
    if (evidence.curriculum.ontologyReleaseId !== input.release.id || evidence.curriculum.ontologyReleaseIdentity !== identity) {
      throw new Error("corroborating_evidence_release_mismatch");
    }
    if (!input.release.concepts.some((concept) => concept.id === evidence.objective.conceptId)) {
      throw new Error("corroborating_evidence_concept_not_released");
    }
    return assessEvidenceQuality(evidence, { asOf: input.asOf, policy: EVIDENCE_QUALITY_POLICY_V1 });
  });
  const byConcept = new Map(input.states.map((state) => [state.scope.conceptId, state]));
  const ordered = [...input.states].sort((a, b) => a.scope.conceptId.localeCompare(b.scope.conceptId));
  const competencies = ordered.map((state) => Object.freeze({
    conceptId: state.scope.conceptId,
    sufficiency: assessEvidenceSufficiency({
      state, policy, corroborating: assessments.filter((entry) => entry.conceptId === state.scope.conceptId),
    }),
  }));
  const { stage, share } = stageFor(competencies.map((entry) => entry.sufficiency.level), policy);
  const reasons: string[] = [];
  if (stage === "INITIAL") reasons.push("NO_GOVERNED_EVIDENCE_YET");
  if (stage === "PROVISIONAL") reasons.push("EVIDENCE_TOO_SPARSE_FOR_PERSONALIZATION");
  if (stage === "CALIBRATING") reasons.push(share > 0 ? "SOME_COMPETENCIES_SUFFICIENT" : "PARTIAL_EVIDENCE_ACCUMULATING");
  if (stage === "STABLE") reasons.push("SUFFICIENT_EVIDENCE_ACROSS_COMPETENCIES");
  if (competencies.some((entry) => entry.sufficiency.reasons.includes("CONTRADICTORY_EVIDENCE"))) reasons.push("CONTRADICTORY_EVIDENCE_PRESENT");
  if (competencies.some((entry) => entry.sufficiency.reasons.includes("STALE_EVIDENCE"))) reasons.push("STALE_EVIDENCE_PRESENT");

  const calibration: LearnerCalibration = Object.freeze({
    policyVersion: CALIBRATION_POLICY_VERSION,
    id: "calibration-" + createHash("sha256").update(JSON.stringify({
      revision, asOf: input.asOf, corroborating: assessments.map((entry) => entry.evidenceId).sort(), policy: policy.version,
    })).digest("hex"),
    asOf: input.asOf,
    scope: Object.freeze({
      schoolId: first.schoolId, studentId: first.studentId, studentUserId: first.studentUserId,
      ontologyReleaseId: input.release.id, ontologyReleaseIdentity: identity,
      subject: input.release.subject, releaseGrade: input.release.grade,
    }),
    enrollment: Object.freeze({ grade: input.enrollmentGrade, source: "STUDENT_RECORD" as const, mutableByCalibration: false as const }),
    learnerStateRevision: revision,
    stage,
    sufficientShare: share,
    competencies: Object.freeze(competencies),
    reasons: Object.freeze(reasons),
    authority: Object.freeze({
      derivedFromGovernedEvidence: true as const,
      mayWriteCanonicalMastery: false as const,
      mayChangeAdministrativeGrade: false as const,
      deviceMayWrite: false as const,
      llmMayWrite: false as const,
    }),
  });
  const estimates = Object.freeze(ordered.map((state) => buildCompetencyEstimate({
    state, byConcept, release: input.release,
    sufficiency: competencies.find((entry) => entry.conceptId === state.scope.conceptId)!.sufficiency,
  })));
  return { calibration, estimates };
}
