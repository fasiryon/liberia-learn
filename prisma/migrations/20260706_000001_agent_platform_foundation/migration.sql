-- Sprint 6.0a: Agent Platform Foundation.
-- Additive, non-destructive. New LLM-agent harness tables. Does NOT touch the
-- generic Agent/AgentTask (Family A) or the dormant Autonomous OS AgentRun
-- (Family B) tables.

CREATE TABLE IF NOT EXISTS "AgentInvocation" (
  "id"               TEXT NOT NULL,
  "agentName"        TEXT NOT NULL,
  "agentVersion"     TEXT NOT NULL,
  "goalId"           TEXT,
  "userId"           TEXT,
  "triggeredBy"      TEXT NOT NULL,
  "input"            JSONB NOT NULL,
  "output"           JSONB,
  "toolCalls"        JSONB NOT NULL DEFAULT '[]',
  "llmTokensIn"      INTEGER NOT NULL DEFAULT 0,
  "llmTokensOut"     INTEGER NOT NULL DEFAULT 0,
  "llmCostUSD"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "toolCostUnits"    INTEGER NOT NULL DEFAULT 0,
  "latencyMs"        INTEGER NOT NULL DEFAULT 0,
  "status"           TEXT NOT NULL,
  "errorMessage"     TEXT,
  "escalationReason" TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentInvocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AgentGoal" (
  "id"                  TEXT NOT NULL,
  "agentName"           TEXT NOT NULL,
  "initiatedBy"         TEXT NOT NULL,
  "goalDescription"     TEXT NOT NULL,
  "status"              TEXT NOT NULL DEFAULT 'OPEN',
  "state"               JSONB NOT NULL DEFAULT '{}',
  "pauseReason"         TEXT,
  "pauseUntil"          TIMESTAMP(3),
  "humanReviewRequired" BOOLEAN NOT NULL DEFAULT false,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,
  "completedAt"         TIMESTAMP(3),
  CONSTRAINT "AgentGoal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AgentCostAccounting" (
  "id"                 TEXT NOT NULL,
  "agentName"          TEXT NOT NULL,
  "date"               DATE NOT NULL,
  "totalInvocations"   INTEGER NOT NULL DEFAULT 0,
  "totalLlmCostUSD"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalToolCostUnits" INTEGER NOT NULL DEFAULT 0,
  "uniqueUsers"        INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "AgentCostAccounting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EscalationQueue" (
  "id"           TEXT NOT NULL,
  "agentName"    TEXT NOT NULL,
  "invocationId" TEXT NOT NULL,
  "goalId"       TEXT,
  "userId"       TEXT,
  "reason"       TEXT NOT NULL,
  "priority"     TEXT NOT NULL DEFAULT 'MEDIUM',
  "assignedTo"   TEXT,
  "status"       TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt"   TIMESTAMP(3),
  "resolution"   TEXT,
  CONSTRAINT "EscalationQueue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AgentInvocation_agentName_createdAt_idx" ON "AgentInvocation" ("agentName", "createdAt");
CREATE INDEX IF NOT EXISTS "AgentInvocation_userId_createdAt_idx" ON "AgentInvocation" ("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "AgentInvocation_goalId_idx" ON "AgentInvocation" ("goalId");

CREATE INDEX IF NOT EXISTS "AgentGoal_status_updatedAt_idx" ON "AgentGoal" ("status", "updatedAt");
CREATE INDEX IF NOT EXISTS "AgentGoal_initiatedBy_idx" ON "AgentGoal" ("initiatedBy");

CREATE UNIQUE INDEX IF NOT EXISTS "AgentCostAccounting_agentName_date_key" ON "AgentCostAccounting" ("agentName", "date");

CREATE INDEX IF NOT EXISTS "EscalationQueue_status_priority_createdAt_idx" ON "EscalationQueue" ("status", "priority", "createdAt");

-- FK for invocation → goal (nullable). Guarded so re-runs are idempotent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AgentInvocation_goalId_fkey'
  ) THEN
    ALTER TABLE "AgentInvocation"
      ADD CONSTRAINT "AgentInvocation_goalId_fkey"
      FOREIGN KEY ("goalId") REFERENCES "AgentGoal" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
