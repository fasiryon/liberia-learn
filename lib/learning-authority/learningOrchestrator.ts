import { createHash } from "crypto";
import {
  deterministicReleaseIdentity, validateOntologyRelease,
  type CurriculumOntologyRelease, type ToolKey,
} from "@/lib/learning-authority/governedGrade4Math";
import { compatibilityRelease } from "@/lib/learning-authority/compatibilityRelease";
import {
  toDecisionModelLearnerState, type StudentConceptState, type DecisionModelLearnerState,
  type DecisionModel, type DecisionModelInput, type DecisionModelOutput,
} from "@/lib/learning-state/studentLearningModel";

export type { DecisionModel, DecisionModelInput, DecisionModelOutput } from "@/lib/learning-state/studentLearningModel";

export const LEARNING_DECISION_POLICY_VERSION = "learning-decision-policy/1.0.0" as const;
export type LearningAction = DecisionModelLearnerState["validCandidateActions"][number];
export type RankedCandidate = Readonly<{ id: string; probability: number }>;
export type TeacherOverride = Readonly<{
  candidateId: string;
  actorId: string;
  role: "TEACHER" | "ADMIN";
  reason: string;
}>;
export type LearningRecommendation = Readonly<{
  id: string;
  candidateId: string;
  rankedCandidates: readonly RankedCandidate[];
  modelId: string;
  modelConfidence: number;
  fallbackReason: string | null;
  shadowOutput: DecisionModelOutput | null;
  learnerStateRevision: string;
  ontologyReleaseIdentity: string;
}>;
export type LearningPolicyResolution = Readonly<{
  id: string;
  recommendationId: string;
  selectedCandidateId: string;
  reason: string;
  teacherOverride: TeacherOverride | null;
  policyVersion: typeof LEARNING_DECISION_POLICY_VERSION;
  eligibleCandidateIds: readonly string[];
}>;
export type LearningDecision = Readonly<{
  id: string;
  recommendationId: string;
  resolutionId: string;
  action: LearningAction;
  learnerStateRevision: string;
  ontologyReleaseId: string;
  ontologyReleaseIdentity: string;
  effectiveAuthority: "GOVERNED_LEARNING_ORCHESTRATOR";
  mayWriteCanonicalMastery: false;
  mayChangeAdministrativeGrade: false;
}>;

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function learnerStateRevision(states: readonly StudentConceptState[], release = compatibilityRelease()): string {
  const expected = new Set(release.concepts.map((concept) => concept.id));
  if (states.length !== expected.size) throw new Error("learner_state_incomplete");
  const identity = deterministicReleaseIdentity(release);
  for (const state of states) {
    if (!expected.delete(state.scope.conceptId) || state.scope.ontologyReleaseId !== release.id ||
      state.scope.ontologyReleaseIdentity !== identity || !state.authority.canonical) throw new Error("learner_state_scope_invalid");
    if (state.scope.schoolId !== states[0].scope.schoolId || state.scope.studentId !== states[0].scope.studentId ||
      state.scope.studentUserId !== states[0].scope.studentUserId) throw new Error("learner_state_identity_mismatch");
  }
  return digest(states.map((state) => ({ conceptId: state.scope.conceptId,
    reducerVersion: state.reducerVersion, eventCount: state.replay.eventCount, inputDigest: state.replay.inputDigest,
  })).sort((a, b) => a.conceptId.localeCompare(b.conceptId)));
}

