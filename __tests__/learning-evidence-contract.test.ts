import { describe, expect, it } from "vitest";
import { GRADE4_MATH_ONTOLOGY_RELEASE, deterministicReleaseIdentity } from "@/lib/learning-authority/governedGrade4Math";
import { generateLearningCandidates, learnerStateRevision, resolveLearningDecision } from "@/lib/learning-authority/learningOrchestrator";
import { createGovernedEvidence, deduplicateGovernedEvidence, toCanonicalMasteryEvidence } from "@/lib/learning-evidence/evidenceContract";
import { replayStudentConceptState } from "@/lib/learning-state/studentLearningModel";

const release = GRADE4_MATH_ONTOLOGY_RELEASE;
const identity = deterministicReleaseIdentity(release);
const asOf = "2026-09-21T12:00:00.000Z";

function scope(conceptId: string) {
  return { schoolId: "school-fixture", studentId: "student-fixture", studentUserId: "user-fixture", conceptId, ontologyReleaseId: release.id, ontologyReleaseIdentity: identity };
}

function evidence() {
  const binding = release.bindings[0];
  const item = release.items.find((candidate) => candidate.id === binding.itemId)!;
  return createGovernedEvidence({
    evidenceId: "ev-fixture-1", idempotencyKey: "offline-attempt-1", attemptId: "attempt-1",
    tenantId: "tenant-fixture", schoolId: "school-fixture",
    learner: { studentId: "student-fixture", studentUserId: "user-fixture" },
    objective: { conceptId: binding.conceptId, objectiveId: "LR-MATH-G4_6-02" },
    activity: { activityId: item.id, activityVersion: item.version }, evidenceType: "DIAGNOSTIC",
    modality: "OFFLINE_PACKET", occurredAt: "2026-09-20T12:00:00.000Z",
    performance: { outcome: "CORRECT", score: 1, maxScore: 1, correct: true, selectedAnswerIndex: item.correctIndex, signals: [], payload: { prediction: "equal parts" } },
    provenance: { source: "OFFLINE", actorId: "user-fixture", actorRole: "STUDENT", runtime: "SYNC", recordedAt: asOf, clientEventId: "client-1", syncBatchId: "sync-1" },
    strength: { serverScored: true, humanVerified: false, assistanceUsed: false, retryCount: 0, hintCount: 0, independenceKey: "attempt-1", directness: "DIRECT", reliability: "VERIFIED", policyRef: "fixture" },
    offline: { isOffline: true, syncIdentity: "sync-1" }, curriculum: { ontologyReleaseId: release.id, ontologyReleaseIdentity: identity },
  });
}

describe("governed adaptive intelligence contract", () => {
  it("proves objective -> activity -> evidence -> SLM -> DecisionModel -> next action", async () => {
    const canonical = toCanonicalMasteryEvidence(evidence(), release);
    const states = release.concepts.map((concept) => replayStudentConceptState(
      concept.id === release.concepts[0].id ? [canonical] : [], { asOf, expectedScope: scope(concept.id) },
    ));
    const result = await resolveLearningDecision({ states, currentRevision: async () => learnerStateRevision(states), idempotencyKey: "proof-1" });
    expect(canonical.scope.conceptId).toBe(release.concepts[0].id);
    expect(result.decision.status).toBe("SELECTED");
    expect(result.decision.action?.id).toBe("g4-frac-bind-equivalence-v1:practice");
    expect(result.decision.mayWriteCanonicalMastery).toBe(false);
  });

  it("supports lab evidence without a special-case mastery write", () => {
    const lab = createGovernedEvidence({ ...evidence(), evidenceId: "lab-1", idempotencyKey: "lab-attempt-1", attemptId: "lab-attempt-1", evidenceType: "LAB", modality: "LAB_RUNTIME", performance: { outcome: "OBSERVED", score: null, maxScore: null, correct: null, signals: [{ code: "aperture_focus_confusion", value: "CORRECTED" }], payload: { stateManipulated: "focus-distance", finalExplanation: "sharp plane" } }, offline: { isOffline: false, syncIdentity: null } });
    expect(() => toCanonicalMasteryEvidence(lab, release)).toThrow("evidence_mastery_adapter_not_available");
    expect(lab.canonicalMasteryMutation).toBe(false);
  });

  it("rejects conflicting duplicate/offline replay identities and unsafe tenant payloads", () => {
    expect(deduplicateGovernedEvidence([evidence(), evidence()])).toHaveLength(1);
    expect(() => deduplicateGovernedEvidence([evidence(), { ...evidence(), evidenceId: "different" }])).toThrow("evidence_idempotency_conflict");
    const otherSchool = createGovernedEvidence({ ...evidence(), idempotencyKey: "other-school-attempt", schoolId: "school-other" });
    expect(otherSchool.schoolId).toBe("school-other");
  });

  it("fails safely when governed inventory has no eligible candidate", async () => {
    const states = release.concepts.map((concept) => replayStudentConceptState([], { asOf, expectedScope: scope(concept.id) }));
    const result = await resolveLearningDecision({ states, availableCandidateIds: [], currentRevision: async () => learnerStateRevision(states), idempotencyKey: "no-resource" });
    expect(result.decision.status).toBe("NO_VALID_RESOURCE");
    expect(result.decision.action).toBeNull();
    expect(result.recommendation.fallbackReason).toBe("NO_VALID_RESOURCE");
  });
});
