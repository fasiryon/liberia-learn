-- Create enum for training status
CREATE TYPE "TrainingStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- Training modules
CREATE TABLE "TrainingModule" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "pilotOnly" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TrainingModule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrainingModule_code_key" ON "TrainingModule"("code");

-- Teacher training progress
CREATE TABLE "TeacherTrainingProgress" (
  "id" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "moduleId" TEXT NOT NULL,
  "status" "TrainingStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "pilotOnly" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TeacherTrainingProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeacherTrainingProgress_teacherId_moduleId_key" ON "TeacherTrainingProgress"("teacherId", "moduleId");
CREATE INDEX "TeacherTrainingProgress_moduleId_status_idx" ON "TeacherTrainingProgress"("moduleId", "status");
CREATE INDEX "TeacherTrainingProgress_teacherId_status_idx" ON "TeacherTrainingProgress"("teacherId", "status");

ALTER TABLE "TeacherTrainingProgress"
  ADD CONSTRAINT "TeacherTrainingProgress_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TeacherTrainingProgress"
  ADD CONSTRAINT "TeacherTrainingProgress_moduleId_fkey"
  FOREIGN KEY ("moduleId") REFERENCES "TrainingModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Export records
CREATE TABLE "ExportRecord" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "exportType" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "scopeId" TEXT,
  "filters" JSONB,
  "format" TEXT,
  "pilotOnly" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ExportRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExportRecord_exportType_createdAt_idx" ON "ExportRecord"("exportType", "createdAt");
CREATE INDEX "ExportRecord_scope_scopeId_createdAt_idx" ON "ExportRecord"("scope", "scopeId", "createdAt");
CREATE INDEX "ExportRecord_userId_createdAt_idx" ON "ExportRecord"("userId", "createdAt");

ALTER TABLE "ExportRecord"
  ADD CONSTRAINT "ExportRecord_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

