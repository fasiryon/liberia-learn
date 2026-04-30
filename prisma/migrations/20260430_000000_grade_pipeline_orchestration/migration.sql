CREATE TABLE "GradePipelineJob" (
    "id" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "subjects" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "currentSubject" TEXT,
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),

    CONSTRAINT "GradePipelineJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PipelineLock" (
    "id" TEXT NOT NULL,
    "lockKey" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PipelineLock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GradePipelineJob_grade_key" ON "GradePipelineJob"("grade");
CREATE INDEX "GradePipelineJob_status_createdAt_idx" ON "GradePipelineJob"("status", "createdAt");
CREATE INDEX "GradePipelineJob_completedAt_idx" ON "GradePipelineJob"("completedAt");
CREATE UNIQUE INDEX "PipelineLock_lockKey_key" ON "PipelineLock"("lockKey");
CREATE INDEX "PipelineLock_expiresAt_idx" ON "PipelineLock"("expiresAt");
