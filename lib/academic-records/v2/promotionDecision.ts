/**
 * Authorized promotion decisions, enrollment-transition plans and appeals.
 *
 *   recommendation (evaluator) → decision (principal/admin of the same school) → transition plan
 *
 * The plan is a pure description of the enrollment writes; a caller applies it in one transaction.
 * It never edits prior-year records beyond closing the source enrollment with its true outcome
 * (RETAINED stays RETAINED, so repeated-grade history is preserved), and it carries an idempotency
 * key so re-applying the same decision is a no-op while a conflicting one is refused.
 */
import { createHash } from "crypto";
import { LL_PROMOTION } from "@/lib/academic-policy/llAep001";
import { addSchoolDays, type AcademicCalendar } from "./calendar";
import type { GraduationOutcomes, PromotionRecommendation, PromotionRecommendationKind } from "./promotion";
import type { RecordsActor, RecordsAuditEvent } from "./periodLock";

export type DecisionOutcome = Exclude<PromotionRecommendationKind, "PENDING_REVIEW">;

/** Documented support plan required for conditional promotion (LL-AEP-001). */
export type SupportPlan = Readonly<{
  planId: string;
  ownerUserId: string;
  focusAreas: readonly string[];
  reassessmentPlanned: boolean;
  reviewOn: string;
}>;

function assertSupportPlan(plan: SupportPlan | null, decidedAt: string): asserts plan is SupportPlan {
  if (!plan) throw new Error("records_conditional_promotion_requires_support_plan");
  if (!plan.planId || !plan.ownerUserId || plan.focusAreas.length === 0 || !plan.reassessmentPlanned) throw new Error("records_support_plan_incomplete");
  if (!(plan.reviewOn.slice(0, 10) > decidedAt.slice(0, 10))) throw new Error("records_support_plan_review_must_be_future");
}

export type PromotionDecision = Readonly<{
  decisionId: string;
  version: number;
  studentId: string;
  schoolId: string;
  academicYearId: string;
  grade: number;
  outcome: DecisionOutcome;
  recommendation: PromotionRecommendationKind;
  recommendationDigest: string;
  overridesRecommendation: boolean;
  rationale: string | null;
  supportPlan: SupportPlan | null;
  /** Copied from the recommendation; a GRADUATE decision never implies national school-leaving status. */
  graduation: GraduationOutcomes;
  /** Copied from the recommendation so an appeal revision is held to the same retention rule. */
  interventionDocumented: boolean;
  terminalGrade: number;
  decidedBy: string;
  decidedAt: string;
  supersedesDecisionId: string | null;
}>;

const LEADERS = new Set(["PRINCIPAL", "ADMIN"]);

export function decidePromotion(input: {
  decisionId: string;
  recommendation: PromotionRecommendation;
  outcome: DecisionOutcome;
  actor: RecordsActor;
  rationale: string | null;
  supportPlan: SupportPlan | null;
  terminalGrade: number;
  at: string;
}): Readonly<{ decision: PromotionDecision; audit: RecordsAuditEvent }> {
  const { recommendation, outcome, actor } = input;
  if (!LEADERS.has(actor.role) || actor.schoolId !== recommendation.schoolId) throw new Error("records_promotion_decision_requires_school_leadership");
  const pendingReview = recommendation.recommendation === "PENDING_REVIEW";
  const overrides = recommendation.recommendation !== outcome;
  if ((overrides || pendingReview) && (input.rationale ?? "").trim().length < 20) throw new Error("records_promotion_rationale_required");
  if (outcome === "GRADUATE" && recommendation.grade !== input.terminalGrade) throw new Error("records_graduation_requires_terminal_grade");
  if (outcome !== "GRADUATE" && outcome !== "RETAIN" && recommendation.grade >= input.terminalGrade) throw new Error("records_cannot_promote_past_terminal_grade");
  if (outcome === "CONDITIONAL_PROMOTION") assertSupportPlan(input.supportPlan, input.at);
  // Retention is a last resort: never decided without documented, reviewed intervention.
  if (outcome === "RETAIN" && !recommendation.interventionDocumented) throw new Error("records_retention_requires_documented_intervention");
  if (outcome === "GRADUATE" && recommendation.graduation.liberiaLearnProgram !== "MET") throw new Error("records_graduation_requires_program_completion");
  const decision: PromotionDecision = Object.freeze({
    decisionId: input.decisionId, version: 1,
    studentId: recommendation.studentId, schoolId: recommendation.schoolId, academicYearId: recommendation.academicYearId, grade: recommendation.grade,
    outcome, recommendation: recommendation.recommendation, recommendationDigest: recommendation.inputDigest,
    overridesRecommendation: overrides, rationale: input.rationale, supportPlan: input.supportPlan, graduation: recommendation.graduation,
    interventionDocumented: recommendation.interventionDocumented, terminalGrade: input.terminalGrade,
    decidedBy: actor.userId, decidedAt: input.at, supersedesDecisionId: null,
  });
  return Object.freeze({
    decision,
    audit: { action: "records.promotion.decided", resourceRef: `${decision.decisionId}@1`, actorId: actor.userId, schoolId: decision.schoolId, at: input.at, details: { outcome, recommendation: recommendation.recommendation, overrides } },
  });
}

