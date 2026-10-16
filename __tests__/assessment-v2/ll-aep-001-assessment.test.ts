import { createHash } from "crypto";
import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  acceptClientObservation,
  assertSummativeDesign,
  authenticWorkRubricGaps,
  authorizeRelease,
  demandTier,
  evaluateDifficultyBlueprint,
  gradebookEligibility,
  isIndependentAssessment,
  learnerDisclosure,
  LL_RETENTION_PILOT_POLICY,
  planRetentionOpportunities,
  projectItemForLearner,
  reconcileMarks,
  recordModeratedScore,
  recordSecondMark,
  resolveRetentionPolicy,
  scoreAttemptForm,
  scoreResponse,
  sealItem,
  tutorAccessFor,
  verifyObservation,
  type AssessmentItemV2,
  type ModerationPolicy,
  type ProtectedScoringSpec,
  type ServerAttemptContext,
} from "@/lib/assessment/v2";
import { approve, buildDefinition, buildForm, buildItems, buildReleased, CURRICULUM, definitionSubject, formSubject, itemSubject, LEAD, REVIEWER_A, REVIEWER_B, SCHOOL, specFor } from "./fixtures";

/** Identical in the assessment (PR #193) and records (PR #194) branches. Update both copies together. */
const LL_AEP_001_SOURCE_DIGEST = "c69ddd89e743400707ddd6e26fcda4f9cd3a6dbb137531c30eed1279572d2561";

function variant(item: AssessmentItemV2, spec: ProtectedScoringSpec, overrides: Partial<AssessmentItemV2>): AssessmentItemV2 {
  const { itemHash: _h, scoringSpecHash: _s, ...rest } = item;
  return sealItem({ ...rest, ...overrides }, spec);
}

/** A Grades 4–12 summative set: 20/35/30/15 by approved form points. */
function summativeSet(points = { single: 4, numeric: 7, ordering: 6, worked: 3 }) {
  const built = buildItems();
  const single = variant(built.single, built.singleSpec, { cognitiveDemand: "RECALL" });
  const ordering = variant(built.ordering, built.orderingSpec, { cognitiveDemand: "ANALYZE" });
  const items = [single, built.numeric, ordering, built.worked];
  const specs = [built.singleSpec, built.numericSpec, built.orderingSpec, built.rubricSpec];
  const definition = buildDefinition({ purpose: "SUMMATIVE" });
  const pointList = [points.single, points.numeric, points.ordering, points.worked];
  const refs = items.map((item, index) => ({ itemId: item.itemId, itemVersion: item.version, itemHash: item.itemHash, points: pointList[index] }));
  const form = buildForm(definition, items, { items: refs, blueprint: { blueprintVersion: "1", totalPoints: pointList.reduce((a, b) => a + b, 0), objectiveCoverage: [{ objectiveId: "obj-compare", minItems: 1 }] } });
  const subjects = [definitionSubject(definition), formSubject(form), ...items.map(itemSubject)];
  const reviews = [...subjects.map((subject) => approve(subject, REVIEWER_A)), ...subjects.map((subject) => approve(subject, REVIEWER_B))];
  return { items, specs, definition, form, reviews, itemMap: new Map(items.map((item) => [`${item.itemId}@${item.version}`, item])) };
}

const releaseArgs = { releaseId: "rel-s", permittedModes: ["OFFICIAL" as const], effectiveFrom: "2026-10-01T00:00:00.000Z", effectiveUntil: null, schoolId: SCHOOL, actor: LEAD, authorizedAt: "2026-10-02T00:00:00.000Z" };

describe("LL-AEP-001 shared policy", () => {
  it("is byte-identical to the academic-records copy", () => {
    const source = readFileSync(path.resolve(__dirname, "../../lib/academic-policy/llAep001.ts"), "utf8").replace(/\r\n/g, "\n");
    expect(createHash("sha256").update(source).digest("hex")).toBe(LL_AEP_001_SOURCE_DIGEST);
  });
});

