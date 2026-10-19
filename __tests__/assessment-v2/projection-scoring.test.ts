import { describe, expect, it } from "vitest";
import {
  assertLearnerSafe,
  buildOfflineAssessmentPackage,
  isServerAutoScorable,
  learnerDisclosure,
  parseLearnerNumber,
  projectFormForLearner,
  projectLegacyExamQuestionForLearner,
  protectedStrings,
  recordModeratedScore,
  resolveDelivery,
  scoreResponse,
  type ModerationPolicy,
} from "@/lib/assessment/v2";
import { buildItems, buildReleased, CURRICULUM, SCHOOL } from "./fixtures";

const now = "2026-11-01T00:00:00.000Z";

function officialDelivery() {
  const released = buildReleased();
  const delivery = resolveDelivery({ mode: "OFFICIAL", now, requester: { role: "STUDENT", schoolId: SCHOOL }, release: released.release, revocations: [], expectedCurriculum: CURRICULUM });
  return { ...released, delivery };
}

describe("Learner-safe projection", () => {
  it("contains no answer keys, scoring rules, explanations, rubric descriptors or moderation notes", () => {
    const { form, definition, release, itemMap, items, specs, delivery } = officialDelivery();
    const projected = projectFormForLearner({ form, definition, release, items: itemMap, attemptId: "att-1", delivery });
    expect(projected.official).toBe(true);
    expect(() => assertLearnerSafe(projected, protectedStrings(items, specs))).not.toThrow();
    const serialized = JSON.stringify(projected);
    for (const forbidden of ["correctOptionId", "acceptedAnswers", "460,003.025", "Seven tenths is greater", "Compares tenths before hundredths", "Accept equivalent wording", "scoringSpecHash", "itemHash", "misconceptionSignals"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("builds offline packages from the pre-response projection only", () => {
    const { form, definition, release, itemMap, items, specs, delivery } = officialDelivery();
    const pkg = buildOfflineAssessmentPackage({ form, definition, release, items: itemMap, attemptId: "att-off", delivery });
    expect(pkg).toMatchObject({ capture: "CAPTURE_ONLY", scoring: "SERVER_AFTER_SYNC" });
    expect(() => assertLearnerSafe(pkg, protectedStrings(items, specs))).not.toThrow();
    const prohibited = { ...form, delivery: { ...form.delivery, offlineDelivery: "PROHIBITED" as const } };
    expect(() => buildOfflineAssessmentPackage({ form: prohibited, definition, release, items: itemMap, attemptId: "x", delivery })).toThrow("assessment_offline_delivery_prohibited");
  });

  it("refuses to project a denied delivery or a form whose item pins drifted", () => {
    const { form, definition, release, itemMap, delivery, items } = officialDelivery();
    const denied = resolveDelivery({ mode: "OFFICIAL", now, requester: { role: "STUDENT", schoolId: SCHOOL }, release: null, revocations: [], expectedCurriculum: null });
    expect(() => projectFormForLearner({ form, definition, release, items: itemMap, attemptId: "a", delivery: denied })).toThrow(/assessment_delivery_denied/);
    const drifted = new Map(itemMap);
    drifted.set(`${items[0].itemId}@${items[0].version}`, { ...items[0], itemHash: "different" });
    expect(() => projectFormForLearner({ form, definition, release, items: drifted, attemptId: "a", delivery })).toThrow("assessment_projection_item_pin_mismatch");
  });

  it("detects leakage through protected field names and protected values", () => {
    const { items, specs } = buildItems();
    const secrets = protectedStrings(items, specs);
    expect(() => assertLearnerSafe({ items: [{ correctIndex: 1 }] }, secrets)).toThrow("assessment_learner_payload_leak_field:correctIndex");
    expect(() => assertLearnerSafe({ note: "460,003.025" }, secrets)).toThrow("assessment_learner_payload_leak_value");
    expect(() => assertLearnerSafe({ explanation: "hidden" }, secrets)).toThrow(/leak_field:explanation/);
  });

  it("does not present ordering elements in the authored (key) order", () => {
    const { ordering } = buildItems();
    const { form, definition, release, itemMap, delivery } = officialDelivery();
    const orders = ["a1", "a2", "a3", "a4", "a5", "a6"].map((attemptId) => projectFormForLearner({ form, definition, release, items: itemMap, attemptId, delivery })
      .items.find((item) => item.itemId === ordering.itemId)!.orderingElements.map((element) => element.optionId).join(","));
    expect(orders.some((order) => order !== "e1,e2,e3,e4")).toBe(true);
    // Deterministic per attempt (resumes and offline replays see the same order).
    expect(projectFormForLearner({ form, definition, release, items: itemMap, attemptId: "a1", delivery }).items[2].orderingElements)
      .toEqual(projectFormForLearner({ form, definition, release, items: itemMap, attemptId: "a1", delivery }).items[2].orderingElements);
  });

  it("discloses explanations and answers only as the feedback policy allows", () => {
    const { single, singleSpec } = buildItems();
    expect(learnerDisclosure(single, singleSpec, "BEFORE_RESPONSE", { delivery: { mode: "PRACTICE_UNOFFICIAL", official: false, purpose: "FORMATIVE" }, attemptStatus: "CLOSED" })).toEqual({ explanation: null, correctResponse: null });
    expect(learnerDisclosure(single, singleSpec, "AFTER_RESPONSE", { delivery: { mode: "PRACTICE_UNOFFICIAL", official: false, purpose: "FORMATIVE" }, attemptStatus: "CLOSED" })).toEqual({ explanation: singleSpec.explanation, correctResponse: null });
    expect(learnerDisclosure(single, singleSpec, "AFTER_ATTEMPT_CLOSED", { delivery: { mode: "PRACTICE_UNOFFICIAL", official: false, purpose: "FORMATIVE" }, attemptStatus: "CLOSED" })).toEqual({ explanation: singleSpec.explanation, correctResponse: "0.7" });
    const never = { ...single, feedbackPolicy: { hints: "NONE" as const, explanation: "NEVER" as const, correctAnswer: "NEVER" as const } };
    expect(learnerDisclosure(never, singleSpec, "AFTER_RELEASE_WINDOW", { delivery: { mode: "PRACTICE_UNOFFICIAL", official: false, purpose: "FORMATIVE" }, attemptStatus: "CLOSED" })).toEqual({ explanation: null, correctResponse: null });
  });

  it("projects legacy exam questions without key or worked explanation", () => {
    const projected = projectLegacyExamQuestionForLearner({ id: "q1", examId: "e1", prompt: "2+2?", options: ["3", "4"], correctIndex: 1, explanation: "Two plus two is four.", moeCode: "M1", points: 2 });
    expect(projected).toEqual({ id: "q1", examId: "e1", prompt: "2+2?", options: ["3", "4"], moeCode: "M1", points: 2 });
  });
});

describe("Server-authoritative scoring", () => {
  const items = buildItems();

  it("scores single-select from the protected key and flags mapped misconceptions", () => {
    expect(scoreResponse(items.single, items.singleSpec, { kind: "SINGLE_SELECT", optionId: "a" })).toMatchObject({ status: "SCORED", points: 1, scorerAuthority: "SERVER_KEYED" });
    expect(scoreResponse(items.single, items.singleSpec, { kind: "SINGLE_SELECT", optionId: "b" })).toMatchObject({ status: "SCORED", points: 0, misconceptionIds: ["mc-longer-decimal-bigger"] });
    expect(scoreResponse(items.single, items.singleSpec, { kind: "SINGLE_SELECT", optionId: "zz" }).status).toBe("INVALID_RESPONSE");
  });

  it("refuses to score with a spec that does not match the item hash", () => {
    expect(() => scoreResponse(items.single, { ...items.singleSpec, key: { kind: "SINGLE_SELECT", correctOptionId: "b" } }, { kind: "SINGLE_SELECT", optionId: "b" })).toThrow("assessment_scoring_spec_mismatch");
  });

  it("scores numeric answers with tolerance and units, rejecting ambiguous numbers", () => {
    expect(parseLearnerNumber("7,000")).toBe(7000);
    expect(parseLearnerNumber("7.000,5")).toBeNull();
    expect(parseLearnerNumber("1,23")).toBeNull();
    expect(scoreResponse(items.numeric, items.numericSpec, { kind: "NUMERIC", value: "7,000", unit: "m" })).toMatchObject({ points: 1, partial: false });
    expect(scoreResponse(items.numeric, items.numericSpec, { kind: "NUMERIC", value: "7000", unit: "km" })).toMatchObject({ points: 0.5, partial: true });
    expect(scoreResponse(items.numeric, items.numericSpec, { kind: "NUMERIC", value: "7", unit: "km" })).toMatchObject({ points: 0 });
    expect(scoreResponse(items.numeric, items.numericSpec, { kind: "NUMERIC", value: "seven", unit: "m" }).status).toBe("INVALID_RESPONSE");
  });

  it("gives ordering partial credit by adjacent pairs", () => {
    expect(scoreResponse(items.ordering, items.orderingSpec, { kind: "ORDERING", order: ["e1", "e2", "e3", "e4"] }).points).toBe(1);
    expect(scoreResponse(items.ordering, items.orderingSpec, { kind: "ORDERING", order: ["e2", "e1", "e3", "e4"] }).points).toBeCloseTo(0.667, 3);
    expect(scoreResponse(items.ordering, items.orderingSpec, { kind: "ORDERING", order: ["e1", "e2"] }).status).toBe("INVALID_RESPONSE");
  });

  it("auto-scores exact constructed answers but never auto-zeroes an ambiguous one", () => {
    expect(scoreResponse(items.short, items.shortSpec, { kind: "TEXT", text: " 460,003.025. " })).toMatchObject({ status: "SCORED", points: 1 });
    const ambiguous = scoreResponse(items.short, items.shortSpec, { kind: "TEXT", text: "460 003.025" });
    expect(ambiguous).toMatchObject({ status: "PENDING_HUMAN_MODERATION", points: null, reason: "constructed_response_not_exact_match" });
    // A blank answer is BLANK (0 points), distinct from an invalid response.
    expect(scoreResponse(items.short, items.shortSpec, { kind: "TEXT", text: "   " })).toMatchObject({ status: "BLANK", points: 0 });
  });

  it("routes rubric items to human moderation and does not let AI score them", () => {
    expect(isServerAutoScorable("WORKED_SOLUTION", items.rubricSpec.key)).toBe(false);
    const pending = scoreResponse(items.worked, items.rubricSpec, { kind: "TEXT", text: "No, 0.7 = 0.70 and 70 hundredths > 65 hundredths." });
    expect(pending).toMatchObject({ status: "PENDING_HUMAN_MODERATION", points: null, scorerAuthority: null });
    const policy: ModerationPolicy = { policyId: "moderation-g7", version: "1.0.0", moderatorRoles: ["TEACHER"], requiresSecondMarker: false, reconciliationTolerancePercent: 10, examinerRoles: ["EXAMINER"] };
    const base = { pending, item: items.worked, spec: items.rubricSpec, attemptSchoolId: SCHOOL, purpose: "FORMATIVE" as const, policy, criterionScores: [{ criterionId: "decision", points: 1 }, { criterionId: "reason", points: 1 }], aiSuggestion: null, moderatedAt: now };
    expect(() => recordModeratedScore({ ...base, moderator: { kind: "AI", id: "agent:grader", role: "TEACHER", schoolId: SCHOOL } })).toThrow("assessment_ai_scoring_not_authoritative");
    expect(() => recordModeratedScore({ ...base, policy: null, moderator: { kind: "HUMAN", id: "t1", role: "TEACHER", schoolId: SCHOOL } })).toThrow("assessment_moderation_policy_required");
    expect(() => recordModeratedScore({ ...base, moderator: { kind: "HUMAN", id: "t1", role: "TEACHER", schoolId: "school-2" } })).toThrow("assessment_moderator_school_mismatch");
    expect(() => recordModeratedScore({ ...base, moderator: { kind: "HUMAN", id: "s1", role: "STUDENT", schoolId: SCHOOL } })).toThrow("assessment_moderator_role_forbidden");
    expect(() => recordModeratedScore({ ...base, criterionScores: [{ criterionId: "decision", points: 5 }, { criterionId: "reason", points: 1 }], moderator: { kind: "HUMAN", id: "t1", role: "TEACHER", schoolId: SCHOOL } })).toThrow("assessment_rubric_level_invalid");
    const suggestion = { authority: "AI_SUGGESTION_NON_AUTHORITATIVE" as const, agentId: "agent:grader", promptRef: "p@1", rubricId: "r-compare", rubricVersion: "1", suggestedLevels: [], feedbackDraft: "Good reasoning.", createdAt: now };
    const moderated = recordModeratedScore({ ...base, aiSuggestion: suggestion, moderator: { kind: "HUMAN", id: "t1", role: "TEACHER", schoolId: SCHOOL } });
    expect(moderated.outcome).toMatchObject({ status: "SCORED", points: 2, scorerAuthority: "HUMAN_MODERATOR" });
    expect(moderated.moderation.aiSuggestionConsulted).toBe(true);
    expect(moderated.audit.type).toBe("assessment.score.moderated");
  });
});
