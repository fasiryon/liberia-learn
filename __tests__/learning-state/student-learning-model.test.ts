import { describe, expect, it } from "vitest";
import {
  MASTERY_REDUCER_VERSION,
  createGovernedMisconceptionReview,
  projectLegacyMasteryRead,
  replayStudentConceptState,
  toDecisionModelLearnerState,
  toLearnerSafeStudentConceptState,
  type GovernedMasteryEvidence,
  type LearnerStateScope,
} from "@/lib/learning-state/studentLearningModel";
import {
  GRADE4_MATH_ONTOLOGY_RELEASE,
  deterministicReleaseIdentity,
} from "@/lib/learning-authority/governedGrade4Math";
import { MISCONCEPTION_SIGNAL_POLICY_VERSION } from "@/lib/learning-state/misconceptionPolicy";

const scope: LearnerStateScope = {
  schoolId: "school-a",
  studentId: "student-a",
  studentUserId: "user-a",
  conceptId: "g4-fractions-equal-parts",
  ontologyReleaseId: GRADE4_MATH_ONTOLOGY_RELEASE.id,
  ontologyReleaseIdentity: deterministicReleaseIdentity(GRADE4_MATH_ONTOLOGY_RELEASE),
};

function evidence(overrides: Partial<GovernedMasteryEvidence> = {}): GovernedMasteryEvidence {
  return {
    type: "GOVERNED_EVIDENCE",
    schemaVersion: 1,
    reducerVersion: MASTERY_REDUCER_VERSION,
    evidenceId: "evidence-1",
    scope,
    bindingId: "g4-frac-bind-equal-parts-v1",
    itemId: "g4-frac-diagnostic-equal-parts",
    itemVersion: "1.0.0",
    evidencePolicyVersion: "1.0.0",
    toolPolicyVersion: "1.0.0",
    context: "DIAGNOSTIC",
    result: "CORRECT",
    selectedAnswerIndex: 2,
    independenceKey: "session-1",
    occurredAt: "2026-01-01T00:00:00.000Z",
    serverScored: true,
    admissionDecision: "ACCEPTED",
    authority: "SERVER_GOVERNED_EVIDENCE_GATEWAY",
    retentionProbe: false,
    misconceptionSignalId: null,
    misconceptionPolicyVersion: MISCONCEPTION_SIGNAL_POLICY_VERSION,
    ...overrides,
  };
}

const replay = (events: readonly GovernedMasteryEvidence[], asOf = "2026-01-01T00:00:00.000Z") =>
  replayStudentConceptState(events, { asOf, expectedScope: scope });

