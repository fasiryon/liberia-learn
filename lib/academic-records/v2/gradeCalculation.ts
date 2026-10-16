/**
 * Deterministic official subject-grade calculation under an approved, school-scoped policy.
 *
 * Rules (LL-AEP-001):
 *   - every entry is normalized against ITS OWN points possible; raw scores on different scales
 *     are never averaged together;
 *   - entries from another student, school, class, subject or period are rejected, not mixed in;
 *   - no false zeros: MISSING is zero only if the policy allows it AND a teacher confirmed it;
 *     EXEMPT is excluded; INCOMPLETE and PENDING_MODERATION block finalization;
 *   - no automatic official AI grading: AI scores no teacher approved (including scores
 *     auto-released after a timeout) are excluded and block finalization;
 *   - reassessment is allowed and every attempt stays in the history; the policy says which
 *     attempt counts;
 *   - no single-exam dependency: one assessment may not carry more than the policy's share;
 *   - nothing graded is NO_EVIDENCE with a null percent, never 0%;
 *   - passing and proficiency are reported separately from the letter band.
 */
import {
  bandFor,
  groupFor,
  isPassing,
  meetsProficiency,
  policyRef,
  validateGradingPolicy,
  type GradeCategory,
  type GradingPolicy,
  type GradingPolicyRef,
} from "./gradingPolicy";

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
  /** Logical piece of work; several entries with the same key are reassessment attempts. */
  assessmentKey?: string;
  attemptNumber?: number;
}>;

export type GradeScope = Readonly<{ studentId: string; schoolId: string; classId: string; subject: string; periodId: string }>;

export type GroupResult = Readonly<{
  groupId: string;
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
  meetsProficiencyTarget: boolean | null;
  groups: readonly GroupResult[];
  excluded: readonly Readonly<{ entryId: string; reason: string }>[];
  blockers: readonly string[];
}>;

const OFFICIAL_AUTHORITIES: readonly ScoreAuthority[] = ["TEACHER", "SERVER_KEYED", "HUMAN_MODERATOR"];

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

type Counted = { entryId: string; fraction: number; possible: number };

