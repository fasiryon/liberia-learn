-- CreateTable
CREATE TABLE "ContentQaReview" (
    "id" TEXT NOT NULL,
    "agentName" TEXT NOT NULL DEFAULT 'content-qa',
    "submissionId" TEXT NOT NULL,
    "submissionType" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION NOT NULL,
    "feedback" TEXT,
    "rubricUsed" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_TEACHER_REVIEW',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentQaReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentQaReview_submissionType_status_idx" ON "ContentQaReview"("submissionType", "status");

-- CreateIndex
CREATE INDEX "ContentQaReview_submissionId_idx" ON "ContentQaReview"("submissionId");
