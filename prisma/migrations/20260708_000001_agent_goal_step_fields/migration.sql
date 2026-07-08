-- Sprint 6.0c: Agent goal loop bookkeeping. Additive, non-destructive.
-- stepCount bounds runaway goals + powers the admin goal browser;
-- lastError records why a goal FAILED.
ALTER TABLE "AgentGoal"
  ADD COLUMN IF NOT EXISTS "stepCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastError" TEXT;
