-- P2-B Qualified Review Operations canonical migration. Additive only.
CREATE TYPE "ReviewerProfileStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
CREATE TYPE "ReviewerOrganizationType" AS ENUM ('SCHOOL', 'MOE', 'PLATFORM', 'SPECIALIST');
CREATE TYPE "ReviewerCredentialType" AS ENUM ('SUBJECT_REVIEW', 'STANDARDS_ALIGNMENT', 'ACCESSIBILITY_REVIEW', 'SAFETY_REVIEW', 'HEALTH_REVIEW', 'LEGAL_REVIEW', 'WAEC_SUBJECT_REVIEW', 'LICENSED_SOURCE_REVIEW', 'SOURCE_RIGHTS_VERIFICATION');
CREATE TYPE "ReviewerCredentialStatus" AS ENUM ('DRAFT', 'PENDING_VERIFICATION', 'VERIFIED', 'SUSPENDED', 'REVOKED', 'EXPIRED', 'SUPERSEDED');
CREATE TYPE "ReviewerCurriculumScope" AS ENUM ('SCHOOL', 'NATIONAL', 'WAEC', 'IMPORTED', 'LICENSED_SOURCE');
CREATE TYPE "ReviewerRestrictionType" AS ENUM ('ALL_REVIEW', 'SUBJECT', 'SCHOOL', 'ORGANIZATION', 'CALIBRATION_REQUIRED', 'CONFLICT');
CREATE TYPE "CurriculumReviewTaskStatus" AS ENUM ('QUEUED', 'CLAIMED', 'IN_REVIEW', 'AWAITING_SECOND_REVIEW', 'DISAGREEMENT', 'ESCALATED', 'COMPLETED', 'CANCELLED', 'EXPIRED');
CREATE TYPE "CurriculumReviewPriorityBand" AS ENUM ('CRITICAL', 'HIGH', 'STANDARD', 'LOW');
CREATE TYPE "CurriculumReviewSlot" AS ENUM ('FIRST', 'SECOND', 'RESOLVER', 'EMERGENCY_REVOCATION');
CREATE TYPE "CurriculumReviewAssignmentStatus" AS ENUM ('ACTIVE', 'RELEASED', 'EXPIRED', 'OVERRIDDEN', 'SUBMITTED', 'RECUSED');
CREATE TYPE "CurriculumReviewAssessmentStatus" AS ENUM ('DRAFT', 'SUBMITTED');
CREATE TYPE "CurriculumReviewRecommendation" AS ENUM ('APPROVE', 'REJECT', 'RETURN_FOR_REVISION', 'ESCALATE', 'ABSTAIN_CONFLICT');
CREATE TYPE "CurriculumReviewDecisionStatus" AS ENUM ('PENDING', 'FINAL');
CREATE TYPE "CurriculumReviewDecisionOutcome" AS ENUM ('APPROVED', 'REJECTED', 'RETURNED_FOR_REVISION', 'REVOKED', 'REINSTATED');
CREATE TYPE "ReviewCalibrationSessionStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'CANCELLED');

CREATE TABLE "ReviewerProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "ReviewerProfileStatus" NOT NULL DEFAULT 'ACTIVE',
  "organizationType" "ReviewerOrganizationType" NOT NULL,
  "authority" "CurriculumReviewAuthority" NOT NULL,
  "schoolId" TEXT,
  "organizationName" TEXT,
  "tier" INTEGER NOT NULL DEFAULT 1,
  "available" BOOLEAN NOT NULL DEFAULT true,
  "maxActiveClaims" INTEGER NOT NULL DEFAULT 3,
  "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "calibrationEligibleThrough" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "creationIdempotencyKey" TEXT NOT NULL,
  CONSTRAINT "ReviewerProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReviewerProfile_capacity_check" CHECK ("maxActiveClaims" BETWEEN 1 AND 100),
  CONSTRAINT "ReviewerProfile_tier_check" CHECK ("tier" BETWEEN 1 AND 10),
  CONSTRAINT "ReviewerProfile_school_authority_check" CHECK ("authority" <> 'SCHOOL' OR "schoolId" IS NOT NULL)
);

