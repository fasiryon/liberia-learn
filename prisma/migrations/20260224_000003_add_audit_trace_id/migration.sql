-- Block 6: Add traceId to AuditLog for request-level correlation.
-- Idempotent: uses IF NOT EXISTS / IF NOT EXISTS guards.

ALTER TABLE "AuditLog"
  ADD COLUMN IF NOT EXISTS "traceId" TEXT;

CREATE INDEX IF NOT EXISTS "AuditLog_traceId_idx"
  ON "AuditLog"("traceId");
