-- NR-14A: Add clientSubmissionId to HomeworkSubmission for offline idempotency
-- Safe partial unique index: only enforces uniqueness when the column is non-NULL
-- (matches Prisma's @unique on an optional field)

ALTER TABLE "HomeworkSubmission"
  ADD COLUMN IF NOT EXISTS "clientSubmissionId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "HomeworkSubmission_clientSubmissionId_key"
  ON "HomeworkSubmission"("clientSubmissionId")
  WHERE "clientSubmissionId" IS NOT NULL;
