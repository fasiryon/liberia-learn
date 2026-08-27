-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'MOE_SUPER_ADMIN';
ALTER TYPE "Role" ADD VALUE 'MOE_DISTRICT_ADMIN';

-- DropForeignKey
ALTER TABLE "AssignmentSuggestion" DROP CONSTRAINT "AssignmentSuggestion_schoolId_fkey";

-- DropForeignKey
ALTER TABLE "Attendance" DROP CONSTRAINT "Attendance_markedById_fkey";

-- DropForeignKey
ALTER TABLE "ChangeRequestSignoff" DROP CONSTRAINT "ChangeRequestSignoff_changeRequestId_fkey";

-- DropForeignKey
ALTER TABLE "CurriculumReviewAssessment" DROP CONSTRAINT "CurriculumReviewAssessment_credential_profile_fkey";

-- DropForeignKey
ALTER TABLE "CurriculumReviewAssessment" DROP CONSTRAINT "CurriculumReviewAssessment_scope_credential_fkey";

-- DropForeignKey
ALTER TABLE "CurriculumReviewAssignment" DROP CONSTRAINT "CurriculumReviewAssignment_credential_profile_fkey";

-- DropForeignKey
ALTER TABLE "CurriculumReviewAssignment" DROP CONSTRAINT "CurriculumReviewAssignment_scope_credential_fkey";

-- DropForeignKey
ALTER TABLE "CurriculumUnit" DROP CONSTRAINT "CurriculumUnit_createdById_fkey";

-- DropForeignKey
ALTER TABLE "CurriculumUnit" DROP CONSTRAINT "CurriculumUnit_schoolId_fkey";

-- DropForeignKey
ALTER TABLE "LabSession" DROP CONSTRAINT "LabSession_schoolId_fkey";

-- DropForeignKey
ALTER TABLE "LabSession" DROP CONSTRAINT "LabSession_studentId_fkey";

-- DropForeignKey
ALTER TABLE "PostChangeEvaluationPlan" DROP CONSTRAINT "PostChangeEvaluationPlan_changeRequestId_fkey";

-- DropForeignKey
ALTER TABLE "SchoolStorageQuota" DROP CONSTRAINT "SchoolStorageQuota_schoolId_fkey";

-- DropForeignKey
ALTER TABLE "StagedRolloutPlan" DROP CONSTRAINT "StagedRolloutPlan_changeRequestId_fkey";

-- DropForeignKey
ALTER TABLE "TeacherLessonAssignment" DROP CONSTRAINT "TeacherLessonAssignment_assignedById_fkey";

-- DropForeignKey
ALTER TABLE "TeacherLessonAssignment" DROP CONSTRAINT "TeacherLessonAssignment_classId_fkey";

-- DropForeignKey
ALTER TABLE "TeacherLessonAssignment" DROP CONSTRAINT "TeacherLessonAssignment_contentId_fkey";

-- DropForeignKey
ALTER TABLE "VideoWatchEvent" DROP CONSTRAINT "VideoWatchEvent_studentId_fkey";

-- DropForeignKey
ALTER TABLE "VideoWatchEvent" DROP CONSTRAINT "VideoWatchEvent_videoId_fkey";

-- DropIndex
DROP INDEX "AssignmentSubmission_turnedInAt_assignmentId_idx";

-- DropIndex
DROP INDEX "Attendance_studentId_date_idx";

-- DropIndex
DROP INDEX "curriculum_content_embedding_idx";

-- DropIndex
DROP INDEX "Exam_academicYearId_idx";

-- DropIndex
DROP INDEX "Exam_classId_idx";

-- DropIndex
DROP INDEX "Exam_schoolId_publishedAt_idx";

-- DropIndex
DROP INDEX "Exam_schoolId_status_idx";

-- DropIndex
DROP INDEX "LessonHelpFlag_studentId_contentId_idx";

-- DropIndex
DROP INDEX "rag_chunk_embedding_idx";

-- DropIndex
DROP INDEX "ReviewerCredential_id_reviewerProfileId_key";

-- DropIndex
DROP INDEX "ReviewerCredentialScope_id_credentialId_key";

-- DropIndex
DROP INDEX "StudentMasteryProfile_studentId_lastAssessedAt_idx";

-- DropIndex
DROP INDEX "Timetable_classId_dayOfWeek_idx";

-- DropIndex
DROP INDEX "VirtualLab_status_grade_schoolId_idx";

