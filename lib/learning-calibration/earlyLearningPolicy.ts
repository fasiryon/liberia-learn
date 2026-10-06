import { createHash } from "crypto";
import type { CurriculumOntologyRelease } from "@/lib/learning-authority/governedGrade4Math";
import type { LearningAction, RankedCandidate } from "@/lib/learning-authority/learningOrchestrator";
import { PREREQUISITE_PROGRESSION_THRESHOLD } from "@/lib/learning-authority/progressionPolicy";
import type { StudentConceptState } from "@/lib/learning-state/studentLearningModel";
import type { CalibrationStage, LearnerCalibration } from "@/lib/learning-calibration/calibrationState";

/**
 * Early-calibration learning policy (configurable, versioned).
 *
 * Starting hypothesis only: while evidence is thin, most actions stay at grade
 * level, some target prerequisite remediation, and some seek evidence. As
 * evidence sufficiency improves, a growing share of decisions defers to the
 * DecisionModel ranking ("personalized"). The mix is data, not code, and is
 * explicitly not a permanent 70/20/10 rule.
 *
 * The policy runs inside the Learning Orchestrator's existing policy
 * resolution step. It only chooses among server-generated, governed candidates
 * the DecisionModel already ranked; it cannot add candidates, write mastery,
 * or change the official grade.
 */
export const EARLY_LEARNING_POLICY_VERSION = "early-learning-policy/1.0.0" as const;

export type ActionCategory = "GRADE_LEVEL" | "PREREQUISITE_REMEDIATION" | "EVIDENCE_SEEKING";
export type AppliedCategory = ActionCategory | "PERSONALIZED";

export type StageMix = Readonly<{
  mix: Readonly<Record<ActionCategory, number>>;
  /** Upper bound on the share of decisions deferred to the DecisionModel ranking. */
  maxPersonalization: number;
}>;

export type EarlyLearningPolicy = Readonly<{
  version: typeof EARLY_LEARNING_POLICY_VERSION;
  status: "STARTING_HYPOTHESIS_REQUIRES_EDUCATIONAL_REVIEW";
  stages: Readonly<Record<CalibrationStage, StageMix>>;
  categoryFallbackOrder: readonly ActionCategory[];
}>;

export const EARLY_LEARNING_POLICY_V1: EarlyLearningPolicy = Object.freeze({
  version: EARLY_LEARNING_POLICY_VERSION,
  status: "STARTING_HYPOTHESIS_REQUIRES_EDUCATIONAL_REVIEW",
  stages: Object.freeze({
    INITIAL: Object.freeze({ mix: Object.freeze({ GRADE_LEVEL: 0.3, PREREQUISITE_REMEDIATION: 0.1, EVIDENCE_SEEKING: 0.6 }), maxPersonalization: 0 }),
    PROVISIONAL: Object.freeze({ mix: Object.freeze({ GRADE_LEVEL: 0.7, PREREQUISITE_REMEDIATION: 0.2, EVIDENCE_SEEKING: 0.1 }), maxPersonalization: 0.25 }),
    CALIBRATING: Object.freeze({ mix: Object.freeze({ GRADE_LEVEL: 0.7, PREREQUISITE_REMEDIATION: 0.2, EVIDENCE_SEEKING: 0.1 }), maxPersonalization: 0.75 }),
    STABLE: Object.freeze({ mix: Object.freeze({ GRADE_LEVEL: 0.6, PREREQUISITE_REMEDIATION: 0.3, EVIDENCE_SEEKING: 0.1 }), maxPersonalization: 1 }),
  }),
  categoryFallbackOrder: Object.freeze(["GRADE_LEVEL", "PREREQUISITE_REMEDIATION", "EVIDENCE_SEEKING"] as const),
});

export type EarlyLearningResolution = Readonly<{
  policyVersion: typeof EARLY_LEARNING_POLICY_VERSION;
  calibrationId: string;
  stage: CalibrationStage;
  personalizationShare: number;
  draw: number;
  intendedCategory: AppliedCategory;
  appliedCategory: AppliedCategory;
  selectedCandidateId: string;
  candidateCategories: readonly Readonly<{ candidateId: string; category: ActionCategory }>[];
}>;

export function validateEarlyLearningPolicy(policy: EarlyLearningPolicy): void {
  if (policy.version !== EARLY_LEARNING_POLICY_VERSION) throw new Error("early_learning_policy_version_unsupported");
  for (const stage of ["INITIAL", "PROVISIONAL", "CALIBRATING", "STABLE"] as const) {
    const entry = policy.stages[stage];
    if (!entry) throw new Error("early_learning_policy_stage_missing");
    const values = Object.values(entry.mix);
    if (values.some((value) => !Number.isFinite(value) || value < 0) ||
      Math.abs(values.reduce((sum, value) => sum + value, 0) - 1) > 1e-9) throw new Error("early_learning_policy_mix_invalid");
    if (!Number.isFinite(entry.maxPersonalization) || entry.maxPersonalization < 0 || entry.maxPersonalization > 1) {
      throw new Error("early_learning_policy_personalization_invalid");
    }
  }
}

