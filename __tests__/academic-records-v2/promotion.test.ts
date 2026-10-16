import { describe, expect, it } from "vitest";
import {
  appealDeadline,
  attachAdvisory,
  decidePromotion,
  evaluatePromotionEligibility,
  openAppeal,
  planEnrollmentTransition,
  resolveAppeal,
  transitionIdempotencyKey,
  type DocumentedIntervention,
  type SupportPlan,
} from "@/lib/academic-records/v2";
import { admin, ALL_PROGRAM_MET, calendar, principal, promotionPolicy, SCHOOL, teacher, YEAR, yearEnd } from "./fixtures";

const sourceYear = { academicYearId: YEAR, schoolId: SCHOOL, startDate: "2026-09-01T00:00:00.000Z", endDate: "2027-07-15T00:00:00.000Z" };
const targetYear = { academicYearId: "year-2027", schoolId: SCHOOL, startDate: "2027-09-01T00:00:00.000Z", endDate: "2028-07-15T00:00:00.000Z" };
const source = { enrollmentId: "enr-1", studentId: "stu-1", schoolId: SCHOOL, academicYearId: YEAR, grade: 7, status: "ACTIVE" };
const AT = "2027-07-08T00:00:00.000Z";
const plan: SupportPlan = { planId: "plan-1", ownerUserId: "teacher-1", focusAreas: ["Fractions"], reassessmentPlanned: true, reviewOn: "2027-10-15" };
const intervention: DocumentedIntervention = { interventionId: "int-1", focus: "Reading fluency", startedOn: "2027-02-01", completedOn: "2027-04-30", schoolDays: 55, documentedBy: "teacher-1", reviewedBy: "principal-1" };
const failingAll = () => yearEnd({ subjects: yearEnd().subjects.map((subject) => ({ ...subject, percent: 40, passing: false })) });
const decide = (overrides: Partial<Parameters<typeof decidePromotion>[0]>) => decidePromotion({
  decisionId: "dec-1", recommendation: evaluatePromotionEligibility(yearEnd(), promotionPolicy), outcome: "PROMOTE",
  actor: principal, rationale: null, supportPlan: null, terminalGrade: 12, at: AT, ...overrides,
});

