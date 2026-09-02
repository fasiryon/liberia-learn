-- P7-C Task 9: additive quality review calibration session/result tables.
-- Prepared in Step 1 only. Do not apply without separate database approval.

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

RESET statement_timeout;
RESET lock_timeout;
