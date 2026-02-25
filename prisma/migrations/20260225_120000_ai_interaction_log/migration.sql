-- Block 10: AI Interaction Log
-- Additive-only. No existing tables modified.
-- No studentId — no PII stored in this table.

CREATE TABLE "AiInteractionLog" (
    "id"               TEXT NOT NULL,
    "schoolId"         TEXT,
    "subject"          TEXT NOT NULL,
    "strandKey"        TEXT NOT NULL,
    "requestType"      TEXT NOT NULL,
    "guidanceLevel"    TEXT,
    "hadFallback"      BOOLEAN NOT NULL DEFAULT false,
    "estimatedCostUSD" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "timestamp"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiInteractionLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiInteractionLog_timestamp_idx"
    ON "AiInteractionLog"("timestamp");

CREATE INDEX "AiInteractionLog_subject_strandKey_idx"
    ON "AiInteractionLog"("subject", "strandKey");

CREATE INDEX "AiInteractionLog_schoolId_timestamp_idx"
    ON "AiInteractionLog"("schoolId", "timestamp");