CREATE TABLE "ReviewerCredential" (
  "id" TEXT NOT NULL,
  "reviewerProfileId" TEXT NOT NULL,
  "credentialType" "ReviewerCredentialType" NOT NULL,
  "issuer" TEXT NOT NULL,
  "authority" "CurriculumReviewAuthority" NOT NULL,
  "status" "ReviewerCredentialStatus" NOT NULL DEFAULT 'DRAFT',
  "validFrom" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "verifiedAt" TIMESTAMP(3),
  "verifierUserId" TEXT,
  "evidenceRef" TEXT,
  "notes" TEXT,
  "supersedesCredentialId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "idempotencyKey" TEXT NOT NULL,
  CONSTRAINT "ReviewerCredential_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReviewerCredential_validity_check" CHECK ("expiresAt" IS NULL OR "validFrom" IS NULL OR "expiresAt" > "validFrom"),
  CONSTRAINT "ReviewerCredential_verified_fields_check" CHECK ("status" <> 'VERIFIED' OR ("verifierUserId" IS NOT NULL AND "verifiedAt" IS NOT NULL))
);

CREATE TABLE "ReviewerCredentialScope" (
  "id" TEXT NOT NULL,
  "credentialId" TEXT NOT NULL,
  "subject" TEXT,
  "gradeMin" INTEGER,
  "gradeMax" INTEGER,
  "domains" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "curriculumScopes" "ReviewerCurriculumScope"[] DEFAULT ARRAY[]::"ReviewerCurriculumScope"[],
  "curriculumTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "schoolId" TEXT,
  "county" TEXT,
  "standardRefs" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "language" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReviewerCredentialScope_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReviewerCredentialScope_grade_pair_check" CHECK (("gradeMin" IS NULL) = ("gradeMax" IS NULL)),
  CONSTRAINT "ReviewerCredentialScope_grade_range_check" CHECK ("gradeMin" IS NULL OR ("gradeMin" BETWEEN 1 AND 12 AND "gradeMax" BETWEEN 1 AND 12 AND "gradeMin" <= "gradeMax"))
);

