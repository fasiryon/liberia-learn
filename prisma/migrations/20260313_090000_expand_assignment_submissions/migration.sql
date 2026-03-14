ALTER TABLE "AssignmentSubmission"
ADD COLUMN "content" TEXT,
ADD COLUMN "feedback" TEXT,
ADD COLUMN "gradedAt" TIMESTAMP(3),
ADD COLUMN "gradedBy" TEXT;
