-- Block 5: Self-Healing Ops Agent
-- Creates OpsFinding and OpsExplanation tables.
-- No PII stored — aggregate signals only.
-- Idempotent: uses IF NOT EXISTS throughout.

CREATE TABLE IF NOT EXISTS "OpsFinding" (
  "id"                 TEXT         NOT NULL PRIMARY KEY,
  "schoolId"           TEXT,
  "severity"           TEXT         NOT NULL,
  "category"           TEXT         NOT NULL,
  "signalKey"          TEXT         NOT NULL,
  "windowHours"        INTEGER      NOT NULL,
  "baseline"           DOUBLE PRECISION,
  "current"            DOUBLE PRECISION,
  "deltaPct"           DOUBLE PRECISION,
  "recommendedActions" JSONB        NOT NULL DEFAULT '[]',
  "recommendedFlags"   JSONB        NOT NULL DEFAULT '[]',
  "status"             TEXT         NOT NULL DEFAULT 'open',
  "createdAt"          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updatedAt"          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "ackedAt"            TIMESTAMPTZ,
  "resolvedAt"         TIMESTAMPTZ,
  CONSTRAINT "OpsFinding_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "OpsFinding_schoolId_status_idx"    ON "OpsFinding"("schoolId", "status");
CREATE INDEX IF NOT EXISTS "OpsFinding_severity_status_idx"    ON "OpsFinding"("severity",  "status");
CREATE INDEX IF NOT EXISTS "OpsFinding_category_status_idx"    ON "OpsFinding"("category",  "status");
CREATE INDEX IF NOT EXISTS "OpsFinding_createdAt_idx"          ON "OpsFinding"("createdAt");

CREATE TABLE IF NOT EXISTS "OpsExplanation" (
  "id"          TEXT        NOT NULL PRIMARY KEY,
  "findingId"   TEXT        NOT NULL UNIQUE,
  "summary"     TEXT        NOT NULL,
  "hypotheses"  JSONB       NOT NULL DEFAULT '[]',
  "checklist"   JSONB       NOT NULL DEFAULT '[]',
  "monitorNext" JSONB       NOT NULL DEFAULT '[]',
  "modelUsed"   TEXT        NOT NULL,
  "promptHash"  TEXT        NOT NULL,
  "rawJson"     JSONB       NOT NULL DEFAULT '{}',
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "OpsExplanation_findingId_fkey"
    FOREIGN KEY ("findingId") REFERENCES "OpsFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "OpsExplanation_findingId_idx" ON "OpsExplanation"("findingId");