export function generateLearningCandidates(input: {
  states: readonly StudentConceptState[];
  release?: CurriculumOntologyRelease;
  prohibitedTools?: readonly ToolKey[];
}): readonly LearningAction[] {
  const release = input.release ?? compatibilityRelease();
  validateOntologyRelease(release);
  learnerStateRevision(input.states, release);
  const byConcept = new Map(input.states.map((state) => [state.scope.conceptId, state]));
  const candidates: LearningAction[] = [];
  for (const binding of release.bindings) {
    const item = release.items.find((entry) => entry.id === binding.itemId && entry.version === binding.itemVersion);
    const toolPolicy = release.toolPolicies.find((entry) => entry.id === binding.toolPolicyId);
    if (!item || !toolPolicy || toolPolicy.context !== item.context ||
      (input.prohibitedTools ?? []).some((tool) => toolPolicy.allowed.includes(tool))) continue;
    const prerequisites = release.prerequisites.filter((edge) => edge.toConceptId === binding.conceptId);
    if (prerequisites.some((edge) => {
      const prior = byConcept.get(edge.fromConceptId);
      return !prior || prior.mastery.observedScore === null || prior.mastery.observedScore < 0.8;
    })) continue;
    candidates.push(Object.freeze({
      id: `${binding.id}:${item.context.toLowerCase()}`,
      conceptId: binding.conceptId, itemId: item.id, kind: item.context,
      reason: prerequisites.length
        ? "Prior governed observation permits provisional progression; mastery is not certified."
        : "Published grade-level entry action.",
    }));
  }
  return Object.freeze(candidates.sort((a, b) => a.id.localeCompare(b.id)));
}

/** Read-only offline pack fallback when no trusted learner-state snapshot is available. */
export function offlineCurriculumFallback(release: CurriculumOntologyRelease): LearningAction {
  validateOntologyRelease(release);
  const entry = release.bindings.find((binding) =>
    !release.prerequisites.some((edge) => edge.toConceptId === binding.conceptId) &&
    release.items.some((item) => item.id === binding.itemId && item.version === binding.itemVersion && item.context === "DIAGNOSTIC") &&
    release.toolPolicies.some((policy) => policy.id === binding.toolPolicyId && policy.context === "DIAGNOSTIC"));
  if (!entry) throw new Error("offline_entry_unavailable");
  return Object.freeze({ id: `${entry.id}:diagnostic`, conceptId: entry.conceptId,
    itemId: entry.itemId, kind: "DIAGNOSTIC", reason: "Published grade-level offline entry action." });
}

export function offlineGrade4CurriculumFallback(): LearningAction {
  return offlineCurriculumFallback(compatibilityRelease());
}

export const deterministicDecisionModel: DecisionModel = Object.freeze({
  id: "deterministic-learning-v1",
  async rank(input: DecisionModelInput): Promise<DecisionModelOutput> {
    const state = new Map(input.authoritativeState.map((entry) => [entry.authoritativeLearnerState.scope.conceptId, entry.authoritativeLearnerState]));
    const ordered = [...input.candidates].sort((a, b) => {
      const score = (candidate: LearningAction) => {
        const concept = state.get(candidate.conceptId);
        if (!concept || concept.confidence.level === "NONE") return candidate.kind === "DIAGNOSTIC" ? 100 : 85;
        if (concept.conflict.present) return candidate.kind === "DIAGNOSTIC" ? 95 : 65;
        if (concept.confidence.level === "LOW") return candidate.kind === "DIAGNOSTIC" ? 60 : 75;
        if (concept.retention.status === "AT_RISK" || concept.retention.status === "DUE") return candidate.kind === "PRACTICE" ? 90 : 80;
        return candidate.kind === "PRACTICE" ? 70 : 60;
      };
      return score(b) - score(a) || a.id.localeCompare(b.id);
    });
    const total = ordered.reduce((sum, _, index) => sum + 1 / (index + 1), 0);
    return { modelId: this.id, rankedCandidates: ordered.map((candidate, index) => ({ id: candidate.id, probability: (1 / (index + 1)) / total })), confidence: 1 };
  },
});

function validOutput(output: DecisionModelOutput, candidates: readonly LearningAction[]): boolean {
  const ids = new Set(candidates.map((candidate) => candidate.id));
  const seen = new Set<string>();
  return !!output.modelId && Number.isFinite(output.confidence) && output.confidence >= 0 && output.confidence <= 1 &&
    output.rankedCandidates.length > 0 && output.rankedCandidates[0].probability > 0 &&
    output.rankedCandidates.every((entry, index) => {
      if (!ids.has(entry.id) || seen.has(entry.id) || !Number.isFinite(entry.probability) || entry.probability < 0 || entry.probability > 1) return false;
      if (index > 0 && entry.probability > output.rankedCandidates[index - 1].probability) return false;
      seen.add(entry.id);
      return true;
    });
}

