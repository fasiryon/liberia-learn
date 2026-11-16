/**
 * What a student reads about an offline item the server kept as a conflict. A conflict is never retried
 * automatically (flushQueue skips it), so the wording must say it will not send again, and who decides.
 * Codes come from /api/student/sync resolution hints; anything unknown gets the general wording.
 */
const COPY: Record<string, string> = {
  // SEC-R02: a student device cannot create or replace official attendance.
  attendance_requires_teacher_review: "Your teacher records attendance. Your device kept this note, and it will not be sent again.",
  // AT-LAB-STUDENT-SCORE: a submitted or teacher-reviewed lab cannot be changed from the student side.
  completed_lab_session_requires_review: "This lab is already submitted. Your teacher reviews it now.",
};
const GENERAL = "Your teacher or school needs to check this. It is saved on this device and will not be sent again by itself.";

export function studentConflictMessage(resolutionHint: string | null | undefined): string {
  return (resolutionHint && COPY[resolutionHint]) || GENERAL;
}

/**
 * #29 (R4 P2-1): the learner-facing name of an offline item. Built from the queued work type only: never the server's
 * entity/model name (e.g. "studentProgress"). The device has no lesson title offline, so unknown or missing types get
 * the neutral "Lesson work".
 */
const ITEM_LABELS: Record<string, string> = {
  "lesson-complete": "Lesson work",
  "assignment-submission": "Assignment",
  homework: "Homework",
  "lab-submission": "Lab work",
};
export function learnerItemLabel(item: Readonly<{ type?: string | null; entity?: string | null }>): string {
  return (item.type && ITEM_LABELS[item.type]) || "Lesson work";
}
