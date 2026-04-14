-- Sprint 3: Intervention chains + derived intelligence + misconceptions
-- Additive schema changes only. Raw source tables remain intact.

ALTER TABLE "AssessmentAttempt"
  ADD COLUMN "chainId" TEXT;

ALTER TABLE "Intervention"
  ADD COLUMN "chainId" TEXT,
  ADD COLUMN "chainStage" TEXT,
  ADD COLUMN "sourceEventId" TEXT,
  ADD COLUMN "attributionSource" TEXT,
  ADD COLUMN "openedByUserId" TEXT,
  ADD COLUMN "closedByUserId" TEXT,
  ADD COLUMN "sourceAttemptId" TEXT;

ALTER TABLE "MasterySnapshot"
  ADD COLUMN "previousSnapshotId" TEXT,
  ADD COLUMN "snapshotType" TEXT NOT NULL DEFAULT 'progress_refresh',
  ADD COLUMN "sourceEventId" TEXT;

CREATE TABLE "DerivedStudentProgress" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "schoolId" TEXT,
  "subject" TEXT NOT NULL,
  "strandKey" TEXT,
  "sourceProfileId" TEXT,
  "sourceAttemptId" TEXT,
  "sourceSnapshotId" TEXT,
  "sourceChainId" TEXT,
  "derivationType" TEXT NOT NULL DEFAULT 'mastery_refresh',
  "progressVersion" TEXT,
  "currentScore" DOUBLE PRECISION,
  "baselineScore" DOUBLE PRECISION,
  "growthDelta" DOUBLE PRECISION,
  "hybridScore" DOUBLE PRECISION,
  "sustainabilityIndex" DOUBLE PRECISION,
  "decayRate" DOUBLE PRECISION,
  "aiRelianceRate" DOUBLE PRECISION,
  "proficiencyState" TEXT,
  "masteryState" TEXT,
  "misconceptionCount" INTEGER NOT NULL DEFAULT 0,
  "openInterventionChainCount" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "derivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DerivedStudentProgress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InterventionChain" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "schoolId" TEXT,
  "districtId" TEXT,
  "studentId" TEXT,
  "teacherUserId" TEXT,
  "openedByUserId" TEXT,
  "openedByRole" TEXT,
  "attributionSource" TEXT,
  "status" TEXT NOT NULL DEFAULT 'open',
  "currentStage" TEXT NOT NULL DEFAULT 'baseline',
  "rationale" TEXT,
  "sourceAssessmentAttemptId" TEXT,
  "baselineSnapshotId" TEXT,
  "latestInterventionId" TEXT,
  "metadata" JSONB,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "interventionStartedAt" TIMESTAMP(3),
  "outcomeMeasuredAt" TIMESTAMP(3),
  "retentionCheckedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InterventionChain_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MisconceptionCategory" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT,
  "subject" TEXT,
  "strandKey" TEXT,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "severity" TEXT,
  "examples" JSONB,
  "guidance" JSONB,
  "createdByUserId" TEXT,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MisconceptionCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MisconceptionTag" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "schoolId" TEXT,
  "assessmentAttemptId" TEXT,
  "interventionId" TEXT,
  "chainId" TEXT,
  "categoryId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "origin" TEXT NOT NULL DEFAULT 'assessment_evaluation',
  "confidence" DOUBLE PRECISION,
  "evidence" JSONB,
  "teacherNote" TEXT,
  "taggedByUserId" TEXT,
  "sourceEventId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MisconceptionTag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MisconceptionCategory_schoolId_code_key"
  ON "MisconceptionCategory"("schoolId", "code");

CREATE INDEX "AssessmentAttempt_chainId_attemptedAt_idx"
  ON "AssessmentAttempt"("chainId", "attemptedAt");

CREATE INDEX "Intervention_chainId_openedAt_idx"
  ON "Intervention"("chainId", "openedAt");
CREATE INDEX "Intervention_sourceAttemptId_idx"
  ON "Intervention"("sourceAttemptId");

CREATE INDEX "MasterySnapshot_studentId_subject_strandKey_capturedAt_idx"
  ON "MasterySnapshot"("studentId", "subject", "strandKey", "capturedAt");
CREATE INDEX "MasterySnapshot_previousSnapshotId_idx"
  ON "MasterySnapshot"("previousSnapshotId");
CREATE INDEX "MasterySnapshot_sourceEventId_idx"
  ON "MasterySnapshot"("sourceEventId");

CREATE INDEX "DerivedStudentProgress_studentId_derivedAt_idx"
  ON "DerivedStudentProgress"("studentId", "derivedAt");
CREATE INDEX "DerivedStudentProgress_studentId_subject_strandKey_derivedAt_idx"
  ON "DerivedStudentProgress"("studentId", "subject", "strandKey", "derivedAt");
CREATE INDEX "DerivedStudentProgress_schoolId_subject_derivedAt_idx"
  ON "DerivedStudentProgress"("schoolId", "subject", "derivedAt");
CREATE INDEX "DerivedStudentProgress_sourceSnapshotId_idx"
  ON "DerivedStudentProgress"("sourceSnapshotId");
CREATE INDEX "DerivedStudentProgress_sourceChainId_derivedAt_idx"
  ON "DerivedStudentProgress"("sourceChainId", "derivedAt");

CREATE INDEX "InterventionChain_studentId_status_openedAt_idx"
  ON "InterventionChain"("studentId", "status", "openedAt");
CREATE INDEX "InterventionChain_schoolId_status_currentStage_openedAt_idx"
  ON "InterventionChain"("schoolId", "status", "currentStage", "openedAt");
CREATE INDEX "InterventionChain_teacherUserId_status_openedAt_idx"
  ON "InterventionChain"("teacherUserId", "status", "openedAt");
CREATE INDEX "InterventionChain_sourceAssessmentAttemptId_idx"
  ON "InterventionChain"("sourceAssessmentAttemptId");

CREATE INDEX "MisconceptionCategory_subject_strandKey_isActive_idx"
  ON "MisconceptionCategory"("subject", "strandKey", "isActive");
CREATE INDEX "MisconceptionCategory_createdByUserId_createdAt_idx"
  ON "MisconceptionCategory"("createdByUserId", "createdAt");

CREATE INDEX "MisconceptionTag_studentId_createdAt_idx"
  ON "MisconceptionTag"("studentId", "createdAt");
CREATE INDEX "MisconceptionTag_categoryId_createdAt_idx"
  ON "MisconceptionTag"("categoryId", "createdAt");
CREATE INDEX "MisconceptionTag_assessmentAttemptId_createdAt_idx"
  ON "MisconceptionTag"("assessmentAttemptId", "createdAt");
CREATE INDEX "MisconceptionTag_chainId_createdAt_idx"
  ON "MisconceptionTag"("chainId", "createdAt");
