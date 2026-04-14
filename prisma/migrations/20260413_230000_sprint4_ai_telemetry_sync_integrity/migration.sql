ALTER TABLE "AIInteraction"
ADD COLUMN "promptKey" TEXT,
ADD COLUMN "promptHash" TEXT,
ADD COLUMN "originalOccurredAt" TIMESTAMP(3),
ADD COLUMN "syncReceivedAt" TIMESTAMP(3),
ADD COLUMN "clientEventId" TEXT,
ADD COLUMN "dedupeKey" TEXT,
ADD COLUMN "sourceEventId" TEXT;

CREATE INDEX "AIInteraction_clientEventId_idx" ON "AIInteraction"("clientEventId");
CREATE INDEX "AIInteraction_dedupeKey_idx" ON "AIInteraction"("dedupeKey");
CREATE INDEX "AIInteraction_sourceEventId_idx" ON "AIInteraction"("sourceEventId");