describe("Promotion eligibility evaluator (LL-AEP-001)", () => {
  it("never recommends without an approved policy of the same school", () => {
    expect(evaluatePromotionEligibility(yearEnd(), null)).toMatchObject({ recommendation: "PENDING_REVIEW", reasons: ["no_promotion_policy"] });
    expect(evaluatePromotionEligibility(yearEnd(), { ...promotionPolicy, status: "DRAFT" }).recommendation).toBe("PENDING_REVIEW");
    expect(evaluatePromotionEligibility(yearEnd(), { ...promotionPolicy, schoolId: "school-2" }).recommendation).toBe("PENDING_REVIEW");
  });

  it("promotes only with passed subjects, Secure critical competencies and attendance at target", () => {
    const result = evaluatePromotionEligibility(yearEnd(), promotionPolicy);
    expect(result).toMatchObject({ recommendation: "PROMOTE", authority: "DETERMINISTIC_POLICY_EVALUATOR", requiresAuthorizedDecision: true });
    expect(evaluatePromotionEligibility(yearEnd(), promotionPolicy).inputDigest).toBe(result.inputDigest);
    expect(evaluatePromotionEligibility(yearEnd({ recordsFinalized: false }), promotionPolicy).reasons).toEqual(["records_not_finalized"]);
  });

  it("does not promote ordinarily when a passing average hides a critical competency below Secure", () => {
    const gap = yearEnd({ competencies: [{ objectiveId: "math-place-value", state: "DEVELOPING" }, { objectiveId: "eng-reading-comprehension", state: "SECURE" }] });
    expect(evaluatePromotionEligibility(gap, promotionPolicy)).toMatchObject({ recommendation: "CONDITIONAL_PROMOTION", criticalCompetencyGaps: ["math-place-value"] });
    const unassessed = yearEnd({ competencies: [{ objectiveId: "math-place-value", state: "SECURE" }] });
    expect(evaluatePromotionEligibility(unassessed, promotionPolicy).reasons).toContain("critical_competency_unassessed:eng-reading-comprehension");
  });

  it("treats missing evidence as PENDING_REVIEW, never as failure or zero", () => {
    const missingSubject = yearEnd({ subjects: yearEnd().subjects.filter((subject) => subject.subject !== "SCIENCE") });
    expect(evaluatePromotionEligibility(missingSubject, promotionPolicy).reasons).toContain("required_subject_missing:SCIENCE");
    const noEvidence = yearEnd({ subjects: [...yearEnd().subjects.slice(0, 2), { subject: "SCIENCE", status: "NO_EVIDENCE", percent: null, passing: null }] });
    expect(evaluatePromotionEligibility(noEvidence, promotionPolicy).recommendation).toBe("PENDING_REVIEW");
  });

  it("distinguishes low attendance, approved attendance exceptions and missing attendance evidence", () => {
    expect(evaluatePromotionEligibility(yearEnd({ attendancePercent: null }), promotionPolicy)).toMatchObject({ recommendation: "PENDING_REVIEW", reasons: ["attendance_evidence_missing"] });
    expect(evaluatePromotionEligibility(yearEnd({ attendancePercent: 84 }), promotionPolicy)).toMatchObject({ recommendation: "CONDITIONAL_PROMOTION" });
    const excused = evaluatePromotionEligibility(yearEnd({ attendancePercent: 84, attendanceException: { reason: "Documented medical absence", approvedBy: "principal-1", approvedAt: "2027-05-01T00:00:00.000Z" } }), promotionPolicy);
    expect(excused).toMatchObject({ recommendation: "PROMOTE" });
    expect(excused.reasons).toContain("attendance_below_target_exception_approved");
  });

  it("allows conditional promotion for limited gaps and retention only after documented intervention", () => {
    const oneFail = yearEnd({ subjects: [{ subject: "MATH", status: "COMPLETE", percent: 65, passing: false }, ...yearEnd().subjects.slice(1)] });
    expect(evaluatePromotionEligibility(oneFail, promotionPolicy)).toMatchObject({ recommendation: "CONDITIONAL_PROMOTION", failedRequiredSubjects: ["MATH"] });
    expect(evaluatePromotionEligibility(failingAll(), promotionPolicy)).toMatchObject({ recommendation: "PENDING_REVIEW", reasons: expect.arrayContaining(["retention_requires_documented_intervention"]) });
    const unreviewed = { ...intervention, reviewedBy: null };
    expect(evaluatePromotionEligibility({ ...failingAll(), interventions: [unreviewed] }, promotionPolicy).recommendation).toBe("PENDING_REVIEW");
    const tooShort = { ...intervention, schoolDays: 5 };
    expect(evaluatePromotionEligibility({ ...failingAll(), interventions: [tooShort] }, promotionPolicy).recommendation).toBe("PENDING_REVIEW");
    expect(evaluatePromotionEligibility({ ...failingAll(), interventions: [intervention] }, promotionPolicy)).toMatchObject({ recommendation: "RETAIN", interventionDocumented: true });
  });

  it("records LiberiaLearn program completion and national school-leaving status separately", () => {
    const grad = evaluatePromotionEligibility(yearEnd({ grade: 12, programRequirementsMet: ALL_PROGRAM_MET, nationalSchoolLeaving: { applicable: true, met: null, reference: "WASSCE 2027" } }), promotionPolicy);
    expect(grad).toMatchObject({ recommendation: "GRADUATE", graduation: { liberiaLearnProgram: "MET", nationalSchoolLeaving: "UNKNOWN" } });
    const nationalPassedProgramIncomplete = evaluatePromotionEligibility(yearEnd({ grade: 12, programRequirementsMet: { ...ALL_PROGRAM_MET, MAJOR_PROJECT_COMPLETED: false }, nationalSchoolLeaving: { applicable: true, met: true, reference: "WASSCE 2027" } }), promotionPolicy);
    expect(nationalPassedProgramIncomplete).toMatchObject({ recommendation: "PENDING_REVIEW", graduation: { liberiaLearnProgram: "NOT_MET", nationalSchoolLeaving: "MET" } });
    expect(evaluatePromotionEligibility(yearEnd({ grade: 12, programRequirementsMet: {} }), promotionPolicy).graduation.liberiaLearnProgram).toBe("UNKNOWN");
  });

  it("lets AI explain risk beside, never inside, a recommendation", () => {
    const recommendation = evaluatePromotionEligibility(yearEnd(), promotionPolicy);
    const withAdvisory = attachAdvisory(recommendation, { authority: "AI_ADVISORY_ONLY", sourceRef: "risk-model@1", summary: "Predicted to struggle", suggestedInterventions: ["Summer numeracy"] });
    expect(withAdvisory.recommendation.recommendation).toBe("PROMOTE");
  });
});

