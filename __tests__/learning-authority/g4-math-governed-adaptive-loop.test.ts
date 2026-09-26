/**
 * Real Grade 4 Math adaptive-loop proof.
 *
 * Uses the real governed inventory (template cell x published release 2026.1)
 * and the real structured MOE source, not the compatibility fixture:
 *
 *   MOE objective -> governed lesson -> diagnostic -> learner response
 *   -> admitted evidence -> SLM replay -> DecisionModel -> next governed action
 *   -> teacher-visible reasoning
 *
 * plus wrong/replayed evidence and NO_VALID_RESOURCE for objectives that
 * only have draft lessons.
 */
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  EvidenceAdmissionLedger, GRADE4_MATH_ONTOLOGY_RELEASE, admitEvidence, deterministicReleaseIdentity,
  type RawLearningObservation,
} from "@/lib/learning-authority/governedGrade4Math";
import {
  governedInventoryForRelease, inventoryCandidateIds, resolveInventoryActivity, resolveObjective, teacherDecisionView,
} from "@/lib/learning-authority/governedInventoryRuntime";
import { learnerStateRevision, resolveLearningDecision } from "@/lib/learning-authority/learningOrchestrator";
import { createGovernedEvidence, toCanonicalMasteryEvidence } from "@/lib/learning-evidence/evidenceContract";
import { replayStudentConceptState, type StudentConceptState } from "@/lib/learning-state/studentLearningModel";
import { GRADE4_FRACTIONS_LESSON } from "@/lib/curriculum/authority/grade4FractionsLesson";
import { GRADE4_MATH_DRAFT_LESSONS } from "@/lib/curriculum/authority/grade4Math";

const release = GRADE4_MATH_ONTOLOGY_RELEASE;
const identity = deterministicReleaseIdentity(release);
const inventory = governedInventoryForRelease(release);
const PARTS_OF_A_SET = "moe-math-g4-s1-p3-number-theory-and-fraction-obj4";
const EQUIVALENT_FRACTIONS = "moe-math-g4-s1-p3-number-theory-and-fraction-obj5";
const ADD_FRACTIONS = "moe-math-g4-s1-p3-number-theory-and-fraction-obj7";
const asOf = "2026-09-26T12:00:00.000Z";
const learner = { schoolId: "school-g4", studentId: "student-g4", studentUserId: "user-g4" };
const structured = JSON.parse(fs.readFileSync("curriculum/structured/moe-structured-v1.json", "utf8")) as { items: { id: string; text: string; provenance: { pages: number[] } }[] };

const scope = (conceptId: string) => ({ ...learner, conceptId, ontologyReleaseId: release.id, ontologyReleaseIdentity: identity });
const replayAll = (events: Parameters<typeof replayStudentConceptState>[0]) => release.concepts.map((concept) =>
  replayStudentConceptState(events.filter((event) => event.scope.conceptId === concept.id), { asOf, expectedScope: scope(concept.id) }));
const decide = (states: readonly StudentConceptState[], idempotencyKey: string, availableCandidateIds = inventoryCandidateIds(inventory)) =>
  resolveLearningDecision({ states, release, availableCandidateIds, currentRevision: async () => learnerStateRevision(states, release), idempotencyKey });

function observation(itemId: string, itemVersion: string, overrides: Partial<RawLearningObservation> = {}): RawLearningObservation {
  const item = release.items.find((candidate) => candidate.id === itemId)!;
  return { idempotencyKey: `attempt-${itemId}`, ...learner, authenticatedUserId: learner.studentUserId, itemId, itemVersion,
    context: item.context, toolsUsed: [], hintsUsed: 0, aiAssisted: false, source: "ONLINE", ...overrides };
}
const admissionContext = { expectedSchoolId: learner.schoolId, expectedStudentId: learner.studentId, expectedStudentUserId: learner.studentUserId, serverScored: true };

/** The route's evidence construction, with the objective resolved from the governed inventory. */
function evidenceFor(itemId: string, selectedAnswerIndex: number, attempt: string, correctClaim?: boolean) {
  const item = release.items.find((candidate) => candidate.id === itemId)!;
  const activity = resolveInventoryActivity(inventory, item.id, item.version);
  const correct = correctClaim ?? selectedAnswerIndex === item.correctIndex;
  return createGovernedEvidence({
    evidenceId: `learning-evidence-v1-${attempt}`, idempotencyKey: attempt, attemptId: attempt, tenantId: learner.schoolId, schoolId: learner.schoolId,
    learner: { studentId: learner.studentId, studentUserId: learner.studentUserId },
    objective: { conceptId: activity.conceptId, objectiveId: activity.objectiveId },
    activity: { activityId: item.id, activityVersion: item.version }, evidenceType: item.context, modality: "TEXT", occurredAt: "2026-09-25T12:00:00.000Z",
    performance: { outcome: correct ? "CORRECT" : "INCORRECT", score: correct ? 1 : 0, maxScore: 1, correct, selectedAnswerIndex, signals: [] },
    provenance: { source: "ONLINE", actorId: learner.studentUserId, actorRole: "STUDENT", runtime: "WEB", recordedAt: "2026-09-25T12:00:00.000Z", clientEventId: attempt, syncBatchId: null },
    strength: { serverScored: true, humanVerified: false, assistanceUsed: false, retryCount: 0, hintCount: 0, independenceKey: attempt, directness: "DIRECT", reliability: "VERIFIED", policyRef: "1.0.0" },
    offline: { isOffline: false, syncIdentity: null },
    curriculum: { ontologyReleaseId: release.id, ontologyReleaseIdentity: identity },
  });
}

