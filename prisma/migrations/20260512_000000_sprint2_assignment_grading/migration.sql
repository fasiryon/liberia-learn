-- Sprint 2: add rubricScore to AssignmentSubmission for per-criterion grade breakdown
ALTER TABLE "AssignmentSubmission" ADD COLUMN IF NOT EXISTS "rubricScore" JSONB;
