-- CreateTable TeachingSession
CREATE TABLE "TeachingSession" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "facilitatorId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "alignmentMode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "degradedMode" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeachingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable TeachingTurn
CREATE TABLE "TeachingTurn" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "turnIndex" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "inputText" TEXT NOT NULL,
    "responseText" TEXT NOT NULL,
    "guardrailMode" TEXT NOT NULL,
    "deferred" BOOLEAN NOT NULL DEFAULT false,
    "lessonDirectorAction" TEXT NOT NULL,
    "whisperPrompt" JSONB,
    "llmCostUSD" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeachingTurn_pkey" PRIMARY KEY ("id")
);

-- CreateTable TeachingLedger
CREATE TABLE "TeachingLedger" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "facilitatorId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "standardsCovered" JSONB NOT NULL,
    "objectives" JSONB NOT NULL,
    "resourcesUsed" JSONB NOT NULL,
    "questionsAsked" JSONB NOT NULL,
    "aggregatedResponses" JSONB NOT NULL,
    "quizResults" JSONB,
    "homeworkAssigned" JSONB,
    "transcript" JSONB NOT NULL,
    "confidenceFlags" JSONB NOT NULL,
    "outOfScopeQuestions" JSONB NOT NULL,
    "facilitatorNotes" TEXT,
    "narrativeText" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeachingLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for TeachingSession
CREATE INDEX "TeachingSession_facilitatorId_startedAt_idx" ON "TeachingSession"("facilitatorId", "startedAt");

-- CreateIndex for TeachingSession
CREATE INDEX "TeachingSession_schoolId_startedAt_idx" ON "TeachingSession"("schoolId", "startedAt");

-- CreateIndex for TeachingSession
CREATE INDEX "TeachingSession_contentId_idx" ON "TeachingSession"("contentId");

-- CreateIndex for TeachingTurn
CREATE UNIQUE INDEX "TeachingTurn_sessionId_turnIndex_key" ON "TeachingTurn"("sessionId", "turnIndex");

-- CreateIndex for TeachingTurn
CREATE INDEX "TeachingTurn_sessionId_createdAt_idx" ON "TeachingTurn"("sessionId", "createdAt");

-- CreateIndex for TeachingLedger
CREATE UNIQUE INDEX "TeachingLedger_sessionId_key" ON "TeachingLedger"("sessionId");

-- CreateIndex for TeachingLedger
CREATE INDEX "TeachingLedger_schoolId_createdAt_idx" ON "TeachingLedger"("schoolId", "createdAt");

-- CreateIndex for TeachingLedger
CREATE INDEX "TeachingLedger_facilitatorId_createdAt_idx" ON "TeachingLedger"("facilitatorId", "createdAt");

-- AddForeignKey for TeachingTurn
ALTER TABLE "TeachingTurn" ADD CONSTRAINT "TeachingTurn_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TeachingSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey for TeachingLedger
ALTER TABLE "TeachingLedger" ADD CONSTRAINT "TeachingLedger_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TeachingSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
