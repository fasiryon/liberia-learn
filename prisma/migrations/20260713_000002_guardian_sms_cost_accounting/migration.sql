-- Sprint 6.1 (escalation point 4, approved): per-guardian SMS cost accounting.
-- Additive, non-destructive.

CREATE TABLE IF NOT EXISTS "GuardianSmsCostAccounting" (
  "id"               TEXT NOT NULL,
  "guardianPhone"    TEXT NOT NULL,
  "date"             DATE NOT NULL,
  "outboundCount"    INTEGER NOT NULL DEFAULT 0,
  "outboundSegments" INTEGER NOT NULL DEFAULT 0,
  "estimatedCostUSD" DOUBLE PRECISION NOT NULL DEFAULT 0,
  CONSTRAINT "GuardianSmsCostAccounting_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "GuardianSmsCostAccounting_guardianPhone_date_key" ON "GuardianSmsCostAccounting" ("guardianPhone", "date");
