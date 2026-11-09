/**
 * Shared guards for the student grading endpoints (essay, code, AI literacy). AT-GRADE-01 batch 2e.
 *
 * Every check here runs before any grading provider call, submission write or mastery update:
 * - the exact lesson must reach this learner through one of their own-school enrolled classes (founder AT-SUBMIT-02):
 *   a ScheduledWork with status "confirmed" or null (legacy), an active TeacherLessonAssignment (released: scheduledFor null or not in the future, the rule the
 *   student lesson listing uses) or an Assignment of that lesson. School-wide or platform availability alone is a
 *   self-directed path and needs separate authorization, so it grants nothing here. The lesson's own restrictions
 *   (learnerEligibility.learnerRowAllowed: visibility, version, payload flags, lifecycle) still apply. Unavailable and
 *   unknown lessons answer the same 404, so nothing about a lesson is disclosed to a learner who cannot open it;
 * - an idempotency key replays only the same learner's exact canonical request: lesson, prompt, exercise type and
 *   the answer byte for byte, compared field by field (never serialized bodies, so property order cannot conflict).
 *   There is no documented canonicalization for these answers, so none is applied;
 * - a key already bound to another learner is refused with 409 and none of that learner's data.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { learnerRowAllowed, loadLearnerScope } from "@/lib/curriculum/learnerEligibility";

const LESSON_FIELDS = {
  id: true, contentId: true, grade: true, subject: true, title: true, unitId: true,
  schoolId: true, teacherCreated: true, visibility: true, versionId: true, payload: true,
  curriculumVersion: { select: { status: true } }, provenance: { select: { lifecycleState: true } },
} as const;

export type AvailableLesson = Readonly<{ id: string; contentId: string; grade: number; subject: string; title: string | null; unitId: string | null }>;

/** The lesson, when this learner may work on it now; otherwise null (unknown and unavailable look the same). */
export async function availableLessonForLearner(user: { id: string; schoolId?: string | null }, lessonId: string): Promise<AvailableLesson | null> {
  const row = await prisma.curriculumContent.findUnique({ where: { id: lessonId }, select: LESSON_FIELDS });
  if (!row || !learnerRowAllowed(row)) return null;
  const scope = await loadLearnerScope(prisma, user);
  if (!scope.schoolId || scope.classIds.length === 0) return null;
  // A platform row or the learner's own school's row; never another school's.
  if (row.schoolId && row.schoolId !== scope.schoolId) return null;
  const classIds = [...scope.classIds], schoolId = scope.schoolId;
  const [scheduled, assigned, homework] = await Promise.all([
    // Only teacher-confirmed scheduled work, or legacy rows from before the status field (CoS AT-SUBMIT-02 ruling);
    // "suggested" and "dismissed" work never makes a lesson available.
    prisma.scheduledWork.findFirst({ where: { contentId: row.contentId, classId: { in: classIds }, class: { schoolId }, OR: [{ status: "confirmed" }, { status: null }] }, select: { id: true } }),
    prisma.teacherLessonAssignment.findFirst({
      where: { contentId: row.contentId, classId: { in: classIds }, class: { schoolId }, OR: [{ scheduledFor: null }, { scheduledFor: { lte: new Date() } }] },
      select: { id: true },
    }),
    prisma.assignment.findFirst({ where: { contentId: row.contentId, classId: { in: classIds }, Class: { schoolId } }, select: { id: true } }),
  ]);
  if (!scheduled && !assigned && !homework) return null;
  return { id: row.id, contentId: row.contentId, grade: row.grade, subject: String(row.subject), title: row.title ?? null, unitId: row.unitId ?? null };
}

export const lessonNotFound = () => NextResponse.json({ error: "lesson_not_found" }, { status: 404 });

/** The canonical identity of one submission request, exactly as it is stored on GradedSubmission. */
export type SubmissionIdentity = Readonly<{ studentId: string; lessonId: string; promptId: string | null; exerciseType: string; submissionText: string }>;

type StoredSubmission = Readonly<{ studentId: string; lessonId: string; promptId: string | null; exerciseType: string; submissionText: string }>;

const sameRequest = (stored: StoredSubmission, request: SubmissionIdentity) =>
  stored.studentId === request.studentId && stored.lessonId === request.lessonId && (stored.promptId ?? null) === request.promptId &&
  stored.exerciseType === request.exerciseType && stored.submissionText === request.submissionText;

/**
 * For a request carrying an idempotency key: a replay of the learner's own identical submission (200), a 409 when
 * the key is bound to another learner or to a different request, or null when the key is new.
 */
export async function idempotentReplay(clientSubmissionId: string | undefined, request: SubmissionIdentity): Promise<NextResponse | null> {
  if (!clientSubmissionId) return null;
  const existing = await prisma.gradedSubmission.findUnique({ where: { clientSubmissionId } });
  if (!existing) return null;
  if (!sameRequest(existing, request)) {
    // Another learner's key, or the same key for a different request: never replay, never disclose.
    return NextResponse.json(
      { error: "Idempotency key is already bound to a different submission", resolutionHint: "idempotency_key_payload_mismatch" },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true, submission: existing }, { status: 200 });
}

/** The status for an error thrown by the session guards: their own 401/403, otherwise null (the route decides). */
export function guardErrorStatus(err: unknown): 401 | 403 | null {
  const status = (err as { status?: unknown } | null)?.status;
  if (status === 401 || status === 403) return status;
  return err instanceof Error && err.message.includes("Unauthorized") ? 401 : null;
}