export type EnrollmentSnapshot = Readonly<{ enrollmentId: string; studentId: string; schoolId: string; academicYearId: string; grade: number; status: string }>;
export type AcademicYearSnapshot = Readonly<{ academicYearId: string; schoolId: string; startDate: string; endDate: string }>;

export type TransitionPlan = Readonly<{
  idempotencyKey: string;
  disposition: "APPLY" | "ALREADY_APPLIED";
  closeSource: Readonly<{ enrollmentId: string; status: "PROMOTED" | "RETAINED" | "GRADUATED" }>;
  createTarget: Readonly<{ studentId: string; schoolId: string; academicYearId: string; grade: number; status: "ACTIVE" }> | null;
  preservesPriorRecords: true;
}>;

export function transitionIdempotencyKey(decision: PromotionDecision): string {
  return createHash("sha256").update(`${decision.studentId}|${decision.schoolId}|${decision.academicYearId}|${decision.decisionId}|${decision.version}|${decision.outcome}`).digest("hex");
}

export function planEnrollmentTransition(input: {
  decision: PromotionDecision;
  source: EnrollmentSnapshot;
  sourceYear: AcademicYearSnapshot;
  targetYear: AcademicYearSnapshot | null;
  existingTarget: EnrollmentSnapshot | null;
  appliedIdempotencyKeys: readonly string[];
  openAppeal: boolean;
}): TransitionPlan {
  const { decision, source, sourceYear, targetYear } = input;
  if (input.openAppeal) throw new Error("records_transition_blocked_by_open_appeal");
  if (source.studentId !== decision.studentId || source.schoolId !== decision.schoolId || source.academicYearId !== decision.academicYearId || source.grade !== decision.grade) throw new Error("records_transition_source_mismatch");
  if (sourceYear.academicYearId !== source.academicYearId || sourceYear.schoolId !== decision.schoolId) throw new Error("records_transition_source_year_mismatch");
  const idempotencyKey = transitionIdempotencyKey(decision);
  const closeStatus: TransitionPlan["closeSource"]["status"] = decision.outcome === "GRADUATE" ? "GRADUATED" : decision.outcome === "RETAIN" ? "RETAINED" : "PROMOTED";
  const targetGrade = decision.outcome === "RETAIN" ? decision.grade : decision.grade + 1;

  if (input.appliedIdempotencyKeys.includes(idempotencyKey)) {
    return Object.freeze({ idempotencyKey, disposition: "ALREADY_APPLIED" as const, closeSource: { enrollmentId: source.enrollmentId, status: closeStatus }, createTarget: null, preservesPriorRecords: true as const });
  }
  if (source.status !== "ACTIVE") throw new Error("records_transition_source_not_active");

  if (decision.outcome === "GRADUATE") {
    if (targetYear) throw new Error("records_graduation_has_no_target_year");
    return Object.freeze({ idempotencyKey, disposition: "APPLY" as const, closeSource: { enrollmentId: source.enrollmentId, status: "GRADUATED" as const }, createTarget: null, preservesPriorRecords: true as const });
  }
  if (!targetYear) throw new Error("records_transition_target_year_required");
  if (targetYear.schoolId !== decision.schoolId) throw new Error("records_transition_target_year_other_school");
  if (targetYear.academicYearId === sourceYear.academicYearId) throw new Error("records_transition_target_year_same_as_source");
  if (!(targetYear.startDate.slice(0, 10) > sourceYear.endDate.slice(0, 10))) throw new Error("records_transition_target_year_not_after_source");
  if (input.existingTarget) throw new Error("records_transition_target_enrollment_exists");
  return Object.freeze({
    idempotencyKey,
    disposition: "APPLY" as const,
    closeSource: { enrollmentId: source.enrollmentId, status: closeStatus },
    createTarget: { studentId: decision.studentId, schoolId: decision.schoolId, academicYearId: targetYear.academicYearId, grade: targetGrade, status: "ACTIVE" as const },
    preservesPriorRecords: true as const,
  });
}

// ─── Appeals ────────────────────────────────────────────────────────────────────────────────────

