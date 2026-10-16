/**
 * Deterministic promotion-eligibility evaluator (LL-AEP-001). Produces a RECOMMENDATION from
 * finalized year-end records under an approved, school-scoped promotion policy. It never changes
 * enrollment: an authorized school leader decides (promotionDecision.ts).
 *
 *   PROMOTE                 all required subjects passed, every critical competency Secure, and
 *                           attendance at target (or below target with an approved exception)
 *   CONDITIONAL_PROMOTION   limited gaps, to be covered by a documented support plan
 *   RETAIN                  last resort: only after documented, completed intervention and review
 *   GRADUATE                terminal grade, LiberiaLearn program requirements all met. National
 *                           school-leaving status is recorded separately and never implied.
 *   PENDING_REVIEW          anything uncertain: missing/unapproved policy, unfinalized records,
 *                           missing grades, competencies or attendance evidence, unknown
 *                           graduation requirements, or retention without documented intervention
 *
 * Low attendance and missing attendance evidence are different: the first is a finding, the
 * second makes the recommendation PENDING_REVIEW. There is no AI input. `PromotionAdvisory` sits
 * beside a recommendation and never changes it.
 */
import { createHash } from "crypto";
import { canonicalizeJson } from "@/lib/curriculum/provenance/hash";
import { LL_PROMOTION, type LlMasteryState } from "@/lib/academic-policy/llAep001";
import { masteryAtLeast } from "./masteryPolicy";

export type PromotionRecommendationKind = "PROMOTE" | "CONDITIONAL_PROMOTION" | "RETAIN" | "GRADUATE" | "PENDING_REVIEW";

export type PromotionPolicy = Readonly<{
  policyId: string;
  version: string;
  schoolId: string;
  status: "DRAFT" | "APPROVED" | "RETIRED";
  source: Readonly<{ kind: "LIBERIALEARN_INSTITUTIONAL" | "SCHOOL_POLICY" | "MOE_DIRECTIVE"; reference: string; attestedBy: string | null }>;
  appliesToGrades: readonly number[];
  terminalGrade: number;
  requiredSubjects: readonly string[];
  /** Designated foundational competencies that must reach `criticalCompetencyMinimum` for ordinary promotion. */
  criticalCompetencies: readonly Readonly<{ subject: string; objectiveId: string }>[];
  criticalCompetencyMinimum: LlMasteryState;
  /** Gaps still allowing conditional promotion with a support plan. */
  maxFailedSubjectsForConditional: number;
  maxCriticalGapsForConditional: number;
  attendanceTargetPercent: number | null;
  attendanceExceptionsAllowed: boolean;
  retentionRequiresDocumentedIntervention: boolean;
  minimumInterventionSchoolDays: number;
  /** LiberiaLearn program requirements for completion at the terminal grade. */
  programRequirements: readonly Readonly<{ requirementId: string; description: string }>[];
}>;

export type FinalSubjectResult = Readonly<{
  subject: string;
  status: "COMPLETE" | "INCOMPLETE" | "NO_EVIDENCE";
  percent: number | null;
  passing: boolean | null;
}>;

export type AttendanceException = Readonly<{ reason: string; approvedBy: string; approvedAt: string }>;

export type DocumentedIntervention = Readonly<{
  interventionId: string;
  focus: string;
  startedOn: string;
  completedOn: string | null;
  schoolDays: number;
  documentedBy: string;
  reviewedBy: string | null;
}>;

export type YearEndRecord = Readonly<{
  studentId: string;
  schoolId: string;
  academicYearId: string;
  grade: number;
  enrollmentStatus: "ACTIVE" | "COMPLETED" | "PROMOTED" | "RETAINED" | "TRANSFERRED" | "GRADUATED";
  /** True only when every final-period record is locked and the year-end report is OFFICIAL. */
  recordsFinalized: boolean;
  subjects: readonly FinalSubjectResult[];
  /** Mastery from verified independent evidence (masteryPolicy.ts), per objective. */
  competencies: readonly Readonly<{ objectiveId: string; state: LlMasteryState }>[];
  /** Null = no attendance evidence (distinct from low attendance). */
  attendancePercent: number | null;
  attendanceException: AttendanceException | null;
  interventions: readonly DocumentedIntervention[];
  /** LiberiaLearn program requirements: true met, false not met, null unknown. */
  programRequirementsMet: Readonly<Record<string, boolean | null>>;
  /** National school-leaving outcome (e.g. WAEC), recorded separately where applicable. */
  nationalSchoolLeaving: Readonly<{ applicable: boolean; met: boolean | null; reference: string | null }>;
}>;

export type GraduationOutcomes = Readonly<{
  liberiaLearnProgram: "MET" | "NOT_MET" | "UNKNOWN" | "NOT_APPLICABLE";
  nationalSchoolLeaving: "MET" | "NOT_MET" | "UNKNOWN" | "NOT_APPLICABLE";
}>;