describe("Difficulty and cognitive-demand blueprint", () => {
  it("maps items to demand tiers; NEW-context and CREATE items are transfer/creation", () => {
    expect(demandTier({ cognitiveDemand: "RECALL", context: "REHEARSED" })).toBe("FOUNDATIONAL");
    expect(demandTier({ cognitiveDemand: "APPLY", context: "REHEARSED" })).toBe("APPLICATION");
    expect(demandTier({ cognitiveDemand: "EVALUATE", context: "NEAR" })).toBe("ANALYSIS");
    expect(demandTier({ cognitiveDemand: "APPLY", context: "NEW" })).toBe("TRANSFER_CREATION");
    expect(demandTier({ cognitiveDemand: "CREATE", context: "REHEARSED" })).toBe("TRANSFER_CREATION");
  });

  it("measures summative marks against the Grades 4–12 target 20/35/30/15", () => {
    const { form, itemMap } = summativeSet();
    expect(evaluateDifficultyBlueprint(form, itemMap, 7)).toMatchObject({ blueprintId: "ll-summative-g4-12", withinTarget: true, actualPercent: { FOUNDATIONAL: 20, APPLICATION: 35, ANALYSIS: 30, TRANSFER_CREATION: 15 } });
    const recallHeavy = summativeSet({ single: 14, numeric: 3, ordering: 2, worked: 1 });
    expect(evaluateDifficultyBlueprint(recallHeavy.form, recallHeavy.itemMap, 7).withinTarget).toBe(false);
    expect(evaluateDifficultyBlueprint(recallHeavy.form, recallHeavy.itemMap, 2).blueprintId).toBe("ll-summative-g1-3");
  });

  it("gates summative release on the blueprint, with documented non-author exceptions", () => {
    const ok = summativeSet();
    expect(authorizeRelease({ ...releaseArgs, ...ok }).release.items).toHaveLength(4);
    const off = summativeSet({ single: 14, numeric: 3, ordering: 2, worked: 1 });
    expect(() => authorizeRelease({ ...releaseArgs, ...off })).toThrow("assessment_blueprint_outside_target_without_exception");
    const authorException = { reason: "Foundational unit reviewing prerequisite number facts", basis: "subject structure", approvedBy: "agent:item-writer" };
    expect(() => authorizeRelease({ ...releaseArgs, ...off, blueprintException: authorException })).toThrow("assessment_blueprint_exception_requires_non_author");
    expect(authorizeRelease({ ...releaseArgs, ...off, blueprintException: { ...authorException, approvedBy: "lead-1" } }).release).toBeTruthy();
  });

  it("makes higher-order and transfer items mandatory for Grades 4–12 summative forms, even with an exception", () => {
    const set = summativeSet();
    const noTransfer = new Map(set.itemMap);
    const worked = set.items[3];
    noTransfer.set(`${worked.itemId}@${worked.version}`, { ...worked, context: "REHEARSED", cognitiveDemand: "APPLY" });
    const exception = { reason: "Documented exception for a shortened accommodation form", basis: "accessibility", approvedBy: "lead-1" };
    expect(() => assertSummativeDesign({ definition: set.definition, form: set.form, items: noTransfer, exception })).toThrow("assessment_summative_requires_transfer_item");
  });
});

describe("Authentic work rubrics", () => {
  it("requires reasoning, evidence, accuracy, originality, communication and reflection for essays and projects", () => {
    const built = buildItems();
    const thin = specFor("i-essay", { kind: "RUBRIC", rubric: { rubricId: "r-essay", rubricVersion: "1", criteria: [
      { criterionId: "c1", title: "Argument", dimension: "REASONING", levels: [{ points: 0, descriptor: "None" }, { points: 2, descriptor: "Clear claim and reasons" }] },
    ] } }, 2);
    const essay = variant({ ...built.worked, itemId: "i-essay" }, thin, { itemType: "EXTENDED_WRITING" });
    expect(authenticWorkRubricGaps(essay, thin)).toEqual(["dimension_missing:EVIDENCE", "dimension_missing:ACCURACY", "dimension_missing:ORIGINALITY", "dimension_missing:COMMUNICATION", "dimension_missing:REFLECTION"]);
    const dims = ["REASONING", "EVIDENCE", "ACCURACY", "ORIGINALITY", "COMMUNICATION", "REFLECTION"];
    const full = specFor("i-essay", { kind: "RUBRIC", rubric: { rubricId: "r-essay", rubricVersion: "2", criteria: dims.map((dimension) => ({ criterionId: dimension, title: dimension, dimension, levels: [{ points: 0, descriptor: `No ${dimension}` }, { points: 1, descriptor: `Shows ${dimension}` }] })) } }, 6);
    expect(authenticWorkRubricGaps(variant({ ...built.worked, itemId: "i-essay" }, full, { itemType: "EXTENDED_WRITING" }), full)).toEqual([]);
    expect(authenticWorkRubricGaps(built.worked, built.rubricSpec)).toEqual([]); // worked solutions are not authentic-work items
  });
});

