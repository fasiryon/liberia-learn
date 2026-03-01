-- Integrated Delivery Engine Migration
-- Parts 1-7: CurriculumContent, ScheduledWork, Assignment, Homework, CurriculumUnit, AssignmentSuggestion, VirtualLab, LabSession

-- Part 1: Delivery Profile + Unit soft link
ALTER TABLE "CurriculumContent" ADD COLUMN IF NOT EXISTS "deliveryProfile" JSONB;
ALTER TABLE "CurriculumContent" ADD COLUMN IF NOT EXISTS "unitId" TEXT;

-- Part 2: ScheduledWork delivery tracking fields
ALTER TABLE "ScheduledWork" ADD COLUMN IF NOT EXISTS "classFormat" TEXT;
ALTER TABLE "ScheduledWork" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3);
ALTER TABLE "ScheduledWork" ADD COLUMN IF NOT EXISTS "deliveryNotes" TEXT;
ALTER TABLE "ScheduledWork" ADD COLUMN IF NOT EXISTS "completionRate" INTEGER;
ALTER TABLE "ScheduledWork" ADD COLUMN IF NOT EXISTS "isDelivered" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ScheduledWork" ADD COLUMN IF NOT EXISTS "sessionPairId" TEXT;
ALTER TABLE "ScheduledWork" ADD COLUMN IF NOT EXISTS "status" TEXT;
ALTER TABLE "ScheduledWork" ADD COLUMN IF NOT EXISTS "suggestedLabs" JSONB;
ALTER TABLE "ScheduledWork" ADD COLUMN IF NOT EXISTS "toolUsageLog" JSONB;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ScheduledWork_sessionPairId_idx" ON "ScheduledWork"("sessionPairId");

-- Part 4: CurriculumUnit
CREATE TABLE IF NOT EXISTS "CurriculumUnit" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "unitId" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "subject" TEXT NOT NULL,
  "grade" INTEGER NOT NULL,
  "schoolId" TEXT NOT NULL,
  "targetStandardCodes" TEXT[] NOT NULL DEFAULT '{}',
  "weekStart" INTEGER NOT NULL,
  "weekEnd" INTEGER NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("schoolId") REFERENCES "School"("id"),
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "CurriculumUnit_schoolId_grade_subject_idx"
  ON "CurriculumUnit"("schoolId", "grade", "subject");

-- Part 5: Assignment + Homework lesson linkage
ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "scheduledWorkId" TEXT;
ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "contentId" TEXT;
ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "moeStandardCodes" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "generationMethod" TEXT;

ALTER TABLE "Homework" ADD COLUMN IF NOT EXISTS "scheduledWorkId" TEXT;
ALTER TABLE "Homework" ADD COLUMN IF NOT EXISTS "contentId" TEXT;
ALTER TABLE "Homework" ADD COLUMN IF NOT EXISTS "moeStandardCodes" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "Homework" ADD COLUMN IF NOT EXISTS "generationMethod" TEXT;

CREATE TABLE IF NOT EXISTS "AssignmentSuggestion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "schoolId" TEXT NOT NULL,
  "contentId" TEXT NOT NULL,
  "scheduledWorkId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "suggestedTitle" TEXT NOT NULL,
  "suggestedDueDate" TIMESTAMP(3) NOT NULL,
  "moeStandardCodes" TEXT[] NOT NULL DEFAULT '{}',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("schoolId") REFERENCES "School"("id")
);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "AssignmentSuggestion_schoolId_status_idx"
  ON "AssignmentSuggestion"("schoolId", "status");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "AssignmentSuggestion_scheduledWorkId_idx"
  ON "AssignmentSuggestion"("scheduledWorkId");

-- Part 7: VirtualLab
CREATE TABLE IF NOT EXISTS "VirtualLab" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "labId" TEXT NOT NULL UNIQUE,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "grade" INTEGER NOT NULL,
  "gradeBand" TEXT NOT NULL,
  "labType" TEXT NOT NULL,
  "moeStandardCodes" TEXT[] NOT NULL DEFAULT '{}',
  "primaryContentIds" TEXT[] NOT NULL DEFAULT '{}',
  "triggerStandardCodes" TEXT[] NOT NULL DEFAULT '{}',
  "estimatedMinutes" INTEGER NOT NULL,
  "difficulty" TEXT NOT NULL,
  "equipmentList" TEXT[] NOT NULL DEFAULT '{}',
  "safetyNotes" TEXT,
  "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "schoolId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "VirtualLab_subject_grade_status_idx"
  ON "VirtualLab"("subject", "grade", "status");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "VirtualLab_schoolId_idx"
  ON "VirtualLab"("schoolId");

-- Part 7: LabSession
CREATE TABLE IF NOT EXISTS "LabSession" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "labId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "scheduledWorkId" TEXT,
  "schoolId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "observations" JSONB,
  "conclusions" TEXT,
  "score" INTEGER,
  "teacherFeedback" TEXT,
  "masteryUpdated" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("schoolId") REFERENCES "School"("id"),
  FOREIGN KEY ("studentId") REFERENCES "User"("id")
);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "LabSession_schoolId_labId_idx"
  ON "LabSession"("schoolId", "labId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "LabSession_scheduledWorkId_idx"
  ON "LabSession"("scheduledWorkId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "LabSession_studentId_schoolId_idx"
  ON "LabSession"("studentId", "schoolId");
