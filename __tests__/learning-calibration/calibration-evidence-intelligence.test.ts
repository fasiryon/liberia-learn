import { generateKeyPairSync, createSign, createVerify } from "crypto";
import { describe, expect, it } from "vitest";
import { GRADE4_MATH_ONTOLOGY_RELEASE, deterministicReleaseIdentity } from "@/lib/learning-authority/governedGrade4Math";
import { generateLearningCandidates, resolveLearningDecision, learnerStateRevision, type DecisionModel } from "@/lib/learning-authority/learningOrchestrator";
import { createGovernedEvidence, type GovernedEvidence } from "@/lib/learning-evidence/evidenceContract";
import { assessEvidenceSufficiency, calibrateLearner, calibrationInputRevision } from "@/lib/learning-calibration/calibrationState";
import { assessEvidenceQuality } from "@/lib/learning-calibration/evidenceQualityPolicy";
import {
  applyEarlyLearningPolicy, EARLY_LEARNING_POLICY_V1, validateEarlyLearningPolicy, type EarlyLearningPolicy,
} from "@/lib/learning-calibration/earlyLearningPolicy";
import { deriveParticipationSignals, type ParticipationObservation } from "@/lib/learning-calibration/participationSignals";
import { generateInterventionCandidates, resolveTeacherInterventionResponse } from "@/lib/learning-calibration/teacherInterventions";
import { deriveInstructionalReadiness, placementToGovernedEvidence } from "@/lib/learning-calibration/placementReadiness";
import {
  buildSignedOfflineCalibrationProjection, reconcileOfflineObservations, verifyOfflineCalibrationProjection,
} from "@/lib/learning-calibration/offlineCalibrationProjection";
import {
  formatSimulationTrace, simulateLearnerPath, SYNTHETIC_LABEL, type SimulatedStep, type SimulationScenario,
} from "@/lib/learning-calibration/learnerPathSimulator";

// All learners below are SYNTHETIC. Concepts: A -> B -> C prerequisite chain.
const release = GRADE4_MATH_ONTOLOGY_RELEASE;
const [A, B, C] = release.concepts.map((concept) => concept.id);
const START = "2026-09-01T08:00:00.000Z";

function scenario(name: string, steps: readonly SimulatedStep[], extra: Partial<SimulationScenario> = {}): SimulationScenario {
  return { name, label: SYNTHETIC_LABEL, enrollmentGrade: 4, startAt: START, steps, ...extra };
}

async function last(s: SimulationScenario) {
  const result = await simulateLearnerPath(s);
  return result.snapshots.at(-1)!;
}

const est = (snap: Awaited<ReturnType<typeof last>>, conceptId: string) => snap.estimates.find((entry) => entry.conceptId === conceptId)!;
const intervention = (snap: Awaited<ReturnType<typeof last>>, kind: string, conceptId: string | null = null) =>
  snap.interventions.find((entry) => entry.kind === kind && entry.conceptId === conceptId);

/** Three independent correct observations on every concept, one canonical and two prior-history imports. */
const priorHistorySteps: SimulatedStep[] = [
  ...[A, B, C].flatMap((conceptId): SimulatedStep[] => [
    { day: -40, kind: "PRIOR_HISTORY", conceptId, correct: true, occasion: `prior-term-1-${conceptId}` },
    { day: -20, kind: "PRIOR_HISTORY", conceptId, correct: true, occasion: `prior-term-2-${conceptId}` },
  ]),
  { day: 1, kind: "RELEASED_ITEM", conceptId: A, correct: true },
  { day: 1, kind: "RELEASED_ITEM", conceptId: B, correct: true },
  { day: 1, kind: "RELEASED_ITEM", conceptId: C, correct: true },
];

