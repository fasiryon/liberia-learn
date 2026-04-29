CREATE TABLE "TextbookGenerationJob" (
    "id" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'student',
    "version" TEXT NOT NULL DEFAULT 'v1',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "storageUrl" TEXT,
    "storagePath" TEXT,
    "estimatedCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "durationMs" INTEGER,
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "force" BOOLEAN NOT NULL DEFAULT false,
    "requestedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "generatedAt" TIMESTAMP(3),

    CONSTRAINT "TextbookGenerationJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TextbookGenerationJob_grade_subject_format_version_key" ON "TextbookGenerationJob"("grade", "subject", "format", "version");
CREATE INDEX "TextbookGenerationJob_status_createdAt_idx" ON "TextbookGenerationJob"("status", "createdAt");
CREATE INDEX "TextbookGenerationJob_grade_subject_format_idx" ON "TextbookGenerationJob"("grade", "subject", "format");
CREATE INDEX "TextbookGenerationJob_generatedAt_idx" ON "TextbookGenerationJob"("generatedAt");

ALTER TABLE "TextbookGenerationJob" ADD CONSTRAINT "TextbookGenerationJob_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