describe("real Grade 4 Math governed adaptive loop", () => {
  it("runs MOE objective -> lesson -> diagnostic -> evidence -> SLM -> DecisionModel -> next governed action -> teacher view", async () => {
    // MOE objective, from the structured source.
    const moe = structured.items.find((item) => item.id === PARTS_OF_A_SET)!;
    expect(moe.text).toBe("Find parts of a set.");
    expect(moe.provenance.pages).toEqual([42]);

    // Governed lesson for that objective (and only the governed one).
    const governed = resolveObjective(inventory, PARTS_OF_A_SET);
    expect(governed.status).toBe("GOVERNED");
    if (governed.status !== "GOVERNED") return;
    expect(governed.lessons.map((lesson) => `${lesson.contentId}@${lesson.version}`)).toEqual([`${GRADE4_FRACTIONS_LESSON.contentId}@${GRADE4_FRACTIONS_LESSON.version}`]);
    expect(governed.activities.map((activity) => activity.activityId)).toEqual(["g4-frac-diagnostic-equal-parts"]);

    // A new learner gets the entry diagnostic from the DecisionModel.
    const first = await decide(replayAll([]), "g4-proof-first");
    expect(first.decision.status).toBe("SELECTED");
    expect(first.decision.action?.id).toBe("g4-frac-bind-equal-parts-v1:diagnostic");

    // Learner response -> admitted, server-scored evidence -> canonical mastery event.
    const diagnostic = release.items.find((item) => item.id === "g4-frac-diagnostic-equal-parts")!;
    const admission = admitEvidence(observation(diagnostic.id, diagnostic.version), admissionContext);
    expect(admission.decision).toBe("ACCEPTED");
    const evidence = evidenceFor(diagnostic.id, diagnostic.correctIndex, "attempt-1");
    expect(evidence.objective.objectiveId).toBe(PARTS_OF_A_SET);
    const canonical = toCanonicalMasteryEvidence(evidence, release);

    // SLM replay -> DecisionModel -> next governed action.
    const states = replayAll([canonical]);
    const equalParts = states.find((state) => state.scope.conceptId === "g4-fractions-equal-parts")!;
    expect(equalParts.replay.eventCount).toBe(1);
    expect(equalParts.mastery.observedScore).toBe(1);
    const next = await decide(states, "g4-proof-next");
    expect(next.decision.status).toBe("SELECTED");
    expect(next.decision.action?.id).toBe("g4-frac-bind-equivalence-v1:practice");
    expect(next.decision.mayWriteCanonicalMastery).toBe(false);

    // Teacher-visible reasoning names the MOE objective and the evidence behind the action.
    const view = teacherDecisionView({ inventory, decision: next.decision, recommendation: next.recommendation, states });
    expect(view.action).toMatchObject({ kind: "PRACTICE", conceptId: "g4-fractions-equivalence", objectiveId: EQUIVALENT_FRACTIONS, objectiveBasis: "MOE_OBJECTIVE" });
    expect(view.lesson).toBeNull(); // no governed lesson exists for equivalence; the draft is not offered
    expect(view.release).toEqual({ id: release.id, identity, moeApprovalState: "NOT_CLAIMED" });
    expect(view.ranking.rankedCandidates[0].id).toBe("g4-frac-bind-equivalence-v1:practice");
    expect(view.evidence.find((entry) => entry.conceptId === "g4-fractions-equal-parts")).toMatchObject({ objectiveId: PARTS_OF_A_SET, eventCount: 1, observedScore: 1 });
    expect(view.evidence.find((entry) => entry.conceptId === "g4-fractions-compare")?.objectiveId).toBe("LIBERIALEARN_EXTENSION:g4-fractions-compare");
  });

  it("keeps replayed evidence idempotent and rejects wrong evidence", () => {
    const diagnostic = release.items.find((item) => item.id === "g4-frac-diagnostic-equal-parts")!;
    const ledger = new EvidenceAdmissionLedger();
    expect(ledger.admit(observation(diagnostic.id, diagnostic.version), admissionContext).decision).toBe("ACCEPTED");
    expect(ledger.admit(observation(diagnostic.id, diagnostic.version), admissionContext).reason).toBe("duplicate_observation_idempotent");
    expect(ledger.size).toBe(1);

    const canonical = toCanonicalMasteryEvidence(evidenceFor(diagnostic.id, diagnostic.correctIndex, "attempt-1"), release);
    const once = replayStudentConceptState([canonical], { asOf, expectedScope: scope("g4-fractions-equal-parts") });
    const twice = replayStudentConceptState([canonical, canonical], { asOf, expectedScope: scope("g4-fractions-equal-parts") });
    expect(twice.replay).toEqual(once.replay);
    const conflicting = toCanonicalMasteryEvidence(evidenceFor(diagnostic.id, 3, "attempt-1"), release);
    expect(() => replayStudentConceptState([canonical, conflicting], { asOf, expectedScope: scope("g4-fractions-equal-parts") }))
      .toThrow("canonical_learning_event_duplicate_conflict");

    expect(admitEvidence(observation(diagnostic.id, "0.9.0"), admissionContext).reason).toBe("item_version_invalid");
    expect(admitEvidence(observation(diagnostic.id, diagnostic.version, { clientClaimedMastery: 1 }), admissionContext).reason).toBe("client_cannot_assert_mastery");
    expect(admitEvidence(observation(diagnostic.id, diagnostic.version, { schoolId: "school-other" }), admissionContext).reason).toBe("tenant_or_student_identity_mismatch");
    expect(() => toCanonicalMasteryEvidence(evidenceFor(diagnostic.id, 0, "attempt-2", true), release)).toThrow("evidence_result_mismatch");
    const staleRelease = { ...evidenceFor(diagnostic.id, diagnostic.correctIndex, "attempt-3"), curriculum: { ontologyReleaseId: release.id, ontologyReleaseIdentity: "0".repeat(64) } };
    expect(() => toCanonicalMasteryEvidence(staleRelease, release)).toThrow("evidence_release_invalid");
    expect(() => resolveInventoryActivity(inventory, "g4-frac-practice-part-of-set", "1.0.0")).toThrow("inventory_activity_not_governed");
  });

  it("returns NO_VALID_RESOURCE for an objective that only has a draft lesson", async () => {
    expect(GRADE4_MATH_DRAFT_LESSONS.some((lesson) => lesson.moeObjectiveId === ADD_FRACTIONS)).toBe(true);
    expect(resolveObjective(inventory, ADD_FRACTIONS)).toEqual({ status: "NO_VALID_RESOURCE", objectiveId: ADD_FRACTIONS, reason: "OBJECTIVE_HAS_NO_REVIEWED_RESOURCE" });
    expect(resolveObjective(inventory, "moe-math-g5-not-in-this-cell")).toMatchObject({ status: "NO_VALID_RESOURCE", reason: "OBJECTIVE_NOT_IN_CELL" });

    // The orchestrator restricted to that objective's governed candidates has nothing to offer.
    const forObjective = inventory.activities.filter((activity) => activity.objectiveId === ADD_FRACTIONS)
      .map((activity) => `${activity.bindingId}:${activity.evidenceType.toLowerCase()}`);
    expect(forObjective).toEqual([]);
    const result = await decide(replayAll([]), "g4-proof-no-resource", forObjective);
    expect(result.decision.status).toBe("NO_VALID_RESOURCE");
    expect(result.decision.action).toBeNull();
    expect(teacherDecisionView({ inventory, decision: result.decision, recommendation: result.recommendation, states: replayAll([]) }).action).toBeNull();
  });

  it("never makes a draft lesson an eligible candidate or resource", () => {
    const drafts = new Set(GRADE4_MATH_DRAFT_LESSONS.map((lesson) => lesson.contentId));
    expect(drafts.size).toBe(43);
    const serialized = JSON.stringify({ inventory, candidates: inventoryCandidateIds(inventory) });
    for (const contentId of drafts) expect(serialized).not.toContain(contentId);
    const governedWithDraft: string[] = [];
    for (const draft of GRADE4_MATH_DRAFT_LESSONS) {
      const resolution = resolveObjective(inventory, draft.moeObjectiveId);
      if (resolution.status === "GOVERNED") {
        governedWithDraft.push(draft.moeObjectiveId);
        expect(resolution.lessons.map((lesson) => lesson.contentId)).not.toContain(draft.contentId);
      } else {
        expect(resolution.reason).toBe("OBJECTIVE_HAS_NO_REVIEWED_RESOURCE");
      }
    }
    // Equivalent fractions has a released practice item but its lesson is still a draft.
    expect(governedWithDraft).toEqual([EQUIVALENT_FRACTIONS]);
    expect(inventoryCandidateIds(inventory)).toEqual([
      "g4-frac-bind-compare-v1:diagnostic", "g4-frac-bind-equal-parts-v1:diagnostic", "g4-frac-bind-equivalence-v1:practice",
    ]);
  });
});
