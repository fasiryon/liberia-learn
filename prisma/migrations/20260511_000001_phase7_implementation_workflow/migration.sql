-- Phase 7: Governed Implementation Workflow for Approved Optimization Proposals
-- Adds OptimizationChangeRequest, ChangeRequestSignoff, StagedRolloutPlan,
-- and PostChangeEvaluationPlan tables.
-- All changes are additive and safe to apply to a live database.
-- Policy mutation NEVER occurs here; tables store plan artifacts only.

CREATE TABLE IF NOT EXISTS "OptimizationChangeRequest" (
  "id"                           TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "proposalEventId"              TEXT NOT NULL,
  "category"                     TEXT NOT NULL,
  "title"                        TEXT NOT NULL,
  "affectedScope"                TEXT NOT NULL,
  "affectedArea"                 TEXT NOT NULL,
  "schoolId"                     TEXT,
  "districtId"                   TEXT,
  "tenantId"                     TEXT,
  "expectedImpact"               TEXT,
  "riskAssessment"               JSONB,
  "evidenceRefs"                 JSONB,
  "proposedImplementationPlan"   JSONB,
  "rollbackPlan"                 JSONB,
  "requiredReviewerRoles"        JSONB,
  "workflowRunId"                TEXT,
  "workflowTraceId"              TEXT,
  "correlationId"                TEXT NOT NULL,
  "status"                       TEXT NOT NULL DEFAULT 'DRAFT',
  "implementationStatus"         TEXT NOT NULL DEFAULT 'NOT_STARTED',
  "requiresManualImplementation" BOOLEAN NOT NULL DEFAULT TRUE,
  "idempotencyKey"               TEXT UNIQUE,
  "createdBy"                    TEXT,
  "createdAt"                    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "OptimizationChangeRequest_proposalEventId_idx"
  ON "OptimizationChangeRequest"("proposalEventId");
CREATE INDEX IF NOT EXISTS "OptimizationChangeRequest_schoolId_status_createdAt_idx"
  ON "OptimizationChangeRequest"("schoolId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "OptimizationChangeRequest_status_createdAt_idx"
  ON "OptimizationChangeRequest"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "OptimizationChangeRequest_correlationId_createdAt_idx"
  ON "OptimizationChangeRequest"("correlationId", "createdAt");

CREATE TABLE IF NOT EXISTS "ChangeRequestSignoff" (
  "id"              TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "changeRequestId" TEXT NOT NULL REFERENCES "OptimizationChangeRequest"("id"),
  "reviewerUserId"  TEXT NOT NULL,
  "reviewerRole"    TEXT NOT NULL,
  "schoolId"        TEXT,
  "decision"        TEXT NOT NULL,
  "comment"         TEXT,
  "decidedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "traceId"         TEXT,
  "idempotencyKey"  TEXT UNIQUE,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ChangeRequestSignoff_changeRequestId_createdAt_idx"
  ON "ChangeRequestSignoff"("changeRequestId", "createdAt");
CREATE INDEX IF NOT EXISTS "ChangeRequestSignoff_reviewerUserId_createdAt_idx"
  ON "ChangeRequestSignoff"("reviewerUserId", "createdAt");

CREATE TABLE IF NOT EXISTS "StagedRolloutPlan" (
  "id"                           TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "changeRequestId"              TEXT NOT NULL UNIQUE REFERENCES "OptimizationChangeRequest"("id"),
  "currentStage"                 TEXT NOT NULL DEFAULT 'INTERNAL_ONLY',
  "stages"                       JSONB NOT NULL,
  "status"                       TEXT NOT NULL DEFAULT 'DRAFT',
  "requiresManualImplementation" BOOLEAN NOT NULL DEFAULT TRUE,
  "rollbackTrigger"              TEXT,
  "rollbackOwner"                TEXT,
  "rollbackSteps"                JSONB,
  "rollbackVerificationChecklist" JSONB,
  "expectedRestoredState"        JSONB,
  "rolloutVerification"          JSONB,
  "rollbackVerification"         JSONB,
  "traceId"                      TEXT,
  "createdBy"                    TEXT,
  "createdAt"                    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "StagedRolloutPlan_changeRequestId_idx"
  ON "StagedRolloutPlan"("changeRequestId");
CREATE INDEX IF NOT EXISTS "StagedRolloutPlan_status_createdAt_idx"
  ON "StagedRolloutPlan"("status", "createdAt");

CREATE TABLE IF NOT EXISTS "PostChangeEvaluationPlan" (
  "id"                               TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "changeRequestId"                  TEXT NOT NULL UNIQUE REFERENCES "OptimizationChangeRequest"("id"),
  "baselineMetrics"                  JSONB,
  "postChangeMetrics"                JSONB,
  "evaluationWindowDays"             INTEGER NOT NULL DEFAULT 14,
  "status"                           TEXT NOT NULL DEFAULT 'BASELINE_PENDING',
  "detectorPrecisionBaseline"        DOUBLE PRECISION,
  "falsePositiveRateBaseline"        DOUBLE PRECISION,
  "recommendationAcceptanceBaseline" DOUBLE PRECISION,
  "approvalRejectionBaseline"        DOUBLE PRECISION,
  "findings"                         JSONB,
  "feedbackLoopStatus"               TEXT NOT NULL DEFAULT 'pending',
  "createdBy"                        TEXT,
  "traceId"                          TEXT,
  "createdAt"                        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "PostChangeEvaluationPlan_changeRequestId_idx"
  ON "PostChangeEvaluationPlan"("changeRequestId");
CREATE INDEX IF NOT EXISTS "PostChangeEvaluationPlan_status_createdAt_idx"
  ON "PostChangeEvaluationPlan"("status", "createdAt");
