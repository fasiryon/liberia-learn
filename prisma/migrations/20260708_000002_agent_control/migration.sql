-- Sprint 6.0d: admin kill-switch override table. Additive, non-destructive.
CREATE TABLE IF NOT EXISTS "AgentControl" (
  "id"              TEXT NOT NULL,
  "agentName"       TEXT NOT NULL,
  "enabledOverride" BOOLEAN,
  "updatedBy"       TEXT,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgentControl_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AgentControl_agentName_key" ON "AgentControl" ("agentName");
