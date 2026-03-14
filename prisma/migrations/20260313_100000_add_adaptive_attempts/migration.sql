CREATE TABLE "StudentAdaptiveAttempt" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "strandCode" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "difficultyTier" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentAdaptiveAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StudentAdaptiveAttempt_studentId_strandCode_idx"
    ON "StudentAdaptiveAttempt"("studentId", "strandCode");

CREATE INDEX "StudentAdaptiveAttempt_studentId_completedAt_idx"
    ON "StudentAdaptiveAttempt"("studentId", "completedAt");

ALTER TABLE "StudentAdaptiveAttempt"
    ADD CONSTRAINT "StudentAdaptiveAttempt_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
