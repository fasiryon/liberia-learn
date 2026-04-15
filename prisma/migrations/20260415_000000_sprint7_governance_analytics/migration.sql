-- Sprint 7: Governance + Anonymized Exports + Analytics
-- Additive only. Safe to apply to production without downtime.

-- DataAccessLog: fine-grained record of every data access event
-- Used by logDataAccess() for governance audit trail.
CREATE TABLE IF NOT EXISTS "DataAccessLog" (
  "id"            TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "userId"        TEXT,
  "schoolId"      TEXT,
  "resourceType"  TEXT NOT NULL,
  "resourceId"    TEXT,
  "action"        TEXT NOT NULL,
  "scope"         TEXT,
  "traceId"       TEXT,
  "ipAddress"     TEXT,
  "metadata"      JSONB,
  "accessedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DataAccessLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DataAccessLog_userId_accessedAt_idx"
  ON "DataAccessLog"("userId", "accessedAt");
CREATE INDEX IF NOT EXISTS "DataAccessLog_schoolId_accessedAt_idx"
  ON "DataAccessLog"("schoolId", "accessedAt");
CREATE INDEX IF NOT EXISTS "DataAccessLog_resourceType_action_accessedAt_idx"
  ON "DataAccessLog"("resourceType", "action", "accessedAt");
CREATE INDEX IF NOT EXISTS "DataAccessLog_traceId_idx"
  ON "DataAccessLog"("traceId");
