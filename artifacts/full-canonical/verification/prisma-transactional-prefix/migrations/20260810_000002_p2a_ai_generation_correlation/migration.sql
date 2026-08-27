-- P2-A Migration B1: nullable correlation field only.
-- No default is added, so existing rows remain unchanged and unknown.

-- Fail promptly on metadata-lock contention and cap total statement time.
SET lock_timeout = '5s';
SET statement_timeout = '5min';

ALTER TABLE "AIInteraction"
  ADD COLUMN "generationCorrelationId" TEXT;

RESET statement_timeout;
RESET lock_timeout;