describe("calibration lifecycle (SYNTHETIC learners)", () => {
  it("brand-new learner starts INITIAL, gets a grade-level entry action and an evidence-collection prompt", async () => {
    const snap = await last(scenario("brand-new", [], { checkpoints: [0] }));
    expect(snap.calibration.stage).toBe("INITIAL");
    expect(snap.calibration.enrollment).toEqual({ grade: 4, source: "STUDENT_RECORD", mutableByCalibration: false });
    expect(snap.decision.action?.itemId).toBe("g4-frac-diagnostic-equal-parts");
    expect(snap.resolution.earlyLearning?.personalizationShare).toBe(0);
    expect(snap.resolution.earlyLearning?.appliedCategory).not.toBe("PERSONALIZED");
    expect(intervention(snap, "INSUFFICIENT_EVIDENCE")?.recommendedAction.kind).toBe("COLLECT_EVIDENCE");
    // Absent participation data is not an observation of inactivity.
    expect(intervention(snap, "INACTIVITY")).toBeUndefined();
  });

  it("prior-history learner stabilizes on day 1 while a new learner with the same day-1 evidence stays provisional", async () => {
    const prior = await last(scenario("prior-history", priorHistorySteps, { checkpoints: [1] }));
    expect(prior.calibration.stage).toBe("STABLE");
    expect(prior.estimates.every((entry) => entry.sufficiency.level === "SUFFICIENT")).toBe(true);
    const fresh = await last(scenario("fresh", priorHistorySteps.filter((step) => step.day === 1), { checkpoints: [1] }));
    expect(fresh.calibration.stage).toBe("PROVISIONAL");
    // Canonical SLM mastery is identical: prior history informs sufficiency, never mastery.
    expect(prior.estimates.map((entry) => entry.mastery)).toEqual(fresh.estimates.map((entry) => entry.mastery));
  });

  it("depends on evidence sufficiency, not elapsed days", async () => {
    const steps: SimulatedStep[] = [{ day: 0, kind: "RELEASED_ITEM", conceptId: A, correct: true }];
    const result = await simulateLearnerPath(scenario("elapsed", steps, { checkpoints: [0, 10, 25] }));
    expect(result.snapshots.map((snap) => snap.calibration.stage)).toEqual(["PROVISIONAL", "PROVISIONAL", "PROVISIONAL"]);
  });

  it("sparse evidence leaves the competency INSUFFICIENT and the learner PROVISIONAL", async () => {
    const snap = await last(scenario("sparse", [{ day: 0, kind: "RELEASED_ITEM", conceptId: A, correct: true }]));
    expect(est(snap, A).sufficiency.level).toBe("INSUFFICIENT");
    expect(est(snap, A).sufficiency.reasons).toContain("TOO_FEW_INDEPENDENT_OCCASIONS");
    expect(snap.calibration.stage).toBe("PROVISIONAL");
  });

  it("contradictory evidence is preserved, marks sufficiency PARTIAL, and raises an explainable check", async () => {
    const snap = await last(scenario("contradictory", [
      { day: 0, kind: "RELEASED_ITEM", conceptId: A, correct: true },
      { day: 2, kind: "RELEASED_ITEM", conceptId: A, correct: false },
      { day: 3, kind: "TEACHER_EVIDENCE", conceptId: A, correct: false },
    ]));
    const a = est(snap, A);
    expect(a.evidenceIds.positive).toHaveLength(1);
    expect(a.evidenceIds.negative).toHaveLength(1);
    expect(a.sufficiency.level).toBe("PARTIAL");
    expect(a.sufficiency.reasons).toContain("CONTRADICTORY_EVIDENCE");
    const check = intervention(snap, "INSUFFICIENT_EVIDENCE", A)!;
    expect(check.triggeringEvidence.evidenceIds.length).toBeGreaterThanOrEqual(3);
    expect(check.recommendedAction.candidateId).toBe("g4-frac-bind-equal-parts-v1:diagnostic");
  });

  it("flags corroboration that disagrees with canonical mastery", async () => {
    const snap = await last(scenario("disagree", [
      { day: 0, kind: "RELEASED_ITEM", conceptId: A, correct: true, occasion: "o1" },
      { day: 1, kind: "RELEASED_ITEM", conceptId: A, correct: true, occasion: "o2" },
      { day: 2, kind: "TEACHER_EVIDENCE", conceptId: A, correct: false },
    ]));
    expect(est(snap, A).sufficiency.corroborationAgreement).toBe("DISAGREES");
    expect(est(snap, A).sufficiency.level).toBe("PARTIAL");
  });

  it("old evidence is reported stale, retention declines, and stale corroboration is downgraded", async () => {
    const snap = await last(scenario("old", [
      { day: 0, kind: "RELEASED_ITEM", conceptId: A, correct: true, occasion: "o1" },
      { day: 1, kind: "QUIZ", conceptId: A, correct: true },
    ], { checkpoints: [90] }));
    const a = est(snap, A);
    expect(a.retention.status).toBe("AT_RISK");
    expect(a.sufficiency.reasons).toContain("STALE_EVIDENCE");
    // The stale STRONG quiz is downgraded to MODERATE (0.5), keeping the competency below sufficiency.
    expect(a.sufficiency.effectiveOccasions).toBe(1.5);
    expect(a.sufficiency.level).toBe("INSUFFICIENT");
    const decline = intervention(snap, "RETENTION_DECLINE", A)!;
    expect(decline.confidence).toBe("LOW");
    expect(decline.reason).toContain("policy estimate");
  });

  it("high mastery / low confidence is never treated as secure or extension-ready", async () => {
    const snap = await last(scenario("high-mastery-low-confidence", [{ day: 0, kind: "RELEASED_ITEM", conceptId: A, correct: true }]));
    const a = est(snap, A);
    expect(a.mastery.estimate).toBe(1);
    expect(a.confidence.level).toBe("LOW");
    expect(a.mastery.level).toBe("INSUFFICIENT_EVIDENCE");
    expect(intervention(snap, "READY_FOR_EXTENSION", A)).toBeUndefined();
  });

  it("low mastery / high certainty yields a confident prerequisite gap", async () => {
    const snap = await last(scenario("low-mastery-high-certainty", [
      { day: 0, kind: "RELEASED_ITEM", conceptId: A, correct: false, occasion: "o1" },
      { day: 1, kind: "RELEASED_ITEM", conceptId: A, correct: false, occasion: "o2" },
      { day: 2, kind: "RELEASED_ITEM", conceptId: A, correct: false, occasion: "o3" },
      { day: 3, kind: "TEACHER_EVIDENCE", conceptId: A, correct: false },
    ]));
    const a = est(snap, A);
    expect(a.mastery.estimate).toBe(0);
    expect(a.sufficiency.level).toBe("SUFFICIENT");
    expect(a.sufficiency.corroborationAgreement).toBe("AGREES");
    const gap = intervention(snap, "PREREQUISITE_GAP", B)!;
    expect(gap.confidence).toBe("HIGH");
    expect(gap.triggeringEvidence.evidenceIds).toEqual(a.evidenceIds.negative);
    expect(gap.recommendedAction.candidateId).toBe("g4-frac-bind-equal-parts-v1:diagnostic");
  });

  it("prerequisite gap blocks progression and is reported per competency", async () => {
    const snap = await last(scenario("prereq-gap", [{ day: 0, kind: "RELEASED_ITEM", conceptId: A, correct: false }]));
    expect(est(snap, B).prerequisite).toEqual({ status: "UNMET", unmetConceptIds: [A], unknownConceptIds: [] });
    expect(est(snap, C).prerequisite.status).toBe("UNKNOWN");
    expect(snap.decision.action?.conceptId).toBe(A);
    expect(intervention(snap, "PREREQUISITE_GAP", B)?.recommendedAction.kind).toBe("REMEDIATE_PREREQUISITE");
  });

  it("an incorrect governed retrieval probe is a high-certainty retention decline", async () => {
    const snap = await last(scenario("retention", [
      { day: 0, kind: "RELEASED_ITEM", conceptId: A, correct: true, occasion: "o1" },
      { day: 40, kind: "RELEASED_ITEM", conceptId: A, correct: false, occasion: "probe", retentionProbe: true },
    ]));
    expect(est(snap, A).retention.lastProbeResult).toBe("INCORRECT");
    expect(intervention(snap, "RETENTION_DECLINE", A)?.confidence).toBe("HIGH");
  });

  it("repeated misconception signals become a teacher review candidate, confirmed reviews raise certainty", async () => {
    const steps: SimulatedStep[] = [
      { day: 0, kind: "RELEASED_ITEM", conceptId: A, correct: false, selectedAnswerIndex: 3, occasion: "o1" },
      { day: 1, kind: "RELEASED_ITEM", conceptId: A, correct: false, selectedAnswerIndex: 3, occasion: "o2" },
    ];
    const suspected = await last(scenario("misconception", steps));
    expect(intervention(suspected, "REPEATED_MISCONCEPTION", A)?.confidence).toBe("MEDIUM");
    const confirmed = await last(scenario("misconception-confirmed", [...steps,
      { day: 2, kind: "MISCONCEPTION_REVIEW", conceptId: A, signalId: "g4-fractions-numerator-denominator-reversal", decision: "CONFIRMED" }]));
    expect(est(confirmed, A).misconception.state).toBe("CONFIRMED");
    expect(intervention(confirmed, "REPEATED_MISCONCEPTION", A)?.confidence).toBe("HIGH");
  });

  it("secure, sufficient, fresh competencies are offered extension without touching the grade", async () => {
    const snap = await last(scenario("extension", priorHistorySteps, { checkpoints: [1] }));
    const extension = intervention(snap, "READY_FOR_EXTENSION", A);
    // One released item per concept caps SLM confidence, so SECURE is not reachable in this release.
    expect(est(snap, A).mastery.level).not.toBe("SECURE");
    expect(extension).toBeUndefined();
    expect(snap.calibration.enrollment.grade).toBe(4);
    // A release with item diversity can reach SECURE; the engine then offers extension.
    const secure = snap.estimates.map((entry) => entry.conceptId === A ? { ...entry, mastery: { ...entry.mastery, level: "SECURE" as const } } : entry);
    const offered = generateInterventionCandidates({ calibration: snap.calibration, estimates: secure, participation: snap.participation,
      candidates: generateLearningCandidates({ states: snap.states }) }).find((entry) => entry.kind === "READY_FOR_EXTENSION");
    expect(offered).toMatchObject({ conceptId: A, confidence: "HIGH", recommendedAction: { kind: "OFFER_EXTENSION", candidateId: null } });
    expect(offered?.recommendedAction.description).toContain("official grade is unchanged");
  });
});

