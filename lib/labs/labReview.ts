/**
 * AT-R-LAB: which lab scores count. A lab session is teacher-reviewed only when the teacher review route has saved
 * both its score and its required feedback (PATCH /api/teacher/labs/sessions/[sessionId]). A null score (not yet
 * reviewed, or an AI analysis kept only as a provisional suggestion) and a student-supplied provisional score are
 * pending, never a zero and never a reviewed result.
 */
export type ReviewableLabSession = Readonly<{ completedAt: Date | null; score: number | null; teacherFeedback?: string | null }>;

export function isTeacherReviewed(session: ReviewableLabSession): session is ReviewableLabSession & { score: number } {
  return session.score != null && typeof session.teacherFeedback === "string" && session.teacherFeedback.trim().length > 0;
}

/** Average over teacher-reviewed sessions only; completed sessions without a review are counted as pending. */
export function labReviewSummary(sessions: readonly ReviewableLabSession[]) {
  const completed = sessions.filter((s) => s.completedAt);
  const reviewed = completed.filter(isTeacherReviewed);
  return {
    completedCount: completed.length,
    reviewedCount: reviewed.length,
    pendingCount: completed.length - reviewed.length,
    avgScore: reviewed.length > 0 ? Math.round(reviewed.reduce((sum, s) => sum + s.score, 0) / reviewed.length) : null,
  };
}

/**
 * AT-LAB-STUDENT-SCORE: once a session is completed (or teacher-reviewed) a student path may not change it, so a
 * reviewed score can never be replaced from the student side (409 online, conflict in offline sync).
 */
export function isLockedForStudent(session: ReviewableLabSession): boolean {
  return session.completedAt != null || isTeacherReviewed(session);
}

/**
 * A student's own score is never written to labSession.score (the teacher's field). It is kept as a labelled
 * observation, merged over the incoming observations or, when none were sent, the stored ones.
 */
export function labelStudentScore(stored: unknown, incoming: unknown, score: number) {
  const object = (value: unknown) => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null);
  return { ...(object(incoming) ?? object(stored) ?? {}), provisionalScore: { value: score, scorer: "STUDENT_CLIENT" as const } };
}
