-- P2-A Migration B2: live-table index created concurrently.
-- This file must not be wrapped in BEGIN/COMMIT because PostgreSQL forbids
-- CREATE INDEX CONCURRENTLY inside a transaction block.

-- Lock acquisition still fails promptly, but index construction has no short
-- statement timeout. Progress and validity are monitored by the runbook.
SET lock_timeout = '5s';
SET statement_timeout = '0';

CREATE INDEX CONCURRENTLY IF NOT EXISTS
  "AIInteraction_generationCorrelationId_createdAt_idx"
ON "AIInteraction"("generationCorrelationId", "createdAt");

RESET statement_timeout;
RESET lock_timeout;