describe("Independent assessment integrity", () => {
  it("blocks the AI Tutor in independent assessment and allows it in learning mode", () => {
    expect(tutorAccessFor({ mode: "OFFICIAL", official: true, purpose: "FORMATIVE" })).toBe("BLOCKED");
    expect(tutorAccessFor({ mode: "PRACTICE_UNOFFICIAL", official: false, purpose: "RETENTION" })).toBe("BLOCKED");
    expect(tutorAccessFor({ mode: "PRACTICE_UNOFFICIAL", official: false, purpose: "FORMATIVE" })).toBe("INSTRUCTIONAL");
    expect(isIndependentAssessment({ mode: "PRACTICE_UNOFFICIAL", official: false, purpose: "EXAMINATION" })).toBe(true);
  });

  it("offers no hints and defers explanations until the attempt closes during independent assessment", () => {
    const { single, singleSpec } = buildItems();
    expect(projectItemForLearner(single, { attemptId: "a", points: 1 }).hintCount).toBe(1);
    expect(projectItemForLearner(single, { attemptId: "a", points: 1, independent: true }).hintCount).toBe(0);
    expect(learnerDisclosure(single, singleSpec, "AFTER_RESPONSE", { independent: true }).explanation).toBeNull();
    expect(learnerDisclosure(single, singleSpec, "AFTER_ATTEMPT_CLOSED", { independent: true }).explanation).toBe(singleSpec.explanation);
  });

  it("records tutor and hint use during independent assessment as integrity flags and keeps it out of the gradebook", () => {
    const { context, release, single, singleSpec } = officialContext();
    const raw = acceptClientObservation(sub({ assistance: { ...NONE, aiTutorUsed: true, hintsRevealed: 1 } }), context);
    expect(raw.integrityFlags).toEqual(["ai_tutor_used_during_independent_assessment", "hints_used_during_independent_assessment"]);
    const { evidence } = verifyObservation(raw, { outcome: scoreResponse(single, singleSpec, { kind: "SINGLE_SELECT", optionId: "a" }), release, revocations: [], moderation: null, recordedBy: { kind: "SYSTEM", id: "s", role: null }, recordedAt: "2026-11-01T10:00:06.000Z" });
    expect(gradebookEligibility(evidence, { gradingPolicy: { schoolId: SCHOOL, policyId: "p", version: "1", status: "APPROVED" }, revocations: [] }).reason).toBe("integrity_review_required");
  });

  it("refuses new responses after submission and capture times in the future", () => {
    const { context } = officialContext();
    const submitted = { ...context, attempt: { ...context.attempt, status: "SUBMITTED" as const, submittedAt: "2026-11-01T09:30:00.000Z" } };
    expect(() => acceptClientObservation(sub({}), submitted)).toThrow("assessment_attempt_already_submitted");
    const offlineBefore = sub({ capture: { source: "OFFLINE", deviceId: "tab-1", clientEventId: "e", clientSequence: 0, capturedAt: "2026-11-01T09:00:00.000Z", syncBatchId: "b" } });
    expect(acceptClientObservation(offlineBefore, submitted).tier).toBe("RAW_OBSERVATION");
    expect(() => acceptClientObservation(sub({ capture: { ...sub({}).capture, capturedAt: "2026-11-01T11:00:00.000Z" } }), context)).toThrow("assessment_capture_time_in_future");
  });
});