describe("evidence quality policy", () => {
  const base = (overrides: Partial<Parameters<typeof createGovernedEvidence>[0]> = {}) => createGovernedEvidence({
    evidenceId: "e1", idempotencyKey: "e1", attemptId: "a1", tenantId: "t", schoolId: "synthetic-school",
    learner: { studentId: "synthetic-student", studentUserId: "synthetic-user" },
    objective: { conceptId: A, objectiveId: "o" }, activity: { activityId: "x", activityVersion: "1" },
    evidenceType: "QUIZ", modality: "INTERACTIVE", occurredAt: "2026-09-10T00:00:00.000Z",
    performance: { outcome: "CORRECT", score: 8, maxScore: 10, correct: null, signals: [] },
    provenance: { source: "ONLINE", actorId: null, actorRole: "STUDENT", runtime: "WEB", recordedAt: "2026-09-10T00:00:00.000Z", clientEventId: null, syncBatchId: null },
    strength: { serverScored: true, humanVerified: false, assistanceUsed: false, retryCount: 0, hintCount: 0, independenceKey: "k", directness: "DIRECT", reliability: "UNASSESSED", policyRef: "p" },
    offline: { isOffline: false, syncIdentity: null },
    curriculum: { ontologyReleaseId: release.id, ontologyReleaseIdentity: deterministicReleaseIdentity(release) },
    ...overrides,
  });
  const asOf = "2026-09-12T00:00:00.000Z";

  it("describes characteristics and never emits a gradebook weight", () => {
    const quality = assessEvidenceQuality(base(), { asOf });
    expect(quality.corroboration).toBe("STRONG");
    expect(quality.characteristics).toMatchObject({ independence: "INDEPENDENT", supervision: "CONTROLLED", recency: "FRESH", attempts: "FIRST_ATTEMPT" });
    expect(quality.authority).toEqual({ mayChangeCanonicalMastery: false, isGradebookWeight: false });
    expect(JSON.stringify(quality)).not.toMatch(/weight"?\s*:\s*0?\.\d|percent/i);
  });

  it("excludes completion-only and inferred records and weakens assisted or heavily retried work", () => {
    expect(assessEvidenceQuality(base({ evidenceType: "LESSON_COMPLETION", performance: { outcome: "COMPLETED", score: null, maxScore: null, correct: null, signals: [] } }), { asOf }).corroboration).toBe("EXCLUDED");
    expect(assessEvidenceQuality(base({ strength: { ...base().strength, directness: "INFERRED" } }), { asOf }).corroboration).toBe("EXCLUDED");
    expect(assessEvidenceQuality(base({ strength: { ...base().strength, assistanceUsed: true } }), { asOf }).corroboration).toBe("WEAK");
    expect(assessEvidenceQuality(base({ strength: { ...base().strength, retryCount: 4 } }), { asOf }).corroboration).toBe("WEAK");
  });
});

describe("placement orchestration", () => {
  const bindings = [{ placementItemKey: "e5", conceptId: C, objectiveId: "compare", approvedBy: "synthetic-reviewer" }];
  const learner = { studentId: "synthetic-student", studentUserId: "synthetic-user" };

  it("emits provisional INDIRECT evidence only for approved bindings and never maps by guesswork", () => {
    const result = placementToGovernedEvidence({ placementSessionId: "p1", tenantId: "t", schoolId: "synthetic-school", learner, release, bindings,
      responses: [
        { placementItemKey: "e5", itemVersion: "1", difficulty: 2, isCorrect: true, answeredAt: "2026-09-01T09:00:00.000Z" },
        { placementItemKey: "e7", itemVersion: "1", difficulty: 3, isCorrect: true, answeredAt: "2026-09-01T09:01:00.000Z" },
      ] });
    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0].strength.directness).toBe("INDIRECT");
    expect(result.unboundItemKeys).toEqual(["e7"]);
    expect(assessEvidenceQuality(result.evidence[0], { asOf: "2026-09-02T00:00:00.000Z" }).corroboration).toBe("MODERATE");
    expect(() => placementToGovernedEvidence({ placementSessionId: "p1", tenantId: "t", schoolId: "s", learner, release,
      bindings: [{ ...bindings[0], approvedBy: " " }], responses: [] })).toThrow("placement_binding_approval_required");
  });

  it("placement alone stays provisional and readiness never changes the enrollment grade", async () => {
    const snap = await last(scenario("placement", [{ day: 0, kind: "PLACEMENT", responses: [{ itemKey: "e5", correct: false, difficulty: 2 }] }],
      { placementBindings: bindings }));
    expect(snap.calibration.stage).toBe("PROVISIONAL");
    expect(est(snap, C).mastery.estimate).toBeNull();
    const readiness = deriveInstructionalReadiness({ enrollmentGrade: 4, calibration: snap.calibration, estimates: snap.estimates,
      placement: { recommendedGrade: 2, confidence: "low" } });
    expect(readiness.enrollment).toEqual({ grade: 4, source: "STUDENT_RECORD", changedByReadiness: false });
    expect(readiness.subject.relationToEnrollment).toBe("BELOW");
    expect(readiness.officialGradeChange).toBe("REQUIRES_HUMAN_PLACEMENT_CONFIRMATION");
    expect(() => deriveInstructionalReadiness({ enrollmentGrade: 3, calibration: snap.calibration, estimates: snap.estimates }))
      .toThrow("readiness_enrollment_grade_mismatch");
  });

  it("never reports a competency ready while its prerequisite has no evidence", async () => {
    const snap = await last(scenario("unknown-prereq", [{ day: 0, kind: "RELEASED_ITEM", conceptId: B, correct: true }]));
    expect(est(snap, B).prerequisite.status).toBe("UNKNOWN");
    const readiness = deriveInstructionalReadiness({ enrollmentGrade: 4, calibration: snap.calibration, estimates: snap.estimates });
    const entry = readiness.competencies.find((competency) => competency.conceptId === B)!;
    expect(entry.readiness).toBe("PREREQUISITE_UNKNOWN");
    expect(entry.reasons).toContain(`UNKNOWN_PREREQUISITE:${A}`);
  });
});

