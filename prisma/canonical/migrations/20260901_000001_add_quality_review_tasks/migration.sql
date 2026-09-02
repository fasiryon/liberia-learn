-- P7-C Task 5: additive quality review task/assessment tables.
-- Canonical migration. RLS is enabled from creation and no anon/authenticated
-- privileges are granted, matching this repository's server-only table
-- convention.

-- Fail promptly on metadata-lock contention and cap total statement time.
SET lock_timeout = '5s';
SET statement_timeout = '5min';

CREATE TYPE "QualityReviewDomain" AS ENUM (
  'TUTOR_HELPFULNESS',
  'HALLUCINATION',
  'GROUNDING',
  'MODERATION_FALSE_POSITIVE',
  'MODERATION_FALSE_NEGATIVE'
);

CREATE TYPE "QualityReviewTaskStatus" AS ENUM (
  'QUEUED',
  'CLAIMED',
  'DECIDED',
  'CANCELLED'
);

CREATE TYPE "QualityReviewOutcome" AS ENUM (
  'PASS',
  'FAIL',
  'FALSE_POSITIVE',
  'FALSE_NEGATIVE'
);

CREATE TABLE "QualityReviewTask" (
  "id" TEXT NOT NULL,
  "domain" "QualityReviewDomain" NOT NULL,
  "artifactRef" TEXT NOT NULL,
  "fixtureId" TEXT,
  "fixtureVersion" INTEGER,
  "status" "QualityReviewTaskStatus" NOT NULL DEFAULT 'QUEUED',
  "requiredAuthority" "CurriculumReviewAuthority" NOT NULL,
  "schoolId" TEXT,
  "claimedByProfileId" TEXT,
  "claimedAt" TIMESTAMP(3),
  "dueAt" TIMESTAMP(3) NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT "QualityReviewTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QualityReviewAssessment" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "reviewerProfileId" TEXT NOT NULL,
  "outcome" "QualityReviewOutcome" NOT NULL,
  "severity" TEXT NOT NULL,
  "notes" TEXT,
  "auditLogId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "QualityReviewAssessment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QualityReviewTask_idempotencyKey_key"
  ON "QualityReviewTask"("idempotencyKey");
CREATE INDEX "QualityReviewTask_domain_status_dueAt_idx"
  ON "QualityReviewTask"("domain", "status", "dueAt");
CREATE INDEX "QualityReviewTask_schoolId_idx"
  ON "QualityReviewTask"("schoolId");

CREATE UNIQUE INDEX "QualityReviewAssessment_taskId_key"
  ON "QualityReviewAssessment"("taskId");
CREATE UNIQUE INDEX "QualityReviewAssessment_auditLogId_key"
  ON "QualityReviewAssessment"("auditLogId");
CREATE UNIQUE INDEX "QualityReviewAssessment_idempotencyKey_key"
  ON "QualityReviewAssessment"("idempotencyKey");
CREATE INDEX "QualityReviewAssessment_reviewerProfileId_decidedAt_idx"
  ON "QualityReviewAssessment"("reviewerProfileId", "decidedAt");

ALTER TABLE "QualityReviewTask"
  ADD CONSTRAINT "QualityReviewTask_claimedByProfileId_fkey"
  FOREIGN KEY ("claimedByProfileId") REFERENCES "ReviewerProfile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "QualityReviewTask"
  ADD CONSTRAINT "QualityReviewTask_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "QualityReviewAssessment"
  ADD CONSTRAINT "QualityReviewAssessment_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "QualityReviewTask"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "QualityReviewAssessment"
  ADD CONSTRAINT "QualityReviewAssessment_reviewerProfileId_fkey"
  FOREIGN KEY ("reviewerProfileId") REFERENCES "ReviewerProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "QualityReviewAssessment"
  ADD CONSTRAINT "QualityReviewAssessment_auditLogId_fkey"
  FOREIGN KEY ("auditLogId") REFERENCES "AuditLog"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Security convergence from creation. These tables are server-only and carry
-- no anon/authenticated table privileges by default; the explicit revoke is
-- defense in depth. Roles are optional in a plain PostgreSQL bootstrap image.
ALTER TABLE "QualityReviewTask" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QualityReviewAssessment" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE role_name text;
DECLARE table_list constant text := '"QualityReviewTask", "QualityReviewAssessment"';
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON TABLE %s FROM %I', table_list, role_name);
    END IF;
  END LOOP;
END;
$$;

RESET statement_timeout;
RESET lock_timeout;
