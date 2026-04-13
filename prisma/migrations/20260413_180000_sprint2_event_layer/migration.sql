-- Sprint 2: Data architecture + immutable event layer
-- Additive tables only. Existing systems remain in place.

CREATE TABLE "DataPolicyAcceptance" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "schoolId" TEXT,
  "policyKey" TEXT NOT NULL,
  "policyVersion" TEXT NOT NULL,
  "source" TEXT,
  "locale" TEXT,
  "metadata" JSONB,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DataPolicyAcceptance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConsentRecord" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT,
  "userId" TEXT,
  "studentId" TEXT,
  "guardianId" TEXT,
  "consentType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'granted',
  "legalBasis" TEXT,
  "policyVersion" TEXT,
  "source" TEXT,
  "metadata" JSONB,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExportJobRequest" (
  "id" TEXT NOT NULL,
  "requestedByUserId" TEXT,
  "approvedByUserId" TEXT,
  "schoolId" TEXT,
  "scope" TEXT NOT NULL,
  "scopeId" TEXT,
  "exportType" TEXT NOT NULL,
  "format" TEXT NOT NULL DEFAULT 'csv',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "approvalStatus" TEXT NOT NULL DEFAULT 'pending',
  "filters" JSONB,
  "metadata" JSONB,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "downloadUrl" TEXT,
  "checksum" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ExportJobRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LearningEvent" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT,
  "districtId" TEXT,
  "classId" TEXT,
  "userId" TEXT,
  "studentId" TEXT,
  "actorType" TEXT,
  "actorId" TEXT,
  "actorRole" TEXT,
  "targetType" TEXT,
  "targetId" TEXT,
  "eventType" TEXT NOT NULL,
  "source" TEXT,
  "status" TEXT NOT NULL DEFAULT 'accepted',
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "originalOccurredAt" TIMESTAMP(3),
  "syncReceivedAt" TIMESTAMP(3),
  "clientEventId" TEXT,
  "dedupeKey" TEXT,
  "replayOfEventId" TEXT,
  "replaySequence" INTEGER,
  "isReplay" BOOLEAN NOT NULL DEFAULT false,
  "contentId" TEXT,
  "lessonId" TEXT,
  "unitId" TEXT,
  "termId" TEXT,
  "subject" TEXT,
  "grade" INTEGER,
  "curriculumVersion" TEXT,
  "promptVersion" TEXT,
  "assessmentVersion" TEXT,
  "calculationVersion" TEXT,
  "metadata" JSONB,
  "qualityMarkers" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LearningEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssessmentAttempt" (
  "id" TEXT NOT NULL,
  "assessmentId" TEXT,
  "assessmentItemId" TEXT,
  "studentId" TEXT,
  "userId" TEXT,
  "schoolId" TEXT,
  "classId" TEXT,
  "subject" TEXT,
  "grade" INTEGER,
  "attemptNumber" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'completed',
  "score" DOUBLE PRECISION,
  "maxScore" DOUBLE PRECISION,
  "rubricScore" DOUBLE PRECISION,
  "aiAssisted" BOOLEAN NOT NULL DEFAULT false,
  "rawResponse" JSONB,
  "evaluation" JSONB,
  "metadata" JSONB,
  "source" TEXT,
  "sourceEventId" TEXT,
  "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submittedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AssessmentAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Intervention" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "schoolId" TEXT,
  "districtId" TEXT,
  "studentId" TEXT,
  "teacherUserId" TEXT,
  "recommendationId" TEXT,
  "interventionType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "channel" TEXT,
  "priority" TEXT,
  "objective" TEXT,
  "details" JSONB,
  "outcome" JSONB,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Intervention_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MasterySnapshot" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "schoolId" TEXT,
  "subject" TEXT NOT NULL,
  "strandKey" TEXT,
  "sourceProfileId" TEXT,
  "sourceAttemptId" TEXT,
  "currentScore" DOUBLE PRECISION,
  "baselineScore" DOUBLE PRECISION,
  "proficiencyState" TEXT,
  "masteryState" TEXT,
  "sustainabilityIndex" DOUBLE PRECISION,
  "decayRate" DOUBLE PRECISION,
  "aiRelianceRate" DOUBLE PRECISION,
  "hybridScore" DOUBLE PRECISION,
  "growthDelta" DOUBLE PRECISION,
  "metadata" JSONB,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MasterySnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AIInteraction" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT,
  "userId" TEXT,
  "studentId" TEXT,
  "route" TEXT,
  "feature" TEXT,
  "requestType" TEXT,
  "guidanceLevel" TEXT,
  "subject" TEXT,
  "strandKey" TEXT,
  "contentId" TEXT,
  "lessonId" TEXT,
  "provider" TEXT,
  "model" TEXT,
  "tier" TEXT,
  "hadFallback" BOOLEAN NOT NULL DEFAULT false,
  "tokensUsed" INTEGER NOT NULL DEFAULT 0,
  "estimatedCostUSD" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "latencyMs" INTEGER,
  "promptVersion" TEXT,
  "contentVersion" TEXT,
  "assessmentVersion" TEXT,
  "calculationVersion" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AIInteraction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeacherAction" (
  "id" TEXT NOT NULL,
  "teacherUserId" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "classId" TEXT,
  "studentId" TEXT,
  "contentId" TEXT,
  "actionType" TEXT NOT NULL,
  "targetType" TEXT,
  "targetId" TEXT,
  "subject" TEXT,
  "metadata" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TeacherAction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DataPolicyAcceptance_policyKey_policyVersion_acceptedAt_idx"
  ON "DataPolicyAcceptance"("policyKey", "policyVersion", "acceptedAt");