export function classifyCandidate(input: {
  candidate: LearningAction;
  calibration: LearnerCalibration;
  byConcept: ReadonlyMap<string, StudentConceptState>;
  release: CurriculumOntologyRelease;
}): ActionCategory {
  const sufficiency = input.calibration.competencies.find((entry) => entry.conceptId === input.candidate.conceptId)?.sufficiency.level;
  if (input.candidate.kind === "DIAGNOSTIC" && (sufficiency === "NONE" || sufficiency === "INSUFFICIENT")) return "EVIDENCE_SEEKING";
  const isPrerequisite = input.release.prerequisites.some((edge) => edge.fromConceptId === input.candidate.conceptId);
  const score = input.byConcept.get(input.candidate.conceptId)?.mastery.observedScore ?? null;
  if (isPrerequisite && score !== null && score < PREREQUISITE_PROGRESSION_THRESHOLD) return "PREREQUISITE_REMEDIATION";
  return "GRADE_LEVEL";
}

function unitDraw(seed: unknown): number {
  const hex = createHash("sha256").update(JSON.stringify(seed)).digest("hex").slice(0, 13);
  return parseInt(hex, 16) / 2 ** 52;
}

/**
 * Choose among ranked governed candidates. Deterministic for a given learner
 * revision and idempotency key, so replays and retries resolve identically.
 */
export function applyEarlyLearningPolicy(input: {
  calibration: LearnerCalibration;
  states: readonly StudentConceptState[];
  release: CurriculumOntologyRelease;
  candidates: readonly LearningAction[];
  ranked: readonly RankedCandidate[];
  learnerStateRevision: string;
  /** calibrationInputRevision over the current canonical states, corroborating evidence and as-of time. */
  calibrationInputRevision: string;
  idempotencyKey: string;
  policy?: EarlyLearningPolicy;
}): EarlyLearningResolution {
  const policy = input.policy ?? EARLY_LEARNING_POLICY_V1;
  validateEarlyLearningPolicy(policy);
  if (input.calibration.learnerStateRevision !== input.learnerStateRevision) throw new Error("calibration_state_stale");
  // The canonical revision misses corroborating-evidence and as-of changes; the input revision covers them.
  if (input.calibration.inputRevision !== input.calibrationInputRevision) throw new Error("calibration_inputs_stale");
  if (input.calibration.scope.ontologyReleaseId !== input.release.id) throw new Error("calibration_release_mismatch");
  // Revisions of learners with no evidence can coincide, so identity is checked explicitly.
  const learner = input.states[0]?.scope;
  if (!learner || input.calibration.scope.schoolId !== learner.schoolId || input.calibration.scope.studentId !== learner.studentId ||
    input.calibration.scope.studentUserId !== learner.studentUserId) throw new Error("calibration_learner_mismatch");
  if (!input.ranked.length) throw new Error("early_learning_requires_ranked_candidates");
  const byConcept = new Map(input.states.map((state) => [state.scope.conceptId, state]));
  const categories = new Map(input.candidates.map((candidate) => [candidate.id, classifyCandidate({
    candidate, calibration: input.calibration, byConcept, release: input.release,
  })]));
  const stage = policy.stages[input.calibration.stage];
  const personalizationShare = Math.min(stage.maxPersonalization, input.calibration.sufficientShare);
  const draw = unitDraw({ revision: input.learnerStateRevision, key: input.idempotencyKey, policy: policy.version });
  const topRanked = input.ranked[0].id;

  let intended: AppliedCategory = "PERSONALIZED";
  if (draw >= personalizationShare) {
    const scaled = personalizationShare >= 1 ? 0 : (draw - personalizationShare) / (1 - personalizationShare);
    let cumulative = 0;
    intended = policy.categoryFallbackOrder[policy.categoryFallbackOrder.length - 1];
    for (const category of policy.categoryFallbackOrder) {
      cumulative += stage.mix[category];
      if (scaled < cumulative) { intended = category; break; }
    }
  }
  let applied: AppliedCategory = intended;
  let selected = topRanked;
  if (intended !== "PERSONALIZED") {
    const order = [intended, ...policy.categoryFallbackOrder.filter((category) => category !== intended)];
    const hit = order.map((category) => ({
      category, id: input.ranked.find((entry) => categories.get(entry.id) === category)?.id,
    })).find((entry) => entry.id !== undefined);
    if (hit?.id) { applied = hit.category; selected = hit.id; } else { applied = "PERSONALIZED"; }
  }
  return Object.freeze({
    policyVersion: EARLY_LEARNING_POLICY_VERSION,
    calibrationId: input.calibration.id,
    stage: input.calibration.stage,
    personalizationShare: Math.round(personalizationShare * 10_000) / 10_000,
    draw: Math.round(draw * 1_000_000) / 1_000_000,
    intendedCategory: intended,
    appliedCategory: applied,
    selectedCandidateId: selected,
    candidateCategories: Object.freeze([...categories.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([candidateId, category]) => Object.freeze({ candidateId, category }))),
  });
}