export type PromotionRecommendation = Readonly<{
  studentId: string;
  schoolId: string;
  academicYearId: string;
  grade: number;
  recommendation: PromotionRecommendationKind;
  reasons: readonly string[];
  failedRequiredSubjects: readonly string[];
  criticalCompetencyGaps: readonly string[];
  interventionDocumented: boolean;
  graduation: GraduationOutcomes;
  policy: Readonly<{ policyId: string; version: string }> | null;
  inputDigest: string;
  authority: "DETERMINISTIC_POLICY_EVALUATOR";
  requiresAuthorizedDecision: true;
}>;

export function validatePromotionPolicy(policy: PromotionPolicy): readonly string[] {
  const issues: string[] = [];
  if (policy.appliesToGrades.length === 0) issues.push("promotion_policy_grades_required");
  if (policy.requiredSubjects.length === 0) issues.push("promotion_policy_required_subjects_missing");
  if (!Number.isInteger(policy.maxFailedSubjectsForConditional) || policy.maxFailedSubjectsForConditional < 0) issues.push("promotion_policy_conditional_invalid");
  if (!Number.isInteger(policy.maxCriticalGapsForConditional) || policy.maxCriticalGapsForConditional < 0) issues.push("promotion_policy_conditional_invalid");
  if (policy.attendanceTargetPercent !== null && !(policy.attendanceTargetPercent > 0 && policy.attendanceTargetPercent <= 100)) issues.push("promotion_policy_attendance_invalid");
  if (!Number.isInteger(policy.minimumInterventionSchoolDays) || policy.minimumInterventionSchoolDays < 0) issues.push("promotion_policy_intervention_invalid");
  if (policy.appliesToGrades.includes(policy.terminalGrade) && policy.programRequirements.length === 0) issues.push("promotion_policy_program_requirements_missing");
  if (policy.source.kind === "MOE_DIRECTIVE" && (!policy.source.reference.trim() || !policy.source.attestedBy)) issues.push("promotion_policy_moe_source_requires_reference_and_attestation");
  return Object.freeze(issues);
}

/** LL-AEP-001 promotion baseline adopted by a school (the adopter supplies subjects, competencies and program requirements). */
export function llPromotionPolicyFor(input: {
  schoolId: string;
  version: string;
  status: PromotionPolicy["status"];
  appliesToGrades: readonly number[];
  requiredSubjects: readonly string[];
  criticalCompetencies: PromotionPolicy["criticalCompetencies"];
  programRequirements: PromotionPolicy["programRequirements"];
}): PromotionPolicy {
  return Object.freeze({
    policyId: `${input.schoolId}:ll-aep-001-promotion`,
    version: input.version,
    schoolId: input.schoolId,
    status: input.status,
    source: { kind: "LIBERIALEARN_INSTITUTIONAL", reference: "LL-AEP-001@1.0.0", attestedBy: null },
    appliesToGrades: [...input.appliesToGrades],
    terminalGrade: 12,
    requiredSubjects: [...input.requiredSubjects],
    criticalCompetencies: [...input.criticalCompetencies],
    criticalCompetencyMinimum: LL_PROMOTION.criticalCompetencyMinimum,
    maxFailedSubjectsForConditional: 1,
    maxCriticalGapsForConditional: 2,
    attendanceTargetPercent: LL_PROMOTION.attendanceTargetPercent,
    attendanceExceptionsAllowed: LL_PROMOTION.attendanceExceptionsAllowed,
    retentionRequiresDocumentedIntervention: LL_PROMOTION.retentionRequiresDocumentedIntervention,
    minimumInterventionSchoolDays: LL_PROMOTION.minimumInterventionSchoolDays,
    programRequirements: [...input.programRequirements],
  });
}