CREATE TABLE "ReviewerCredentialStatusEvent" (
  "id" TEXT NOT NULL,
  "credentialId" TEXT NOT NULL,
  "fromStatus" "ReviewerCredentialStatus",
  "toStatus" "ReviewerCredentialStatus" NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "reason" TEXT,
  "auditLogId" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "idempotencyKey" TEXT NOT NULL,
  CONSTRAINT "ReviewerCredentialStatusEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReviewerRestriction" (
  "id" TEXT NOT NULL,
  "reviewerProfileId" TEXT NOT NULL,
  "restrictionType" "ReviewerRestrictionType" NOT NULL,
  "subject" TEXT,
  "schoolId" TEXT,
  "organizationRef" TEXT,
  "reason" TEXT NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveUntil" TIMESTAMP(3),
  "liftedAt" TIMESTAMP(3),
  "imposedByUserId" TEXT NOT NULL,
  "auditLogId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "idempotencyKey" TEXT NOT NULL,
  CONSTRAINT "ReviewerRestriction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReviewerRestriction_window_check" CHECK ("effectiveUntil" IS NULL OR "effectiveUntil" > "effectiveFrom")
);

CREATE TABLE "CurriculumReviewTask" (
  "id" TEXT NOT NULL,
  "provenanceId" TEXT NOT NULL,
  "revisionId" TEXT NOT NULL,
  "status" "CurriculumReviewTaskStatus" NOT NULL DEFAULT 'QUEUED',
  "policyKey" TEXT NOT NULL,
  "policyVersion" INTEGER NOT NULL,
  "rubricKey" TEXT NOT NULL,
  "rubricVersion" INTEGER NOT NULL,
  "priorityBand" "CurriculumReviewPriorityBand" NOT NULL,
  "priorityScore" INTEGER NOT NULL,
  "priorityReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "riskScore" INTEGER,
  "riskReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "requiredAuthority" "CurriculumReviewAuthority" NOT NULL,
  "requiredReviewCount" INTEGER NOT NULL DEFAULT 1,
  "specialistRequirements" JSONB,
  "blindSecondReview" BOOLEAN NOT NULL DEFAULT false,
  "evidenceRequirements" JSONB,
  "schoolId" TEXT,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "createdByUserId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "cancelledReason" TEXT,
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "CurriculumReviewTask_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CurriculumReviewTask_review_count_check" CHECK ("requiredReviewCount" BETWEEN 1 AND 3),
  CONSTRAINT "CurriculumReviewTask_risk_score_check" CHECK ("riskScore" IS NULL OR "riskScore" BETWEEN 0 AND 100),
  CONSTRAINT "CurriculumReviewTask_policy_version_check" CHECK ("policyVersion" > 0 AND "rubricVersion" > 0)
);

CREATE TABLE "CurriculumReviewAssignment" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "slot" "CurriculumReviewSlot" NOT NULL,
  "reviewerProfileId" TEXT NOT NULL,
  "credentialId" TEXT NOT NULL,
  "credentialScopeId" TEXT NOT NULL,
  "status" "CurriculumReviewAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "leaseToken" TEXT NOT NULL,
  "leaseExpiresAt" TIMESTAMP(3) NOT NULL,
  "maxContinuousUntil" TIMESTAMP(3) NOT NULL,
  "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastHeartbeatAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  "releaseReason" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CurriculumReviewAssignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CurriculumReviewAssignment_lease_window_check" CHECK ("leaseExpiresAt" > "claimedAt" AND "maxContinuousUntil" >= "leaseExpiresAt")
);

CREATE TABLE "CurriculumReviewAssessment" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "reviewerProfileId" TEXT NOT NULL,
  "credentialId" TEXT NOT NULL,
  "credentialScopeId" TEXT NOT NULL,
  "status" "CurriculumReviewAssessmentStatus" NOT NULL DEFAULT 'DRAFT',
  "reviewerRoleSnapshot" TEXT NOT NULL,
  "qualificationSnapshot" JSONB NOT NULL,
  "rubricKey" TEXT NOT NULL,
  "rubricVersion" INTEGER NOT NULL,
  "rubricResponses" JSONB NOT NULL,
  "recommendation" "CurriculumReviewRecommendation",
  "rationale" TEXT,
  "evidenceRefs" JSONB,
  "reviewerRiskResponse" JSONB,
  "submittedAt" TIMESTAMP(3),
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "CurriculumReviewAssessment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CurriculumReviewAssessment_submitted_fields_check" CHECK ("status" <> 'SUBMITTED' OR ("recommendation" IS NOT NULL AND NULLIF(BTRIM("rationale"), '') IS NOT NULL AND "submittedAt" IS NOT NULL))
);

CREATE TABLE "CurriculumReviewDecision" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "status" "CurriculumReviewDecisionStatus" NOT NULL DEFAULT 'PENDING',
  "outcome" "CurriculumReviewDecisionOutcome" NOT NULL,
  "rationale" TEXT NOT NULL,
  "resolverAssessmentId" TEXT,
  "resolverUserId" TEXT,
  "qualificationSnapshot" JSONB,
  "governanceEventId" TEXT,
  "auditLogId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finalizedAt" TIMESTAMP(3),
  CONSTRAINT "CurriculumReviewDecision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CurriculumReviewDecision_final_fields_check" CHECK ("status" <> 'FINAL' OR ("governanceEventId" IS NOT NULL AND "finalizedAt" IS NOT NULL))
);

