/**
 * Versioned grading policies. A grading formula is an approved, hashed policy version, never a
 * constant in code. Weights apply to GROUPS of evidence categories, so the LL-AEP-001 groups
 * (independent classwork, homework and practice, …) can absorb the fine-grained categories that
 * existing records carry.
 *
 * Policy scope:
 *   - INSTITUTION: a LiberiaLearn baseline (LL-AEP-001). Never used directly to grade.
 *   - SCHOOL: a version a school has adopted. Only an APPROVED school-scoped version can
 *     produce official grades, so a baseline is never "activated" by existing in code.
 *
 * Passing and proficiency thresholds are separate from the letter scale. Mastery thresholds live
 * in masteryPolicy.ts.
 */
import { createHash } from "crypto";
import { canonicalizeJson } from "@/lib/curriculum/provenance/hash";
import {
  LL_AEP_001_REF,
  LL_GRADE_BANDS,
  LL_MAX_SINGLE_ASSESSMENT_SHARE_PERCENT,
  LL_SUBJECT_THRESHOLDS,
  LL_WEIGHTS_GRADES_1_3,
  LL_WEIGHTS_GRADES_4_12,
} from "@/lib/academic-policy/llAep001";

export const GRADE_CATEGORIES = [
  "CLASSWORK", "HOMEWORK", "PRACTICE", "ASSIGNMENT", "QUIZ", "FORMATIVE_CHECK", "TEST", "EXAM",
  "PROJECT", "WRITING", "PRACTICAL", "PARTICIPATION",
  "MASTERY_DEMONSTRATION", "GUIDED_ACTIVITY", "FOUNDATIONAL_CHECK", "TEACHER_OBSERVATION",
] as const;
export type GradeCategory = (typeof GRADE_CATEGORIES)[number];

export type GradeBand = Readonly<{ minPercent: number; label: string; meaning: string }>;

export type WeightGroup = Readonly<{
  groupId: string;
  label: string;
  weightPercent: number;
  /** Evidence categories pooled in this group. Each category belongs to at most one group. */
  includes: readonly GradeCategory[];
}>;

export type GradingPolicy = Readonly<{
  policyId: string;
  version: string;
  scope: Readonly<{ kind: "INSTITUTION" }> | Readonly<{ kind: "SCHOOL"; schoolId: string }>;
  status: "DRAFT" | "APPROVED" | "RETIRED";
  approvedBy: Readonly<{ userId: string; role: "PRINCIPAL" | "ADMIN" }> | null;
  source: Readonly<{ kind: "LIBERIALEARN_INSTITUTIONAL" | "SCHOOL_POLICY" | "MOE_DIRECTIVE"; reference: string; attestedBy: string | null }>;
  /** The institutional baseline this version was adopted from, if any. */
  derivedFrom: string | null;
  appliesToGrades: readonly number[];
  groups: readonly WeightGroup[];
  /** Categories that may not be graded under this policy (e.g. high-stakes exams in Grades 1–3). */
  prohibitedCategories: readonly GradeCategory[];
  withinGroup: "POINTS" | "EQUAL";
  emptyGroup: "RENORMALIZE" | "INCOMPLETE";
  /** MISSING is never silently zero (LL-AEP-001: no false zeros). */
  missingWork: "EXCLUDE_UNTIL_RESOLVED" | "ZERO_WHEN_TEACHER_CONFIRMED";
  late: Readonly<{ penaltyPercentPerDay: number; maxPenaltyPercent: number }> | null;
  /** Which attempt of a reassessed piece of work counts. Every attempt stays in the history. */
  reassessment: "LATEST" | "HIGHEST";
  /** No single assessment may carry more than this share of the grade. */
  maxSingleAssessmentSharePercent: number;
  /** Ordered high → low by minPercent. */
  scale: readonly GradeBand[];
  thresholds: Readonly<{ passingPercent: number; proficiencyTargetPercent: number }>;
  roundingDecimals: number;
  minimumScoredEntries: number;
}>;

export function hashGradingPolicy(policy: GradingPolicy): string {
  return createHash("sha256").update(canonicalizeJson({ domain: "liberialearn.grading-policy.v2", policy })).digest("hex");
}