const NONE = { hintsRevealed: 0, aiTutorUsed: false, explanationSeenBeforeResponse: false, answerRevealedBeforeResponse: false, prohibitedToolUsed: false, peerCollaboration: false };
function sub(overrides: Record<string, unknown>) {
  return {
    attemptId: "att-1", itemId: "i-single", itemVersion: "1.0.0", responseSequence: 0, responseId: "r-1", responseDigest: "sha256:a", assistance: NONE,
    capture: { source: "ONLINE" as const, deviceId: null, clientEventId: "e-1", clientSequence: 0, capturedAt: "2026-11-01T10:00:00.000Z", syncBatchId: null },
    ...overrides,
  } as Parameters<typeof acceptClientObservation>[0];
}
function officialContext(itemKey: "single" | "worked" = "single", purpose: ServerAttemptContext["delivery"]["purpose"] = "FORMATIVE") {
  const released = buildReleased();
  const item = released[itemKey];
  const context: ServerAttemptContext = {
    session: { studentId: "stu-1", studentUserId: "u-1", schoolId: SCHOOL, tenantId: "t-1" },
    attempt: { attemptId: "att-1", sessionId: "ses-1", studentId: "stu-1", schoolId: SCHOOL, enrollmentId: "enr-1", classId: "c-1", status: "OPEN" },
    pins: {
      definitionId: released.definition.definitionId, definitionVersion: released.definition.version, definitionHash: released.definition.contentHash,
      formId: released.form.formId, formVersion: released.form.version, formHash: released.form.formHash,
      itemId: item.itemId, itemVersion: item.version, itemHash: item.itemHash, scoringSpecHash: item.scoringSpecHash,
      releaseId: released.release.releaseId, releaseHash: released.release.releaseHash,
      curriculumReleaseId: CURRICULUM.releaseId, curriculumReleaseIdentity: CURRICULUM.releaseIdentity,
    },
    objectiveIds: ["obj-compare"],
    delivery: { mode: "OFFICIAL", official: true, purpose, itemContext: item.context, runtime: "WEB", accommodations: [], allowedToolIds: [] },
    receivedAt: "2026-11-01T10:00:05.000Z",
  };
  return { ...released, context };
}