CREATE INDEX "DataPolicyAcceptance_userId_acceptedAt_idx"
  ON "DataPolicyAcceptance"("userId", "acceptedAt");
CREATE INDEX "DataPolicyAcceptance_schoolId_acceptedAt_idx"
  ON "DataPolicyAcceptance"("schoolId", "acceptedAt");

CREATE INDEX "ConsentRecord_consentType_status_grantedAt_idx"
  ON "ConsentRecord"("consentType", "status", "grantedAt");
CREATE INDEX "ConsentRecord_schoolId_consentType_grantedAt_idx"
  ON "ConsentRecord"("schoolId", "consentType", "grantedAt");
CREATE INDEX "ConsentRecord_studentId_consentType_grantedAt_idx"
  ON "ConsentRecord"("studentId", "consentType", "grantedAt");
CREATE INDEX "ConsentRecord_guardianId_consentType_grantedAt_idx"
  ON "ConsentRecord"("guardianId", "consentType", "grantedAt");

CREATE INDEX "ExportJobRequest_status_requestedAt_idx"
  ON "ExportJobRequest"("status", "requestedAt");
CREATE INDEX "ExportJobRequest_approvalStatus_requestedAt_idx"
  ON "ExportJobRequest"("approvalStatus", "requestedAt");
CREATE INDEX "ExportJobRequest_exportType_requestedAt_idx"
  ON "ExportJobRequest"("exportType", "requestedAt");
CREATE INDEX "ExportJobRequest_requestedByUserId_requestedAt_idx"
  ON "ExportJobRequest"("requestedByUserId", "requestedAt");
CREATE INDEX "ExportJobRequest_schoolId_scope_requestedAt_idx"
  ON "ExportJobRequest"("schoolId", "scope", "requestedAt");

CREATE INDEX "LearningEvent_eventType_occurredAt_idx"
  ON "LearningEvent"("eventType", "occurredAt");
CREATE INDEX "LearningEvent_schoolId_occurredAt_idx"
  ON "LearningEvent"("schoolId", "occurredAt");
CREATE INDEX "LearningEvent_studentId_occurredAt_idx"
  ON "LearningEvent"("studentId", "occurredAt");
CREATE INDEX "LearningEvent_userId_occurredAt_idx"
  ON "LearningEvent"("userId", "occurredAt");
CREATE INDEX "LearningEvent_contentId_occurredAt_idx"
  ON "LearningEvent"("contentId", "occurredAt");
CREATE INDEX "LearningEvent_clientEventId_eventType_idx"
  ON "LearningEvent"("clientEventId", "eventType");
CREATE INDEX "LearningEvent_dedupeKey_idx"
  ON "LearningEvent"("dedupeKey");

CREATE INDEX "AssessmentAttempt_assessmentId_attemptedAt_idx"
  ON "AssessmentAttempt"("assessmentId", "attemptedAt");
CREATE INDEX "AssessmentAttempt_studentId_attemptedAt_idx"
  ON "AssessmentAttempt"("studentId", "attemptedAt");
CREATE INDEX "AssessmentAttempt_schoolId_subject_attemptedAt_idx"
  ON "AssessmentAttempt"("schoolId", "subject", "attemptedAt");
CREATE INDEX "AssessmentAttempt_sourceEventId_idx"
  ON "AssessmentAttempt"("sourceEventId");

CREATE INDEX "Intervention_studentId_openedAt_idx"
  ON "Intervention"("studentId", "openedAt");
CREATE INDEX "Intervention_schoolId_status_openedAt_idx"
  ON "Intervention"("schoolId", "status", "openedAt");
CREATE INDEX "Intervention_tenantId_openedAt_idx"
  ON "Intervention"("tenantId", "openedAt");
CREATE INDEX "Intervention_recommendationId_idx"
  ON "Intervention"("recommendationId");

CREATE INDEX "MasterySnapshot_studentId_capturedAt_idx"
  ON "MasterySnapshot"("studentId", "capturedAt");
CREATE INDEX "MasterySnapshot_schoolId_subject_capturedAt_idx"
  ON "MasterySnapshot"("schoolId", "subject", "capturedAt");
CREATE INDEX "MasterySnapshot_sourceProfileId_idx"
  ON "MasterySnapshot"("sourceProfileId");
CREATE INDEX "MasterySnapshot_sourceAttemptId_idx"
  ON "MasterySnapshot"("sourceAttemptId");

CREATE INDEX "AIInteraction_createdAt_idx"
  ON "AIInteraction"("createdAt");
CREATE INDEX "AIInteraction_schoolId_createdAt_idx"
  ON "AIInteraction"("schoolId", "createdAt");
CREATE INDEX "AIInteraction_userId_createdAt_idx"
  ON "AIInteraction"("userId", "createdAt");
CREATE INDEX "AIInteraction_feature_createdAt_idx"
  ON "AIInteraction"("feature", "createdAt");
CREATE INDEX "AIInteraction_subject_strandKey_createdAt_idx"
  ON "AIInteraction"("subject", "strandKey", "createdAt");

CREATE INDEX "TeacherAction_teacherUserId_occurredAt_idx"
  ON "TeacherAction"("teacherUserId", "occurredAt");
CREATE INDEX "TeacherAction_schoolId_actionType_occurredAt_idx"
  ON "TeacherAction"("schoolId", "actionType", "occurredAt");
CREATE INDEX "TeacherAction_studentId_occurredAt_idx"
  ON "TeacherAction"("studentId", "occurredAt");
CREATE INDEX "TeacherAction_contentId_occurredAt_idx"
  ON "TeacherAction"("contentId", "occurredAt");