CREATE TABLE "ReviewCalibrationSession" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "ReviewCalibrationSessionStatus" NOT NULL DEFAULT 'DRAFT',
  "revisionId" TEXT NOT NULL,
  "policyKey" TEXT NOT NULL,
  "policyVersion" INTEGER NOT NULL,
  "rubricKey" TEXT NOT NULL,
  "rubricVersion" INTEGER NOT NULL,
  "referenceSnapshot" JSONB NOT NULL,
  "opensAt" TIMESTAMP(3),
  "closesAt" TIMESTAMP(3),
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  CONSTRAINT "ReviewCalibrationSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReviewCalibrationSession_window_check" CHECK ("closesAt" IS NULL OR "opensAt" IS NULL OR "closesAt" > "opensAt")
);

CREATE TABLE "ReviewCalibrationResult" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "reviewerProfileId" TEXT NOT NULL,
  "assessmentSnapshot" JSONB NOT NULL,
  "comparisonResult" JSONB NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "idempotencyKey" TEXT NOT NULL,
  CONSTRAINT "ReviewCalibrationResult_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReviewerProfile_userId_key" ON "ReviewerProfile"("userId");
CREATE UNIQUE INDEX "ReviewerProfile_creationIdempotencyKey_key" ON "ReviewerProfile"("creationIdempotencyKey");
CREATE INDEX "ReviewerProfile_status_available_idx" ON "ReviewerProfile"("status", "available");
CREATE INDEX "ReviewerProfile_authority_schoolId_idx" ON "ReviewerProfile"("authority", "schoolId");
CREATE UNIQUE INDEX "ReviewerCredential_supersedesCredentialId_key" ON "ReviewerCredential"("supersedesCredentialId");
CREATE UNIQUE INDEX "ReviewerCredential_idempotencyKey_key" ON "ReviewerCredential"("idempotencyKey");
CREATE INDEX "ReviewerCredential_reviewerProfileId_status_idx" ON "ReviewerCredential"("reviewerProfileId", "status");
CREATE INDEX "ReviewerCredential_credentialType_authority_status_idx" ON "ReviewerCredential"("credentialType", "authority", "status");
CREATE INDEX "ReviewerCredential_expiresAt_status_idx" ON "ReviewerCredential"("expiresAt", "status");
CREATE INDEX "ReviewerCredentialScope_credentialId_idx" ON "ReviewerCredentialScope"("credentialId");
CREATE INDEX "ReviewerCredentialScope_subject_gradeMin_gradeMax_idx" ON "ReviewerCredentialScope"("subject", "gradeMin", "gradeMax");
CREATE INDEX "ReviewerCredentialScope_schoolId_idx" ON "ReviewerCredentialScope"("schoolId");
CREATE UNIQUE INDEX "ReviewerCredentialScope_id_credentialId_key" ON "ReviewerCredentialScope"("id", "credentialId");
CREATE UNIQUE INDEX "ReviewerCredential_id_reviewerProfileId_key" ON "ReviewerCredential"("id", "reviewerProfileId");
CREATE UNIQUE INDEX "ReviewerCredentialStatusEvent_auditLogId_key" ON "ReviewerCredentialStatusEvent"("auditLogId");
CREATE UNIQUE INDEX "ReviewerCredentialStatusEvent_idempotencyKey_key" ON "ReviewerCredentialStatusEvent"("idempotencyKey");
CREATE INDEX "ReviewerCredentialStatusEvent_credentialId_occurredAt_idx" ON "ReviewerCredentialStatusEvent"("credentialId", "occurredAt");
CREATE UNIQUE INDEX "ReviewerRestriction_auditLogId_key" ON "ReviewerRestriction"("auditLogId");
CREATE UNIQUE INDEX "ReviewerRestriction_idempotencyKey_key" ON "ReviewerRestriction"("idempotencyKey");
CREATE INDEX "ReviewerRestriction_reviewerProfileId_effectiveFrom_effectiv_idx" ON "ReviewerRestriction"("reviewerProfileId", "effectiveFrom", "effectiveUntil");
CREATE INDEX "ReviewerRestriction_schoolId_restrictionType_idx" ON "ReviewerRestriction"("schoolId", "restrictionType");
CREATE UNIQUE INDEX "CurriculumReviewTask_idempotencyKey_key" ON "CurriculumReviewTask"("idempotencyKey");
CREATE UNIQUE INDEX "CurriculumReviewTask_revisionId_policyKey_policyVersion_key" ON "CurriculumReviewTask"("revisionId", "policyKey", "policyVersion");
CREATE INDEX "CurriculumReviewTask_status_priorityBand_priorityScore_dueAt__idx" ON "CurriculumReviewTask"("status", "priorityBand", "priorityScore", "dueAt", "createdAt");
CREATE INDEX "CurriculumReviewTask_provenanceId_revisionId_idx" ON "CurriculumReviewTask"("provenanceId", "revisionId");
CREATE INDEX "CurriculumReviewTask_schoolId_status_idx" ON "CurriculumReviewTask"("schoolId", "status");
CREATE UNIQUE INDEX "CurriculumReviewAssignment_leaseToken_key" ON "CurriculumReviewAssignment"("leaseToken");
CREATE UNIQUE INDEX "CurriculumReviewAssignment_idempotencyKey_key" ON "CurriculumReviewAssignment"("idempotencyKey");
CREATE UNIQUE INDEX "CurriculumReviewAssignment_active_slot_key" ON "CurriculumReviewAssignment"("taskId", "slot") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "CurriculumReviewAssignment_active_reviewer_key" ON "CurriculumReviewAssignment"("taskId", "reviewerProfileId") WHERE "status" = 'ACTIVE';
CREATE INDEX "CurriculumReviewAssignment_taskId_slot_status_idx" ON "CurriculumReviewAssignment"("taskId", "slot", "status");
CREATE INDEX "CurriculumReviewAssignment_reviewerProfileId_status_leaseE_idx" ON "CurriculumReviewAssignment"("reviewerProfileId", "status", "leaseExpiresAt");
CREATE INDEX "CurriculumReviewAssignment_leaseExpiresAt_status_idx" ON "CurriculumReviewAssignment"("leaseExpiresAt", "status");
CREATE UNIQUE INDEX "CurriculumReviewAssessment_assignmentId_key" ON "CurriculumReviewAssessment"("assignmentId");
CREATE UNIQUE INDEX "CurriculumReviewAssessment_idempotencyKey_key" ON "CurriculumReviewAssessment"("idempotencyKey");
CREATE INDEX "CurriculumReviewAssessment_taskId_status_idx" ON "CurriculumReviewAssessment"("taskId", "status");
CREATE INDEX "CurriculumReviewAssessment_reviewerProfileId_submittedAt_idx" ON "CurriculumReviewAssessment"("reviewerProfileId", "submittedAt");
CREATE UNIQUE INDEX "CurriculumReviewDecision_taskId_key" ON "CurriculumReviewDecision"("taskId");
CREATE UNIQUE INDEX "CurriculumReviewDecision_resolverAssessmentId_key" ON "CurriculumReviewDecision"("resolverAssessmentId");
CREATE UNIQUE INDEX "CurriculumReviewDecision_governanceEventId_key" ON "CurriculumReviewDecision"("governanceEventId");
CREATE UNIQUE INDEX "CurriculumReviewDecision_auditLogId_key" ON "CurriculumReviewDecision"("auditLogId");
CREATE UNIQUE INDEX "CurriculumReviewDecision_idempotencyKey_key" ON "CurriculumReviewDecision"("idempotencyKey");
CREATE INDEX "ReviewCalibrationSession_status_opensAt_closesAt_idx" ON "ReviewCalibrationSession"("status", "opensAt", "closesAt");
CREATE INDEX "ReviewCalibrationSession_revisionId_idx" ON "ReviewCalibrationSession"("revisionId");
CREATE UNIQUE INDEX "ReviewCalibrationResult_idempotencyKey_key" ON "ReviewCalibrationResult"("idempotencyKey");
CREATE UNIQUE INDEX "ReviewCalibrationSession_idempotencyKey_key" ON "ReviewCalibrationSession"("idempotencyKey");
CREATE UNIQUE INDEX "ReviewCalibrationResult_sessionId_reviewerProfileId_key" ON "ReviewCalibrationResult"("sessionId", "reviewerProfileId");
CREATE INDEX "ReviewCalibrationResult_reviewerProfileId_submittedAt_idx" ON "ReviewCalibrationResult"("reviewerProfileId", "submittedAt");

