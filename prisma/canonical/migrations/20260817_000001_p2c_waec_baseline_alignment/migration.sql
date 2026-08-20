-- CreateEnum
CREATE TYPE "CurriculumAuthorityType" AS ENUM ('LIBERIA_MOE', 'WAEC_LIBERIA', 'WAEC_REGIONAL', 'GOVERNMENT', 'OTHER_VERIFIED');


-- CreateEnum
CREATE TYPE "CurriculumAuthoritySourceType" AS ENUM ('WEB_PAGE', 'PDF', 'ZIP_ARCHIVE', 'REGULATION', 'SYLLABUS', 'EXAM_FRAMEWORK', 'EXAMINER_REPORT', 'OTHER');


-- CreateEnum
CREATE TYPE "CurriculumAuthoritySourceStatus" AS ENUM ('ACTIVE', 'SUPERSEDED', 'WITHDRAWN', 'UNAVAILABLE');


-- CreateEnum
CREATE TYPE "CurriculumRightsStatus" AS ENUM ('PUBLIC_DOMAIN', 'OPEN_LICENSE', 'PERMISSION_GRANTED', 'LICENSED', 'REFERENCE_ONLY', 'RIGHTS_UNKNOWN', 'PROHIBITED', 'EXPIRED', 'REVOKED');


-- CreateEnum
CREATE TYPE "CurriculumPermittedAction" AS ENUM ('CITATION', 'METADATA', 'INTERNAL_ANALYSIS', 'AI_ANALYSIS', 'STORAGE', 'LEARNER_DISPLAY', 'REPRODUCTION', 'OFFLINE_DISTRIBUTION', 'TRANSFORMATION');


-- CreateEnum
CREATE TYPE "CurriculumExtractionMethod" AS ENUM ('MANUAL', 'STRUCTURED_IMPORT', 'AI_ASSISTED');


-- CreateEnum
CREATE TYPE "CurriculumVerificationStatus" AS ENUM ('VERIFIED', 'PARTIAL', 'UNVERIFIED', 'STALE', 'SOURCE_MISSING', 'RIGHTS_LIMITED');


-- CreateEnum
CREATE TYPE "AssessmentFrameworkKind" AS ENUM ('BASELINE', 'BENCHMARK');


-- CreateEnum
CREATE TYPE "ExternalAuthorityStatus" AS ENUM ('NOT_CLAIMED', 'VERIFIED_AUTHORIZATION');


-- CreateEnum
CREATE TYPE "BaselineCompetencyCriticality" AS ENUM ('CRITICAL', 'HIGH', 'STANDARD', 'OPTIONAL');


-- CreateEnum
CREATE TYPE "CurriculumTargetLevel" AS ENUM ('MASTERY', 'EXTENSION');


-- CreateEnum
CREATE TYPE "CognitiveDemandCategory" AS ENUM ('RECALL', 'COMPREHENSION', 'PROCEDURAL_FLUENCY', 'APPLICATION', 'ANALYSIS', 'REASONING', 'EVALUATION', 'CREATION', 'TRANSFER', 'PROBLEM_MODELING');


-- CreateEnum
CREATE TYPE "CurriculumAlignmentRelationship" AS ENUM ('DIRECT', 'SUPPORTING', 'PREREQUISITE', 'PARTIAL', 'ENRICHMENT', 'NOT_ALIGNED', 'UNKNOWN');


-- CreateEnum
CREATE TYPE "CurriculumDepthRelation" AS ENUM ('BELOW_BASELINE', 'MEETS_BASELINE', 'ABOVE_BASELINE', 'SIGNIFICANTLY_ABOVE_BASELINE', 'NOT_COMPARABLE', 'UNKNOWN');


-- CreateEnum
CREATE TYPE "CurriculumAlignmentStatus" AS ENUM ('DRAFT', 'AI_ASSESSED', 'PLATFORM_REVIEWED', 'STALE', 'REJECTED', 'SUPERSEDED');


-- CreateEnum
CREATE TYPE "CurriculumCoverageDegree" AS ENUM ('NONE', 'PARTIAL', 'FULL');


