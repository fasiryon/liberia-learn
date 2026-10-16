import { describe, expect, it } from "vitest";
import {
  attachAdvisory,
  decidePromotion,
  evaluatePromotionEligibility,
  openAppeal,
  planEnrollmentTransition,
  resolveAppeal,
  transitionIdempotencyKey,
} from "@/lib/academic-records/v2";
import { admin, principal, promotionPolicy, SCHOOL, teacher, YEAR, yearEnd } from "./fixtures";

const sourceYear = { academicYearId: YEAR, schoolId: SCHOOL, startDate: "2026-09-01T00:00:00.000Z", endDate: "2027-07-15T00:00:00.000Z" };
const targetYear = { academicYearId: "year-2027", schoolId: SCHOOL, startDate: "2027-09-01T00:00:00.000Z", endDate: "2028-07-15T00:00:00.000Z" };
const source = { enrollmentId: "enr-1", studentId: "stu-1", schoolId: SCHOOL, academicYearId: YEAR, grade: 7, status: "ACTIVE" };

describe("Promotion eligibility evaluator", () => {
  it("never promotes without an approved policy of the same school", () => {
    expect(evaluatePromotionEligibility(yearEnd(), null)).toMatchObject({ recommendation: "PENDING_REVIEW", reasons: ["no_promotion_policy"] });
    expect(evaluatePromotionEligibility(yearEnd(), { ...promotionPolicy, status: "DRAFT" }).recommendation).toBe("PENDING_REVIEW");
    expect(evaluatePromotionEligibility(yearEnd(), { ...promotionPolicy, schoolId: "school-2" }).recommendation).toBe("PENDING_REVIEW");
  });

  it("recommends PROMOTE only from finalized, complete, passing records", () => {
    const result = evaluatePromotionEligibility(yearEnd(), promotionPolicy);
    expect(result).toMatchObject({ recommendation: "PROMOTE", authority: "DETERMINISTIC_POLICY_EVALUATOR", requiresAuthorizedDecision: true });
    expect(evaluatePromotionEligibility(yearEnd(), promotionPolicy).inputDigest).toBe(result.inputDigest);
    expect(evaluatePromotionEligibility(yearEnd({ recordsFinalized: false }), promotionPolicy)).toMatchObject({ recommendation: "PENDING_REVIEW", reasons: ["records_not_finalized"] });
  });

  it("treats missing or incomplete evidence as PENDING_REVIEW, not as failure or zero", () => {
    const missingSubject = yearEnd({ subjects: yearEnd().subjects.filter((subject) => subject.subject !== "SCIENCE") });
    expect(evaluatePromotionEligibility(missingSubject, promotionPolicy)).toMatchObject({ recommendation: "PENDING_REVIEW", reasons: ["required_subject_missing:SCIENCE"] });
    const noEvidence = yearEnd({ subjects: [...yearEnd().subjects.slice(0, 2), { subject: "SCIENCE", status: "NO_EVIDENCE", percent: null, passing: null }] });
    expect(evaluatePromotionEligibility(noEvidence, promotionPolicy).recommendation).toBe("PENDING_REVIEW");
    expect(evaluatePromotionEligibility(yearEnd({ attendancePercent: null }), promotionPolicy).reasons).toContain("attendance_missing");
  });

  it("recommends CONDITIONAL_PROMOTION and RETAIN by policy thresholds", () => {
    const oneFail = yearEnd({ subjects: [{ subject: "MATH", status: "COMPLETE", percent: 55, passing: false }, ...yearEnd().subjects.slice(1)] });
    expect(evaluatePromotionEligibility(oneFail, promotionPolicy)).toMatchObject({ recommendation: "CONDITIONAL_PROMOTION", failedRequiredSubjects: ["MATH"] });
    const twoFail = yearEnd({ subjects: [{ subject: "MATH", status: "COMPLETE", percent: 55, passing: false }, { subject: "ENGLISH", status: "COMPLETE", percent: 50, passing: false }, yearEnd().subjects[2]] });
    expect(evaluatePromotionEligibility(twoFail, promotionPolicy).recommendation).toBe("RETAIN");
    expect(evaluatePromotionEligibility(yearEnd({ attendancePercent: 60 }), promotionPolicy).recommendation).toBe("CONDITIONAL_PROMOTION");
  });

  it("recommends GRADUATE only at the terminal grade with every requirement known and met", () => {
    expect(evaluatePromotionEligibility(yearEnd({ grade: 12, graduationRequirementsMet: { "national-exam": true } }), promotionPolicy).recommendation).toBe("GRADUATE");
    expect(evaluatePromotionEligibility(yearEnd({ grade: 12, graduationRequirementsMet: {} }), promotionPolicy)).toMatchObject({ recommendation: "PENDING_REVIEW", reasons: ["graduation_requirement_unknown:national-exam"] });
    expect(evaluatePromotionEligibility(yearEnd({ grade: 12, graduationRequirementsMet: { "national-exam": false } }), promotionPolicy).recommendation).toBe("PENDING_REVIEW");
  });

  it("refuses to evaluate students who are not actively enrolled", () => {
    expect(evaluatePromotionEligibility(yearEnd({ enrollmentStatus: "TRANSFERRED" }), promotionPolicy).recommendation).toBe("PENDING_REVIEW");
  });

  it("lets AI explain risk beside, never inside, a recommendation", () => {
    const recommendation = evaluatePromotionEligibility(yearEnd(), promotionPolicy);
    const withAdvisory = attachAdvisory(recommendation, { authority: "AI_ADVISORY_ONLY", sourceRef: "risk-model@1", summary: "Predicted to struggle next year", suggestedInterventions: ["Summer numeracy"] });
    expect(withAdvisory.recommendation).toBe(recommendation);
    expect(withAdvisory.recommendation.recommendation).toBe("PROMOTE");
  });
});