describe("Authorized decisions", () => {
  it("requires school leadership, rationale for overrides, and a complete support plan for conditional promotion", () => {
    expect(() => decide({ actor: teacher })).toThrow("records_promotion_decision_requires_school_leadership");
    expect(() => decide({ actor: { ...principal, schoolId: "school-2" } })).toThrow("records_promotion_decision_requires_school_leadership");
    expect(() => decide({ outcome: "CONDITIONAL_PROMOTION", rationale: "Attendance concerns discussed with family." })).toThrow("records_conditional_promotion_requires_support_plan");
    expect(() => decide({ outcome: "CONDITIONAL_PROMOTION", rationale: "Attendance concerns discussed with family.", supportPlan: { ...plan, focusAreas: [] } })).toThrow("records_support_plan_incomplete");
    expect(() => decide({ outcome: "CONDITIONAL_PROMOTION", rationale: "Attendance concerns discussed with family.", supportPlan: { ...plan, reviewOn: "2027-07-01" } })).toThrow("records_support_plan_review_must_be_future");
    expect(decide({ outcome: "CONDITIONAL_PROMOTION", rationale: "Attendance concerns discussed with family.", supportPlan: plan }).decision.supportPlan).toEqual(plan);
  });

  it("refuses retention without documented intervention, even as an override", () => {
    expect(() => decide({ outcome: "RETAIN", rationale: "Leadership believes the student should repeat." })).toThrow("records_retention_requires_documented_intervention");
    const rec = evaluatePromotionEligibility({ ...failingAll(), interventions: [intervention] }, promotionPolicy);
    expect(decide({ recommendation: rec, outcome: "RETAIN" }).decision.outcome).toBe("RETAIN");
  });

  it("allows GRADUATE only on program completion at the terminal grade and never implies national status", () => {
    expect(() => decide({ outcome: "GRADUATE", rationale: "Wrong grade for a graduation attempt." })).toThrow("records_graduation_requires_terminal_grade");
    const incomplete = evaluatePromotionEligibility(yearEnd({ grade: 12, programRequirementsMet: { ...ALL_PROGRAM_MET, CREDITS_COMPLETED: false } }), promotionPolicy);
    expect(() => decide({ recommendation: incomplete, outcome: "GRADUATE", rationale: "Override attempt without program completion." })).toThrow("records_graduation_requires_program_completion");
    const complete = evaluatePromotionEligibility(yearEnd({ grade: 12, programRequirementsMet: ALL_PROGRAM_MET, nationalSchoolLeaving: { applicable: true, met: false, reference: "WASSCE 2027" } }), promotionPolicy);
    expect(decide({ recommendation: complete, outcome: "GRADUATE" }).decision.graduation).toEqual({ liberiaLearnProgram: "MET", nationalSchoolLeaving: "NOT_MET" });
    expect(() => decide({ recommendation: complete, outcome: "PROMOTE", rationale: "Attempt to promote past grade twelve." })).toThrow("records_cannot_promote_past_terminal_grade");
  });
});