-- CreateEnum
CREATE TYPE "CurriculumCoverageStatus" AS ENUM ('COMPLETE_ABOVE_BASELINE', 'COMPLETE_AT_BASELINE', 'PARTIAL', 'BELOW_BASELINE', 'NOT_APPLICABLE', 'UNKNOWN');


-- CreateEnum
CREATE TYPE "AlignmentValidityStatus" AS ENUM ('ACTIVE', 'STALE', 'SUPERSEDED');


-- CreateEnum
CREATE TYPE "ExamPreparationContentOrigin" AS ENUM ('LIBERIALEARN_GENERATED_EXAM_STYLE', 'LICENSED_EXTERNAL');


-- CreateEnum
CREATE TYPE "PolicyScope" AS ENUM ('NATIONAL', 'DISTRICT', 'SCHOOL');


-- CreateTable
CREATE TABLE "CurriculumAuthoritySource" (
    "id" TEXT NOT NULL,
    "authorityType" "CurriculumAuthorityType" NOT NULL,
    "authorityName" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceType" "CurriculumAuthoritySourceType" NOT NULL,
    "canonicalUrl" TEXT NOT NULL,
    "publisher" TEXT NOT NULL,
    "publicationDate" TIMESTAMP(3),
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "retrievedAt" TIMESTAMP(3) NOT NULL,
    "currentVersionId" TEXT,
    "status" "CurriculumAuthoritySourceStatus" NOT NULL DEFAULT 'ACTIVE',
    "subject" TEXT,
    "gradeMin" INTEGER,
    "gradeMax" INTEGER,
    "exam" TEXT,
    "rightsStatus" "CurriculumRightsStatus" NOT NULL DEFAULT 'RIGHTS_UNKNOWN',
    "permittedActions" "CurriculumPermittedAction"[] DEFAULT ARRAY[]::"CurriculumPermittedAction"[],
    "rightsBasis" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurriculumAuthoritySource_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "CurriculumAuthoritySourceVersion" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "versionLabel" TEXT NOT NULL,
    "retrievedAt" TIMESTAMP(3) NOT NULL,
    "contentHash" VARCHAR(64) NOT NULL,
    "evidenceLocator" TEXT,
    "extractionMethod" "CurriculumExtractionMethod" NOT NULL,
    "verificationStatus" "CurriculumVerificationStatus" NOT NULL,
    "changeSummary" JSONB,
    "supersedesVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CurriculumAuthoritySourceVersion_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "MoeCurriculumObjective" (
    "id" TEXT NOT NULL,
    "sourceVersionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "topic" TEXT,
    "authoritativeWording" TEXT NOT NULL,
    "normalizedWording" TEXT,
    "expectedCompetency" TEXT,
    "evidenceLocator" TEXT NOT NULL,
    "extractionMethod" "CurriculumExtractionMethod" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "verificationStatus" "CurriculumVerificationStatus" NOT NULL,
    "criticality" "BaselineCompetencyCriticality" NOT NULL DEFAULT 'STANDARD',
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoeCurriculumObjective_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "AssessmentBaselineFramework" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "authority" "CurriculumAuthorityType" NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "exam" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "kind" "AssessmentFrameworkKind" NOT NULL DEFAULT 'BASELINE',
    "title" TEXT NOT NULL,
    "sourceVersionId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "verificationStatus" "CurriculumVerificationStatus" NOT NULL,
    "externalAuthorityStatus" "ExternalAuthorityStatus" NOT NULL DEFAULT 'NOT_CLAIMED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentBaselineFramework_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "AssessmentBaselineSubject" (
    "id" TEXT NOT NULL,
    "frameworkId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gradeMin" INTEGER NOT NULL,
    "gradeMax" INTEGER NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "subjectGroup" TEXT,
    "officialSubjectCode" TEXT,
    "componentSummary" JSONB,
    "gradingSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentBaselineSubject_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "AssessmentBaselineCompetency" (
    "id" TEXT NOT NULL,
    "baselineSubjectId" TEXT NOT NULL,
    "sourceVersionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "expectation" TEXT NOT NULL,
    "assessmentDepth" "CognitiveDemandCategory" NOT NULL,
    "cognitiveDimensions" "CognitiveDemandCategory"[] DEFAULT ARRAY[]::"CognitiveDemandCategory"[],
    "officialWeight" DOUBLE PRECISION,
    "weightEvidenceLocator" TEXT,
    "criticality" "BaselineCompetencyCriticality" NOT NULL DEFAULT 'STANDARD',
    "evidenceLocator" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "verificationStatus" "CurriculumVerificationStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentBaselineCompetency_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "CurriculumBaselineAlignment" (
    "id" TEXT NOT NULL,
    "moeObjectiveId" TEXT NOT NULL,
    "baselineCompetencyId" TEXT NOT NULL,
    "relationshipType" "CurriculumAlignmentRelationship" NOT NULL,
    "coverage" "CurriculumCoverageDegree" NOT NULL,
    "depthRelation" "CurriculumDepthRelation" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "rationale" TEXT NOT NULL,
    "evidenceRefs" JSONB NOT NULL,
    "actor" TEXT NOT NULL,
    "reviewMethod" TEXT NOT NULL,
    "taxonomyVersion" TEXT NOT NULL,
    "status" "CurriculumAlignmentStatus" NOT NULL DEFAULT 'DRAFT',
    "authorityClaim" "ExternalAuthorityStatus" NOT NULL DEFAULT 'NOT_CLAIMED',
    "reviewTaskId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "supersedesAlignmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CurriculumBaselineAlignment_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "CurriculumAlignmentValidityEvent" (
    "id" TEXT NOT NULL,
    "alignmentId" TEXT NOT NULL,
    "sourceVersionId" TEXT NOT NULL,
    "status" "AlignmentValidityStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "impactedCourseRefs" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CurriculumAlignmentValidityEvent_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "CurriculumLearningTarget" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "targetLevel" "CurriculumTargetLevel" NOT NULL,
    "statement" TEXT NOT NULL,
    "minimumDepth" "CognitiveDemandCategory" NOT NULL,
    "cognitiveDimensions" "CognitiveDemandCategory"[] DEFAULT ARRAY[]::"CognitiveDemandCategory"[],
    "moeObjectiveId" TEXT,
    "baselineCompetencyId" TEXT,
    "curriculumRevisionId" TEXT,
    "prerequisiteRefs" JSONB,
    "misconceptionRefs" JSONB,
    "evidenceRefs" JSONB NOT NULL,
    "platformVersion" TEXT NOT NULL,
    "verificationStatus" "CurriculumVerificationStatus" NOT NULL,
    "reviewTaskId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "supersedesTargetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CurriculumLearningTarget_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "CurriculumCompetencyCoverage" (
    "id" TEXT NOT NULL,
    "curriculumRevisionId" TEXT NOT NULL,
    "moeObjectiveId" TEXT,
    "baselineCompetencyId" TEXT,
    "learningTargetId" TEXT,
    "coverage" "CurriculumCoverageDegree" NOT NULL,
    "depthRelation" "CurriculumDepthRelation" NOT NULL,
    "cognitiveDimensions" "CognitiveDemandCategory"[] DEFAULT ARRAY[]::"CognitiveDemandCategory"[],
    "confidence" DOUBLE PRECISION NOT NULL,
    "rationale" TEXT NOT NULL,
    "evidenceRefs" JSONB NOT NULL,
    "reviewMethod" TEXT NOT NULL,
    "status" "CurriculumAlignmentStatus" NOT NULL DEFAULT 'DRAFT',
    "authorityClaim" "ExternalAuthorityStatus" NOT NULL DEFAULT 'NOT_CLAIMED',
    "reviewTaskId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "supersedesCoverageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CurriculumCompetencyCoverage_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "ExamPreparationProfile" (
    "id" TEXT NOT NULL,
    "baselineSubjectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'LiberiaLearn WAEC Preparation',
    "grade" INTEGER NOT NULL,
    "courseRef" TEXT,
    "competencyCoverageRefs" JSONB NOT NULL,
    "prerequisiteSkillRefs" JSONB,
    "revisionSequence" JSONB NOT NULL,
    "readinessRules" JSONB NOT NULL,
    "timedPracticeRules" JSONB,
    "examModeToolPolicy" JSONB,
    "masteryThresholds" JSONB NOT NULL,
    "remediationPriorities" JSONB,
    "contentOrigin" "ExamPreparationContentOrigin" NOT NULL DEFAULT 'LIBERIALEARN_GENERATED_EXAM_STYLE',
    "externalAuthorityStatus" "ExternalAuthorityStatus" NOT NULL DEFAULT 'NOT_CLAIMED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "supersedesProfileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamPreparationProfile_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "PolicyConfig" (
    "id" TEXT NOT NULL,
    "policyKey" TEXT NOT NULL,
    "scope" "PolicyScope" NOT NULL,
    "districtId" TEXT,
    "schoolId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolicyConfig_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "PolicyOverride" (
    "id" TEXT NOT NULL,
    "policyKey" TEXT NOT NULL,
    "policyId" TEXT,
    "districtId" TEXT,
    "schoolId" TEXT,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "reason" TEXT NOT NULL,
    "overrideData" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyOverride_pkey" PRIMARY KEY ("id")
);


-- CreateIndex
CREATE UNIQUE INDEX "CurriculumAuthoritySource_currentVersionId_key" ON "CurriculumAuthoritySource"("currentVersionId");


-- CreateIndex
CREATE INDEX "CurriculumAuthoritySource_authorityType_jurisdiction_status_idx" ON "CurriculumAuthoritySource"("authorityType", "jurisdiction", "status");


-- CreateIndex
CREATE INDEX "CurriculumAuthoritySource_exam_subject_gradeMin_gradeMax_idx" ON "CurriculumAuthoritySource"("exam", "subject", "gradeMin", "gradeMax");


-- CreateIndex
CREATE INDEX "CurriculumAuthoritySource_rightsStatus_status_idx" ON "CurriculumAuthoritySource"("rightsStatus", "status");


-- CreateIndex
CREATE UNIQUE INDEX "CurriculumAuthoritySource_authorityType_jurisdiction_canoni_key" ON "CurriculumAuthoritySource"("authorityType", "jurisdiction", "canonicalUrl");


-- CreateIndex
CREATE UNIQUE INDEX "CurriculumAuthoritySourceVersion_supersedesVersionId_key" ON "CurriculumAuthoritySourceVersion"("supersedesVersionId");


-- CreateIndex
CREATE INDEX "CurriculumAuthoritySourceVersion_sourceId_retrievedAt_idx" ON "CurriculumAuthoritySourceVersion"("sourceId", "retrievedAt");


-- CreateIndex
CREATE INDEX "CurriculumAuthoritySourceVersion_verificationStatus_retriev_idx" ON "CurriculumAuthoritySourceVersion"("verificationStatus", "retrievedAt");


-- CreateIndex
CREATE UNIQUE INDEX "CurriculumAuthoritySourceVersion_sourceId_versionLabel_key" ON "CurriculumAuthoritySourceVersion"("sourceId", "versionLabel");


-- CreateIndex
CREATE UNIQUE INDEX "CurriculumAuthoritySourceVersion_sourceId_contentHash_key" ON "CurriculumAuthoritySourceVersion"("sourceId", "contentHash");


-- CreateIndex
CREATE UNIQUE INDEX "MoeCurriculumObjective_code_key" ON "MoeCurriculumObjective"("code");


-- CreateIndex
CREATE INDEX "MoeCurriculumObjective_grade_subject_domain_idx" ON "MoeCurriculumObjective"("grade", "subject", "domain");


-- CreateIndex
CREATE INDEX "MoeCurriculumObjective_sourceVersionId_verificationStatus_idx" ON "MoeCurriculumObjective"("sourceVersionId", "verificationStatus");


-- CreateIndex
CREATE UNIQUE INDEX "AssessmentBaselineFramework_code_key" ON "AssessmentBaselineFramework"("code");


-- CreateIndex
CREATE INDEX "AssessmentBaselineFramework_authority_jurisdiction_exam_kin_idx" ON "AssessmentBaselineFramework"("authority", "jurisdiction", "exam", "kind");


-- CreateIndex
CREATE INDEX "AssessmentBaselineFramework_sourceVersionId_verificationSta_idx" ON "AssessmentBaselineFramework"("sourceVersionId", "verificationStatus");


-- CreateIndex
CREATE INDEX "AssessmentBaselineSubject_name_gradeMin_gradeMax_idx" ON "AssessmentBaselineSubject"("name", "gradeMin", "gradeMax");


-- CreateIndex
CREATE UNIQUE INDEX "AssessmentBaselineSubject_frameworkId_code_key" ON "AssessmentBaselineSubject"("frameworkId", "code");


-- CreateIndex
CREATE UNIQUE INDEX "AssessmentBaselineCompetency_code_key" ON "AssessmentBaselineCompetency"("code");


-- CreateIndex
CREATE INDEX "AssessmentBaselineCompetency_baselineSubjectId_domain_criti_idx" ON "AssessmentBaselineCompetency"("baselineSubjectId", "domain", "criticality");


-- CreateIndex
CREATE INDEX "AssessmentBaselineCompetency_sourceVersionId_verificationSt_idx" ON "AssessmentBaselineCompetency"("sourceVersionId", "verificationStatus");


-- CreateIndex
CREATE UNIQUE INDEX "CurriculumBaselineAlignment_supersedesAlignmentId_key" ON "CurriculumBaselineAlignment"("supersedesAlignmentId");


-- CreateIndex
CREATE INDEX "CurriculumBaselineAlignment_baselineCompetencyId_status_dep_idx" ON "CurriculumBaselineAlignment"("baselineCompetencyId", "status", "depthRelation");


-- CreateIndex
CREATE INDEX "CurriculumBaselineAlignment_moeObjectiveId_status_idx" ON "CurriculumBaselineAlignment"("moeObjectiveId", "status");


-- CreateIndex
CREATE INDEX "CurriculumBaselineAlignment_reviewTaskId_idx" ON "CurriculumBaselineAlignment"("reviewTaskId");


-- CreateIndex
CREATE UNIQUE INDEX "CurriculumBaselineAlignment_moeObjectiveId_baselineCompeten_key" ON "CurriculumBaselineAlignment"("moeObjectiveId", "baselineCompetencyId", "version");


-- CreateIndex
CREATE INDEX "CurriculumAlignmentValidityEvent_alignmentId_createdAt_idx" ON "CurriculumAlignmentValidityEvent"("alignmentId", "createdAt");


-- CreateIndex
CREATE INDEX "CurriculumAlignmentValidityEvent_sourceVersionId_status_idx" ON "CurriculumAlignmentValidityEvent"("sourceVersionId", "status");


-- CreateIndex
CREATE UNIQUE INDEX "CurriculumLearningTarget_supersedesTargetId_key" ON "CurriculumLearningTarget"("supersedesTargetId");


-- CreateIndex
CREATE INDEX "CurriculumLearningTarget_grade_subject_targetLevel_idx" ON "CurriculumLearningTarget"("grade", "subject", "targetLevel");


-- CreateIndex
CREATE INDEX "CurriculumLearningTarget_baselineCompetencyId_targetLevel_idx" ON "CurriculumLearningTarget"("baselineCompetencyId", "targetLevel");


-- CreateIndex
CREATE INDEX "CurriculumLearningTarget_curriculumRevisionId_idx" ON "CurriculumLearningTarget"("curriculumRevisionId");


-- CreateIndex
CREATE UNIQUE INDEX "CurriculumLearningTarget_code_version_key" ON "CurriculumLearningTarget"("code", "version");


-- CreateIndex
CREATE UNIQUE INDEX "CurriculumCompetencyCoverage_supersedesCoverageId_key" ON "CurriculumCompetencyCoverage"("supersedesCoverageId");


-- CreateIndex
CREATE INDEX "CurriculumCompetencyCoverage_curriculumRevisionId_status_idx" ON "CurriculumCompetencyCoverage"("curriculumRevisionId", "status");


-- CreateIndex
CREATE INDEX "CurriculumCompetencyCoverage_baselineCompetencyId_coverage__idx" ON "CurriculumCompetencyCoverage"("baselineCompetencyId", "coverage", "depthRelation");


-- CreateIndex
CREATE INDEX "CurriculumCompetencyCoverage_moeObjectiveId_coverage_idx" ON "CurriculumCompetencyCoverage"("moeObjectiveId", "coverage");


-- CreateIndex
CREATE INDEX "CurriculumCompetencyCoverage_learningTargetId_coverage_idx" ON "CurriculumCompetencyCoverage"("learningTargetId", "coverage");


-- CreateIndex
CREATE UNIQUE INDEX "ExamPreparationProfile_supersedesProfileId_key" ON "ExamPreparationProfile"("supersedesProfileId");


-- CreateIndex
CREATE INDEX "ExamPreparationProfile_baselineSubjectId_grade_idx" ON "ExamPreparationProfile"("baselineSubjectId", "grade");


-- CreateIndex
CREATE UNIQUE INDEX "ExamPreparationProfile_code_version_key" ON "ExamPreparationProfile"("code", "version");


-- CreateIndex
CREATE INDEX "PolicyConfig_policyKey_scope_isActive_idx" ON "PolicyConfig"("policyKey", "scope", "isActive");


-- CreateIndex
CREATE INDEX "PolicyConfig_districtId_schoolId_idx" ON "PolicyConfig"("districtId", "schoolId");


-- CreateIndex
CREATE INDEX "PolicyOverride_policyKey_districtId_schoolId_idx" ON "PolicyOverride"("policyKey", "districtId", "schoolId");


-- CreateIndex
CREATE INDEX "PolicyOverride_targetType_targetId_idx" ON "PolicyOverride"("targetType", "targetId");


-- AddForeignKey
ALTER TABLE "CurriculumAuthoritySource" ADD CONSTRAINT "CurriculumAuthoritySource_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "CurriculumAuthoritySourceVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "CurriculumAuthoritySourceVersion" ADD CONSTRAINT "CurriculumAuthoritySourceVersion_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "CurriculumAuthoritySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "CurriculumAuthoritySourceVersion" ADD CONSTRAINT "CurriculumAuthoritySourceVersion_supersedesVersionId_fkey" FOREIGN KEY ("supersedesVersionId") REFERENCES "CurriculumAuthoritySourceVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "MoeCurriculumObjective" ADD CONSTRAINT "MoeCurriculumObjective_sourceVersionId_fkey" FOREIGN KEY ("sourceVersionId") REFERENCES "CurriculumAuthoritySourceVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "AssessmentBaselineFramework" ADD CONSTRAINT "AssessmentBaselineFramework_sourceVersionId_fkey" FOREIGN KEY ("sourceVersionId") REFERENCES "CurriculumAuthoritySourceVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "AssessmentBaselineSubject" ADD CONSTRAINT "AssessmentBaselineSubject_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "AssessmentBaselineFramework"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "AssessmentBaselineCompetency" ADD CONSTRAINT "AssessmentBaselineCompetency_baselineSubjectId_fkey" FOREIGN KEY ("baselineSubjectId") REFERENCES "AssessmentBaselineSubject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "AssessmentBaselineCompetency" ADD CONSTRAINT "AssessmentBaselineCompetency_sourceVersionId_fkey" FOREIGN KEY ("sourceVersionId") REFERENCES "CurriculumAuthoritySourceVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "CurriculumBaselineAlignment" ADD CONSTRAINT "CurriculumBaselineAlignment_moeObjectiveId_fkey" FOREIGN KEY ("moeObjectiveId") REFERENCES "MoeCurriculumObjective"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "CurriculumBaselineAlignment" ADD CONSTRAINT "CurriculumBaselineAlignment_baselineCompetencyId_fkey" FOREIGN KEY ("baselineCompetencyId") REFERENCES "AssessmentBaselineCompetency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "CurriculumBaselineAlignment" ADD CONSTRAINT "CurriculumBaselineAlignment_reviewTaskId_fkey" FOREIGN KEY ("reviewTaskId") REFERENCES "CurriculumReviewTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "CurriculumBaselineAlignment" ADD CONSTRAINT "CurriculumBaselineAlignment_supersedesAlignmentId_fkey" FOREIGN KEY ("supersedesAlignmentId") REFERENCES "CurriculumBaselineAlignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "CurriculumAlignmentValidityEvent" ADD CONSTRAINT "CurriculumAlignmentValidityEvent_alignmentId_fkey" FOREIGN KEY ("alignmentId") REFERENCES "CurriculumBaselineAlignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "CurriculumAlignmentValidityEvent" ADD CONSTRAINT "CurriculumAlignmentValidityEvent_sourceVersionId_fkey" FOREIGN KEY ("sourceVersionId") REFERENCES "CurriculumAuthoritySourceVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "CurriculumLearningTarget" ADD CONSTRAINT "CurriculumLearningTarget_moeObjectiveId_fkey" FOREIGN KEY ("moeObjectiveId") REFERENCES "MoeCurriculumObjective"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "CurriculumLearningTarget" ADD CONSTRAINT "CurriculumLearningTarget_baselineCompetencyId_fkey" FOREIGN KEY ("baselineCompetencyId") REFERENCES "AssessmentBaselineCompetency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "CurriculumLearningTarget" ADD CONSTRAINT "CurriculumLearningTarget_curriculumRevisionId_fkey" FOREIGN KEY ("curriculumRevisionId") REFERENCES "CurriculumContentRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "CurriculumLearningTarget" ADD CONSTRAINT "CurriculumLearningTarget_reviewTaskId_fkey" FOREIGN KEY ("reviewTaskId") REFERENCES "CurriculumReviewTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "CurriculumLearningTarget" ADD CONSTRAINT "CurriculumLearningTarget_supersedesTargetId_fkey" FOREIGN KEY ("supersedesTargetId") REFERENCES "CurriculumLearningTarget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "CurriculumCompetencyCoverage" ADD CONSTRAINT "CurriculumCompetencyCoverage_curriculumRevisionId_fkey" FOREIGN KEY ("curriculumRevisionId") REFERENCES "CurriculumContentRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "CurriculumCompetencyCoverage" ADD CONSTRAINT "CurriculumCompetencyCoverage_moeObjectiveId_fkey" FOREIGN KEY ("moeObjectiveId") REFERENCES "MoeCurriculumObjective"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "CurriculumCompetencyCoverage" ADD CONSTRAINT "CurriculumCompetencyCoverage_baselineCompetencyId_fkey" FOREIGN KEY ("baselineCompetencyId") REFERENCES "AssessmentBaselineCompetency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "CurriculumCompetencyCoverage" ADD CONSTRAINT "CurriculumCompetencyCoverage_learningTargetId_fkey" FOREIGN KEY ("learningTargetId") REFERENCES "CurriculumLearningTarget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "CurriculumCompetencyCoverage" ADD CONSTRAINT "CurriculumCompetencyCoverage_reviewTaskId_fkey" FOREIGN KEY ("reviewTaskId") REFERENCES "CurriculumReviewTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "CurriculumCompetencyCoverage" ADD CONSTRAINT "CurriculumCompetencyCoverage_supersedesCoverageId_fkey" FOREIGN KEY ("supersedesCoverageId") REFERENCES "CurriculumCompetencyCoverage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "ExamPreparationProfile" ADD CONSTRAINT "ExamPreparationProfile_baselineSubjectId_fkey" FOREIGN KEY ("baselineSubjectId") REFERENCES "AssessmentBaselineSubject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "ExamPreparationProfile" ADD CONSTRAINT "ExamPreparationProfile_supersedesProfileId_fkey" FOREIGN KEY ("supersedesProfileId") REFERENCES "ExamPreparationProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "PolicyConfig" ADD CONSTRAINT "PolicyConfig_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "PolicyConfig" ADD CONSTRAINT "PolicyConfig_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "PolicyConfig" ADD CONSTRAINT "PolicyConfig_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "PolicyConfig" ADD CONSTRAINT "PolicyConfig_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "PolicyOverride" ADD CONSTRAINT "PolicyOverride_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "PolicyOverride" ADD CONSTRAINT "PolicyOverride_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "PolicyOverride" ADD CONSTRAINT "PolicyOverride_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "PolicyConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "PolicyOverride" ADD CONSTRAINT "PolicyOverride_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

