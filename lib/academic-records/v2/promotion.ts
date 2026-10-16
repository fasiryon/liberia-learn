/**
 * Deterministic promotion-eligibility evaluator. Produces a RECOMMENDATION from finalized year-end
 * records under an approved, versioned school or MOE-sourced policy. It never changes enrollment:
 * an authorized school leader decides (promotionDecision.ts).
 *
 * Anything uncertain resolves to PENDING_REVIEW, never to PROMOTE or RETAIN: a missing or
 * unapproved policy, unfinalized records, a required subject without a complete final grade,
 * missing attendance the policy needs, or an unknown graduation requirement.
 *
 * There is no AI input. `PromotionAdvisory` can carry an AI risk explanation or intervention ideas
 * next to a recommendation, but the evaluator's signature cannot accept it and it never changes the
 * recommendation.
 */
import { createHash } from "crypto";
import { canonicalizeJson } from "@/lib/curriculum/provenance/hash";

export type PromotionRecommendationKind = "PROMOTE" | "CONDITIONAL_PROMOTION" | "RETAIN" | "GRADUATE" | "PENDING_REVIEW";

export type PromotionPolicy = Readonly<{
  policyId: string;
  version: string;
  schoolId: string;
  status: "DRAFT" | "APPROVED" | "RETIRED";
  source: Readonly<{ kind: "SCHOOL_POLICY" | "MOE_DIRECTIVE"; reference: string; attestedBy: string | null }>;
  appliesToGrades: readonly number[];
  terminalGrade: number;
  requiredSubjects: readonly string[];
  /** Number of failed required subjects still allowing promotion (usually 0). */
  maxFailedForPromotion: number;
  /** Number of failed required subjects allowing conditional promotion with a remediation plan. */
  maxFailedForConditional: number;
  minAttendancePercent: number | null;
  /** Grade-12 completion requirements (e.g. a named national examination result), by id. */
  graduationRequirements: readonly Readonly<{ requirementId: string; description: string }>[];
}>;

export type FinalSubjectResult = Readonly<{
  subject: string;
  status: "COMPLETE" | "INCOMPLETE" | "NO_EVIDENCE";
  percent: number | null;
  passing: boolean | null;
}>;

export type YearEndRecord = Readonly<{
  studentId: string;
  schoolId: string;
  academicYearId: string;
  grade: number;
  enrollmentStatus: "ACTIVE" | "COMPLETED" | "PROMOTED" | "RETAINED" | "TRANSFERRED" | "GRADUATED";
  /** True only when every final-period record is locked and the year-end report is published. */
  recordsFinalized: boolean;
  subjects: readonly FinalSubjectResult[];
  attendancePercent: number | null;
  /** true = met, false = not met, null = unknown. */
  graduationRequirementsMet: Readonly<Record<string, boolean | null>>;
}>;

export type PromotionRecommendation = Readonly<{
  studentId: string;
  schoolId: string;
  academicYearId: string;
  grade: number;
  recommendation: PromotionRecommendationKind;
  reasons: readonly string[];
  failedRequiredSubjects: readonly string[];
  policy: Readonly<{ policyId: string; version: string }> | null;
  inputDigest: string;
  authority: "DETERMINISTIC_POLICY_EVALUATOR";
  requiresAuthorizedDecision: true;
}>;

export function validatePromotionPolicy(policy: PromotionPolicy): readonly string[] {
  const issues: string[] = [];
  if (policy.appliesToGrades.length === 0) issues.push("promotion_policy_grades_required");
  if (policy.requiredSubjects.length === 0) issues.push("promotion_policy_required_subjects_missing");
  if (!Number.isInteger(policy.maxFailedForPromotion) || policy.maxFailedForPromotion < 0) issues.push("promotion_policy_max_failed_invalid");
  if (!Number.isInteger(policy.maxFailedForConditional) || policy.maxFailedForConditional < policy.maxFailedForPromotion) issues.push("promotion_policy_conditional_invalid");
  if (policy.minAttendancePercent !== null && !(policy.minAttendancePercent >= 0 && policy.minAttendancePercent <= 100)) issues.push("promotion_policy_attendance_invalid");
  if (policy.source.kind === "MOE_DIRECTIVE" && (!policy.source.reference.trim() || !policy.source.attestedBy)) issues.push("promotion_policy_moe_source_requires_reference_and_attestation");
  return Object.freeze(issues);
}

export function evaluatePromotionEligibility(record: YearEndRecord, policy: PromotionPolicy | null): PromotionRecommendation {
  const reasons: string[] = [];
  const failed: string[] = [];
  const inputDigest = createHash("sha256").update(canonicalizeJson({ record, policy })).digest("hex");
  const result = (recommendation: PromotionRecommendationKind) => Object.freeze({
    studentId: record.studentId,
    schoolId: record.schoolId,
    academicYearId: record.academicYearId,
    grade: record.grade,
    recommendation,
    reasons: Object.freeze([...reasons]),
    failedRequiredSubjects: Object.freeze([...failed]),
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
  if (policy.minAttendancePercent !== null) {
    if (record.attendancePercent === null) { reasons.push("attendance_missing"); uncertain = true; }
    else if (record.attendancePercent < policy.minAttendancePercent) reasons.push("attendance_below_minimum");
  }
  if (record.grade === policy.terminalGrade) {
    for (const requirement of policy.graduationRequirements) {
      const met = record.graduationRequirementsMet[requirement.requirementId];
      if (met === undefined || met === null) { reasons.push(`graduation_requirement_unknown:${requirement.requirementId}`); uncertain = true; }
      else if (!met) reasons.push(`graduation_requirement_not_met:${requirement.requirementId}`);
    }
  }
  if (uncertain) return result("PENDING_REVIEW");

  const attendanceShort = reasons.includes("attendance_below_minimum");
  if (record.grade === policy.terminalGrade) {
    const requirementsUnmet = reasons.some((reason) => reason.startsWith("graduation_requirement_not_met"));
    if (failed.length === 0 && !requirementsUnmet && !attendanceShort) { reasons.push("graduation_requirements_met"); return result("GRADUATE"); }
    // Not graduating at the terminal grade is a consequential call; route it to review, not to RETAIN.
    reasons.push("terminal_grade_requirements_not_met");
    return result("PENDING_REVIEW");
  }
  if (failed.length <= policy.maxFailedForPromotion && !attendanceShort) { reasons.push("promotion_criteria_met"); return result("PROMOTE"); }
  if (failed.length <= policy.maxFailedForConditional) { reasons.push("conditional_criteria_met"); return result("CONDITIONAL_PROMOTION"); }
  reasons.push("retention_criteria_met");
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
