-- Sprint 14 - School Operations Layer

ALTER TABLE "School"
  ADD COLUMN "schoolType" TEXT,
  ADD COLUMN "estimatedEnrollment" INTEGER,
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "rejectedAt" TIMESTAMP(3),
  ADD COLUMN "rejectionReason" TEXT;

ALTER TABLE "Class"
  ADD COLUMN "gradeLevel" INTEGER;

ALTER TABLE "Student"
  ADD COLUMN "dateOfBirth" TIMESTAMP(3);

CREATE TYPE "StudentImportBatchStatus" AS ENUM (
  'PENDING',
  'QUEUED',
  'PROCESSING',
  'COMPLETED',
  'FAILED'
);

CREATE TABLE "StudentImportBatch" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "status" "StudentImportBatchStatus" NOT NULL DEFAULT 'PENDING',
  "sourceFileName" TEXT,
  "totalRows" INTEGER NOT NULL DEFAULT 0,
  "processedRows" INTEGER NOT NULL DEFAULT 0,
  "successCount" INTEGER NOT NULL DEFAULT 0,
  "errorCount" INTEGER NOT NULL DEFAULT 0,
  "queuedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "downloadedAt" TIMESTAMP(3),
  "resultSummary" JSONB,
  "credentialCsv" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StudentImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StudentImportBatch_schoolId_status_createdAt_idx"
ON "StudentImportBatch"("schoolId", "status", "createdAt");

CREATE INDEX "StudentImportBatch_createdById_createdAt_idx"
ON "StudentImportBatch"("createdById", "createdAt");

ALTER TABLE "StudentImportBatch"
  ADD CONSTRAINT "StudentImportBatch_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
