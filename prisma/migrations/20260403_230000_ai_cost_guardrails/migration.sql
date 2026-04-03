ALTER TABLE "AiInteractionLog"
ADD COLUMN "userId" TEXT;

ALTER TABLE "AiInteractionLog"
ADD COLUMN "feature" TEXT;

ALTER TABLE "AiInteractionLog"
ADD COLUMN "model" TEXT;

ALTER TABLE "AiInteractionLog"
ADD COLUMN "tier" TEXT;

CREATE INDEX "AiInteractionLog_feature_timestamp_idx"
ON "AiInteractionLog"("feature", "timestamp");

CREATE INDEX "AiInteractionLog_userId_timestamp_idx"
ON "AiInteractionLog"("userId", "timestamp");
