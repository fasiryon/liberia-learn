-- P2-A Migration A: additive curriculum provenance core.
-- Creates four new tables and supporting enum types only.
-- This migration does not alter or rewrite CurriculumContent.

-- Fail promptly on metadata-lock contention and cap total statement time.
SET lock_timeout = '5s';
SET statement_timeout = '5min';

CREATE TYPE "CurriculumProvenanceCompleteness" AS ENUM (
  'VERIFIED',
  'PARTIAL',
  'UNVERIFIED'
);

CREATE TYPE "CurriculumLifecycleState" AS ENUM (
  'DRAFT',
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'REVOKED',
  'SUPERSEDED'
);

CREATE TYPE "CurriculumRevisionKind" AS ENUM (
  'ORIGINAL_GENERATION',
  'IMPORT',
  'HUMAN_CREATE',
  'HUMAN_EDIT',
  'FORK',
  'AI_REGENERATION',
  'AI_UPGRADE',
  'AI_ENRICHMENT',
  'DETERMINISTIC_ENRICHMENT',
  'ALIGNMENT_CHANGE',
  'METADATA_CHANGE',
  'BACKFILL_SNAPSHOT'
);

CREATE TYPE "CurriculumOriginKind" AS ENUM (
  'AI_GENERATED',
  'DETERMINISTIC_GENERATED',
  'IMPORTED',
  'HUMAN_AUTHORED',
  'FORKED',
  'AI_UPGRADED',
  'LEGACY_UNKNOWN'
);

CREATE TYPE "CurriculumGovernanceEventType" AS ENUM (
  'SUBMITTED',
  'RISK_ASSESSED',
  'APPROVED',
  'REJECTED',
  'RETURNED_FOR_REVIEW',
  'REAPPROVED',
  'REVOKED',
  'REINSTATED',
  'SUPERSEDED'
);

CREATE TYPE "CurriculumGovernanceActorType" AS ENUM (
  'USER',
  'SYSTEM',
  'LEGACY_UNKNOWN'
);

CREATE TYPE "CurriculumApprovalBasis" AS ENUM (
  'HUMAN_REVIEW',
  'AUTOMATED_RISK_POLICY',
  'ROLE_POLICY',
  'SCHOOL_POLICY',
  'IMPORT_POLICY',
  'LEGACY_UNKNOWN'
);

CREATE TYPE "CurriculumReviewAuthority" AS ENUM (
  'MOE',
  'SCHOOL',
  'PLATFORM',
  'SYSTEM',
  'UNKNOWN'
);

CREATE TYPE "CurriculumFutureAssignmentPolicy" AS ENUM (
  'BLOCK_NEW',
  'REPLACE_WITH_SUCCESSOR'
);

CREATE TYPE "CurriculumExistingAssignmentPolicy" AS ENUM (
  'KEEP_EXISTING',
  'WITHDRAW_EXISTING',
  'REPLACE_WITH_SUCCESSOR'
);

CREATE TYPE "CurriculumOfflineCachePolicy" AS ENUM (
  'NO_INVALIDATION',
  'INVALIDATE_ON_NEXT_REFRESH',
  'URGENT_INVALIDATE_ON_NEXT_REFRESH'
);

CREATE TYPE "CurriculumEvidenceType" AS ENUM (
  'URL',
  'DOCUMENT',
  'CURRICULUM_STANDARD',
  'TEXTBOOK',
  'REVIEWER_NOTE',
  'EXTERNAL_REFERENCE'
);

CREATE TYPE "CurriculumEvidencePurpose" AS ENUM (
  'FACTUAL_SUPPORT',
  'CURRICULUM_AUTHORITY',
  'SOURCE_MATERIAL',
  'IMPORT_ORIGIN',
  'REVIEW_SUPPORT'
);

CREATE TYPE "CurriculumEvidenceStatus" AS ENUM (
  'ACTIVE',
  'WITHDRAWN'
);

