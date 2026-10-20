/**
 * Grading-period lifecycle: OPEN → TEACHER_VERIFIED → LOCKED. Teachers verify their class/subject
 * results; a principal or school admin locks the period. After LOCK, grades change only through an
 * approved amendment (reportCard.ts). Transitions are idempotent and audited.
 */
import type { SubjectGradeResult } from "./gradeCalculation";

export type PeriodState = "OPEN" | "TEACHER_VERIFIED" | "LOCKED";

export type ClassSubjectPeriod = Readonly<{
  schoolId: string;
  academicYearId: string;
  periodId: string;
  classId: string;
  subject: string;
  state: PeriodState;
  verifiedBy: string | null;
  lockedBy: string | null;
  /** Digest of the results that were verified; a change after verification reopens verification. */
  verifiedResultsDigest: string | null;
}>;

export type RecordsActor = Readonly<{ userId: string; role: "TEACHER" | "ADMIN" | "PRINCIPAL" | "STUDENT" | "GUARDIAN" | "PLATFORM_ADMIN"; schoolId: string | null; classIds: readonly string[] }>;

export type RecordsAuditEvent = Readonly<{ action: string; resourceRef: string; actorId: string; schoolId: string; at: string; details: Readonly<Record<string, string | number | boolean | null>> }>;

export function resultsDigest(results: readonly SubjectGradeResult[]): string {
  return results
    .map((result) => `${result.scope.studentId}:${result.status}:${result.percent ?? "null"}:${result.policy.hash}`)
    .sort()
    .join("|");
}

export function verifyPeriod(period: ClassSubjectPeriod, input: { actor: RecordsActor; results: readonly SubjectGradeResult[]; at: string }): Readonly<{ period: ClassSubjectPeriod; audit: RecordsAuditEvent | null }> {
  const { actor, results } = input;
  if (actor.role !== "TEACHER" || actor.schoolId !== period.schoolId || !actor.classIds.includes(period.classId)) throw new Error("records_verify_requires_assigned_teacher");
  if (period.state === "LOCKED") throw new Error("records_period_locked");
  for (const result of results) {
    if (result.scope.schoolId !== period.schoolId || result.scope.classId !== period.classId || result.scope.subject !== period.subject || result.scope.periodId !== period.periodId) throw new Error("records_result_scope_mismatch");
  }
  const blocked = results.filter((result) => result.status === "INCOMPLETE");
  if (blocked.length > 0) throw new Error(`records_verify_blocked:${blocked[0].blockers[0] ?? "incomplete"}`);
  const digest = resultsDigest(results);
  if (period.state === "TEACHER_VERIFIED" && period.verifiedResultsDigest === digest) return Object.freeze({ period, audit: null });
  const next = Object.freeze({ ...period, state: "TEACHER_VERIFIED" as const, verifiedBy: actor.userId, verifiedResultsDigest: digest });
  return Object.freeze({
    period: next,
    audit: { action: "records.period.verified", resourceRef: `${period.classId}:${period.subject}:${period.periodId}`, actorId: actor.userId, schoolId: period.schoolId, at: input.at, details: { students: results.length, noEvidence: results.filter((result) => result.status === "NO_EVIDENCE").length } },
  });
}

export function lockPeriod(period: ClassSubjectPeriod, input: { actor: RecordsActor; currentResults: readonly SubjectGradeResult[]; at: string }): Readonly<{ period: ClassSubjectPeriod; audit: RecordsAuditEvent | null }> {
  const { actor } = input;
  if ((actor.role !== "PRINCIPAL" && actor.role !== "ADMIN") || actor.schoolId !== period.schoolId) throw new Error("records_lock_requires_school_leadership");
  if (period.state === "LOCKED") return Object.freeze({ period, audit: null });
  if (period.state !== "TEACHER_VERIFIED") throw new Error("records_lock_requires_teacher_verification");
  // Grades edited after verification must be re-verified before they can be locked.
  if (resultsDigest(input.currentResults) !== period.verifiedResultsDigest) throw new Error("records_results_changed_since_verification");
  const next = Object.freeze({ ...period, state: "LOCKED" as const, lockedBy: actor.userId });
  return Object.freeze({
    period: next,
    audit: { action: "records.period.locked", resourceRef: `${period.classId}:${period.subject}:${period.periodId}`, actorId: actor.userId, schoolId: period.schoolId, at: input.at, details: { verifiedBy: period.verifiedBy } },
  });
}
