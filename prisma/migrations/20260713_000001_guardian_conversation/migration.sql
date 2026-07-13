-- Sprint 6.1: Guardian Agent (LiberiaLearn Family). Additive, non-destructive.

-- EscalationQueue.invocationId becomes nullable: safeguarding.escalate can fire
-- mid-loop, before the enclosing AgentInvocation row is persisted.
ALTER TABLE "EscalationQueue" ALTER COLUMN "invocationId" DROP NOT NULL;

CREATE TABLE IF NOT EXISTS "GuardianConversation" (
  "id"                   TEXT NOT NULL,
  "guardianPhone"        TEXT NOT NULL,
  "guardianId"           TEXT,
  "verifiedAt"           TIMESTAMP(3),
  "verificationAttempts" INTEGER NOT NULL DEFAULT 0,
  "state"                JSONB NOT NULL DEFAULT '{}',
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL,
  "expiresAt"            TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GuardianConversation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "GuardianConversation_guardianPhone_key" ON "GuardianConversation" ("guardianPhone");
CREATE INDEX IF NOT EXISTS "GuardianConversation_expiresAt_idx" ON "GuardianConversation" ("expiresAt");
