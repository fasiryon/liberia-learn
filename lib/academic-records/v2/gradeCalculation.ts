/**
 * Deterministic official subject-grade calculation under an approved grading policy.
 *
 * Rules that the legacy generator (lib/reportCards/generateReportCard.ts) does not follow:
 *   - every entry is normalized against ITS OWN points possible; raw scores on different scales
 *     are never averaged together;
 *   - entries from another school, class, subject or period are rejected, not mixed in;
 *   - MISSING is not zero unless the policy allows it AND a teacher confirmed it;
 *   - EXEMPT is excluded, not zero; INCOMPLETE and PENDING_MODERATION block finalization;
 *   - AI scores that no teacher approved (including scores auto-released after a timeout) are not
 *     official and block finalization until moderated;
 *   - no evidence at all is NO_EVIDENCE with a null percent, never 0%.
 */
import { bandFor, policyRef, validateGradingPolicy, type GradeCategory, type GradingPolicy, type GradingPolicyRef } from "./gradingPolicy";

export type GradeEntryStatus = "SCORED" | "LATE" | "MISSING" | "EXEMPT" | "INCOMPLETE" | "PENDING_MODERATION";

export type ScoreAuthority = "TEACHER" | "SERVER_KEYED" | "HUMAN_MODERATOR" | "AI_UNMODERATED" | "AI_AUTO_RELEASED";

export type GradeEntry = Readonly<{
  entryId: string;
  sourceRef: string;
  studentId: string;
  schoolId: string;
  classId: string;
  subject: string;
  periodId: string;
  category: GradeCategory;
  status: GradeEntryStatus;
  pointsEarned: number | null;
  pointsPossible: number;
  daysLate: number;
  teacherConfirmedMissing: boolean;
  scoreAuthority: ScoreAuthority | null;
}>;

export type GradeScope = Readonly<{ studentId: string; schoolId: string; classId: string; subject: string; periodId: string }>;

export type CategoryResult = Readonly<{
  category: GradeCategory;
  weightPercent: number;
  appliedWeightPercent: number;
  percent: number | null;
  countedEntries: number;
}>;

export type SubjectGradeResult = Readonly<{
  scope: GradeScope;
  policy: GradingPolicyRef;
  status: "COMPLETE" | "INCOMPLETE" | "NO_EVIDENCE";
  percent: number | null;
  label: string | null;
  passing: boolean | null;
  categories: readonly CategoryResult[];
  excluded: readonly Readonly<{ entryId: string; reason: string }>[];
  blockers: readonly string[];
}>;

