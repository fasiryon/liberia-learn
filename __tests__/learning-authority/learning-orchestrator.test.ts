import { describe, expect, it, vi } from "vitest";
import { GRADE4_MATH_ONTOLOGY_RELEASE, deterministicReleaseIdentity } from "@/lib/learning-authority/governedGrade4Math";
import { generateLearningCandidates, learnerStateRevision, offlineGrade4CurriculumFallback, resolveLearningDecision, type DecisionModel } from "@/lib/learning-authority/learningOrchestrator";
import { replayStudentConceptState, MASTERY_REDUCER_VERSION, type GovernedMasteryEvidence } from "@/lib/learning-state/studentLearningModel";
import { MISCONCEPTION_SIGNAL_POLICY_VERSION } from "@/lib/learning-state/misconceptionPolicy";

const release = GRADE4_MATH_ONTOLOGY_RELEASE;
const identity = deterministicReleaseIdentity(release);
const asOf = "2026-09-21T12:00:00.000Z";
const bindings = release.bindings;

function states(correctConcepts: readonly string[] = [], schoolId = "school-a") {
  return release.concepts.map((concept) => {
    const scope = { schoolId, studentId: "student-a", studentUserId: "user-a", conceptId: concept.id,
      ontologyReleaseId: release.id, ontologyReleaseIdentity: identity };
    const binding = bindings.find((entry) => entry.conceptId === concept.id)!;
    const item = release.items.find((entry) => entry.id === binding.itemId)!;
    const events: GovernedMasteryEvidence[] = correctConcepts.includes(concept.id) ? [{
      type: "GOVERNED_EVIDENCE", schemaVersion: 1, reducerVersion: MASTERY_REDUCER_VERSION,
      evidenceId: `evidence-${concept.id}`, scope, bindingId: binding.id, itemId: item.id, itemVersion: item.version,
      evidencePolicyVersion: "1.0.0", toolPolicyVersion: "1.0.0", context: item.context,
      result: "CORRECT", selectedAnswerIndex: item.correctIndex, independenceKey: `session-${concept.id}`,
      occurredAt: "2026-09-20T12:00:00.000Z", serverScored: true, admissionDecision: "ACCEPTED",
      authority: "SERVER_GOVERNED_EVIDENCE_GATEWAY", retentionProbe: false, misconceptionSignalId: null,
      misconceptionPolicyVersion: MISCONCEPTION_SIGNAL_POLICY_VERSION,
    }] : [];
    return replayStudentConceptState(events, { asOf, expectedScope: scope });
  });
}

const decide = (s = states(), overrides: Partial<Parameters<typeof resolveLearningDecision>[0]> = {}) =>
  resolveLearningDecision({ states: s, currentRevision: async () => learnerStateRevision(s), idempotencyKey: "request-1", ...overrides });

