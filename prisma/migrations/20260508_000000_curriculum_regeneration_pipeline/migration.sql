-- Additive curriculum regeneration run/checkpoint/job tracking.
CREATE TABLE "CurriculumRegenerationRun" (
  "id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "targetStatus" TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
  "totalPlanned" INTEGER NOT NULL DEFAULT 0,
  "totalProcessed" INTEGER NOT NULL DEFAULT 0,
  "totalApproved" INTEGER NOT NULL DEFAULT 0,
  "totalFailed" INTEGER NOT NULL DEFAULT 0,
  "currentGradeLevel" INTEGER,
  "currentSubject" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "stoppedReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CurriculumRegenerationRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CurriculumRegenerationCheckpoint" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "gradeLevel" INTEGER NOT NULL,
  "subject" TEXT NOT NULL,
  "lastProcessedContentId" TEXT,
  "plannedCount" INTEGER NOT NULL DEFAULT 0,
  "processedCount" INTEGER NOT NULL DEFAULT 0,
  "approvedCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CurriculumRegenerationCheckpoint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CurriculumRegenerationJob" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "curriculumContentId" TEXT NOT NULL,
  "gradeLevel" INTEGER NOT NULL,
  "subject" TEXT NOT NULL,
  "topic" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempt" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "provider" TEXT,
  "requestedBy" TEXT,
  "schoolId" TEXT,
  "tenantId" TEXT,
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CurriculumRegenerationJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CurriculumRegenerationRun_status_createdAt_idx"
  ON "CurriculumRegenerationRun"("status", "createdAt");
CREATE INDEX "CurriculumRegenerationRun_targetStatus_status_idx"
  ON "CurriculumRegenerationRun"("targetStatus", "status");

CREATE UNIQUE INDEX "CurriculumRegenerationCheckpoint_runId_gradeLevel_subject_key"
  ON "CurriculumRegenerationCheckpoint"("runId", "gradeLevel", "subject");
CREATE INDEX "CurriculumRegenerationCheckpoint_status_updatedAt_idx"
  ON "CurriculumRegenerationCheckpoint"("status", "updatedAt");

CREATE UNIQUE INDEX "CurriculumRegenerationJob_idempotencyKey_key"
  ON "CurriculumRegenerationJob"("idempotencyKey");
CREATE INDEX "CurriculumRegenerationJob_runId_status_createdAt_idx"
  ON "CurriculumRegenerationJob"("runId", "status", "createdAt");
CREATE INDEX "CurriculumRegenerationJob_gradeLevel_subject_status_idx"
  ON "CurriculumRegenerationJob"("gradeLevel", "subject", "status");
CREATE INDEX "CurriculumRegenerationJob_curriculumContentId_idx"
  ON "CurriculumRegenerationJob"("curriculumContentId");

ALTER TABLE "CurriculumRegenerationCheckpoint"
  ADD CONSTRAINT "CurriculumRegenerationCheckpoint_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "CurriculumRegenerationRun"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CurriculumRegenerationJob"
  ADD CONSTRAINT "CurriculumRegenerationJob_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "CurriculumRegenerationRun"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
