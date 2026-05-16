-- Sprint 20: AI homework grading fields on AssignmentSubmission
ALTER TABLE "AssignmentSubmission"
  ADD COLUMN IF NOT EXISTS "aiGrade"         INTEGER,
  ADD COLUMN IF NOT EXISTS "aiFeedback"      TEXT,
  ADD COLUMN IF NOT EXISTS "aiGradedAt"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "aiRationale"     TEXT,
  ADD COLUMN IF NOT EXISTS "teacherApproved" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "approvedAt"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "autoReleasedAt"  TIMESTAMP(3);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "AssignmentSubmission_aiGradedAt_teacherApproved_autoReleasedAt_idx"
  ON "AssignmentSubmission" ("aiGradedAt", "teacherApproved", "autoReleasedAt");