export function evaluatePromotionEligibility(record: YearEndRecord, policy: PromotionPolicy | null): PromotionRecommendation {
  const reasons: string[] = [];
  const failed: string[] = [];
  const criticalGaps: string[] = [];
  const inputDigest = createHash("sha256").update(canonicalizeJson({ record, policy })).digest("hex");
  const interventionDocumented = Boolean(policy) && record.interventions.some((intervention) =>
    intervention.completedOn !== null && intervention.reviewedBy !== null && intervention.schoolDays >= (policy?.minimumInterventionSchoolDays ?? 0));
  const terminal = policy !== null && record.grade === policy.terminalGrade;
  let graduation: GraduationOutcomes = { liberiaLearnProgram: "NOT_APPLICABLE", nationalSchoolLeaving: "NOT_APPLICABLE" };
  const result = (recommendation: PromotionRecommendationKind) => Object.freeze({
    studentId: record.studentId,
    schoolId: record.schoolId,
    academicYearId: record.academicYearId,
    grade: record.grade,
    recommendation,
    reasons: Object.freeze([...reasons]),
    failedRequiredSubjects: Object.freeze([...failed]),
    criticalCompetencyGaps: Object.freeze([...criticalGaps]),
    interventionDocumented,
    graduation: Object.freeze({ ...graduation }),
    policy: policy ? { policyId: policy.policyId, version: policy.version } : null,
    inputDigest,
    authority: "DETERMINISTIC_POLICY_EVALUATOR" as const,
    requiresAuthorizedDecision: true as const,
  });

  if (!policy) { reasons.push("no_promotion_policy"); return result("PENDING_REVIEW"); }
  if (policy.status !== "APPROVED") { reasons.push("promotion_policy_not_approved"); return result("PENDING_REVIEW"); }
  if (policy.schoolId !== record.schoolId) { reasons.push("promotion_policy_school_mismatch"); return result("PENDING_REVIEW"); }
  const policyIssues = validatePromotionPolicy(policy);
  if (policyIssues.length > 0) { reasons.push(...policyIssues); return result("PENDING_REVIEW"); }
  if (!policy.appliesToGrades.includes(record.grade)) { reasons.push("grade_not_covered_by_policy"); return result("PENDING_REVIEW"); }
  if (record.enrollmentStatus !== "ACTIVE") { reasons.push(`enrollment_not_active:${record.enrollmentStatus}`); return result("PENDING_REVIEW"); }
  if (!record.recordsFinalized) { reasons.push("records_not_finalized"); return result("PENDING_REVIEW"); }

  let uncertain = false;
  for (const subject of policy.requiredSubjects) {
    const final = record.subjects.find((candidate) => candidate.subject === subject);
    if (!final) { reasons.push(`required_subject_missing:${subject}`); uncertain = true; continue; }
    if (final.status !== "COMPLETE" || final.passing === null) { reasons.push(`required_subject_not_final:${subject}:${final.status}`); uncertain = true; continue; }
    if (!final.passing) failed.push(subject);
  }
  for (const competency of policy.criticalCompetencies) {
    const evidence = record.competencies.find((candidate) => candidate.objectiveId === competency.objectiveId);
    if (!evidence) { reasons.push(`critical_competency_unassessed:${competency.objectiveId}`); uncertain = true; continue; }
    if (!masteryAtLeast(evidence.state, policy.criticalCompetencyMinimum)) criticalGaps.push(competency.objectiveId);
  }
  let attendanceShort = false;
  if (policy.attendanceTargetPercent !== null) {
    if (record.attendancePercent === null) { reasons.push("attendance_evidence_missing"); uncertain = true; }
    else if (record.attendancePercent < policy.attendanceTargetPercent) {
      if (policy.attendanceExceptionsAllowed && record.attendanceException) reasons.push("attendance_below_target_exception_approved");
      else { reasons.push("attendance_below_target"); attendanceShort = true; }
    }
  }
  if (terminal) {
    let unknown = false;
    let unmet = false;
    for (const requirement of policy.programRequirements) {
      const met = record.programRequirementsMet[requirement.requirementId];
      if (met === undefined || met === null) { reasons.push(`program_requirement_unknown:${requirement.requirementId}`); unknown = true; }
      else if (!met) { reasons.push(`program_requirement_not_met:${requirement.requirementId}`); unmet = true; }
    }
    const national = record.nationalSchoolLeaving;
    graduation = {
      liberiaLearnProgram: unknown ? "UNKNOWN" : unmet ? "NOT_MET" : "MET",
      nationalSchoolLeaving: !national.applicable ? "NOT_APPLICABLE" : national.met === null ? "UNKNOWN" : national.met ? "MET" : "NOT_MET",
    };
    if (unknown) uncertain = true;
  }
  if (uncertain) return result("PENDING_REVIEW");

  if (terminal) {
    if (graduation.liberiaLearnProgram === "MET" && failed.length === 0 && criticalGaps.length === 0 && !attendanceShort) {
      reasons.push("liberialearn_program_completed");
      return result("GRADUATE");
    }
    // Not completing the program at the terminal grade is a consequential call: always reviewed.
    reasons.push("terminal_grade_program_not_completed");
    return result("PENDING_REVIEW");
  }
  if (failed.length === 0 && criticalGaps.length === 0 && !attendanceShort) {
    reasons.push("promotion_criteria_met");
    return result("PROMOTE");
  }
  if (failed.length <= policy.maxFailedSubjectsForConditional && criticalGaps.length <= policy.maxCriticalGapsForConditional) {
    reasons.push("limited_gaps_support_plan_required");
    return result("CONDITIONAL_PROMOTION");
  }
  if (policy.retentionRequiresDocumentedIntervention && !interventionDocumented) {
    reasons.push("retention_requires_documented_intervention");
    return result("PENDING_REVIEW");
  }
  reasons.push("retention_after_documented_intervention");
  return result("RETAIN");
}

/** Advisory text (for example an AI risk explanation). It is shown beside, never inside, a decision. */
export type PromotionAdvisory = Readonly<{
  authority: "AI_ADVISORY_ONLY" | "TEACHER_NOTE";
  sourceRef: string;
  summary: string;
  suggestedInterventions: readonly string[];
}>;

export function attachAdvisory(recommendation: PromotionRecommendation, advisory: PromotionAdvisory): Readonly<{
  recommendation: PromotionRecommendation;
  advisory: PromotionAdvisory;
}> {
  return Object.freeze({ recommendation, advisory: Object.freeze({ ...advisory }) });
}