describe("Authorized decisions and enrollment transitions", () => {
  const recommendation = evaluatePromotionEligibility(yearEnd(), promotionPolicy);

  it("requires school leadership, a rationale for overrides, and a remediation plan for conditional promotion", () => {
    const base = { decisionId: "dec-1", recommendation, rationale: null, remediationPlanRef: null, terminalGrade: 12, at: "2027-07-08T00:00:00.000Z" };
    expect(() => decidePromotion({ ...base, outcome: "PROMOTE", actor: teacher })).toThrow("records_promotion_decision_requires_school_leadership");
    expect(() => decidePromotion({ ...base, outcome: "PROMOTE", actor: { ...principal, schoolId: "school-2" } })).toThrow("records_promotion_decision_requires_school_leadership");
    expect(() => decidePromotion({ ...base, outcome: "RETAIN", actor: principal })).toThrow("records_promotion_rationale_required");
    expect(() => decidePromotion({ ...base, outcome: "CONDITIONAL_PROMOTION", rationale: "Attendance concerns discussed with family.", actor: principal })).toThrow("records_conditional_promotion_requires_remediation_plan");
    expect(() => decidePromotion({ ...base, outcome: "GRADUATE", rationale: "Wrong grade for graduation attempt.", actor: principal })).toThrow("records_graduation_requires_terminal_grade");
    const pending = evaluatePromotionEligibility(yearEnd({ recordsFinalized: false }), promotionPolicy);
    expect(() => decidePromotion({ ...base, recommendation: pending, outcome: "PROMOTE", actor: principal })).toThrow("records_promotion_rationale_required");
    const { decision, audit } = decidePromotion({ ...base, outcome: "PROMOTE", actor: principal });
    expect(decision).toMatchObject({ outcome: "PROMOTE", overridesRecommendation: false, decidedBy: principal.userId });
    expect(audit.action).toBe("records.promotion.decided");
  });

  it("plans an idempotent transition that preserves prior records and refuses cross-school or backwards years", () => {
    const { decision } = decidePromotion({ decisionId: "dec-1", recommendation, outcome: "PROMOTE", actor: principal, rationale: null, remediationPlanRef: null, terminalGrade: 12, at: "2027-07-08T00:00:00.000Z" });
    const base = { decision, source, sourceYear, targetYear, existingTarget: null, appliedIdempotencyKeys: [], openAppeal: false };
    const plan = planEnrollmentTransition(base);
    expect(plan).toMatchObject({ disposition: "APPLY", closeSource: { status: "PROMOTED" }, createTarget: { grade: 8, academicYearId: "year-2027" }, preservesPriorRecords: true });
    expect(planEnrollmentTransition({ ...base, appliedIdempotencyKeys: [transitionIdempotencyKey(decision)] }).disposition).toBe("ALREADY_APPLIED");
    expect(() => planEnrollmentTransition({ ...base, targetYear: { ...targetYear, schoolId: "school-2" } })).toThrow("records_transition_target_year_other_school");
    expect(() => planEnrollmentTransition({ ...base, targetYear: { ...targetYear, startDate: "2027-01-01T00:00:00.000Z" } })).toThrow("records_transition_target_year_not_after_source");
    expect(() => planEnrollmentTransition({ ...base, targetYear: sourceYear })).toThrow("records_transition_target_year_same_as_source");
    expect(() => planEnrollmentTransition({ ...base, existingTarget: { ...source, academicYearId: "year-2027", grade: 9 } })).toThrow("records_transition_target_enrollment_exists");
    expect(() => planEnrollmentTransition({ ...base, source: { ...source, schoolId: "school-2" } })).toThrow("records_transition_source_mismatch");
    expect(() => planEnrollmentTransition({ ...base, openAppeal: true })).toThrow("records_transition_blocked_by_open_appeal");
  });

  it("records retention as RETAINED at the same grade (repeated-grade history) and graduation without a target year", () => {
    const retainRec = evaluatePromotionEligibility(yearEnd({ subjects: yearEnd().subjects.map((subject) => ({ ...subject, percent: 40, passing: false })) }), promotionPolicy);
    const { decision } = decidePromotion({ decisionId: "dec-r", recommendation: retainRec, outcome: "RETAIN", actor: principal, rationale: null, remediationPlanRef: null, terminalGrade: 12, at: "2027-07-08T00:00:00.000Z" });
    expect(planEnrollmentTransition({ decision, source, sourceYear, targetYear, existingTarget: null, appliedIdempotencyKeys: [], openAppeal: false })).toMatchObject({ closeSource: { status: "RETAINED" }, createTarget: { grade: 7 } });
    const gradRec = evaluatePromotionEligibility(yearEnd({ grade: 12, graduationRequirementsMet: { "national-exam": true } }), promotionPolicy);
    const grad = decidePromotion({ decisionId: "dec-g", recommendation: gradRec, outcome: "GRADUATE", actor: principal, rationale: null, remediationPlanRef: null, terminalGrade: 12, at: "2027-07-08T00:00:00.000Z" }).decision;
    const g12 = { ...source, grade: 12 };
    expect(planEnrollmentTransition({ decision: grad, source: g12, sourceYear, targetYear: null, existingTarget: null, appliedIdempotencyKeys: [], openAppeal: false })).toMatchObject({ closeSource: { status: "GRADUATED" }, createTarget: null });
    expect(() => decidePromotion({ decisionId: "dec-x", recommendation: gradRec, outcome: "PROMOTE", actor: principal, rationale: "Attempt to promote past grade twelve.", remediationPlanRef: null, terminalGrade: 12, at: "2027-07-08T00:00:00.000Z" })).toThrow("records_cannot_promote_past_terminal_grade");
  });

  it("supports appeals within a window, decided by an independent leader, with a new decision version", () => {
    const retainRec = evaluatePromotionEligibility(yearEnd({ subjects: yearEnd().subjects.map((subject) => ({ ...subject, percent: 40, passing: false })) }), promotionPolicy);
    const { decision } = decidePromotion({ decisionId: "dec-r", recommendation: retainRec, outcome: "RETAIN", actor: principal, rationale: null, remediationPlanRef: null, terminalGrade: 12, at: "2027-07-08T00:00:00.000Z" });
    const filedBy = { userId: "guardian-1", role: "GUARDIAN" as const };
    expect(() => openAppeal(decision, { appealId: "ap-1", filedBy, reason: "Late exam marks were not included in the record.", filedAt: "2027-08-30T00:00:00.000Z", windowDays: 14 })).toThrow("records_appeal_window_closed");
    const appeal = openAppeal(decision, { appealId: "ap-1", filedBy, reason: "Late exam marks were not included in the record.", filedAt: "2027-07-10T00:00:00.000Z", windowDays: 14 });
    expect(() => resolveAppeal(appeal, decision, { panel: [principal], outcome: "REVISED", revisedOutcome: "PROMOTE", rationale: "Corrected marks meet the promotion criteria.", remediationPlanRef: null, at: "2027-07-15T00:00:00.000Z" })).toThrow("records_appeal_requires_independent_reviewer");
    expect(() => resolveAppeal(appeal, decision, { panel: [teacher], outcome: "UPHELD", revisedOutcome: null, rationale: "The original decision stands after review.", remediationPlanRef: null, at: "2027-07-15T00:00:00.000Z" })).toThrow("records_appeal_panel_requires_school_leadership");
    const resolved = resolveAppeal(appeal, decision, { panel: [principal, admin], outcome: "REVISED", revisedOutcome: "PROMOTE", rationale: "Corrected marks meet the promotion criteria.", remediationPlanRef: null, at: "2027-07-15T00:00:00.000Z" });
    expect(resolved.appeal.status).toBe("REVISED");
    expect(resolved.decision).toMatchObject({ version: 2, outcome: "PROMOTE", supersedesDecisionId: "dec-r@1", decidedBy: admin.userId });
    // The revised decision has a new idempotency key; the original stays in history.
    expect(transitionIdempotencyKey(resolved.decision)).not.toBe(transitionIdempotencyKey(decision));
    expect(() => resolveAppeal(resolved.appeal, decision, { panel: [admin], outcome: "UPHELD", revisedOutcome: null, rationale: "Second resolution attempt is refused.", remediationPlanRef: null, at: "2027-07-16T00:00:00.000Z" })).toThrow("records_appeal_not_open");
  });
});