describe("Student Learning Model V1 calibration fixtures", () => {
  it("keeps mastery and retention unknown with no evidence", () => {
    const state = replay([]);
    expect(state.mastery).toMatchObject({ observedScore: null, level: "UNKNOWN" });
    expect(state.confidence).toMatchObject({ score: 0, level: "NONE", reasons: ["NO_EVIDENCE"] });
    expect(state.retention).toMatchObject({ estimatedRetainedMastery: null, status: "UNKNOWN" });
  });

  it("keeps one correct diagnostic sparse instead of treating correctness as confidence", () => {
    const state = replay([evidence()]);
    expect(state.mastery.observedScore).toBe(1);
    expect(state.mastery.level).toBe("INSUFFICIENT_EVIDENCE");
    expect(state.confidence.score).toBeLessThan(0.5);
    expect(state.confidence.reasons).toEqual(expect.arrayContaining(["SPARSE_EVIDENCE", "SINGLE_ITEM_COVERAGE", "SINGLE_OCCASION"]));
  });

  it("represents one incorrect diagnostic as negative sparse evidence, not zero certainty", () => {
    const state = replay([evidence({ result: "INCORRECT", selectedAnswerIndex: 0 })]);
    expect(state.mastery).toMatchObject({ observedScore: 0, negativeStrength: 1, level: "INSUFFICIENT_EVIDENCE" });
    expect(state.confidence.score).toBeGreaterThan(0);
    expect(state.confidence.score).toBeLessThan(0.5);
  });

  it("caps confidence for repeated exposure to one released item", () => {
    const events = Array.from({ length: 12 }, (_, index) => evidence({
      evidenceId: `evidence-${index}`,
      independenceKey: `session-${index}`,
      occurredAt: `2026-01-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
    }));
    const state = replay(events, "2026-01-12T00:00:00.000Z");
    expect(state.confidence.score).toBe(0.45);
    expect(state.confidence.level).toBe("LOW");
    expect(state.mastery.level).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("preserves contradictory evidence instead of averaging it away", () => {
    const state = replay([
      evidence(),
      evidence({ evidenceId: "evidence-2", independenceKey: "session-2", result: "INCORRECT", selectedAnswerIndex: 0, occurredAt: "2026-01-02T00:00:00.000Z" }),
    ], "2026-01-02T00:00:00.000Z");
    expect(state.mastery.observedScore).toBe(0.5);
    expect(state.conflict).toMatchObject({ present: true, score: 1 });
    expect(state.conflict.positiveEvidenceIds).toEqual(["evidence-1"]);
    expect(state.conflict.negativeEvidenceIds).toEqual(["evidence-2"]);
    expect(state.confidence.reasons).toContain("CONFLICTING_EVIDENCE");
  });

  it("uses pinned context strengths without hiding raw evidence mass", () => {
    const diagnostic = replay([evidence()]);
    const practiceScope = { ...scope, conceptId: "g4-fractions-equivalence" };
    const practice = replayStudentConceptState([evidence({
      scope: practiceScope,
      evidenceId: "practice",
      independenceKey: "practice-session",
      bindingId: "g4-frac-bind-equivalence-v1",
      itemId: "g4-frac-practice-equivalence",
      context: "PRACTICE",
      selectedAnswerIndex: 1,
    })], { asOf: "2026-01-01T00:00:00.000Z", expectedScope: practiceScope });
    expect(diagnostic.mastery.positiveStrength).toBe(1);
    expect(practice.mastery.positiveStrength).toBe(0.7);
  });

  it("decays retention at explicit as-of time without changing observed mastery", () => {
    const fresh = replay([evidence()], "2026-01-01T00:00:00.000Z");
    const later = replay([evidence()], "2026-03-02T00:00:00.000Z");
    expect(later.mastery).toEqual(fresh.mastery);
    expect(fresh.retention.estimatedRetainedMastery).toBe(1);
    expect(later.retention.estimatedRetainedMastery).toBe(0.25);
    expect(later.retention.status).toBe("AT_RISK");
  });

  it("records delayed retrieval probes independently of administrative grade", () => {
    const state = replay([
      evidence(),
      evidence({ evidenceId: "probe", independenceKey: "probe-session", retentionProbe: true, result: "INCORRECT", selectedAnswerIndex: 0, occurredAt: "2026-02-01T00:00:00.000Z" }),
    ], "2026-02-01T00:00:00.000Z");
    expect(state.retention).toMatchObject({ lastProbeAt: "2026-02-01T00:00:00.000Z", lastProbeResult: "INCORRECT" });
    expect(state.authority.mayChangeAdministrativeGrade).toBe(false);
    expect("currentGrade" in state).toBe(false);
  });

  it("replays shuffled histories deterministically and orders timestamp ties by event id", () => {
    const events = [
      evidence({ evidenceId: "b", independenceKey: "session-b", result: "INCORRECT", selectedAnswerIndex: 0 }),
      evidence({ evidenceId: "a", independenceKey: "session-a" }),
    ];
    expect(replay(events)).toEqual(replay([...events].reverse()));
  });

  it("deduplicates byte-equivalent events but rejects conflicting duplicate ids", () => {
    expect(replay([evidence(), evidence()]).replay.eventCount).toBe(1);
    expect(() => replay([evidence(), evidence({ result: "INCORRECT", selectedAnswerIndex: 0 })]))
      .toThrow("canonical_learning_event_duplicate_conflict");
  });

  it("fails closed on unsupported reducers, invalid clocks, future events, and cross-scope evidence", () => {
    expect(() => replay([evidence({ reducerVersion: "forged" as never })])).toThrow("canonical_learning_event_version_unsupported");
    expect(() => replay([evidence({ occurredAt: "not-a-date" })])).toThrow("canonical_learning_event_timestamp_invalid");
    expect(() => replay([evidence()], "2025-12-31T00:00:00.000Z")).toThrow("canonical_learning_event_after_as_of");
    expect(() => replay([evidence({ scope: { ...scope, schoolId: "school-b" } })])).toThrow("canonical_learning_event_scope_mismatch");
  });

  it("fails closed on malformed union fields and ungoverned release, binding, or policy claims", () => {
    expect(() => replay([evidence({ result: "MAYBE" as never })])).toThrow("governed_evidence_result_invalid");
    expect(() => replay([evidence({ retentionProbe: "yes" as never })])).toThrow("governed_evidence_retention_probe_invalid");
    expect(() => replay([evidence({ scope: {} as never })])).toThrow("scope_schoolId_required");
    expect(() => replay([evidence({ type: "LEGACY_MASTERY" as never })])).toThrow("canonical_learning_event_type_invalid");
    expect(() => replay([evidence({ scope: { ...scope, ontologyReleaseIdentity: "forged" } })])).toThrow("governed_evidence_release_invalid");
    expect(() => replay([evidence({ bindingId: "forged" })])).toThrow("governed_evidence_binding_invalid");
    expect(() => replay([evidence({ evidencePolicyVersion: "forged" })])).toThrow("governed_evidence_binding_invalid");
    expect(() => replay([evidence({ selectedAnswerIndex: 99, result: "INCORRECT" })])).toThrow("governed_evidence_binding_invalid");
    expect(() => replay([evidence({ misconceptionSignalId: "llm-inferred" })])).toThrow("governed_evidence_misconception_policy_invalid");
    expect(() => replayStudentConceptState([], {
      asOf: "2026-01-01T00:00:00.000Z",
      expectedScope: { ...scope, conceptId: "unreleased-concept" },
    })).toThrow("student_concept_scope_not_governed");
  });

  it("rejects device, client, LLM, provisional, and non-server-scored authority claims", () => {
    for (const forged of [
      { authority: "CLIENT" },
      { authority: "DEVICE" },
      { authority: "LLM" },
      { admissionDecision: "PROVISIONAL" },
      { serverScored: false },
    ]) {
      expect(() => replay([evidence(forged as never)])).toThrow("governed_evidence_authority_invalid");
    }
  });

  it("creates only a suspected signal from an exact governed distractor", () => {
    const signaled = evidence({ result: "INCORRECT", selectedAnswerIndex: 3, misconceptionSignalId: "g4-fractions-numerator-denominator-reversal" });
    expect(replay([signaled]).misconceptions).toEqual([expect.objectContaining({
      signalId: "g4-fractions-numerator-denominator-reversal",
      status: "SUSPECTED",
      signalEvidenceIds: ["evidence-1"],
    })]);
  });

  it("requires an authorized review tied to governed signal evidence to confirm or reject", () => {
    const signaled = evidence({ result: "INCORRECT", selectedAnswerIndex: 3, misconceptionSignalId: "g4-fractions-numerator-denominator-reversal" });
    const confirmed = createGovernedMisconceptionReview({
      reviewId: "review-confirm", scope, signalId: signaled.misconceptionSignalId!, decision: "CONFIRMED",
      evidenceIds: [signaled.evidenceId], actor: { userId: "teacher-a", role: "TEACHER" }, occurredAt: "2026-01-02T00:00:00.000Z",
    });
    const rejected = createGovernedMisconceptionReview({
      reviewId: "review-reject", scope, signalId: signaled.misconceptionSignalId!, decision: "REJECTED",
      evidenceIds: [signaled.evidenceId], actor: { userId: "admin-a", role: "ADMIN" }, occurredAt: "2026-01-03T00:00:00.000Z",
    });
    expect(replayStudentConceptState([signaled, confirmed], { asOf: confirmed.occurredAt }).misconceptions[0].status).toBe("CONFIRMED");
    expect(replayStudentConceptState([signaled, rejected], { asOf: rejected.occurredAt }).misconceptions[0].status).toBe("REJECTED");
    expect(replayStudentConceptState([signaled, confirmed, rejected], { asOf: rejected.occurredAt }).misconceptions[0].status).toBe("CONFLICTED");
  });

  it("fails closed when a review references unrelated evidence", () => {
    const signaled = evidence({ result: "INCORRECT", selectedAnswerIndex: 3, misconceptionSignalId: "g4-fractions-numerator-denominator-reversal" });
    const review = createGovernedMisconceptionReview({
      reviewId: "review", scope, signalId: signaled.misconceptionSignalId!, decision: "CONFIRMED",
      evidenceIds: ["nonexistent"], actor: { userId: "teacher-a", role: "TEACHER" }, occurredAt: "2026-01-02T00:00:00.000Z",
    });
    expect(() => replayStudentConceptState([signaled, review], { asOf: review.occurredAt }))
      .toThrow("misconception_review_evidence_invalid");
  });

  it("rejects unauthorized misconception reviewers", () => {
    expect(() => createGovernedMisconceptionReview({
      reviewId: "review", scope, signalId: "signal", decision: "CONFIRMED", evidenceIds: ["evidence-1"],
      actor: { userId: "student-a", role: "STUDENT" as never }, occurredAt: "2026-01-02T00:00:00.000Z",
    })).toThrow("misconception_review_authority_invalid");
  });

  it("rejects review decisions that predate their referenced evidence", () => {
    const signaled = evidence({
      occurredAt: "2026-01-03T00:00:00.000Z",
      result: "INCORRECT",
      selectedAnswerIndex: 3,
      misconceptionSignalId: "g4-fractions-numerator-denominator-reversal",
    });
    const review = createGovernedMisconceptionReview({
      reviewId: "early-review", scope, signalId: signaled.misconceptionSignalId!, decision: "CONFIRMED",
      evidenceIds: [signaled.evidenceId], actor: { userId: "teacher-a", role: "TEACHER" }, occurredAt: "2026-01-02T00:00:00.000Z",
    });
    expect(() => replayStudentConceptState([signaled, review], { asOf: signaled.occurredAt }))
      .toThrow("misconception_review_evidence_invalid");
  });

  it("exposes a provider-neutral DecisionModel input without choosing actions", () => {
    const output = toDecisionModelLearnerState(replay([evidence()]));
    expect(output).toMatchObject({
      contractVersion: "decision-model-learner-state/1.0.0",
      validCandidateActions: [],
      governedPolicyResolution: { actionPolicyStatus: "NOT_IMPLEMENTED_IN_THIS_MISSION", requiresDecisionAuthority: true },
    });
  });

  it("keeps misconception policy, evidence IDs, and teacher explanations out of learner projections", () => {
    const signaled = evidence({
      result: "INCORRECT",
      selectedAnswerIndex: 3,
      misconceptionSignalId: "g4-fractions-numerator-denominator-reversal",
    });
    const projection = toLearnerSafeStudentConceptState(replay([signaled]));
    expect(projection).toMatchObject({ authority: { canonical: true, learnerMayWrite: false } });
    expect("misconceptions" in projection).toBe(false);
    expect("teacherExplanation" in projection).toBe(false);
    expect("positiveEvidenceIds" in projection.conflict).toBe(false);
  });

  it("keeps legacy compatibility one-way and read-only", () => {
    expect(projectLegacyMasteryRead(replay([evidence()]))).toEqual({
      levelPercent: 100,
      source: "CANONICAL_ONE_WAY_PROJECTION",
      writable: false,
    });
  });

  it("produces teacher-readable explanations for sparse, conflicting, stale, and reviewed state", () => {
    const state = replay([
      evidence(),
      evidence({ evidenceId: "negative", independenceKey: "session-2", result: "INCORRECT", selectedAnswerIndex: 3, misconceptionSignalId: "g4-fractions-numerator-denominator-reversal", occurredAt: "2026-01-02T00:00:00.000Z" }),
    ], "2026-03-05T00:00:00.000Z");
    expect(state.teacherExplanation.join(" ")).toMatch(/Evidence covers one released item/);
    expect(state.teacherExplanation.join(" ")).toMatch(/Evidence conflicts/);
    expect(state.teacherExplanation.join(" ")).toMatch(/Retention is a policy estimate/);
    expect(state.teacherExplanation.join(" ")).toMatch(/misconception signal/i);
  });
});