export function validateGradingPolicy(policy: GradingPolicy): readonly string[] {
  const issues: string[] = [];
  if (!policy.policyId || !policy.version) issues.push("policy_identity_required");
  if (policy.scope.kind === "SCHOOL" && !policy.scope.schoolId) issues.push("policy_school_required");
  if (policy.scope.kind === "INSTITUTION" && policy.status === "APPROVED") issues.push("policy_institution_baseline_cannot_grade_directly");
  if (policy.appliesToGrades.length === 0 || policy.appliesToGrades.some((grade) => !Number.isInteger(grade) || grade < 1 || grade > 12)) issues.push("policy_grades_invalid");
  if (policy.groups.length === 0) issues.push("policy_groups_required");
  const seenGroups = new Set<string>();
  const seenCategories = new Set<string>();
  for (const group of policy.groups) {
    if (seenGroups.has(group.groupId)) issues.push(`policy_group_duplicate:${group.groupId}`);
    seenGroups.add(group.groupId);
    if (!(group.weightPercent > 0)) issues.push(`policy_weight_invalid:${group.groupId}`);
    if (group.includes.length === 0) issues.push(`policy_group_empty:${group.groupId}`);
    for (const category of group.includes) {
      if (!GRADE_CATEGORIES.includes(category)) issues.push(`policy_category_unknown:${category}`);
      if (seenCategories.has(category)) issues.push(`policy_category_in_two_groups:${category}`);
      if (policy.prohibitedCategories.includes(category)) issues.push(`policy_category_both_weighted_and_prohibited:${category}`);
      seenCategories.add(category);
    }
  }
  const total = policy.groups.reduce((sum, group) => sum + group.weightPercent, 0);
  if (Math.abs(total - 100) > 1e-9) issues.push("policy_weights_must_sum_to_100");
  if (policy.scale.length === 0) issues.push("policy_scale_required");
  for (let index = 1; index < policy.scale.length; index += 1) {
    if (!(policy.scale[index - 1].minPercent > policy.scale[index].minPercent)) issues.push("policy_scale_not_descending");
  }
  if (policy.scale.length > 0 && policy.scale[policy.scale.length - 1].minPercent !== 0) issues.push("policy_scale_must_cover_zero");
  const { passingPercent, proficiencyTargetPercent } = policy.thresholds;
  if (!(passingPercent > 0 && passingPercent <= proficiencyTargetPercent && proficiencyTargetPercent <= 100)) issues.push("policy_thresholds_invalid");
  if (!policy.scale.some((band) => band.minPercent === passingPercent)) issues.push("policy_passing_threshold_not_a_band_boundary");
  if (policy.late && !(policy.late.penaltyPercentPerDay >= 0 && policy.late.maxPenaltyPercent >= 0 && policy.late.maxPenaltyPercent <= 100)) issues.push("policy_late_invalid");
  if (!(policy.maxSingleAssessmentSharePercent > 0 && policy.maxSingleAssessmentSharePercent <= 100)) issues.push("policy_single_assessment_share_invalid");
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

export function isPassing(policy: GradingPolicy, percent: number): boolean {
  return percent >= policy.thresholds.passingPercent;
}

export function meetsProficiency(policy: GradingPolicy, percent: number): boolean {
  return percent >= policy.thresholds.proficiencyTargetPercent;
}

export function groupFor(policy: GradingPolicy, category: GradeCategory): WeightGroup | null {
  return policy.groups.find((group) => group.includes.includes(category)) ?? null;
}

export type GradingPolicyRef = Readonly<{ policyId: string; version: string; hash: string }>;

export function policyRef(policy: GradingPolicy): GradingPolicyRef {
  return Object.freeze({ policyId: policy.policyId, version: policy.version, hash: hashGradingPolicy(policy) });
}

// ─── LL-AEP-001 baselines (institutional, DRAFT until a school adopts a version) ────────────────

const LL_CATEGORY_MAP_4_12: Readonly<Record<string, readonly GradeCategory[]>> = {
  INDEPENDENT_CLASSWORK: ["CLASSWORK"],
  HOMEWORK_PRACTICE: ["HOMEWORK", "PRACTICE", "ASSIGNMENT"],
  QUIZZES_FORMATIVE: ["QUIZ", "FORMATIVE_CHECK"],
  PROJECTS_WRITING_PRACTICAL: ["PROJECT", "WRITING", "PRACTICAL"],
  TESTS_EXAMINATIONS: ["TEST", "EXAM"],
};

const LL_CATEGORY_MAP_1_3: Readonly<Record<string, readonly GradeCategory[]>> = {
  MASTERY_DEMONSTRATIONS: ["MASTERY_DEMONSTRATION"],
  GUIDED_ACTIVITIES: ["GUIDED_ACTIVITY", "CLASSWORK", "PRACTICE"],
  FOUNDATIONAL_LITERACY_NUMERACY: ["FOUNDATIONAL_CHECK", "QUIZ", "FORMATIVE_CHECK"],
  TEACHER_OBSERVATIONS: ["TEACHER_OBSERVATION"],
};

const baselineCommon = {
  scope: { kind: "INSTITUTION" } as const,
  status: "DRAFT" as const,
  approvedBy: null,
  source: { kind: "LIBERIALEARN_INSTITUTIONAL" as const, reference: LL_AEP_001_REF, attestedBy: null },
  derivedFrom: null,
  withinGroup: "POINTS" as const,
  emptyGroup: "RENORMALIZE" as const,
  missingWork: "EXCLUDE_UNTIL_RESOLVED" as const,
  reassessment: "LATEST" as const,
  maxSingleAssessmentSharePercent: LL_MAX_SINGLE_ASSESSMENT_SHARE_PERCENT,
  scale: LL_GRADE_BANDS,
  thresholds: LL_SUBJECT_THRESHOLDS,
  roundingDecimals: 2,
  minimumScoredEntries: 3,
};

/** Grades 4–12 (Grades 10–12 use this until a separate version is approved). */
export const LL_AEP_001_GRADES_4_12: GradingPolicy = Object.freeze({
  ...baselineCommon,
  policyId: "ll-aep-001-grading-g4-12",
  version: "1.0.0",
  appliesToGrades: [4, 5, 6, 7, 8, 9, 10, 11, 12],
  groups: LL_WEIGHTS_GRADES_4_12.map((group) => ({ ...group, includes: LL_CATEGORY_MAP_4_12[group.groupId] })),
  prohibitedCategories: [] as GradeCategory[],
  // LL-AEP-001 sets no late penalty; a school may add one in its adopted version.
  late: null,
} satisfies GradingPolicy);

/** Grades 1–3: developmental evidence, no tests or examinations. */
export const LL_AEP_001_GRADES_1_3: GradingPolicy = Object.freeze({
  ...baselineCommon,
  policyId: "ll-aep-001-grading-g1-3",
  version: "1.0.0",
  appliesToGrades: [1, 2, 3],
  groups: LL_WEIGHTS_GRADES_1_3.map((group) => ({ ...group, includes: LL_CATEGORY_MAP_1_3[group.groupId] })),
  prohibitedCategories: ["TEST", "EXAM"] as GradeCategory[],
  late: null,
} satisfies GradingPolicy);

export const LL_AEP_001_GRADING_BASELINES: readonly GradingPolicy[] = Object.freeze([LL_AEP_001_GRADES_1_3, LL_AEP_001_GRADES_4_12]);

/**
 * A school adopts a baseline as its own APPROVED version. This is the only path from the
 * institutional baseline to official grading, and it requires the school's leadership.
 */
export function adoptGradingPolicy(baseline: GradingPolicy, input: {
  schoolId: string;
  approver: Readonly<{ userId: string; role: string; schoolId: string | null }>;
  version: string;
}): GradingPolicy {
  if (baseline.scope.kind !== "INSTITUTION") throw new Error("records_adoption_requires_institutional_baseline");
  if ((input.approver.role !== "PRINCIPAL" && input.approver.role !== "ADMIN") || input.approver.schoolId !== input.schoolId) throw new Error("records_adoption_requires_school_leadership");
  const adopted: GradingPolicy = Object.freeze({
    ...baseline,
    policyId: `${input.schoolId}:${baseline.policyId}`,
    version: input.version,
    scope: { kind: "SCHOOL" as const, schoolId: input.schoolId },
    status: "APPROVED",
    approvedBy: { userId: input.approver.userId, role: input.approver.role as "PRINCIPAL" | "ADMIN" },
    derivedFrom: `${baseline.policyId}@${baseline.version}#${hashGradingPolicy(baseline)}`,
  });
  const issues = validateGradingPolicy(adopted);
  if (issues.length > 0) throw new Error(`records_adopted_policy_invalid:${issues[0]}`);
  return adopted;
}

/** The school's approved policy covering this grade, or null. Never falls back to a baseline. */
export function resolveGradingPolicy(policies: readonly GradingPolicy[], schoolId: string, grade: number): GradingPolicy | null {
  const matches = policies.filter((policy) => policy.status === "APPROVED" && policy.scope.kind === "SCHOOL"
    && policy.scope.schoolId === schoolId && policy.appliesToGrades.includes(grade));
  if (matches.length > 1) throw new Error("records_grading_policy_ambiguous");
  return matches[0] ?? null;
}