ALTER TABLE "ReviewerProfile" ADD CONSTRAINT "ReviewerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewerProfile" ADD CONSTRAINT "ReviewerProfile_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewerCredential" ADD CONSTRAINT "ReviewerCredential_reviewerProfileId_fkey" FOREIGN KEY ("reviewerProfileId") REFERENCES "ReviewerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewerCredential" ADD CONSTRAINT "ReviewerCredential_verifierUserId_fkey" FOREIGN KEY ("verifierUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewerCredential" ADD CONSTRAINT "ReviewerCredential_supersedesCredentialId_fkey" FOREIGN KEY ("supersedesCredentialId") REFERENCES "ReviewerCredential"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewerCredentialScope" ADD CONSTRAINT "ReviewerCredentialScope_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "ReviewerCredential"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewerCredentialScope" ADD CONSTRAINT "ReviewerCredentialScope_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewerCredentialStatusEvent" ADD CONSTRAINT "ReviewerCredentialStatusEvent_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "ReviewerCredential"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewerCredentialStatusEvent" ADD CONSTRAINT "ReviewerCredentialStatusEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewerCredentialStatusEvent" ADD CONSTRAINT "ReviewerCredentialStatusEvent_auditLogId_fkey" FOREIGN KEY ("auditLogId") REFERENCES "AuditLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewerRestriction" ADD CONSTRAINT "ReviewerRestriction_reviewerProfileId_fkey" FOREIGN KEY ("reviewerProfileId") REFERENCES "ReviewerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewerRestriction" ADD CONSTRAINT "ReviewerRestriction_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewerRestriction" ADD CONSTRAINT "ReviewerRestriction_imposedByUserId_fkey" FOREIGN KEY ("imposedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewerRestriction" ADD CONSTRAINT "ReviewerRestriction_auditLogId_fkey" FOREIGN KEY ("auditLogId") REFERENCES "AuditLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CurriculumReviewTask" ADD CONSTRAINT "CurriculumReviewTask_provenanceId_fkey" FOREIGN KEY ("provenanceId") REFERENCES "CurriculumProvenance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CurriculumReviewTask" ADD CONSTRAINT "CurriculumReviewTask_revisionId_provenanceId_fkey" FOREIGN KEY ("revisionId", "provenanceId") REFERENCES "CurriculumContentRevision"("id", "provenanceId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CurriculumReviewTask" ADD CONSTRAINT "CurriculumReviewTask_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CurriculumReviewTask" ADD CONSTRAINT "CurriculumReviewTask_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CurriculumReviewAssignment" ADD CONSTRAINT "CurriculumReviewAssignment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "CurriculumReviewTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CurriculumReviewAssignment" ADD CONSTRAINT "CurriculumReviewAssignment_reviewerProfileId_fkey" FOREIGN KEY ("reviewerProfileId") REFERENCES "ReviewerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CurriculumReviewAssignment" ADD CONSTRAINT "CurriculumReviewAssignment_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "ReviewerCredential"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CurriculumReviewAssignment" ADD CONSTRAINT "CurriculumReviewAssignment_credentialScopeId_fkey" FOREIGN KEY ("credentialScopeId") REFERENCES "ReviewerCredentialScope"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CurriculumReviewAssignment" ADD CONSTRAINT "CurriculumReviewAssignment_credential_profile_fkey" FOREIGN KEY ("credentialId", "reviewerProfileId") REFERENCES "ReviewerCredential"("id", "reviewerProfileId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CurriculumReviewAssignment" ADD CONSTRAINT "CurriculumReviewAssignment_scope_credential_fkey" FOREIGN KEY ("credentialScopeId", "credentialId") REFERENCES "ReviewerCredentialScope"("id", "credentialId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CurriculumReviewAssessment" ADD CONSTRAINT "CurriculumReviewAssessment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "CurriculumReviewTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CurriculumReviewAssessment" ADD CONSTRAINT "CurriculumReviewAssessment_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "CurriculumReviewAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CurriculumReviewAssessment" ADD CONSTRAINT "CurriculumReviewAssessment_reviewerProfileId_fkey" FOREIGN KEY ("reviewerProfileId") REFERENCES "ReviewerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CurriculumReviewAssessment" ADD CONSTRAINT "CurriculumReviewAssessment_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "ReviewerCredential"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CurriculumReviewAssessment" ADD CONSTRAINT "CurriculumReviewAssessment_credentialScopeId_fkey" FOREIGN KEY ("credentialScopeId") REFERENCES "ReviewerCredentialScope"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CurriculumReviewAssessment" ADD CONSTRAINT "CurriculumReviewAssessment_credential_profile_fkey" FOREIGN KEY ("credentialId", "reviewerProfileId") REFERENCES "ReviewerCredential"("id", "reviewerProfileId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CurriculumReviewAssessment" ADD CONSTRAINT "CurriculumReviewAssessment_scope_credential_fkey" FOREIGN KEY ("credentialScopeId", "credentialId") REFERENCES "ReviewerCredentialScope"("id", "credentialId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CurriculumReviewDecision" ADD CONSTRAINT "CurriculumReviewDecision_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "CurriculumReviewTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CurriculumReviewDecision" ADD CONSTRAINT "CurriculumReviewDecision_resolverAssessmentId_fkey" FOREIGN KEY ("resolverAssessmentId") REFERENCES "CurriculumReviewAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CurriculumReviewDecision" ADD CONSTRAINT "CurriculumReviewDecision_resolverUserId_fkey" FOREIGN KEY ("resolverUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CurriculumReviewDecision" ADD CONSTRAINT "CurriculumReviewDecision_governanceEventId_fkey" FOREIGN KEY ("governanceEventId") REFERENCES "CurriculumGovernanceEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CurriculumReviewDecision" ADD CONSTRAINT "CurriculumReviewDecision_auditLogId_fkey" FOREIGN KEY ("auditLogId") REFERENCES "AuditLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewCalibrationSession" ADD CONSTRAINT "ReviewCalibrationSession_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "CurriculumContentRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewCalibrationSession" ADD CONSTRAINT "ReviewCalibrationSession_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewCalibrationResult" ADD CONSTRAINT "ReviewCalibrationResult_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ReviewCalibrationSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewCalibrationResult" ADD CONSTRAINT "ReviewCalibrationResult_reviewerProfileId_fkey" FOREIGN KEY ("reviewerProfileId") REFERENCES "ReviewerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION p2b_reject_update_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'P2-B immutable row cannot be changed: %', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "ReviewerCredentialStatusEvent_immutable" BEFORE UPDATE OR DELETE ON "ReviewerCredentialStatusEvent" FOR EACH ROW EXECUTE FUNCTION p2b_reject_update_delete();
CREATE TRIGGER "ReviewCalibrationResult_immutable" BEFORE UPDATE OR DELETE ON "ReviewCalibrationResult" FOR EACH ROW EXECUTE FUNCTION p2b_reject_update_delete();

CREATE OR REPLACE FUNCTION p2b_assessment_immutable_after_submit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."status" = 'SUBMITTED' THEN
    RAISE EXCEPTION 'submitted assessment is immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "CurriculumReviewAssessment_submitted_immutable" BEFORE UPDATE OR DELETE ON "CurriculumReviewAssessment" FOR EACH ROW EXECUTE FUNCTION p2b_assessment_immutable_after_submit();

CREATE OR REPLACE FUNCTION p2b_decision_immutable_after_final() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."status" = 'FINAL' THEN
    RAISE EXCEPTION 'final review decision is immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "CurriculumReviewDecision_final_immutable" BEFORE UPDATE OR DELETE ON "CurriculumReviewDecision" FOR EACH ROW EXECUTE FUNCTION p2b_decision_immutable_after_final();

CREATE OR REPLACE FUNCTION p2b_credential_core_immutable_after_verified() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "ReviewerCredentialStatusEvent" e WHERE e."credentialId" = OLD."id" AND e."toStatus" = 'VERIFIED') AND
     (NEW."reviewerProfileId", NEW."credentialType", NEW."issuer", NEW."authority", NEW."validFrom", NEW."expiresAt", NEW."evidenceRef", NEW."supersedesCredentialId")
       IS DISTINCT FROM
     (OLD."reviewerProfileId", OLD."credentialType", OLD."issuer", OLD."authority", OLD."validFrom", OLD."expiresAt", OLD."evidenceRef", OLD."supersedesCredentialId") THEN
    RAISE EXCEPTION 'verified credential core is immutable; supersede it' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "ReviewerCredential_verified_core_immutable" BEFORE UPDATE ON "ReviewerCredential" FOR EACH ROW EXECUTE FUNCTION p2b_credential_core_immutable_after_verified();

CREATE OR REPLACE FUNCTION p2b_credential_scope_immutable_after_verified() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_credential TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_credential := OLD."credentialId";
  ELSE
    target_credential := NEW."credentialId";
  END IF;
  IF EXISTS (SELECT 1 FROM "ReviewerCredentialStatusEvent" e WHERE e."credentialId" = target_credential AND e."toStatus" = 'VERIFIED') THEN
    RAISE EXCEPTION 'verified credential scope is immutable; supersede it' USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "ReviewerCredentialScope_verified_immutable" BEFORE INSERT OR UPDATE OR DELETE ON "ReviewerCredentialScope" FOR EACH ROW EXECUTE FUNCTION p2b_credential_scope_immutable_after_verified();

CREATE OR REPLACE FUNCTION p2b_verify_credential_transition() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE holder_user TEXT;
BEGIN
  IF NEW."status" = 'VERIFIED' AND OLD."status" <> 'VERIFIED' THEN
    SELECT "userId" INTO holder_user FROM "ReviewerProfile" WHERE "id" = NEW."reviewerProfileId";
    IF NEW."verifierUserId" IS NULL OR NEW."verifiedAt" IS NULL OR NEW."verifierUserId" = holder_user THEN
      RAISE EXCEPTION 'credential verification requires an independent verifier and timestamp' USING ERRCODE = '23514';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM "ReviewerCredentialScope" WHERE "credentialId" = NEW."id") THEN
      RAISE EXCEPTION 'credential verification requires at least one scope' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "ReviewerCredential_verify_guard" BEFORE UPDATE ON "ReviewerCredential" FOR EACH ROW EXECUTE FUNCTION p2b_verify_credential_transition();

CREATE OR REPLACE FUNCTION p2b_validate_final_decision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE event_revision TEXT; event_provenance TEXT; event_audit TEXT; task_revision TEXT; task_provenance TEXT;
BEGIN
  IF NEW."status" = 'FINAL' THEN
    SELECT "revisionId", "provenanceId", "auditLogId" INTO event_revision, event_provenance, event_audit
      FROM "CurriculumGovernanceEvent" WHERE "id" = NEW."governanceEventId";
    SELECT "revisionId", "provenanceId" INTO task_revision, task_provenance
      FROM "CurriculumReviewTask" WHERE "id" = NEW."taskId";
    IF event_revision IS NULL OR event_revision <> task_revision OR event_provenance <> task_provenance OR event_audit <> NEW."auditLogId" THEN
      RAISE EXCEPTION 'final decision, governance event, exact revision, and audit row must match' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "CurriculumReviewDecision_integrity_guard" BEFORE INSERT OR UPDATE ON "CurriculumReviewDecision" FOR EACH ROW EXECUTE FUNCTION p2b_validate_final_decision();
