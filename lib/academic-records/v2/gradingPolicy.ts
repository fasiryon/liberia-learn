/**
 * Versioned grading policies. A school's official grading formula is an approved, hashed policy
 * version, never a constant in code. No default policy exists: when a school has not approved one,
 * official grades cannot be computed (see gradeCalculation.ts), which is the intended behaviour.
 *
 * `source` records where the policy came from. Recording "MOE_DIRECTIVE" requires a reference and
 * a named attesting person; it states provenance, it is not an endorsement by this software.
 */
import { createHash } from "crypto";
import { canonicalizeJson } from "@/lib/curriculum/provenance/hash";

export const GRADE_CATEGORIES = ["CLASSWORK", "HOMEWORK", "ASSIGNMENT", "QUIZ", "TEST", "EXAM", "PROJECT", "PRACTICAL", "PARTICIPATION"] as const;
export type GradeCategory = (typeof GRADE_CATEGORIES)[number];

export type GradeBand = Readonly<{ minPercent: number; label: string; passing: boolean }>;

export type GradingPolicy = Readonly<{
  policyId: string;
  version: string;
  schoolId: string;
  status: "DRAFT" | "APPROVED" | "RETIRED";
  approvedBy: Readonly<{ userId: string; role: "PRINCIPAL" | "ADMIN" }> | null;
  source: Readonly<{ kind: "SCHOOL_POLICY" | "MOE_DIRECTIVE"; reference: string; attestedBy: string | null }>;
  /** Weights in percent; must sum to 100. Categories absent here are not graded. */
  categories: readonly Readonly<{ category: GradeCategory; weightPercent: number }>[];
  /** Within one category: points-weighted (sum earned / sum possible) or each entry equal. */
  withinCategory: "POINTS" | "EQUAL";
  /** A weighted category with no evidence: re-normalize the rest, or mark the grade incomplete. */
  emptyCategory: "RENORMALIZE" | "INCOMPLETE";
  /**
   * MISSING work is never silently zero. EXCLUDE_UNTIL_RESOLVED keeps the grade incomplete until a
   * teacher resolves it; ZERO_WHEN_TEACHER_CONFIRMED counts zero only for entries a teacher confirmed.
   */
  missingWork: "EXCLUDE_UNTIL_RESOLVED" | "ZERO_WHEN_TEACHER_CONFIRMED";
  late: Readonly<{ penaltyPercentPerDay: number; maxPenaltyPercent: number }> | null;
  /** Ordered high → low by minPercent. */
  scale: readonly GradeBand[];
  roundingDecimals: number;
  /** Minimum scored entries per subject per period before a grade is official. */
  minimumScoredEntries: number;
}>;

export function hashGradingPolicy(policy: GradingPolicy): string {
  return createHash("sha256").update(canonicalizeJson({ domain: "liberialearn.grading-policy.v2", policy })).digest("hex");
}

export function validateGradingPolicy(policy: GradingPolicy): readonly string[] {
  const issues: string[] = [];
  if (!policy.policyId || !policy.version || !policy.schoolId) issues.push("policy_identity_required");
  if (policy.categories.length === 0) issues.push("policy_categories_required");
  const seen = new Set<string>();
  for (const entry of policy.categories) {
    if (!GRADE_CATEGORIES.includes(entry.category)) issues.push(`policy_category_unknown:${entry.category}`);
    if (seen.has(entry.category)) issues.push(`policy_category_duplicate:${entry.category}`);
    seen.add(entry.category);
    if (!(entry.weightPercent > 0)) issues.push(`policy_weight_invalid:${entry.category}`);
  }
  const total = policy.categories.reduce((sum, entry) => sum + entry.weightPercent, 0);
  if (Math.abs(total - 100) > 1e-9) issues.push("policy_weights_must_sum_to_100");
  if (policy.scale.length === 0) issues.push("policy_scale_required");
  for (let index = 1; index < policy.scale.length; index += 1) {
    if (!(policy.scale[index - 1].minPercent > policy.scale[index].minPercent)) issues.push("policy_scale_not_descending");
  }
  if (policy.scale.length > 0 && policy.scale[policy.scale.length - 1].minPercent !== 0) issues.push("policy_scale_must_cover_zero");
  if (!policy.scale.some((band) => band.passing) || !policy.scale.some((band) => !band.passing)) issues.push("policy_scale_pass_fail_required");
  if (policy.late && !(policy.late.penaltyPercentPerDay >= 0 && policy.late.maxPenaltyPercent >= 0 && policy.late.maxPenaltyPercent <= 100)) issues.push("policy_late_invalid");
  if (!Number.isInteger(policy.roundingDecimals) || policy.roundingDecimals < 0 || policy.roundingDecimals > 2) issues.push("policy_rounding_invalid");
  if (!Number.isInteger(policy.minimumScoredEntries) || policy.minimumScoredEntries < 1) issues.push("policy_minimum_entries_invalid");
  if (policy.status === "APPROVED" && !policy.approvedBy) issues.push("policy_approval_required");
  if (policy.source.kind === "MOE_DIRECTIVE" && (!policy.source.reference.trim() || !policy.source.attestedBy)) issues.push("policy_moe_source_requires_reference_and_attestation");
  return Object.freeze(issues);
}

export function bandFor(policy: GradingPolicy, percent: number): GradeBand {
  const band = policy.scale.find((candidate) => percent >= candidate.minPercent);
  if (!band) throw new Error("records_scale_gap");
  return band;
}

export type GradingPolicyRef = Readonly<{ policyId: string; version: string; hash: string }>;

export function policyRef(policy: GradingPolicy): GradingPolicyRef {
  return Object.freeze({ policyId: policy.policyId, version: policy.version, hash: hashGradingPolicy(policy) });
}