describe("governed learning orchestrator hostile boundaries", () => {
  it("derives a finite published entry action and blocks unmet prerequisites", () => {
    expect(generateLearningCandidates({ states: states() }).map((candidate) => candidate.itemId))
      .toEqual(["g4-frac-diagnostic-equal-parts"]);
  });

  it("opens the next action only after governed prerequisite evidence", () => {
    const candidates = generateLearningCandidates({ states: states([release.concepts[0].id]) });
    expect(candidates.map((candidate) => candidate.itemId)).toContain("g4-frac-practice-equivalence");
    expect(candidates.map((candidate) => candidate.itemId)).not.toContain("g4-frac-diagnostic-compare");
  });

  it("advances from the completed entry diagnostic to the governed practice action", async () => {
    const result = await decide(states([release.concepts[0].id]));
    expect(result.decision.action.itemId).toBe("g4-frac-practice-equivalence");
  });

  it("rejects unpublished ontology before model invocation", () => {
    expect(() => generateLearningCandidates({ states: states(), release: { ...release, status: "DRAFT" } })).toThrow("ontology_release_not_executable");
  });

  it("rejects mixed tenant learner state", () => {
    const mixed = states(); mixed[1] = states([], "school-b")[1];
    expect(() => learnerStateRevision(mixed)).toThrow("learner_state_identity_mismatch");
  });

  it("keeps the deterministic baseline provider independent and separates three records", async () => {
    const result = await decide();
    expect(result.recommendation.modelId).toBe("deterministic-grade4-v1");
    expect(result.resolution.recommendationId).toBe(result.recommendation.id);
    expect(result.decision.resolutionId).toBe(result.resolution.id);
    expect(result.decision.mayWriteCanonicalMastery).toBe(false);
  });

  it("rejects provider-injected arbitrary candidates and falls back", async () => {
    const model: DecisionModel = { id: "hostile", rank: async () => ({ modelId: "hostile", confidence: 1,
      rankedCandidates: [{ id: "invented-lesson", probability: 1 }] }) };
    const result = await decide(states(), { model });
    expect(result.recommendation.fallbackReason).toBe("MODEL_UNAVAILABLE_OR_INVALID");
    expect(result.decision.action.itemId).toBe("g4-frac-diagnostic-equal-parts");
  });

  it("falls back on low confidence or provider outage", async () => {
    const uncertain: DecisionModel = { id: "uncertain", rank: async (input) => ({ modelId: "uncertain", confidence: 0.2,
      rankedCandidates: [{ id: input.candidates[0].id, probability: 1 }] }) };
    expect((await decide(states(), { model: uncertain })).recommendation.fallbackReason).toBe("MODEL_UNAVAILABLE_OR_INVALID");
    const outage: DecisionModel = { id: "outage", rank: async () => { throw new Error("unavailable"); } };
    expect((await decide(states(), { model: outage })).recommendation.modelId).toBe("deterministic-grade4-v1");
  });

  it("ignores shadow output for the effective decision", async () => {
    const shadow: DecisionModel = { id: "shadow", rank: async (input) => ({ modelId: "shadow", confidence: 1,
      rankedCandidates: [{ id: input.candidates.at(-1)!.id, probability: 1 }] }) };
    const result = await decide(states([release.concepts[0].id]), { shadowModel: shadow });
    expect(result.recommendation.shadowOutput?.modelId).toBe("shadow");
    expect(result.recommendation.modelId).toBe("deterministic-grade4-v1");
  });

  it("fails closed when learner state changes before resolution", async () => {
    await expect(decide(states(), { currentRevision: async () => "new-revision" })).rejects.toThrow("learner_state_stale");
  });

  it("only allows teacher override to select an eligible candidate", async () => {
    const s = states([release.concepts[0].id]);
    const eligible = generateLearningCandidates({ states: s }).find((candidate) => candidate.kind === "PRACTICE")!;
    const chosen = await decide(s, { teacherOverride: { candidateId: eligible.id, actorId: "teacher-a", role: "TEACHER", reason: "Observed need" } });
    expect(chosen.resolution.reason).toBe("AUTHORIZED_TEACHER_OVERRIDE");
    expect(chosen.decision.action.id).toBe(eligible.id);
    await expect(decide(s, { teacherOverride: { candidateId: "invented", actorId: "teacher-a", role: "TEACHER", reason: "No" } }))
      .rejects.toThrow("decision_candidate_not_governed");
  });

  it("provides the published grade-level entry action offline", async () => {
    const unavailable = vi.fn(async () => { throw new Error("network"); });
    const result = await decide(states(), { offline: true, model: { id: "remote", rank: unavailable } });
    expect(unavailable).not.toHaveBeenCalled();
    expect(result.recommendation.fallbackReason).toBe("OFFLINE_GOVERNED_BASELINE");
    expect(result.decision.action.itemId).toBe("g4-frac-diagnostic-equal-parts");
    expect(offlineGrade4CurriculumFallback().itemId).toBe("g4-frac-diagnostic-equal-parts");
  });
});