describe("early-calibration learning policy", () => {
  it("is validated data, rejects malformed mixes, and personalizes more as evidence improves", async () => {
    expect(() => validateEarlyLearningPolicy(EARLY_LEARNING_POLICY_V1)).not.toThrow();
    const broken = { ...EARLY_LEARNING_POLICY_V1, stages: { ...EARLY_LEARNING_POLICY_V1.stages,
      INITIAL: { mix: { GRADE_LEVEL: 0.5, PREREQUISITE_REMEDIATION: 0.5, EVIDENCE_SEEKING: 0.5 }, maxPersonalization: 0 } } } as EarlyLearningPolicy;
    expect(() => validateEarlyLearningPolicy(broken)).toThrow("early_learning_policy_mix_invalid");
    const caps = (["INITIAL", "PROVISIONAL", "CALIBRATING", "STABLE"] as const).map((stage) => EARLY_LEARNING_POLICY_V1.stages[stage].maxPersonalization);
    expect([...caps].sort((a, b) => a - b)).toEqual(caps);
    const prior = await last(scenario("prior-history-policy", priorHistorySteps, { checkpoints: [1] }));
    expect(prior.resolution.earlyLearning?.personalizationShare).toBe(1);
    expect(prior.resolution.earlyLearning?.appliedCategory).toBe("PERSONALIZED");
  });

  it("is deterministic per learner revision and request, and rejects a stale calibration", async () => {
    const one = await last(scenario("det", [{ day: 0, kind: "RELEASED_ITEM", conceptId: A, correct: true }]));
    const two = await last(scenario("det", [{ day: 0, kind: "RELEASED_ITEM", conceptId: A, correct: true }]));
    expect(two.resolution.earlyLearning).toEqual(one.resolution.earlyLearning);
    const candidates = generateLearningCandidates({ states: one.states });
    const current = { learnerStateRevision: one.calibration.learnerStateRevision, calibrationInputRevision: one.calibration.inputRevision };
    expect(() => applyEarlyLearningPolicy({ calibration: one.calibration, states: one.states, release, candidates,
      ranked: one.recommendation.rankedCandidates, ...current, learnerStateRevision: "other", idempotencyKey: "k" })).toThrow("calibration_state_stale");
    const otherLearner = { ...one.calibration, scope: { ...one.calibration.scope, studentId: "another-student" } };
    expect(() => applyEarlyLearningPolicy({ calibration: otherLearner, states: one.states, release, candidates,
      ranked: one.recommendation.rankedCandidates, ...current, idempotencyKey: "k" }))
      .toThrow("calibration_learner_mismatch");
  });

  it("rejects a calibration whose corroborating evidence or as-of time changed under the same canonical revision", async () => {
    const one = await last(scenario("inputs", [{ day: 0, kind: "RELEASED_ITEM", conceptId: A, correct: true }]));
    const candidates = generateLearningCandidates({ states: one.states });
    const homework = createGovernedEvidence({
      evidenceId: "hw1", idempotencyKey: "hw1", attemptId: "hw1", tenantId: "synthetic-tenant", schoolId: "synthetic-school",
      learner: { studentId: "synthetic-student", studentUserId: "synthetic-user" }, objective: { conceptId: A, objectiveId: "o" },
      activity: { activityId: "hw", activityVersion: "1" }, evidenceType: "QUIZ", modality: "INTERACTIVE", occurredAt: START,
      performance: { outcome: "CORRECT", score: 9, maxScore: 10, correct: null, signals: [] },
      provenance: { source: "TEACHER", actorId: "t", actorRole: "TEACHER", runtime: "WEB", recordedAt: START, clientEventId: null, syncBatchId: null },
      strength: { serverScored: false, humanVerified: true, assistanceUsed: false, retryCount: 0, hintCount: 0, independenceKey: "hw-1", directness: "DIRECT", reliability: "REVIEWED", policyRef: "p" },
      offline: { isOffline: false, syncIdentity: null },
      curriculum: { ontologyReleaseId: release.id, ontologyReleaseIdentity: deterministicReleaseIdentity(release) },
    });
    const revision = one.calibration.learnerStateRevision;
    const withHomework = calibrationInputRevision({ learnerStateRevision: revision, asOf: one.asOf, corroboratingEvidence: [homework] });
    const later = calibrationInputRevision({ learnerStateRevision: revision, asOf: "2026-12-01T00:00:00.000Z" });
    for (const calibrationInputRevision of [withHomework, later]) {
      expect(calibrationInputRevision).not.toBe(one.calibration.inputRevision);
      expect(() => applyEarlyLearningPolicy({ calibration: one.calibration, states: one.states, release, candidates,
        ranked: one.recommendation.rankedCandidates, learnerStateRevision: revision, calibrationInputRevision, idempotencyKey: "k" }))
        .toThrow("calibration_inputs_stale");
    }
    await expect(resolveLearningDecision({ states: one.states, release, calibration: one.calibration,
      currentRevision: async () => revision, idempotencyKey: "k" })).rejects.toThrow("calibration_revision_source_required");
  });
});