const OFFICIAL_AUTHORITIES: readonly ScoreAuthority[] = ["TEACHER", "SERVER_KEYED", "HUMAN_MODERATOR"];

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function computeSubjectGrade(input: {
  scope: GradeScope;
  policy: GradingPolicy | null;
  entries: readonly GradeEntry[];
}): SubjectGradeResult {
  const { scope, policy } = input;
  if (!policy) throw new Error("records_grading_policy_required");
  if (policy.status !== "APPROVED") throw new Error("records_grading_policy_not_approved");
  if (policy.schoolId !== scope.schoolId) throw new Error("records_grading_policy_school_mismatch");
  const policyIssues = validateGradingPolicy(policy);
  if (policyIssues.length > 0) throw new Error(`records_grading_policy_invalid:${policyIssues[0]}`);

  const excluded: { entryId: string; reason: string }[] = [];
  const blockers = new Set<string>();
  const counted = new Map<GradeCategory, { earned: number; possible: number; fractions: number[] }>();
  const seen = new Set<string>();

  for (const entry of input.entries) {
    if (entry.studentId !== scope.studentId || entry.schoolId !== scope.schoolId || entry.classId !== scope.classId
      || entry.subject !== scope.subject || entry.periodId !== scope.periodId) {
      throw new Error("records_entry_scope_mismatch");
    }
    if (seen.has(entry.entryId)) throw new Error("records_entry_duplicate");
    seen.add(entry.entryId);
    if (!(entry.pointsPossible > 0)) throw new Error("records_entry_points_possible_invalid");
    if (!policy.categories.some((candidate) => candidate.category === entry.category)) {
      excluded.push({ entryId: entry.entryId, reason: "category_not_in_policy" });
      continue;
    }
    let fraction: number | null = null;
    switch (entry.status) {
      case "EXEMPT":
        excluded.push({ entryId: entry.entryId, reason: "exempt" });
        continue;
      case "INCOMPLETE":
        excluded.push({ entryId: entry.entryId, reason: "incomplete" });
        blockers.add("incomplete_work_unresolved");
        continue;
      case "PENDING_MODERATION":
        excluded.push({ entryId: entry.entryId, reason: "pending_moderation" });
        blockers.add("scores_pending_moderation");
        continue;
      case "MISSING":
        if (policy.missingWork === "ZERO_WHEN_TEACHER_CONFIRMED" && entry.teacherConfirmedMissing) {
          fraction = 0;
        } else {
          excluded.push({ entryId: entry.entryId, reason: "missing_unresolved" });
          blockers.add("missing_work_unresolved");
          continue;
        }
        break;
      case "SCORED":
      case "LATE": {
        if (!entry.scoreAuthority || !OFFICIAL_AUTHORITIES.includes(entry.scoreAuthority)) {
          excluded.push({ entryId: entry.entryId, reason: "score_not_official" });
          blockers.add("unmoderated_ai_scores_present");
          continue;
        }
        if (entry.pointsEarned === null || entry.pointsEarned < 0 || entry.pointsEarned > entry.pointsPossible) throw new Error("records_entry_points_invalid");
        fraction = entry.pointsEarned / entry.pointsPossible;
        if (entry.status === "LATE" && policy.late) {
          const penalty = Math.min(policy.late.maxPenaltyPercent, Math.max(0, entry.daysLate) * policy.late.penaltyPercentPerDay) / 100;
          fraction = Math.max(0, fraction * (1 - penalty));
        }
        break;
      }
    }
    const bucket = counted.get(entry.category) ?? { earned: 0, possible: 0, fractions: [] };
    bucket.earned += fraction * entry.pointsPossible;
    bucket.possible += entry.pointsPossible;
    bucket.fractions.push(fraction);
    counted.set(entry.category, bucket);
  }

  const countedEntries = [...counted.values()].reduce((sum, bucket) => sum + bucket.fractions.length, 0);
  const categoriesWithEvidence = policy.categories.filter((entry) => counted.has(entry.category));
  const evidenceWeight = categoriesWithEvidence.reduce((sum, entry) => sum + entry.weightPercent, 0);
  if (categoriesWithEvidence.length < policy.categories.length && policy.emptyCategory === "INCOMPLETE" && countedEntries > 0) blockers.add("weighted_category_without_evidence");
  if (countedEntries > 0 && countedEntries < policy.minimumScoredEntries) blockers.add("insufficient_scored_entries");

  const categories: CategoryResult[] = policy.categories.map((entry) => {
    const bucket = counted.get(entry.category);
    const percent = bucket
      ? 100 * (policy.withinCategory === "POINTS" ? bucket.earned / bucket.possible : bucket.fractions.reduce((a, b) => a + b, 0) / bucket.fractions.length)
      : null;
    return Object.freeze({
      category: entry.category,
      weightPercent: entry.weightPercent,
      appliedWeightPercent: bucket && evidenceWeight > 0 ? (entry.weightPercent / evidenceWeight) * 100 : 0,
      percent: percent === null ? null : round(percent, policy.roundingDecimals),
      countedEntries: bucket?.fractions.length ?? 0,
    });
  });

  const base = { scope, policy: policyRef(policy), categories: Object.freeze(categories), excluded: Object.freeze(excluded) };
  if (countedEntries === 0) {
    return Object.freeze({ ...base, status: "NO_EVIDENCE", percent: null, label: null, passing: null, blockers: Object.freeze([...blockers]) });
  }
  const raw = categories.reduce((sum, category) => {
    const bucket = counted.get(category.category);
    if (!bucket) return sum;
    const percent = 100 * (policy.withinCategory === "POINTS" ? bucket.earned / bucket.possible : bucket.fractions.reduce((a, b) => a + b, 0) / bucket.fractions.length);
    return sum + percent * (category.weightPercent / evidenceWeight);
  }, 0);
  const percent = round(raw, policy.roundingDecimals);
  const band = bandFor(policy, percent);
  return Object.freeze({
    ...base,
    status: blockers.size === 0 ? "COMPLETE" : "INCOMPLETE",
    percent,
    label: band.label,
    passing: band.passing,
    blockers: Object.freeze([...blockers]),
  });
}

/** Maps a legacy AssignmentSubmission row to a grade entry, preserving its true score authority. */
export function legacyAssignmentScoreAuthority(row: { score: number | null; teacherApproved: boolean; autoReleasedAt: Date | null; aiGrade: number | null; gradedBy: string | null }): ScoreAuthority | null {
  if (row.score === null) return null;
  if (row.teacherApproved || (row.gradedBy && row.aiGrade === null)) return "TEACHER";
  if (row.autoReleasedAt) return "AI_AUTO_RELEASED";
  if (row.aiGrade !== null) return "AI_UNMODERATED";
  return row.gradedBy ? "TEACHER" : null;
}
