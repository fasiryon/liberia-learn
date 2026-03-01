-- Migration: 20260228_curriculum_feedback
-- Adds CurriculumFeedback table for AI quality feedback loop (Gap 3)

CREATE TABLE IF NOT EXISTS "CurriculumFeedback" (
    "id"               TEXT NOT NULL,
    "curriculumId"     TEXT NOT NULL,
    "action"           TEXT NOT NULL,
    "rejectionReason"  TEXT,
    "grade"            INTEGER NOT NULL,
    "subject"          TEXT NOT NULL,
    "generationMethod" TEXT NOT NULL,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CurriculumFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CurriculumFeedback_curriculumId_idx"
    ON "CurriculumFeedback"("curriculumId");

CREATE INDEX IF NOT EXISTS "CurriculumFeedback_action_createdAt_idx"
    ON "CurriculumFeedback"("action", "createdAt");

CREATE INDEX IF NOT EXISTS "CurriculumFeedback_grade_subject_action_idx"
    ON "CurriculumFeedback"("grade", "subject", "action");