describe("participation signals", () => {
  const asOf = "2026-09-29T00:00:00.000Z";
  const observations: ParticipationObservation[] = [
    { kind: "ATTENDANCE", id: "d1", date: "2026-09-20T00:00:00.000Z", present: false },
    { kind: "ATTENDANCE", id: "d2", date: "2026-09-21T00:00:00.000Z", present: true },
    { kind: "ASSIGNMENT", id: "h1", dueAt: "2026-09-15T00:00:00.000Z", submittedAt: null },
    { kind: "SESSION", id: "s1", startedAt: "2026-09-10T00:00:00.000Z", endedAt: null, completed: false },
    ...[1, 2, 3].map((n) => ({ kind: "RESPONSE" as const, id: `r${n}`, at: "2026-09-10T00:01:00.000Z", conceptId: A, responseMs: 900, correct: false, attempt: n })),
    { kind: "RESPONSE", id: "r1", at: "2026-09-10T00:01:00.000Z", conceptId: A, responseMs: 900, correct: false, attempt: 1 },
  ];

  it("reports only observable counts, de-duplicates replays, and never labels the learner", () => {
    const snapshot = deriveParticipationSignals({ observations, lastGovernedEvidenceAt: "2026-09-10T00:01:00.000Z", asOf });
    const byCode = Object.fromEntries(snapshot.signals.map((signal) => [signal.code, signal]));
    expect(byCode.REPEATED_RAPID_RESPONSES.value).toBe(3);
    expect(byCode.REPEATED_RAPID_RESPONSES.flagged).toBe(true);
    expect(byCode.ATTENDANCE_RATE.value).toBe(0.5);
    expect(byCode.ASSIGNMENT_COMPLETION.observationIds).toEqual(["h1"]);
    expect(byCode.INACTIVITY.flagged).toBe(true);
    expect(byCode.RETRIES.value).toBe(2);
    expect(JSON.stringify(snapshot)).not.toMatch(/motivat|frustrat|learning.?style|lazy|visual learner|effort|attitude|anxi/i);
    expect(snapshot.authority).toEqual({ observableOnly: true, infersPsychologicalState: false, mayChangeMastery: false });
  });

  it("turns inactivity into an explainable check-in candidate", async () => {
    const snap = await last(scenario("inactive", [{ day: 0, kind: "RELEASED_ITEM", conceptId: A, correct: true }],
      { checkpoints: [28], participation: observations }));
    const inactive = intervention(snap, "INACTIVITY")!;
    expect(inactive.triggeringEvidence.signalCodes).toEqual(expect.arrayContaining(["INACTIVITY", "ATTENDANCE_RATE", "ASSIGNMENT_COMPLETION"]));
    expect(inactive.recommendedAction.kind).toBe("CHECK_IN_WITH_LEARNER");
  });
});