describe("Human moderation, high-stakes second marking and examiner reconciliation", () => {
  const policy: ModerationPolicy = { policyId: "mod-1", version: "1", moderatorRoles: ["TEACHER", "EXAMINER"], requiresSecondMarker: false, reconciliationTolerancePercent: 10, examinerRoles: ["EXAMINER"] };
  const teacherA = { kind: "HUMAN" as const, id: "t-a", role: "TEACHER", schoolId: SCHOOL };
  const teacherB = { kind: "HUMAN" as const, id: "t-b", role: "TEACHER", schoolId: SCHOOL };
  const examiner = { kind: "HUMAN" as const, id: "ex-1", role: "EXAMINER", schoolId: SCHOOL };
  const full = [{ criterionId: "decision", points: 1 }, { criterionId: "reason", points: 1 }];
  const half = [{ criterionId: "decision", points: 1 }, { criterionId: "reason", points: 0 }];

  function firstMark(purpose: "SUMMATIVE" | "FORMATIVE", scores = full) {
    const { worked, rubricSpec } = buildItems();
    const pending = scoreResponse(worked, rubricSpec, { kind: "TEXT", text: "No; 0.70 > 0.65 because 7 tenths > 6 tenths." });
    return { worked, rubricSpec, first: recordModeratedScore({ pending, item: worked, spec: rubricSpec, moderator: teacherA, attemptSchoolId: SCHOOL, purpose, policy, criterionScores: scores, aiSuggestion: null, moderatedAt: "2026-11-02T00:00:00.000Z" }) };
  }

  it("requires second marking for summative work even when the policy does not ask for it", () => {
    expect(firstMark("FORMATIVE").first.moderation).toMatchObject({ secondMarkerRequired: false, marking: "SINGLE" });
    expect(firstMark("SUMMATIVE").first.moderation).toMatchObject({ secondMarkerRequired: true, marking: "SINGLE" });
  });

  it("refuses single-marked high-stakes scores as verified evidence", () => {
    const { context, release } = officialContext("worked", "SUMMATIVE");
    const raw = acceptClientObservation(sub({ itemId: "i-worked" }), context);
    const { first } = firstMark("SUMMATIVE");
    expect(() => verifyObservation(raw, { outcome: first.outcome, release, revocations: [], moderation: first.moderation, recordedBy: { kind: "HUMAN", id: "t-a", role: "TEACHER" }, recordedAt: "2026-11-02T00:00:01.000Z" })).toThrow("assessment_second_marking_required");
    // A forged "not required" flag on a high-stakes purpose is refused too.
    expect(() => verifyObservation(raw, { outcome: first.outcome, release, revocations: [], moderation: { ...first.moderation, secondMarkerRequired: false }, recordedBy: { kind: "HUMAN", id: "t-a", role: "TEACHER" }, recordedAt: "2026-11-02T00:00:01.000Z" })).toThrow("assessment_second_marking_required");
  });

  it("agrees within tolerance, sends disagreements to an independent examiner, and verifies the result", () => {
    const { worked, rubricSpec, first } = firstMark("SUMMATIVE");
    const args = { item: worked, spec: rubricSpec, attemptSchoolId: SCHOOL, policy, markedAt: "2026-11-03T00:00:00.000Z" };
    expect(() => recordSecondMark(first, { ...args, marker: teacherA, criterionScores: full })).toThrow("assessment_second_marker_must_be_independent");
    const agreed = recordSecondMark(first, { ...args, marker: teacherB, criterionScores: full });
    expect("moderation" in agreed && agreed.moderation.marking).toBe("AGREED");
    const disagreement = recordSecondMark(first, { ...args, marker: teacherB, criterionScores: half });
    expect(disagreement).toMatchObject({ status: "RECONCILIATION_REQUIRED", difference: 1 });
    if (!("status" in disagreement)) throw new Error("expected disagreement");
    const recArgs = { item: worked, spec: rubricSpec, attemptSchoolId: SCHOOL, policy, criterionScores: half, rationale: "Reason does not compare tenths before hundredths.", reconciledAt: "2026-11-04T00:00:00.000Z" };
    expect(() => reconcileMarks(disagreement, { ...recArgs, examiner: { ...examiner, id: "t-b" } })).toThrow("assessment_examiner_must_be_independent");
    expect(() => reconcileMarks(disagreement, { ...recArgs, examiner: { ...teacherA, id: "t-c" } })).toThrow("assessment_examiner_role_required");
    const reconciled = reconcileMarks(disagreement, { ...recArgs, examiner });
    expect(reconciled).toMatchObject({ moderation: { marking: "RECONCILED" }, outcome: { points: 1 } });
    expect(reconciled.marks).toHaveLength(3);
    const { context, release } = officialContext("worked", "SUMMATIVE");
    const raw = acceptClientObservation(sub({ itemId: "i-worked" }), context);
    const { evidence } = verifyObservation(raw, { outcome: reconciled.outcome, release, revocations: [], moderation: reconciled.moderation, recordedBy: { kind: "HUMAN", id: "ex-1", role: "EXAMINER" }, recordedAt: "2026-11-04T00:00:01.000Z" });
    expect(evidence.scoring).toMatchObject({ scorerAuthority: "HUMAN_MODERATOR", points: 1, moderation: { marking: "RECONCILED" } });
  });
});