export type PromotionAppeal = Readonly<{
  appealId: string;
  decisionId: string;
  decisionVersion: number;
  schoolId: string;
  filedBy: Readonly<{ userId: string; role: "STUDENT" | "GUARDIAN" | "TEACHER" }>;
  reason: string;
  filedAt: string;
  status: "OPEN" | "UPHELD" | "REVISED";
  resolvedBy: readonly string[];
  resolvedAt: string | null;
}>;

/** Appeal window: LL-AEP-001 baseline 15 SCHOOL days after the decision, counted on the school calendar. */
export function appealDeadline(decision: PromotionDecision, calendar: AcademicCalendar, windowSchoolDays: number = LL_PROMOTION.appealWindowSchoolDays): string {
  if (calendar.schoolId !== decision.schoolId) throw new Error("records_appeal_calendar_school_mismatch");
  return addSchoolDays(calendar, decision.decidedAt, windowSchoolDays);
}

export function openAppeal(decision: PromotionDecision, input: {
  appealId: string;
  filedBy: PromotionAppeal["filedBy"];
  reason: string;
  filedAt: string;
  calendar: AcademicCalendar;
  windowSchoolDays?: number;
}): PromotionAppeal {
  if (input.reason.trim().length < 20) throw new Error("records_appeal_reason_required");
  if (input.filedAt.slice(0, 10) > appealDeadline(decision, input.calendar, input.windowSchoolDays)) throw new Error("records_appeal_window_closed");
  return Object.freeze({
    appealId: input.appealId, decisionId: decision.decisionId, decisionVersion: decision.version, schoolId: decision.schoolId,
    filedBy: input.filedBy, reason: input.reason, filedAt: input.filedAt, status: "OPEN", resolvedBy: [], resolvedAt: null,
  });
}

export function resolveAppeal(appeal: PromotionAppeal, decision: PromotionDecision, input: {
  panel: readonly RecordsActor[];
  outcome: "UPHELD" | "REVISED";
  revisedOutcome: DecisionOutcome | null;
  rationale: string;
  supportPlan: SupportPlan | null;
  at: string;
}): Readonly<{ appeal: PromotionAppeal; decision: PromotionDecision; audit: RecordsAuditEvent }> {
  if (appeal.status !== "OPEN") throw new Error("records_appeal_not_open");
  if (appeal.decisionId !== decision.decisionId || appeal.decisionVersion !== decision.version) throw new Error("records_appeal_decision_mismatch");
  if (input.panel.length === 0 || input.panel.some((member) => !LEADERS.has(member.role) || member.schoolId !== decision.schoolId)) throw new Error("records_appeal_panel_requires_school_leadership");
  // The person who made the decision cannot be its only reviewer.
  if (input.panel.every((member) => member.userId === decision.decidedBy)) throw new Error("records_appeal_requires_independent_reviewer");
  if (input.rationale.trim().length < 20) throw new Error("records_appeal_rationale_required");
  const resolvedAppeal = Object.freeze({ ...appeal, status: input.outcome, resolvedBy: input.panel.map((member) => member.userId), resolvedAt: input.at });
  let next = decision;
  if (input.outcome === "REVISED") {
    if (!input.revisedOutcome || input.revisedOutcome === decision.outcome) throw new Error("records_appeal_revision_requires_new_outcome");
    // A revision is a new decision: the same invariants as decidePromotion apply.
    if (input.revisedOutcome === "GRADUATE" && decision.grade !== decision.terminalGrade) throw new Error("records_graduation_requires_terminal_grade");
    if (input.revisedOutcome !== "GRADUATE" && input.revisedOutcome !== "RETAIN" && decision.grade >= decision.terminalGrade) throw new Error("records_cannot_promote_past_terminal_grade");
    if (input.revisedOutcome === "CONDITIONAL_PROMOTION") assertSupportPlan(input.supportPlan, input.at);
    if (input.revisedOutcome === "RETAIN" && !decision.interventionDocumented) throw new Error("records_retention_requires_documented_intervention");
    if (input.revisedOutcome === "GRADUATE" && decision.graduation.liberiaLearnProgram !== "MET") throw new Error("records_graduation_requires_program_completion");
    next = Object.freeze({
      ...decision, version: decision.version + 1, outcome: input.revisedOutcome, overridesRecommendation: input.revisedOutcome !== decision.recommendation,
      rationale: input.rationale, supportPlan: input.supportPlan, decidedBy: input.panel.find((member) => member.userId !== decision.decidedBy)!.userId,
      decidedAt: input.at, supersedesDecisionId: `${decision.decisionId}@${decision.version}`,
    });
  }
  return Object.freeze({
    appeal: resolvedAppeal,
    decision: next,
    audit: { action: `records.promotion.appeal_${input.outcome.toLowerCase()}`, resourceRef: appeal.appealId, actorId: input.panel[0].userId, schoolId: decision.schoolId, at: input.at, details: { decisionVersion: next.version, outcome: next.outcome } },
  });
}
