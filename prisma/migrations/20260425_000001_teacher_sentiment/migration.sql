-- Migration: 20260425_000001_teacher_sentiment
-- Adds TeacherSentiment table for weekly check-ins

CREATE TABLE IF NOT EXISTS "TeacherSentiment" (
  "id"        TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "schoolId"  TEXT NOT NULL,
  "rating"    TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeacherSentiment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TeacherSentiment_schoolId_createdAt_idx"
  ON "TeacherSentiment"("schoolId", "createdAt");

CREATE INDEX IF NOT EXISTS "TeacherSentiment_teacherId_createdAt_idx"
  ON "TeacherSentiment"("teacherId", "createdAt");

ALTER TABLE "TeacherSentiment"
  ADD CONSTRAINT "TeacherSentiment_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
