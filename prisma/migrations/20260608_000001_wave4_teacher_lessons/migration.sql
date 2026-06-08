-- prisma/migrations/20260608_000001_wave4_teacher_lessons/migration.sql

-- CurriculumContent additions
ALTER TABLE "CurriculumContent"
  ADD COLUMN IF NOT EXISTS "learningObjectives" JSONB       NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "visibility"         TEXT        NOT NULL DEFAULT 'class_only',
  ADD COLUMN IF NOT EXISTS "parentLessonId"     TEXT,
  ADD COLUMN IF NOT EXISTS "lessonVersion"      INTEGER     NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "publishedAt"        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "rejectionReason"    TEXT,
  ADD COLUMN IF NOT EXISTS "schoolId"           TEXT;

CREATE INDEX IF NOT EXISTS "CurriculumContent_schoolId_visibility_idx"
  ON "CurriculumContent"("schoolId", "visibility");

-- LessonHelpFlag additions for content flagging
ALTER TABLE "LessonHelpFlag"
  ADD COLUMN IF NOT EXISTS "flagType"   TEXT,
  ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS "LessonHelpFlag_studentId_contentId_key"
  ON "LessonHelpFlag"("studentId", "contentId");

-- TeacherLessonAssignment
CREATE TABLE IF NOT EXISTS "TeacherLessonAssignment" (
  "id"           TEXT        NOT NULL,
  "contentId"    TEXT        NOT NULL,
  "classId"      TEXT        NOT NULL,
  "assignedById" TEXT        NOT NULL,
  "scheduledFor" TIMESTAMPTZ,
  "assignedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "TeacherLessonAssignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TeacherLessonAssignment_contentId_classId_key" UNIQUE ("contentId", "classId"),
  CONSTRAINT "TeacherLessonAssignment_contentId_fkey"
    FOREIGN KEY ("contentId") REFERENCES "CurriculumContent"("contentId") ON DELETE CASCADE,
  CONSTRAINT "TeacherLessonAssignment_classId_fkey"
    FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE,
  CONSTRAINT "TeacherLessonAssignment_assignedById_fkey"
    FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "TeacherLessonAssignment_classId_scheduledFor_idx"
  ON "TeacherLessonAssignment"("classId", "scheduledFor");