describe("teacher accept / modify / override", () => {
  it("routes accept and modify through the governed TeacherOverride and rejects ungoverned candidates", async () => {
    const snap = await last(scenario("teacher", [{ day: 0, kind: "RELEASED_ITEM", conceptId: A, correct: false }]));
    const gap = intervention(snap, "PREREQUISITE_GAP", B)!;
    const candidates = generateLearningCandidates({ states: snap.states });
    const accepted = resolveTeacherInterventionResponse({ intervention: gap, candidates,
      response: { interventionId: gap.id, response: "ACCEPT", actorId: "synthetic-teacher", role: "TEACHER" } });
    expect(accepted.teacherOverride?.candidateId).toBe(gap.recommendedAction.candidateId);
    const decided = await resolveLearningDecision({ states: snap.states, release, calibration: snap.calibration,
      teacherOverride: accepted.teacherOverride!, currentRevision: async () => learnerStateRevision(snap.states, release), idempotencyKey: "teacher-1" });
    expect(decided.decision.reason).toBe("AUTHORIZED_TEACHER_OVERRIDE");
    expect(decided.resolution.earlyLearning).toBeNull();
    expect(() => resolveTeacherInterventionResponse({ intervention: gap, candidates,
      response: { interventionId: gap.id, response: "MODIFY", actorId: "t", role: "TEACHER", reason: "prefer other", candidateId: "invented" } }))
      .toThrow("intervention_candidate_not_governed");
    expect(() => resolveTeacherInterventionResponse({ intervention: gap, candidates,
      response: { interventionId: gap.id, response: "OVERRIDE", actorId: "t", role: "TEACHER" } })).toThrow("intervention_reason_required");
    const dismissed = resolveTeacherInterventionResponse({ intervention: gap, candidates,
      response: { interventionId: gap.id, response: "OVERRIDE", actorId: "t", role: "TEACHER", reason: "Learner was absent for that assessment." } });
    expect(dismissed).toMatchObject({ dismissed: true, teacherOverride: null });
  });

  it("applies a scheduled override inside the simulator", async () => {
    const result = await simulateLearnerPath(scenario("override", [{ day: 0, kind: "RELEASED_ITEM", conceptId: A, correct: true }],
      { teacherOverride: { atDay: 0, override: { candidateId: "g4-frac-bind-equal-parts-v1:diagnostic", actorId: "synthetic-teacher", role: "TEACHER", reason: "Recheck in class" } } }));
    expect(result.snapshots[0].decision.reason).toBe("AUTHORIZED_TEACHER_OVERRIDE");
  });
});

describe("duplicate evidence and no LLM authority", () => {
  it("duplicates do not inflate sufficiency and canonical evidence is never double-counted", async () => {
    const snap = await last(scenario("dup", [{ day: 0, kind: "RELEASED_ITEM", conceptId: A, correct: true }]));
    const quiz = createGovernedEvidence({
      evidenceId: "q1", idempotencyKey: "q1", attemptId: "q1", tenantId: "synthetic-tenant", schoolId: "synthetic-school",
      learner: { studentId: "synthetic-student", studentUserId: "synthetic-user" }, objective: { conceptId: A, objectiveId: "o" },
      activity: { activityId: "q", activityVersion: "1" }, evidenceType: "QUIZ", modality: "INTERACTIVE", occurredAt: START,
      performance: { outcome: "CORRECT", score: 9, maxScore: 10, correct: null, signals: [] },
      provenance: { source: "ONLINE", actorId: null, actorRole: "STUDENT", runtime: "WEB", recordedAt: START, clientEventId: null, syncBatchId: null },
      strength: { serverScored: true, humanVerified: false, assistanceUsed: false, retryCount: 0, hintCount: 0, independenceKey: "quiz-1", directness: "DIRECT", reliability: "UNASSESSED", policyRef: "p" },
      offline: { isOffline: false, syncIdentity: null },
      curriculum: { ontologyReleaseId: release.id, ontologyReleaseIdentity: deterministicReleaseIdentity(release) },
    });
    const once = calibrateLearner({ states: snap.states, release, enrollmentGrade: 4, asOf: snap.asOf, corroboratingEvidence: [quiz] });
    const twice = calibrateLearner({ states: snap.states, release, enrollmentGrade: 4, asOf: snap.asOf, corroboratingEvidence: [quiz, quiz] });
    expect(twice.calibration).toEqual(once.calibration);
    const canonicalId = est(snap, A).evidenceIds.positive[0];
    const echoed = calibrateLearner({ states: snap.states, release, enrollmentGrade: 4, asOf: snap.asOf,
      corroboratingEvidence: [{ ...quiz, evidenceId: canonicalId } as GovernedEvidence] });
    expect(echoed.calibration.competencies.find((entry) => entry.conceptId === A)!.sufficiency.effectiveOccasions).toBe(1);
    expect(() => calibrateLearner({ states: snap.states, release, enrollmentGrade: 4, asOf: snap.asOf,
      corroboratingEvidence: [quiz, { ...quiz, performance: { ...quiz.performance, score: 1 } } as GovernedEvidence] })).toThrow("evidence_idempotency_conflict");
  });

  it("equal-class records for one occasion resolve the same in any input order", async () => {
    const snap = await last(scenario("tie", [{ day: 0, kind: "RELEASED_ITEM", conceptId: A, correct: true }]));
    const record = (id: string, correct: boolean) => assessEvidenceQuality(createGovernedEvidence({
      evidenceId: id, idempotencyKey: id, attemptId: id, tenantId: "synthetic-tenant", schoolId: "synthetic-school",
      learner: { studentId: "synthetic-student", studentUserId: "synthetic-user" }, objective: { conceptId: A, objectiveId: "o" },
      activity: { activityId: "q", activityVersion: "1" }, evidenceType: "QUIZ", modality: "INTERACTIVE", occurredAt: START,
      performance: { outcome: correct ? "CORRECT" : "INCORRECT", score: correct ? 10 : 0, maxScore: 10, correct: null, signals: [] },
      provenance: { source: "ONLINE", actorId: null, actorRole: "STUDENT", runtime: "WEB", recordedAt: START, clientEventId: null, syncBatchId: null },
      strength: { serverScored: true, humanVerified: false, assistanceUsed: false, retryCount: 0, hintCount: 0, independenceKey: "same-occasion", directness: "DIRECT", reliability: "UNASSESSED", policyRef: "p" },
      offline: { isOffline: false, syncIdentity: null },
      curriculum: { ontologyReleaseId: release.id, ontologyReleaseIdentity: deterministicReleaseIdentity(release) },
    }), { asOf: snap.asOf });
    const state = snap.states.find((entry) => entry.scope.conceptId === A)!;
    const pass = record("tie-a", true), fail = record("tie-b", false);
    expect(pass.corroboration).toBe(fail.corroboration);
    expect(assessEvidenceSufficiency({ state, corroborating: [fail, pass] })).toEqual(assessEvidenceSufficiency({ state, corroborating: [pass, fail] }));
  });

  it("AI tutor practice and model rankings cannot change canonical mastery", async () => {
    const withTutor = await last(scenario("tutor", [
      { day: 0, kind: "RELEASED_ITEM", conceptId: A, correct: false },
      ...[1, 2, 3, 4].map((day) => ({ day, kind: "TUTOR_PRACTICE" as const, conceptId: A, correct: true })),
    ]));
    expect(est(withTutor, A).mastery.estimate).toBe(0);
    expect(est(withTutor, A).sufficiency.corroboration.WEAK).toBe(4);
    expect(est(withTutor, A).sufficiency.effectiveOccasions).toBe(1);
    const before = JSON.stringify(withTutor.states);
    const hostile: DecisionModel = { id: "llm", rank: async () => ({ modelId: "llm", confidence: 1, rankedCandidates: [{ id: "promote-to-grade-6", probability: 1 }] }) };
    const result = await resolveLearningDecision({ states: withTutor.states, release, calibration: withTutor.calibration, model: hostile,
      currentRevision: async () => learnerStateRevision(withTutor.states, release),
      currentCalibrationRevision: async () => withTutor.calibration.inputRevision, idempotencyKey: "llm" });
    expect(result.recommendation.fallbackReason).toBe("MODEL_UNAVAILABLE_OR_INVALID");
    expect(JSON.stringify(withTutor.states)).toBe(before);
    expect(withTutor.calibration.authority).toMatchObject({ llmMayWrite: false, mayWriteCanonicalMastery: false, mayChangeAdministrativeGrade: false });
    expect(result.decision.mayChangeAdministrativeGrade).toBe(false);
  });
});

