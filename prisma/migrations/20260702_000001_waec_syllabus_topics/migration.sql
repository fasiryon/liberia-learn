-- Phase 5A Foundation: WAEC syllabus topic tags on curriculum content.
-- Additive, non-destructive: new nullable-with-default array column.
ALTER TABLE "CurriculumContent"
  ADD COLUMN IF NOT EXISTS "waecSyllabusTopics" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