describe("Enrollment transitions and appeals", () => {
  it("plans an idempotent transition preserving prior records and refusing cross-school or backwards years", () => {
    const { decision } = decide({});
    const base = { decision, source, sourceYear, targetYear, existingTarget: null, appliedIdempotencyKeys: [], openAppeal: false };
    expect(planEnrollmentTransition(base)).toMatchObject({ disposition: "APPLY", closeSource: { status: "PROMOTED" }, createTarget: { grade: 8 }, preservesPriorRecords: true });
    expect(planEnrollmentTransition({ ...base, appliedIdempotencyKeys: [transitionIdempotencyKey(decision)] }).disposition).toBe("ALREADY_APPLIED");
    expect(() => planEnrollmentTransition({ ...base, targetYear: { ...targetYear, schoolId: "school-2" } })).toThrow("records_transition_target_year_other_school");
    expect(() => planEnrollmentTransition({ ...base, targetYear: { ...targetYear, startDate: "2027-01-01T00:00:00.000Z" } })).toThrow("records_transition_target_year_not_after_source");
    expect(() => planEnrollmentTransition({ ...base, targetYear: sourceYear })).toThrow("records_transition_target_year_same_as_source");
    expect(() => planEnrollmentTransition({ ...base, existingTarget: { ...source, academicYearId: "year-2027", grade: 9 } })).toThrow("records_transition_target_enrollment_exists");
    expect(() => planEnrollmentTransition({ ...base, source: { ...source, schoolId: "school-2" } })).toThrow("records_transition_source_mismatch");
    expect(() => planEnrollmentTransition({ ...base, openAppeal: true })).toThrow("records_transition_blocked_by_open_appeal");
  });

  it("records retention as RETAINED at the same grade and graduation without a target year", () => {
    const rec = evaluatePromotionEligibility({ ...failingAll(), interventions: [intervention] }, promotionPolicy);
    const { decision } = decide({ decisionId: "dec-r", recommendation: rec, outcome: "RETAIN" });
    expect(planEnrollmentTransition({ decision, source, sourceYear, targetYear, existingTarget: null, appliedIdempotencyKeys: [], openAppeal: false })).toMatchObject({ closeSource: { status: "RETAINED" }, createTarget: { grade: 7 } });
    const gradRec = evaluatePromotionEligibility(yearEnd({ grade: 12, programRequirementsMet: ALL_PROGRAM_MET }), promotionPolicy);
    const grad = decide({ decisionId: "dec-g", recommendation: gradRec, outcome: "GRADUATE" }).decision;
    expect(planEnrollmentTransition({ decision: grad, source: { ...source, grade: 12 }, sourceYear, targetYear: null, existingTarget: null, appliedIdempotencyKeys: [], openAppeal: false })).toMatchObject({ closeSource: { status: "GRADUATED" }, createTarget: null });
  });

  it("counts the 15-day appeal window in school days and requires independent review", () => {
    const rec = evaluatePromotionEligibility({ ...failingAll(), interventions: [intervention] }, promotionPolicy);
    const { decision } = decide({ decisionId: "dec-r", recommendation: rec, outcome: "RETAIN" });
    // Decided Thursday 2027-07-08; 15 school days skipping weekends and the 26 July holiday.
    expect(appealDeadline(decision, calendar)).toBe("2027-07-30");
    expect(() => appealDeadline(decision, { ...calendar, schoolId: "school-2" })).toThrow("records_appeal_calendar_school_mismatch");
    const filedBy = { userId: "guardian-1", role: "GUARDIAN" as const };
    const reason = "Late examination marks were not included in the record.";
    expect(() => openAppeal(decision, { appealId: "ap-1", filedBy, reason, filedAt: "2027-08-02T00:00:00.000Z", calendar })).toThrow("records_appeal_window_closed");
    const appeal = openAppeal(decision, { appealId: "ap-1", filedBy, reason, filedAt: "2027-07-30T09:00:00.000Z", calendar });
    const rationale = "Corrected marks meet the promotion criteria.";
    expect(() => resolveAppeal(appeal, decision, { panel: [principal], outcome: "REVISED", revisedOutcome: "PROMOTE", rationale, supportPlan: null, at: "2027-08-03T00:00:00.000Z" })).toThrow("records_appeal_requires_independent_reviewer");
    expect(() => resolveAppeal(appeal, decision, { panel: [teacher], outcome: "UPHELD", revisedOutcome: null, rationale, supportPlan: null, at: "2027-08-03T00:00:00.000Z" })).toThrow("records_appeal_panel_requires_school_leadership");
    const resolved = resolveAppeal(appeal, decision, { panel: [principal, admin], outcome: "REVISED", revisedOutcome: "PROMOTE", rationale, supportPlan: null, at: "2027-08-03T00:00:00.000Z" });
    expect(resolved.decision).toMatchObject({ version: 2, outcome: "PROMOTE", supersedesDecisionId: "dec-r@1", decidedBy: admin.userId });
    expect(transitionIdempotencyKey(resolved.decision)).not.toBe(transitionIdempotencyKey(decision));
    expect(() => resolveAppeal(resolved.appeal, decision, { panel: [admin], outcome: "UPHELD", revisedOutcome: null, rationale, supportPlan: null, at: "2027-08-04T00:00:00.000Z" })).toThrow("records_appeal_not_open");
  });
});