CREATE TABLE "CurriculumProvenance" (
  "id" TEXT NOT NULL,
  "curriculumContentId" TEXT NOT NULL,
  "provenanceCompleteness" "CurriculumProvenanceCompleteness" NOT NULL DEFAULT 'UNVERIFIED',
  "lifecycleState" "CurriculumLifecycleState" NOT NULL DEFAULT 'DRAFT',
  "currentRevisionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CurriculumProvenance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CurriculumContentRevision" (
  "id" TEXT NOT NULL,
  "provenanceId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "revisionKind" "CurriculumRevisionKind" NOT NULL,
  "originKind" "CurriculumOriginKind" NOT NULL,
  "snapshotSchemaVersion" INTEGER NOT NULL,
  "contentSnapshot" JSONB NOT NULL,
  "contentHash" VARCHAR(64) NOT NULL,
  "generatorName" TEXT,
  "generatorVersion" TEXT,
  "aiProvider" TEXT,
  "aiModel" TEXT,
  "generatedAt" TIMESTAMP(3),
  "generationCorrelationId" TEXT,
  "primaryPromptKey" TEXT,
  "primaryPromptVersion" TEXT,
  "primaryPromptHash" VARCHAR(64),
  "authorUserId" TEXT,
  "sourceRevisionId" TEXT,
  "idempotencyKey" TEXT,
  "backfillRunId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CurriculumContentRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CurriculumGovernanceEvent" (
  "id" TEXT NOT NULL,
  "provenanceId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "revisionId" TEXT NOT NULL,
  "eventType" "CurriculumGovernanceEventType" NOT NULL,
  "actorType" "CurriculumGovernanceActorType" NOT NULL,
  "actorUserId" TEXT,
  "actorLabel" TEXT,
  "approvalBasis" "CurriculumApprovalBasis",
  "reviewAuthority" "CurriculumReviewAuthority",
  "reviewerRoleSnapshot" TEXT,
  "reviewerQualificationRef" TEXT,
  "reviewerQualificationSnapshot" JSONB,
  "riskScore" INTEGER,
  "riskReasons" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "reason" TEXT,
  "lifecycleResult" "CurriculumLifecycleState",
  "replacementRevisionId" TEXT,
  "futureAssignmentPolicy" "CurriculumFutureAssignmentPolicy",
  "existingAssignmentPolicy" "CurriculumExistingAssignmentPolicy",
  "offlineCachePolicy" "CurriculumOfflineCachePolicy",
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "auditLogId" TEXT,
  "idempotencyKey" TEXT,
  "backfillRunId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CurriculumGovernanceEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CurriculumEvidence" (
  "id" TEXT NOT NULL,
  "revisionId" TEXT NOT NULL,
  "evidenceType" "CurriculumEvidenceType" NOT NULL,
  "evidencePurpose" "CurriculumEvidencePurpose" NOT NULL,
  "title" TEXT NOT NULL,
  "uri" TEXT,
  "documentRef" TEXT,
  "citation" TEXT,
  "publisher" TEXT,
  "locator" TEXT,
  "contentHash" VARCHAR(64),
  "license" TEXT,
  "addedByUserId" TEXT,
  "status" "CurriculumEvidenceStatus" NOT NULL DEFAULT 'ACTIVE',
  "supersedesEvidenceId" TEXT,
  "idempotencyKey" TEXT,
  "backfillRunId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CurriculumEvidence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CurriculumProvenance_curriculumContentId_key"
  ON "CurriculumProvenance"("curriculumContentId");
CREATE UNIQUE INDEX "CurriculumProvenance_currentRevisionId_key"
  ON "CurriculumProvenance"("currentRevisionId");
CREATE INDEX "CurriculumProvenance_lifecycleState_idx"
  ON "CurriculumProvenance"("lifecycleState");
CREATE INDEX "CurriculumProvenance_provenanceCompleteness_idx"
  ON "CurriculumProvenance"("provenanceCompleteness");
CREATE INDEX "CurriculumProvenance_updatedAt_idx"
  ON "CurriculumProvenance"("updatedAt");

CREATE UNIQUE INDEX "CurriculumContentRevision_idempotencyKey_key"
  ON "CurriculumContentRevision"("idempotencyKey");
CREATE UNIQUE INDEX "CurriculumContentRevision_provenanceId_sequence_key"
  ON "CurriculumContentRevision"("provenanceId", "sequence");
CREATE UNIQUE INDEX "CurriculumContentRevision_id_provenanceId_key"
  ON "CurriculumContentRevision"("id", "provenanceId");
CREATE INDEX "CurriculumContentRevision_provenanceId_createdAt_idx"
  ON "CurriculumContentRevision"("provenanceId", "createdAt");
CREATE INDEX "CurriculumContentRevision_generationCorrelationId_idx"
  ON "CurriculumContentRevision"("generationCorrelationId");
CREATE INDEX "CurriculumContentRevision_contentHash_idx"
  ON "CurriculumContentRevision"("contentHash");
CREATE INDEX "CurriculumContentRevision_sourceRevisionId_idx"
  ON "CurriculumContentRevision"("sourceRevisionId");
CREATE INDEX "CurriculumContentRevision_backfillRunId_idx"
  ON "CurriculumContentRevision"("backfillRunId");

CREATE UNIQUE INDEX "CurriculumGovernanceEvent_auditLogId_key"
  ON "CurriculumGovernanceEvent"("auditLogId");
CREATE UNIQUE INDEX "CurriculumGovernanceEvent_idempotencyKey_key"
  ON "CurriculumGovernanceEvent"("idempotencyKey");
CREATE UNIQUE INDEX "CurriculumGovernanceEvent_provenanceId_sequence_key"
  ON "CurriculumGovernanceEvent"("provenanceId", "sequence");
CREATE INDEX "CurriculumGovernanceEvent_provenanceId_occurredAt_idx"
  ON "CurriculumGovernanceEvent"("provenanceId", "occurredAt");
CREATE INDEX "CurriculumGovernanceEvent_revisionId_eventType_occurredAt_idx"
  ON "CurriculumGovernanceEvent"("revisionId", "eventType", "occurredAt");
CREATE INDEX "CurriculumGovernanceEvent_eventType_occurredAt_idx"
  ON "CurriculumGovernanceEvent"("eventType", "occurredAt");
CREATE INDEX "CurriculumGovernanceEvent_actorUserId_occurredAt_idx"
  ON "CurriculumGovernanceEvent"("actorUserId", "occurredAt");
CREATE INDEX "CurriculumGovernanceEvent_replacementRevisionId_idx"
  ON "CurriculumGovernanceEvent"("replacementRevisionId");
CREATE INDEX "CurriculumGovernanceEvent_backfillRunId_idx"
  ON "CurriculumGovernanceEvent"("backfillRunId");

CREATE UNIQUE INDEX "CurriculumEvidence_supersedesEvidenceId_key"
  ON "CurriculumEvidence"("supersedesEvidenceId");
CREATE UNIQUE INDEX "CurriculumEvidence_idempotencyKey_key"
  ON "CurriculumEvidence"("idempotencyKey");
CREATE INDEX "CurriculumEvidence_revisionId_evidencePurpose_status_idx"
  ON "CurriculumEvidence"("revisionId", "evidencePurpose", "status");
CREATE INDEX "CurriculumEvidence_evidenceType_evidencePurpose_idx"
  ON "CurriculumEvidence"("evidenceType", "evidencePurpose");
CREATE INDEX "CurriculumEvidence_addedByUserId_createdAt_idx"
  ON "CurriculumEvidence"("addedByUserId", "createdAt");
CREATE INDEX "CurriculumEvidence_backfillRunId_idx"
  ON "CurriculumEvidence"("backfillRunId");

ALTER TABLE "CurriculumProvenance"
  ADD CONSTRAINT "CurriculumProvenance_curriculumContentId_fkey"
  FOREIGN KEY ("curriculumContentId") REFERENCES "CurriculumContent"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CurriculumContentRevision"
  ADD CONSTRAINT "CurriculumContentRevision_provenanceId_fkey"
  FOREIGN KEY ("provenanceId") REFERENCES "CurriculumProvenance"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CurriculumContentRevision"
  ADD CONSTRAINT "CurriculumContentRevision_authorUserId_fkey"
  FOREIGN KEY ("authorUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CurriculumContentRevision"
  ADD CONSTRAINT "CurriculumContentRevision_sourceRevisionId_fkey"
  FOREIGN KEY ("sourceRevisionId") REFERENCES "CurriculumContentRevision"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CurriculumProvenance"
  ADD CONSTRAINT "CurriculumProvenance_currentRevisionId_fkey"
  FOREIGN KEY ("currentRevisionId") REFERENCES "CurriculumContentRevision"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CurriculumGovernanceEvent"
  ADD CONSTRAINT "CurriculumGovernanceEvent_revisionId_provenanceId_fkey"
  FOREIGN KEY ("revisionId", "provenanceId")
  REFERENCES "CurriculumContentRevision"("id", "provenanceId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CurriculumGovernanceEvent"
  ADD CONSTRAINT "CurriculumGovernanceEvent_replacementRevisionId_fkey"
  FOREIGN KEY ("replacementRevisionId") REFERENCES "CurriculumContentRevision"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CurriculumGovernanceEvent"
  ADD CONSTRAINT "CurriculumGovernanceEvent_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CurriculumGovernanceEvent"
  ADD CONSTRAINT "CurriculumGovernanceEvent_auditLogId_fkey"
  FOREIGN KEY ("auditLogId") REFERENCES "AuditLog"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CurriculumEvidence"
  ADD CONSTRAINT "CurriculumEvidence_revisionId_fkey"
  FOREIGN KEY ("revisionId") REFERENCES "CurriculumContentRevision"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CurriculumEvidence"
  ADD CONSTRAINT "CurriculumEvidence_addedByUserId_fkey"
  FOREIGN KEY ("addedByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CurriculumEvidence"
  ADD CONSTRAINT "CurriculumEvidence_supersedesEvidenceId_fkey"
  FOREIGN KEY ("supersedesEvidenceId") REFERENCES "CurriculumEvidence"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

RESET statement_timeout;
RESET lock_timeout;
