/*
  Warnings:

  - You are about to drop the column `artifact_json` on the `GovernedArtifact` table. All the data in the column will be lost.
  - You are about to drop the column `content_type` on the `GovernedArtifact` table. All the data in the column will be lost.
  - Added the required column `artifactJson` to the `GovernedArtifact` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "GradableItemType" AS ENUM ('ASSESSMENT', 'ASSIGNMENT', 'LAB', 'PROJECT', 'ORAL', 'PARTICIPATION', 'PORTFOLIO', 'OTHER');

-- CreateEnum
CREATE TYPE "ScoringType" AS ENUM ('POINTS', 'ANALYTIC_RUBRIC', 'HOLISTIC');

-- CreateEnum
CREATE TYPE "GradingMethod" AS ENUM ('TEACHER', 'AI_ASSISTED', 'PEER', 'SELF', 'COLLABORATIVE', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "GradeLockState" AS ENUM ('DRAFT', 'PUBLISHED', 'LOCKED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SubmissionType" AS ENUM ('ONLINE', 'OFFLINE', 'AUDIO', 'PHOTO', 'TEXT', 'LINK');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('SUBMITTED', 'MISSING', 'EXCUSED', 'EXTENDED', 'GRADED');

-- CreateEnum
CREATE TYPE "ExcuseStatus" AS ENUM ('NONE', 'EXCUSED', 'EXTENDED', 'PENDING_MAKEUP');

-- CreateEnum
CREATE TYPE "AppealStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'RESOLVED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "AppealResolutionType" AS ENUM ('CHANGED', 'UPHELD', 'PARTIALLY_CHANGED');

-- DropIndex
DROP INDEX "public"."GovernedArtifact_curriculumContentId_key";

-- DropIndex
DROP INDEX "public"."GovernedArtifact_decision_idx";

-- DropIndex
DROP INDEX "public"."GovernedArtifact_governanceTimestamp_idx";

-- AlterTable
ALTER TABLE "GovernedArtifact" DROP COLUMN "artifact_json",
DROP COLUMN "content_type",
ADD COLUMN     "artifactJson" JSONB NOT NULL,
ADD COLUMN     "governanceDecision" TEXT,
ADD COLUMN     "governanceReason" TEXT,
ALTER COLUMN "decision" DROP NOT NULL,
ALTER COLUMN "updatedAt" DROP NOT NULL;

-- CreateTable
CREATE TABLE "GradeCategory" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradeCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassGradePolicy" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "term" INTEGER NOT NULL DEFAULT 1,
    "weights" JSONB NOT NULL,
    "latePolicy" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassGradePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradableItem" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "GradableItemType" NOT NULL,
    "scoringType" "ScoringType" NOT NULL,
    "gradingMethod" "GradingMethod" NOT NULL,
    "countsTowardGrade" BOOLEAN NOT NULL DEFAULT true,
    "categoryId" TEXT,
    "maxPoints" INTEGER DEFAULT 100,
    "dueAt" TIMESTAMP(3),
    "checkpointSequence" INTEGER,
    "improvementPolicy" JSONB,
    "publishedToParents" BOOLEAN NOT NULL DEFAULT false,
    "lockState" "GradeLockState" NOT NULL DEFAULT 'DRAFT',
    "lockedAt" TIMESTAMP(3),
    "lockedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradableItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradableItemObjective" (
    "id" TEXT NOT NULL,
    "gradableItemId" TEXT NOT NULL,
    "standardId" TEXT,
    "skillId" TEXT,
    "objectiveText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GradableItemObjective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalEvaluator" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organization" TEXT,
    "credentialRef" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalEvaluator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupSubmission" (
    "id" TEXT NOT NULL,
    "gradableItemId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "members" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradableSubmission" (
    "id" TEXT NOT NULL,
    "gradableItemId" TEXT NOT NULL,
    "studentId" TEXT,
    "groupSubmissionId" TEXT,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "submissionType" "SubmissionType" NOT NULL DEFAULT 'ONLINE',
    "payload" JSONB NOT NULL,
    "recordedOffline" BOOLEAN NOT NULL DEFAULT false,
    "timeSpentMinutes" INTEGER,
    "excuseStatus" "ExcuseStatus" NOT NULL DEFAULT 'NONE',
    "status" "SubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "turnedInAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradableSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeRecord" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "scorePoints" INTEGER,
    "scorePercent" DOUBLE PRECISION,
    "rubricResult" JSONB,
    "feedbackText" TEXT,
    "gradedByUserId" TEXT,
    "externalEvaluatorId" TEXT,
    "gradedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "aiConfidence" DOUBLE PRECISION,
    "humanReviewed" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "publishedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradeRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeRevision" (
    "id" TEXT NOT NULL,
    "gradeRecordId" TEXT NOT NULL,
    "previousSnapshot" JSONB NOT NULL,
    "newSnapshot" JSONB NOT NULL,
    "revisedByUserId" TEXT,
    "revisionReason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previousHash" TEXT,
    "hash" TEXT,

    CONSTRAINT "GradeRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeAppeal" (
    "id" TEXT NOT NULL,
    "gradeRecordId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "AppealStatus" NOT NULL DEFAULT 'SUBMITTED',
    "resolutionType" "AppealResolutionType",
    "claimText" TEXT NOT NULL,
    "evidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "resolutionNotes" TEXT,

    CONSTRAINT "GradeAppeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeAuditFlag" (
    "id" TEXT NOT NULL,
    "gradeRecordId" TEXT NOT NULL,
    "flagType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'LOW',
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,

    CONSTRAINT "GradeAuditFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GradeCategory_classId_idx" ON "GradeCategory"("classId");

-- CreateIndex
CREATE UNIQUE INDEX "GradeCategory_classId_name_key" ON "GradeCategory"("classId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ClassGradePolicy_classId_key" ON "ClassGradePolicy"("classId");

-- CreateIndex
CREATE INDEX "ClassGradePolicy_classId_term_idx" ON "ClassGradePolicy"("classId", "term");

-- CreateIndex
CREATE UNIQUE INDEX "ClassGradePolicy_classId_term_key" ON "ClassGradePolicy"("classId", "term");

-- CreateIndex
CREATE INDEX "GradableItem_classId_type_idx" ON "GradableItem"("classId", "type");

-- CreateIndex
CREATE INDEX "GradableItem_categoryId_idx" ON "GradableItem"("categoryId");

-- CreateIndex
CREATE INDEX "GradableItem_lockState_idx" ON "GradableItem"("lockState");

-- CreateIndex
CREATE INDEX "GradableItem_dueAt_idx" ON "GradableItem"("dueAt");

-- CreateIndex
CREATE INDEX "GradableItemObjective_gradableItemId_idx" ON "GradableItemObjective"("gradableItemId");

-- CreateIndex
CREATE INDEX "GradableItemObjective_standardId_idx" ON "GradableItemObjective"("standardId");

-- CreateIndex
CREATE INDEX "GradableItemObjective_skillId_idx" ON "GradableItemObjective"("skillId");

-- CreateIndex
CREATE INDEX "GroupSubmission_gradableItemId_idx" ON "GroupSubmission"("gradableItemId");

-- CreateIndex
CREATE INDEX "GroupSubmission_classId_idx" ON "GroupSubmission"("classId");

-- CreateIndex
CREATE INDEX "GradableSubmission_gradableItemId_idx" ON "GradableSubmission"("gradableItemId");

-- CreateIndex
CREATE INDEX "GradableSubmission_studentId_idx" ON "GradableSubmission"("studentId");

-- CreateIndex
CREATE INDEX "GradableSubmission_groupSubmissionId_idx" ON "GradableSubmission"("groupSubmissionId");

-- CreateIndex
CREATE INDEX "GradableSubmission_status_idx" ON "GradableSubmission"("status");

-- CreateIndex
CREATE UNIQUE INDEX "GradeRecord_submissionId_key" ON "GradeRecord"("submissionId");

-- CreateIndex
CREATE INDEX "GradeRecord_gradedAt_idx" ON "GradeRecord"("gradedAt");

-- CreateIndex
CREATE INDEX "GradeRecord_gradedByUserId_idx" ON "GradeRecord"("gradedByUserId");

-- CreateIndex
CREATE INDEX "GradeRecord_externalEvaluatorId_idx" ON "GradeRecord"("externalEvaluatorId");

-- CreateIndex
CREATE INDEX "GradeRevision_gradeRecordId_createdAt_idx" ON "GradeRevision"("gradeRecordId", "createdAt");

-- CreateIndex
CREATE INDEX "GradeRevision_hash_idx" ON "GradeRevision"("hash");

-- CreateIndex
CREATE INDEX "GradeAppeal_gradeRecordId_idx" ON "GradeAppeal"("gradeRecordId");

-- CreateIndex
CREATE INDEX "GradeAppeal_studentId_idx" ON "GradeAppeal"("studentId");

-- CreateIndex
CREATE INDEX "GradeAppeal_status_idx" ON "GradeAppeal"("status");

-- CreateIndex
CREATE INDEX "GradeAuditFlag_flagType_idx" ON "GradeAuditFlag"("flagType");

-- CreateIndex
CREATE INDEX "GradeAuditFlag_severity_createdAt_idx" ON "GradeAuditFlag"("severity", "createdAt");

-- CreateIndex
CREATE INDEX "GradeAuditFlag_gradeRecordId_idx" ON "GradeAuditFlag"("gradeRecordId");

-- CreateIndex
CREATE INDEX "GovernedArtifact_schemaId_idx" ON "GovernedArtifact"("schemaId");

-- CreateIndex
CREATE INDEX "GovernedArtifact_curriculumContentId_idx" ON "GovernedArtifact"("curriculumContentId");

-- AddForeignKey
ALTER TABLE "GradeCategory" ADD CONSTRAINT "GradeCategory_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassGradePolicy" ADD CONSTRAINT "ClassGradePolicy_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradableItem" ADD CONSTRAINT "GradableItem_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradableItem" ADD CONSTRAINT "GradableItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "GradeCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradableItem" ADD CONSTRAINT "GradableItem_lockedByUserId_fkey" FOREIGN KEY ("lockedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradableItemObjective" ADD CONSTRAINT "GradableItemObjective_gradableItemId_fkey" FOREIGN KEY ("gradableItemId") REFERENCES "GradableItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradableItemObjective" ADD CONSTRAINT "GradableItemObjective_standardId_fkey" FOREIGN KEY ("standardId") REFERENCES "Standard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradableItemObjective" ADD CONSTRAINT "GradableItemObjective_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupSubmission" ADD CONSTRAINT "GroupSubmission_gradableItemId_fkey" FOREIGN KEY ("gradableItemId") REFERENCES "GradableItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupSubmission" ADD CONSTRAINT "GroupSubmission_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradableSubmission" ADD CONSTRAINT "GradableSubmission_gradableItemId_fkey" FOREIGN KEY ("gradableItemId") REFERENCES "GradableItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradableSubmission" ADD CONSTRAINT "GradableSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradableSubmission" ADD CONSTRAINT "GradableSubmission_groupSubmissionId_fkey" FOREIGN KEY ("groupSubmissionId") REFERENCES "GroupSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeRecord" ADD CONSTRAINT "GradeRecord_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "GradableSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeRecord" ADD CONSTRAINT "GradeRecord_gradedByUserId_fkey" FOREIGN KEY ("gradedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeRecord" ADD CONSTRAINT "GradeRecord_publishedByUserId_fkey" FOREIGN KEY ("publishedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeRecord" ADD CONSTRAINT "GradeRecord_externalEvaluatorId_fkey" FOREIGN KEY ("externalEvaluatorId") REFERENCES "ExternalEvaluator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeRevision" ADD CONSTRAINT "GradeRevision_gradeRecordId_fkey" FOREIGN KEY ("gradeRecordId") REFERENCES "GradeRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeRevision" ADD CONSTRAINT "GradeRevision_revisedByUserId_fkey" FOREIGN KEY ("revisedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeAppeal" ADD CONSTRAINT "GradeAppeal_gradeRecordId_fkey" FOREIGN KEY ("gradeRecordId") REFERENCES "GradeRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeAppeal" ADD CONSTRAINT "GradeAppeal_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeAppeal" ADD CONSTRAINT "GradeAppeal_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeAuditFlag" ADD CONSTRAINT "GradeAuditFlag_gradeRecordId_fkey" FOREIGN KEY ("gradeRecordId") REFERENCES "GradeRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeAuditFlag" ADD CONSTRAINT "GradeAuditFlag_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
