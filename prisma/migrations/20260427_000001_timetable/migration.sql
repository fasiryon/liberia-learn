-- Migration: 20260427_000001_timetable
-- Adds TimetableAssignment model linking timetable slots to lessons on specific dates

CREATE TABLE IF NOT EXISTS "TimetableAssignment" (
  "id"                  TEXT NOT NULL,
  "timetableId"         TEXT NOT NULL,
  "curriculumContentId" TEXT,
  "assignedById"        TEXT NOT NULL,
  "assignedDate"        DATE NOT NULL,
  "title"               TEXT NOT NULL,
  "instructions"        TEXT,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TimetableAssignment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TimetableAssignment"
  ADD CONSTRAINT "TimetableAssignment_timetableId_fkey"
  FOREIGN KEY ("timetableId") REFERENCES "Timetable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TimetableAssignment"
  ADD CONSTRAINT "TimetableAssignment_curriculumContentId_fkey"
  FOREIGN KEY ("curriculumContentId") REFERENCES "CurriculumContent"("contentId") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TimetableAssignment"
  ADD CONSTRAINT "TimetableAssignment_assignedById_fkey"
  FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TimetableAssignment"
  ADD CONSTRAINT "TimetableAssignment_timetableId_assignedDate_key"
  UNIQUE ("timetableId", "assignedDate");

CREATE INDEX IF NOT EXISTS "TimetableAssignment_timetableId_assignedDate_idx"
  ON "TimetableAssignment"("timetableId", "assignedDate");

CREATE INDEX IF NOT EXISTS "TimetableAssignment_assignedDate_idx"
  ON "TimetableAssignment"("assignedDate");