export async function resolveLearningDecision(input: {
  states: readonly StudentConceptState[];
  currentRevision: () => Promise<string>;
  release?: CurriculumOntologyRelease;
  model?: DecisionModel;
  shadowModel?: DecisionModel;
  teacherOverride?: TeacherOverride;
  offline?: boolean;
  prohibitedTools?: readonly ToolKey[];
  idempotencyKey: string;
}): Promise<{ recommendation: LearningRecommendation; resolution: LearningPolicyResolution; decision: LearningDecision }> {
  const release = input.release ?? compatibilityRelease();
  const revision = learnerStateRevision(input.states, release);
  const candidates = generateLearningCandidates(input);
  if (!candidates.length) throw new Error("no_governed_learning_action");
  const identity = deterministicReleaseIdentity(release);
  const handoffs = input.states.map((state) => toDecisionModelLearnerState(state, candidates));
  const modelInput: DecisionModelInput = { contractVersion: "decision-model-input/1.0.0", authoritativeState: handoffs,
    candidates, learnerStateRevision: revision, ontologyReleaseIdentity: identity };
  const baseline = await deterministicDecisionModel.rank(modelInput);
  let output = baseline;
  let fallbackReason: string | null = input.offline ? "OFFLINE_GOVERNED_BASELINE" : null;
  if (!input.offline && input.model && input.model.id !== deterministicDecisionModel.id) {
    try {
      const proposed = await input.model.rank(modelInput);
      if (!validOutput(proposed, candidates) || proposed.confidence < 0.5) throw new Error("model_output_invalid_or_uncertain");
      output = proposed;
    } catch { fallbackReason = "MODEL_UNAVAILABLE_OR_INVALID"; }
  }
  let shadowOutput: DecisionModelOutput | null = null;
  if (!input.offline && input.shadowModel) {
    try {
      const proposed = await input.shadowModel.rank(modelInput);
      if (validOutput(proposed, candidates)) shadowOutput = proposed;
    } catch { /* Shadow execution cannot block instruction. */ }
  }
  if (!validOutput(output, candidates)) throw new Error("baseline_model_invalid");
  const selected = input.teacherOverride?.candidateId ?? output.rankedCandidates[0].id;
  if (input.teacherOverride && (!input.teacherOverride.actorId || !input.teacherOverride.reason.trim() ||
    !["TEACHER", "ADMIN"].includes(input.teacherOverride.role))) throw new Error("teacher_override_authority_invalid");
  const action = candidates.find((candidate) => candidate.id === selected);
  if (!action) throw new Error("decision_candidate_not_governed");
  if (await input.currentRevision() !== revision) throw new Error("learner_state_stale");
  const baseId = digest({ schoolId: input.states[0].scope.schoolId, studentId: input.states[0].scope.studentId,
    revision, identity, idempotencyKey: input.idempotencyKey });
  const recommendation: LearningRecommendation = Object.freeze({ id: `recommendation-${baseId}`, candidateId: output.rankedCandidates[0].id,
    rankedCandidates: output.rankedCandidates, modelId: output.modelId, modelConfidence: output.confidence,
    fallbackReason, shadowOutput, learnerStateRevision: revision, ontologyReleaseIdentity: identity });
  const resolution: LearningPolicyResolution = Object.freeze({ id: `resolution-${baseId}`, recommendationId: recommendation.id,
    selectedCandidateId: action.id, reason: input.teacherOverride ? "AUTHORIZED_TEACHER_OVERRIDE" : "GOVERNED_RANKING_ACCEPTED",
    teacherOverride: input.teacherOverride ?? null, policyVersion: LEARNING_DECISION_POLICY_VERSION,
    eligibleCandidateIds: candidates.map((candidate) => candidate.id) });
  const decision: LearningDecision = Object.freeze({ id: `decision-${baseId}`, recommendationId: recommendation.id,
    resolutionId: resolution.id, action, learnerStateRevision: revision, ontologyReleaseId: release.id,
    ontologyReleaseIdentity: identity, effectiveAuthority: "GOVERNED_LEARNING_ORCHESTRATOR",
    mayWriteCanonicalMastery: false, mayChangeAdministrativeGrade: false });
  return { recommendation, resolution, decision };
}