-- AlterTable
ALTER TABLE "AcademicEnrollment" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AdaptiveMasteryRecord" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AssignmentSuggestion" ALTER COLUMN "moeStandardCodes" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Attendance" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CanvaOAuthCredential" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Certificate" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ChangeRequestSignoff" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ConsentRecord" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CurriculumFlag" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CurriculumUnit" ALTER COLUMN "targetStandardCodes" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DataAccessLog" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ExportJobRequest" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Intervention" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "InterventionChain" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "MisconceptionCategory" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "OptimizationChangeRequest" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PostChangeEvaluationPlan" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PushSubscription" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "RagChunk" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SchoolOnboarding" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SmsSession" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "StagedRolloutPlan" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "StudentImportBatch" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TeacherAlert" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TeacherAlertPreference" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TeacherAssignment" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Timetable" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TimetableAssignment" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "VirtualLab" ALTER COLUMN "moeStandardCodes" DROP DEFAULT,
ALTER COLUMN "primaryContentIds" DROP DEFAULT,
ALTER COLUMN "triggerStandardCodes" DROP DEFAULT,
ALTER COLUMN "equipmentList" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- DropTable
DROP TABLE "TrendSnapshot";

-- CreateIndex
CREATE INDEX "Attendance_markedById_date_idx" ON "Attendance"("markedById", "date");

-- CreateIndex
CREATE INDEX "Exam_schoolId_status_grade_idx" ON "Exam"("schoolId", "status", "grade");

-- CreateIndex
CREATE INDEX "Exam_academicYearId_classId_idx" ON "Exam"("academicYearId", "classId");

-- CreateIndex
CREATE UNIQUE INDEX "GradedSubmission_clientSubmissionId_key" ON "GradedSubmission"("clientSubmissionId");

-- CreateIndex
CREATE UNIQUE INDEX "HomeworkSubmission_clientSubmissionId_key" ON "HomeworkSubmission"("clientSubmissionId");

-- CreateIndex
CREATE UNIQUE INDEX "InterventionRecommendation_idempotencyKey_key" ON "InterventionRecommendation"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherAlert_idempotencyKey_key" ON "TeacherAlert"("idempotencyKey");

-- RenameForeignKey
ALTER TABLE "CurriculumAIReviewAssessment" RENAME CONSTRAINT "CurriculumAIReviewAssessment_agentId_fkey" TO "CurriculumAIReviewAssessment_aiReviewAgentId_fkey";

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoWatchEvent" ADD CONSTRAINT "VideoWatchEvent_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "LessonVideo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoWatchEvent" ADD CONSTRAINT "VideoWatchEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolStorageQuota" ADD CONSTRAINT "SchoolStorageQuota_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurriculumUnit" ADD CONSTRAINT "CurriculumUnit_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurriculumUnit" ADD CONSTRAINT "CurriculumUnit_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentSuggestion" ADD CONSTRAINT "AssignmentSuggestion_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabSession" ADD CONSTRAINT "LabSession_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabSession" ADD CONSTRAINT "LabSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeRequestSignoff" ADD CONSTRAINT "ChangeRequestSignoff_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "OptimizationChangeRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StagedRolloutPlan" ADD CONSTRAINT "StagedRolloutPlan_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "OptimizationChangeRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostChangeEvaluationPlan" ADD CONSTRAINT "PostChangeEvaluationPlan_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "OptimizationChangeRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherLessonAssignment" ADD CONSTRAINT "TeacherLessonAssignment_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "CurriculumContent"("contentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherLessonAssignment" ADD CONSTRAINT "TeacherLessonAssignment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherLessonAssignment" ADD CONSTRAINT "TeacherLessonAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "AssignmentSubmission_aiGradedAt_teacherApproved_autoReleasedAt_" RENAME TO "AssignmentSubmission_aiGradedAt_teacherApproved_autoRelease_idx";

-- RenameIndex
ALTER INDEX "CurriculumAIReviewAssessment_agent_submittedAt_idx" RENAME TO "CurriculumAIReviewAssessment_aiReviewAgentId_submittedAt_idx";

-- RenameIndex
ALTER INDEX "CurriculumReviewAssignment_reviewerProfileId_status_leaseE_idx" RENAME TO "CurriculumReviewAssignment_reviewerProfileId_status_leaseEx_idx";

-- RenameIndex
ALTER INDEX "CurriculumReviewTask_revisionId_policyKey_policyVersion_reviewC" RENAME TO "CurriculumReviewTask_revisionId_policyKey_policyVersion_rev_key";

-- RenameIndex
ALTER INDEX "CurriculumReviewTask_status_priorityBand_priorityScore_dueAt__i" RENAME TO "CurriculumReviewTask_status_priorityBand_priorityScore_dueA_idx";

-- RenameIndex
ALTER INDEX "DerivedStudentProgress_studentId_subject_strandKey_derivedAt_id" RENAME TO "DerivedStudentProgress_studentId_subject_strandKey_derivedA_idx";

-- RenameIndex
ALTER INDEX "MoeDirectiveApplication_directiveId_schoolId_classId_grade_subj" RENAME TO "MoeDirectiveApplication_directiveId_schoolId_classId_grade__key";

-- RenameIndex
ALTER INDEX "ReviewerRestriction_reviewerProfileId_effectiveFrom_effectiv_id" RENAME TO "ReviewerRestriction_reviewerProfileId_effectiveFrom_effecti_idx";

