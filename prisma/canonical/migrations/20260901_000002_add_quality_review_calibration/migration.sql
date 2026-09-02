-- P7-C Task 9: additive quality review calibration session/result tables.
-- Canonical migration. RLS is enabled from creation and no anon/authenticated
-- privileges are granted, matching this repository's server-only table
-- convention.

-- Fail promptly on metadata-lock contention and cap total statement time.
SET lock_timeout = '5s';
SET statement_timeout = '5min';

CREATE TYPE "QualityReviewCalibrationSessionStatus" AS ENUM (
  'DRAFT',
  'OPEN',
  'CLOSED',
  'CANCELLED'
);

CREATE TABLE "QualityReviewCalibrationSession" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "QualityReviewCalibrationSessionStatus" NOT NULL DEFAULT 'DRAFT',
  "domain" "QualityReviewDomain" NOT NULL,
  "referenceTaskId" TEXT NOT NULL,
  "referenceSnapshot" JSONB NOT NULL,
  "opensAt" TIMESTAMP(3),
  "closesAt" TIMESTAMP(3),
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "idempotencyKey" TEXT NOT NULL,

  CONSTRAINT "QualityReviewCalibrationSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QualityReviewCalibrationResult" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "reviewerProfileId" TEXT NOT NULL,
  "assessmentSnapshot" JSONB NOT NULL,
  "comparisonResult" JSONB NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "idempotencyKey" TEXT NOT NULL,

  CONSTRAINT "QualityReviewCalibrationResult_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QualityReviewCalibrationSession_idempotencyKey_key"
  ON "QualityReviewCalibrationSession"("idempotencyKey");
CREATE INDEX "QualityReviewCalibrationSession_status_opensAt_closesAt_idx"
  ON "QualityReviewCalibrationSession"("status", "opensAt", "closesAt");
CREATE INDEX "QualityReviewCalibrationSession_domain_idx"
  ON "QualityReviewCalibrationSession"("domain");

CREATE UNIQUE INDEX "QualityReviewCalibrationResult_idempotencyKey_key"
  ON "QualityReviewCalibrationResult"("idempotencyKey");
CREATE UNIQUE INDEX "QualityReviewCalibrationResult_sessionId_reviewerProfileId_key"
  ON "QualityReviewCalibrationResult"("sessionId", "reviewerProfileId");
CREATE INDEX "QualityReviewCalibrationResult_reviewerProfileId_submittedA_idx"
  ON "QualityReviewCalibrationResult"("reviewerProfileId", "submittedAt");

ALTER TABLE "QualityReviewCalibrationSession"
  ADD CONSTRAINT "QualityReviewCalibrationSession_referenceTaskId_fkey"
  FOREIGN KEY ("referenceTaskId") REFERENCES "QualityReviewTask"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "QualityReviewCalibrationSession"
  ADD CONSTRAINT "QualityReviewCalibrationSession_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "QualityReviewCalibrationResult"
  ADD CONSTRAINT "QualityReviewCalibrationResult_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "QualityReviewCalibrationSession"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "QualityReviewCalibrationResult"
  ADD CONSTRAINT "QualityReviewCalibrationResult_reviewerProfileId_fkey"
  FOREIGN KEY ("reviewerProfileId") REFERENCES "ReviewerProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Security convergence from creation. These tables are server-only and carry
-- no anon/authenticated table privileges by default; the explicit revoke is
-- defense in depth. Roles are optional in a plain PostgreSQL bootstrap image.
ALTER TABLE "QualityReviewCalibrationSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QualityReviewCalibrationResult" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE role_name text;
DECLARE table_list constant text := '"QualityReviewCalibrationSession", "QualityReviewCalibrationResult"';
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