export function computeSubjectGrade(input: {
  scope: GradeScope;
  policy: GradingPolicy | null;
  entries: readonly GradeEntry[];
}): SubjectGradeResult {
  const { scope, policy } = input;
  if (!policy) throw new Error("records_grading_policy_required");
  if (policy.status !== "APPROVED") throw new Error("records_grading_policy_not_approved");
  if (policy.scope.kind !== "SCHOOL" || policy.scope.schoolId !== scope.schoolId) throw new Error("records_grading_policy_school_mismatch");
  const policyIssues = validateGradingPolicy(policy);
  if (policyIssues.length > 0) throw new Error(`records_grading_policy_invalid:${policyIssues[0]}`);

  const excluded: { entryId: string; reason: string }[] = [];
  const blockers = new Set<string>();
  const seen = new Set<string>();

  for (const entry of input.entries) {
    if (entry.studentId !== scope.studentId || entry.schoolId !== scope.schoolId || entry.classId !== scope.classId
      || entry.subject !== scope.subject || entry.periodId !== scope.periodId) {
      throw new Error("records_entry_scope_mismatch");
    }
    if (seen.has(entry.entryId)) throw new Error("records_entry_duplicate");
    seen.add(entry.entryId);
    if (!(entry.pointsPossible > 0)) throw new Error("records_entry_points_possible_invalid");
  }

  // Reassessment: keep every attempt in `excluded` history; only the policy's attempt counts.
  const superseded = new Set<string>();
  const attempts = new Map<string, GradeEntry[]>();
  for (const entry of input.entries) {
    if (!entry.assessmentKey) continue;
    attempts.set(entry.assessmentKey, [...(attempts.get(entry.assessmentKey) ?? []), entry]);
  }
  for (const group of attempts.values()) {
    if (group.length < 2) continue;
    const scored = group.filter((entry) => (entry.status === "SCORED" || entry.status === "LATE") && entry.pointsEarned !== null);
    if (scored.length === 0) continue;
    const pick = policy.reassessment === "LATEST"
      ? [...scored].sort((a, b) => (b.attemptNumber ?? 0) - (a.attemptNumber ?? 0))[0]
      : [...scored].sort((a, b) => b.pointsEarned! / b.pointsPossible - a.pointsEarned! / a.pointsPossible)[0];
    for (const entry of group) if (entry !== pick) superseded.add(entry.entryId);
  }

  const counted = new Map<string, Counted[]>();
  for (const entry of input.entries) {
    if (superseded.has(entry.entryId)) {
      excluded.push({ entryId: entry.entryId, reason: "superseded_by_reassessment" });
      continue;
    }
    if (policy.prohibitedCategories.includes(entry.category)) {
      excluded.push({ entryId: entry.entryId, reason: "category_prohibited_by_policy" });
      blockers.add("prohibited_category_present");
      continue;
    }
    const group = groupFor(policy, entry.category);
    if (!group) {
      excluded.push({ entryId: entry.entryId, reason: "category_not_in_policy" });
      continue;
    }
    let fraction: number;
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
          break;
        }
        excluded.push({ entryId: entry.entryId, reason: "missing_unresolved" });
        blockers.add("missing_work_unresolved");
        continue;
      case "SCORED":
      case "LATE":
        if (!entry.scoreAuthority || !OFFICIAL_AUTHORITIES.includes(entry.scoreAuthority)) {
          excluded.push({ entryId: entry.entryId, reason: "score_not_official" });
          blockers.add("unverified_ai_scores_present");
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
    counted.set(group.groupId, [...(counted.get(group.groupId) ?? []), { entryId: entry.entryId, fraction, possible: entry.pointsPossible }]);
  }

  const countedEntries = [...counted.values()].reduce((sum, list) => sum + list.length, 0);
  const groupsWithEvidence = policy.groups.filter((group) => counted.has(group.groupId));
  const evidenceWeight = groupsWithEvidence.reduce((sum, group) => sum + group.weightPercent, 0);
  if (groupsWithEvidence.length < policy.groups.length && policy.emptyGroup === "INCOMPLETE" && countedEntries > 0) blockers.add("weighted_group_without_evidence");
  if (countedEntries > 0 && countedEntries < policy.minimumScoredEntries) blockers.add("insufficient_scored_entries");

  const groupPercent = (list: Counted[]) => 100 * (policy.withinGroup === "POINTS"
    ? list.reduce((sum, item) => sum + item.fraction * item.possible, 0) / list.reduce((sum, item) => sum + item.possible, 0)
    : list.reduce((sum, item) => sum + item.fraction, 0) / list.length);

  // Effective share of each entry in the final grade; enforces "no single-exam dependency".
  for (const group of groupsWithEvidence) {
    const list = counted.get(group.groupId)!;
    const groupShare = (group.weightPercent / evidenceWeight) * 100;
    const totalPossible = list.reduce((sum, item) => sum + item.possible, 0);
    for (const item of list) {
      const share = groupShare * (policy.withinGroup === "POINTS" ? item.possible / totalPossible : 1 / list.length);
      if (share > policy.maxSingleAssessmentSharePercent + 1e-9) blockers.add("single_assessment_dependency");
    }
  }

  const groups: GroupResult[] = policy.groups.map((group) => {
    const list = counted.get(group.groupId);
    return Object.freeze({
      groupId: group.groupId,
      weightPercent: group.weightPercent,
      appliedWeightPercent: list && evidenceWeight > 0 ? (group.weightPercent / evidenceWeight) * 100 : 0,
      percent: list ? round(groupPercent(list), policy.roundingDecimals) : null,
      countedEntries: list?.length ?? 0,
    });
  });

  const base = { scope, policy: policyRef(policy), groups: Object.freeze(groups), excluded: Object.freeze(excluded) };
  if (countedEntries === 0) {
    return Object.freeze({ ...base, status: "NO_EVIDENCE", percent: null, label: null, passing: null, meetsProficiencyTarget: null, blockers: Object.freeze([...blockers]) });
  }
  const raw = groupsWithEvidence.reduce((sum, group) => sum + groupPercent(counted.get(group.groupId)!) * (group.weightPercent / evidenceWeight), 0);
  const percent = round(raw, policy.roundingDecimals);
  return Object.freeze({
    ...base,
    status: blockers.size === 0 ? "COMPLETE" : "INCOMPLETE",
    percent,
    label: bandFor(policy, percent).label,
    passing: isPassing(policy, percent),
    meetsProficiencyTarget: meetsProficiency(policy, percent),
    blockers: Object.freeze([...blockers]),
  });
}

/**
 * Maps a legacy AssignmentSubmission row to its true score authority. After the LL-AEP-001 fix,
 * auto-release no longer writes `score`; rows auto-released before the fix still carry an AI score
 * in `score` and are classified AI_AUTO_RELEASED until a teacher approves them.
 */
export function legacyAssignmentScoreAuthority(row: { score: number | null; teacherApproved: boolean; autoReleasedAt: Date | null; aiGrade: number | null; gradedBy: string | null }): ScoreAuthority | null {
  if (row.score === null) return null;
  if (row.teacherApproved) return "TEACHER";
  if (row.autoReleasedAt) return "AI_AUTO_RELEASED";
  if (row.aiGrade !== null && row.gradedBy === null) return "AI_UNMODERATED";
  return row.gradedBy ? "TEACHER" : null;
}