describe("Approved points and blank-response semantics", () => {
  it("scores blanks as BLANK (0) and keeps them verifiable, distinct from invalid responses", () => {
    const { single, singleSpec, worked, rubricSpec } = buildItems();
    expect(scoreResponse(single, singleSpec, { kind: "BLANK" })).toMatchObject({ status: "BLANK", points: 0, scorerAuthority: "SERVER_KEYED" });
    expect(scoreResponse(worked, rubricSpec, { kind: "TEXT", text: "" })).toMatchObject({ status: "BLANK", points: 0 });
    expect(scoreResponse(single, singleSpec, { kind: "SINGLE_SELECT", optionId: "zz" }).status).toBe("INVALID_RESPONSE");
    const { context, release } = officialContext();
    const raw = acceptClientObservation(sub({}), context);
    const { evidence } = verifyObservation(raw, { outcome: scoreResponse(single, singleSpec, { kind: "BLANK" }), release, revocations: [], moderation: null, recordedBy: { kind: "SYSTEM", id: "s", role: null }, recordedAt: "2026-11-01T10:00:06.000Z" });
    expect(evidence.scoring).toMatchObject({ status: "BLANK", points: 0 });
  });

  it("totals an attempt with the form's approved points, not each item's raw maximum", () => {
    const set = summativeSet();
    const [single, numeric, ordering, worked] = set.items;
    const [singleSpec, numericSpec, orderingSpec] = set.specs;
    const outcomes = new Map([
      [`${single.itemId}@1.0.0`, scoreResponse(single, singleSpec, { kind: "SINGLE_SELECT", optionId: "a" })],
      [`${numeric.itemId}@1.0.0`, scoreResponse(numeric, numericSpec, { kind: "NUMERIC", value: "7000", unit: "km" })],
      [`${ordering.itemId}@1.0.0`, scoreResponse(ordering, orderingSpec, { kind: "BLANK" })],
    ]);
    expect(scoreAttemptForm({ form: set.form, outcomes, submitted: false }).status).toBe("IN_PROGRESS");
    const submitted = scoreAttemptForm({ form: set.form, outcomes, submitted: true });
    // single 4/4 + numeric 7 × 0.5 + ordering blank 0 + worked not answered 0 = 7.5 of 20.
    expect(submitted).toMatchObject({ status: "SCORED", earnedPoints: 7.5, possiblePoints: 20 });
    expect(submitted.items.find((item) => item.itemId === worked.itemId)).toMatchObject({ status: "NOT_ANSWERED", earned: 0 });
    const invalid = new Map(outcomes).set(`${single.itemId}@1.0.0`, scoreResponse(single, singleSpec, { kind: "SINGLE_SELECT", optionId: "zz" }));
    expect(scoreAttemptForm({ form: set.form, outcomes: invalid, submitted: true })).toMatchObject({ status: "NEEDS_RESOLUTION", earnedPoints: null });
  });
});

describe("7-day and 21-day retention pilot", () => {
  it("applies to every grade and subject by default and plans opportunities only", () => {
    expect(resolveRetentionPolicy([LL_RETENTION_PILOT_POLICY], 3, "READING")?.policyId).toBe("ll-aep-001-retention-pilot");
    const plan = planRetentionOpportunities({ studentId: "s", objectiveIds: ["obj-a"], instructionCompletedAt: "2026-11-02T00:00:00.000Z", policy: LL_RETENTION_PILOT_POLICY });
    expect(plan.map((opportunity) => [opportunity.intervalDays, opportunity.dueAt.slice(0, 10), opportunity.isEvidence])).toEqual([[7, "2026-11-09", false], [21, "2026-11-23", false]]);
  });

  it("supports documented exceptions and refuses undocumented ones", () => {
    const withException = { ...LL_RETENTION_PILOT_POLICY, exceptions: [{ objectiveId: "obj-a", reason: "One-off orientation competency, not retained", approvedBy: "lead-1" }] };
    expect(planRetentionOpportunities({ studentId: "s", objectiveIds: ["obj-a"], instructionCompletedAt: "2026-11-02T00:00:00.000Z", policy: withException })).toEqual([]);
    expect(planRetentionOpportunities({ studentId: "s", objectiveIds: ["obj-a", "obj-b"], instructionCompletedAt: "2026-11-02T00:00:00.000Z", policy: withException })[0].objectiveIds).toEqual(["obj-b"]);
    const undocumented = { ...LL_RETENTION_PILOT_POLICY, exceptions: [{ objectiveId: "obj-a", reason: "no", approvedBy: "" }] };
    expect(() => planRetentionOpportunities({ studentId: "s", objectiveIds: ["obj-a"], instructionCompletedAt: "2026-11-02T00:00:00.000Z", policy: undocumented })).toThrow("assessment_retention_policy_invalid");
  });
});
