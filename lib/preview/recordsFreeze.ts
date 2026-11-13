/**
 * Preview official-records freeze (B5 roster/academic policy, Revision 3). A deployed Preview/staging runtime never
 * changes the roster or official academic records: reviewer journeys are formative, ungraded pilot behaviour and
 * write no canonical records. Two layers:
 *  - route level: previewRecordsFrozen() on the confirmed B5 routes, after their authority checks and before body
 *    parsing, giving a clean 403;
 *  - data level: PREVIEW_FROZEN_RECORD_MODELS, refused for every write operation by the client query extension in
 *    lib/db-guards.ts (root, batch and interactive transactions), so any route not yet inventoried fails closed.
 * Neither layer replaces database triggers, grants or RLS: raw SQL, nested writes through another model and
 * separate Prisma clients are outside the client extension.
 */
import { NextResponse } from "next/server";
import { previewAutomationDisabled } from "@/lib/previewSideEffects";

export const PREVIEW_RECORDS_FROZEN = "PREVIEW_RECORDS_FROZEN";

/**
 * Prisma model names (as reported to query extensions) whose writes are refused on a deployed Preview/staging.
 * Identity models (User, sessions) are deliberately absent: sign-in updates them and the identity freeze owns them.
 */
export const PREVIEW_FROZEN_RECORD_MODELS: ReadonlySet<string> = new Set([
  // roster and school structure
  "School", "Class", "Student", "StudentGuardian", "Enrollment", "AcademicEnrollment", "AcademicYear", "Term",
  "TeacherAssignment", "TeacherLessonAssignment", "Timetable", "TimetableAssignment",
  // grades, assessment status and official results
  "Grade", "GradedSubmission", "Assessment", "AssessmentAttempt", "AssessmentAttemptDetail", "Submission",
  "AssignmentSubmission", "HomeworkSubmission", "Exam", "ExamAttempt", "ExamCertification", "Certificate",
  "ReportCard", "Transcript", "GradePipelineJob", "PortfolioCredential",
  // mastery and progress
  "MasteryRecord", "StudentMasteryProfile", "AdaptiveMasteryRecord", "MasterySnapshot", "DerivedStudentProgress",
  "StudentProgress",
  // attendance
  "Attendance", "AttendanceRecord",
  // sync / labs
  "LabSession",
  // advisory and interventions
  "Intervention", "InterventionChain", "InterventionLog", "InterventionRecommendation",
  // placement and promotion
  "PlacementSession", "PlacementSessionItem", "PlacementReview", "PlacementDecision", "PlacementTest",
]);

export function previewRecordsFrozen(): NextResponse | null {
  if (!previewAutomationDisabled()) return null;
  return NextResponse.json(
    { ok: false, error: "Official records are read-only in this Preview", code: PREVIEW_RECORDS_FROZEN },
    { status: 403, headers: { "Cache-Control": "private, no-store" } }
  );
}