describe("offline calibration model", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const sign = (serialized: string) => {
    const signer = createSign("RSA-SHA256"); signer.update(serialized); signer.end();
    return { signature: signer.sign(privateKey, "base64"), keyId: "synthetic-key" };
  };
  const verify = (serialized: string, signature: string, keyId: string) => {
    if (keyId !== "synthetic-key") return false;
    const verifier = createVerify("RSA-SHA256"); verifier.update(serialized); verifier.end();
    return verifier.verify(publicKey, signature, "base64");
  };

  function offlineQuiz(id: string, overrides: Partial<GovernedEvidence> = {}): GovernedEvidence {
    return createGovernedEvidence({
      evidenceId: id, idempotencyKey: `idem-${id}`, attemptId: id, tenantId: "synthetic-tenant", schoolId: "synthetic-school",
      learner: { studentId: "synthetic-student", studentUserId: "synthetic-user" }, objective: { conceptId: A, objectiveId: "o" },
      activity: { activityId: "offline-quiz", activityVersion: "1" }, evidenceType: "QUIZ", modality: "OFFLINE_PACKET",
      occurredAt: "2026-09-02T08:00:00.000Z",
      performance: { outcome: "CORRECT", score: 9, maxScore: 10, correct: null, signals: [] },
      provenance: { source: "OFFLINE", actorId: null, actorRole: "STUDENT", runtime: "SYNC", recordedAt: "2026-09-02T08:00:00.000Z", clientEventId: id, syncBatchId: "b1" },
      strength: { serverScored: true, humanVerified: false, assistanceUsed: false, retryCount: 0, hintCount: 0, independenceKey: `offline-${id}`, directness: "DIRECT", reliability: "UNASSESSED", policyRef: "p" },
      offline: { isOffline: true, syncIdentity: `sync-${id}` },
      curriculum: { ontologyReleaseId: release.id, ontologyReleaseIdentity: deterministicReleaseIdentity(release) },
      ...overrides,
    } as Parameters<typeof createGovernedEvidence>[0]);
  }

  it("signs a read-only projection the device can trust, and detects tampering, expiry and staleness", async () => {
    const snap = await last(scenario("offline", [{ day: 0, kind: "RELEASED_ITEM", conceptId: A, correct: true }]));
    const projection = buildSignedOfflineCalibrationProjection({ calibration: snap.calibration, estimates: snap.estimates, issuedAt: snap.asOf, ttlHours: 72, sign });
    expect(projection.payload.authority).toEqual({ readOnly: true, deviceMayWrite: false, canonicalSource: "CLOUD_STUDENT_LEARNING_MODEL" });
    expect(verifyOfflineCalibrationProjection({ projection, verify, now: snap.asOf })).toBe("TRUSTED");
    const tampered = { ...projection, payload: { ...projection.payload, stage: "STABLE" as const } };
    expect(verifyOfflineCalibrationProjection({ projection: tampered, verify, now: snap.asOf })).toBe("INVALID_SIGNATURE");
    expect(verifyOfflineCalibrationProjection({ projection, verify, now: "2026-09-30T00:00:00.000Z" })).toBe("EXPIRED");
    expect(verifyOfflineCalibrationProjection({ projection, verify, now: snap.asOf, currentRevision: "newer" })).toBe("STALE_REVISION");
  });

  it("replays queued observations idempotently and recomputes the same calibration server-side", async () => {
    const snap = await last(scenario("offline-replay", [{ day: 0, kind: "RELEASED_ITEM", conceptId: A, correct: true }], { checkpoints: [2] }));
    const projection = buildSignedOfflineCalibrationProjection({ calibration: snap.calibration, estimates: snap.estimates, issuedAt: snap.asOf, ttlHours: 24, sign });
    const q1 = offlineQuiz("q1");
    const q2 = offlineQuiz("q2");
    const foreign = offlineQuiz("q3", { learner: { studentId: "other", studentUserId: "other-user" } });
    const conflicting = offlineQuiz("q4", { idempotencyKey: "idem-q2" });
    const first = reconcileOfflineObservations({ projection, verify, release, queued: [q1, q2, q1, foreign, conflicting], alreadyAdmittedIdempotencyKeys: new Set() });
    expect(first.accepted.map((entry) => entry.evidenceId)).toEqual(["q1"]);
    expect(first.duplicateIds).toEqual(["q1"]);
    expect(first.rejected.map((entry) => entry.reason).sort()).toEqual(["evidence_idempotency_conflict", "evidence_idempotency_conflict", "offline_learner_mismatch"]);
    const replay = reconcileOfflineObservations({ projection, verify, release, queued: [q1], alreadyAdmittedIdempotencyKeys: new Set(["idem-q1"]) });
    expect(replay.accepted).toHaveLength(0);
    expect(replay.projectionSuperseded).toBe(false);
    const online = calibrateLearner({ states: snap.states, release, enrollmentGrade: 4, asOf: snap.asOf, corroboratingEvidence: first.accepted });
    const afterSync = calibrateLearner({ states: snap.states, release, enrollmentGrade: 4, asOf: snap.asOf, corroboratingEvidence: [...first.accepted, ...first.accepted] });
    expect(afterSync.calibration).toEqual(online.calibration);
    expect(first.accepted.every((entry) => entry.canonicalMasteryMutation === false)).toBe(true);
  });

  it("authenticates the projection before using its scope", async () => {
    const snap = await last(scenario("offline-forged", [{ day: 0, kind: "RELEASED_ITEM", conceptId: A, correct: true }]));
    const projection = buildSignedOfflineCalibrationProjection({ calibration: snap.calibration, estimates: snap.estimates, issuedAt: snap.asOf, ttlHours: 24, sign });
    const forged = { ...projection, payload: { ...projection.payload, scope: { ...projection.payload.scope, studentId: "victim", studentUserId: "victim-user" } } };
    const victimQuiz = offlineQuiz("v1", { learner: { studentId: "victim", studentUserId: "victim-user" } });
    expect(() => reconcileOfflineObservations({ projection: forged, verify, release, queued: [victimQuiz], alreadyAdmittedIdempotencyKeys: new Set() }))
      .toThrow("offline_projection_untrusted");
    expect(() => reconcileOfflineObservations({ projection: { ...projection, keyId: "unknown" }, verify, release, queued: [], alreadyAdmittedIdempotencyKeys: new Set() }))
      .toThrow("offline_projection_untrusted");
  });

  it("re-admits device records: asserted trust is discarded and scorable items are re-scored", async () => {
    const snap = await last(scenario("offline-readmit", [{ day: 0, kind: "RELEASED_ITEM", conceptId: A, correct: true }]));
    const projection = buildSignedOfflineCalibrationProjection({ calibration: snap.calibration, estimates: snap.estimates, issuedAt: snap.asOf, ttlHours: 24, sign });
    const claimed = offlineQuiz("c1");
    const forgedTrust = offlineQuiz("c2", { strength: { ...claimed.strength, independenceKey: "offline-c2", serverScored: true, humanVerified: true, reliability: "VERIFIED" } });
    const teacherClaim = offlineQuiz("c3", { provenance: { ...claimed.provenance, source: "TEACHER", actorRole: "TEACHER" } });
    const result = reconcileOfflineObservations({ projection, verify, release, queued: [forgedTrust, teacherClaim], alreadyAdmittedIdempotencyKeys: new Set() });
    expect(result.rejected).toEqual([{ evidenceId: "c3", reason: "offline_provenance_invalid" }]);
    expect(result.accepted[0].strength).toMatchObject({ serverScored: false, humanVerified: false, reliability: "UNASSESSED" });
    const assessedAt = "2026-09-03T00:00:00.000Z";
    expect(assessEvidenceQuality(result.accepted[0], { asOf: assessedAt }).corroboration)
      .not.toBe(assessEvidenceQuality(forgedTrust, { asOf: assessedAt }).corroboration);

    const binding = release.bindings.find((entry) => entry.conceptId === A)!;
    const item = release.items.find((entry) => entry.id === binding.itemId && entry.version === binding.itemVersion)!;
    const wrongIndex = (item.correctIndex + 1) % item.options.length;
    const scored = (id: string, selectedAnswerIndex: number, correct: boolean) => offlineQuiz(id, {
      evidenceType: item.context === "DIAGNOSTIC" ? "DIAGNOSTIC" : "PRACTICE",
      activity: { activityId: item.id, activityVersion: item.version },
      performance: { outcome: correct ? "CORRECT" : "INCORRECT", score: null, maxScore: null, correct, selectedAnswerIndex, signals: [] },
    });
    const honest = scored("s1", item.correctIndex, true), lying = scored("s2", wrongIndex, true);
    const rescored = reconcileOfflineObservations({ projection, verify, release, queued: [honest, lying], alreadyAdmittedIdempotencyKeys: new Set() });
    expect(rescored.accepted.map((entry) => [entry.evidenceId, entry.strength.serverScored, entry.performance.correct])).toEqual([["s1", true, true]]);
    expect(rescored.rejected).toEqual([{ evidenceId: "s2", reason: "evidence_result_mismatch" }]);
  });
});

describe("simulator", () => {
  it("refuses unlabeled data and prints every stage of the loop", async () => {
    await expect(simulateLearnerPath({ ...scenario("x", []), label: "real" as typeof SYNTHETIC_LABEL })).rejects.toThrow("simulator_requires_synthetic_label");
    const trace = formatSimulationTrace(await simulateLearnerPath(scenario("trace", priorHistorySteps, { checkpoints: [1] })));
    for (const stage of [SYNTHETIC_LABEL, "calibration:", "SLM ", "confidence=", "retention=", "misconception=", "DecisionModel:", "Orchestrator:"]) {
      expect(trace).toContain(stage);
    }
  });
});
