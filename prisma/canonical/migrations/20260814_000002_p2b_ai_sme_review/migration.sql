-- P2-B AI SME review extension. Additive only. AI actors are never human credentials.
ALTER TYPE "CurriculumGovernanceActorType" ADD VALUE IF NOT EXISTS 'AI';
ALTER TYPE "CurriculumApprovalBasis" ADD VALUE IF NOT EXISTS 'AI_PLATFORM_REVIEW';
CREATE TYPE "CurriculumReviewActorType" AS ENUM ('HUMAN', 'AI');
CREATE TYPE "AIReviewSpecialty" AS ENUM ('SUBJECT_MATTER','PEDAGOGY','ASSESSMENT','LIBERIAN_LOCALIZATION','FACT_CHECK','ACCESSIBILITY','SAFETY','HISTORY_CIVICS','WAEC_ALIGNMENT');
CREATE TYPE "AIReviewMode" AS ENUM ('HUMAN_REQUIRED','AI_ALLOWED','AI_REQUIRED','AI_PLUS_HUMAN','EXTERNAL_AUTHORITY_REQUIRED');

ALTER TABLE "CurriculumGovernanceEvent" ADD COLUMN "aiReviewAgentId" TEXT;
ALTER TABLE "CurriculumReviewAssessment" ALTER COLUMN "assignmentId" DROP NOT NULL;
ALTER TABLE "CurriculumReviewAssessment" ALTER COLUMN "reviewerProfileId" DROP NOT NULL;
ALTER TABLE "CurriculumReviewAssessment" ALTER COLUMN "credentialId" DROP NOT NULL;
ALTER TABLE "CurriculumReviewAssessment" ALTER COLUMN "credentialScopeId" DROP NOT NULL;
ALTER TABLE "CurriculumReviewAssessment" ADD COLUMN "actorType" "CurriculumReviewActorType" NOT NULL DEFAULT 'HUMAN';
ALTER TABLE "CurriculumReviewDecision" ADD COLUMN "actorType" "CurriculumReviewActorType" NOT NULL DEFAULT 'HUMAN';
ALTER TABLE "CurriculumReviewDecision" ADD COLUMN "aiReviewAgentId" TEXT;
ALTER TABLE "CurriculumReviewDecision" ADD COLUMN "aiAssessmentIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "AIReviewAgent" (
  "id" TEXT NOT NULL,
  "agentKey" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "specialty" "AIReviewSpecialty" NOT NULL,
  "subjectScope" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "gradeMin" INTEGER,
  "gradeMax" INTEGER,
  "curriculumScope" "ReviewerCurriculumScope"[] NOT NULL DEFAULT ARRAY[]::"ReviewerCurriculumScope"[],
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "promptKey" TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "promptHash" TEXT NOT NULL,
  "policyKey" TEXT NOT NULL,
  "policyVersion" INTEGER NOT NULL,
  "rubricKey" TEXT NOT NULL,
  "rubricVersion" INTEGER NOT NULL,
  "minimumConfidence" INTEGER NOT NULL DEFAULT 70,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AIReviewAgent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AIReviewAgent_grade_check" CHECK (("gradeMin" IS NULL AND "gradeMax" IS NULL) OR ("gradeMin" BETWEEN 1 AND 12 AND "gradeMax" BETWEEN 1 AND 12 AND "gradeMin" <= "gradeMax")),
  CONSTRAINT "AIReviewAgent_confidence_check" CHECK ("minimumConfidence" BETWEEN 0 AND 100)
);
CREATE UNIQUE INDEX "AIReviewAgent_agentKey_key" ON "AIReviewAgent"("agentKey");
CREATE INDEX "AIReviewAgent_specialty_enabled_idx" ON "AIReviewAgent"("specialty", "enabled");

CREATE TABLE "CurriculumAIReviewAssessment" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "aiReviewAgentId" TEXT NOT NULL,
  "status" "CurriculumReviewAssessmentStatus" NOT NULL DEFAULT 'SUBMITTED',
  "rubricKey" TEXT NOT NULL,
  "rubricVersion" INTEGER NOT NULL,
  "rubricResponses" JSONB NOT NULL,
  "recommendation" "CurriculumReviewRecommendation",
  "rationale" TEXT NOT NULL,
  "evidenceRefs" JSONB,
  "confidence" INTEGER NOT NULL,
  "aiReviewSnapshot" JSONB NOT NULL,
  "reviewCorrelationId" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CurriculumAIReviewAssessment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CurriculumAIReviewAssessment_confidence_check" CHECK ("confidence" BETWEEN 0 AND 100),
  CONSTRAINT "CurriculumAIReviewAssessment_submitted_check" CHECK ("status" <> 'SUBMITTED' OR ("recommendation" IS NOT NULL AND NULLIF(BTRIM("rationale"), '') IS NOT NULL))
);
CREATE UNIQUE INDEX "CurriculumAIReviewAssessment_idempotencyKey_key" ON "CurriculumAIReviewAssessment"("idempotencyKey");
CREATE INDEX "CurriculumAIReviewAssessment_taskId_submittedAt_idx" ON "CurriculumAIReviewAssessment"("taskId", "submittedAt");
CREATE INDEX "CurriculumAIReviewAssessment_agent_submittedAt_idx" ON "CurriculumAIReviewAssessment"("aiReviewAgentId", "submittedAt");

ALTER TABLE "CurriculumGovernanceEvent" ADD CONSTRAINT "CurriculumGovernanceEvent_aiReviewAgentId_fkey" FOREIGN KEY ("aiReviewAgentId") REFERENCES "AIReviewAgent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CurriculumReviewDecision" ADD CONSTRAINT "CurriculumReviewDecision_aiReviewAgentId_fkey" FOREIGN KEY ("aiReviewAgentId") REFERENCES "AIReviewAgent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CurriculumAIReviewAssessment" ADD CONSTRAINT "CurriculumAIReviewAssessment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "CurriculumReviewTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CurriculumAIReviewAssessment" ADD CONSTRAINT "CurriculumAIReviewAssessment_agentId_fkey" FOREIGN KEY ("aiReviewAgentId") REFERENCES "AIReviewAgent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CurriculumReviewAssessment" ADD CONSTRAINT "CurriculumReviewAssessment_actor_identity_check" CHECK (("actorType" = 'HUMAN' AND "reviewerProfileId" IS NOT NULL AND "credentialId" IS NOT NULL AND "credentialScopeId" IS NOT NULL AND "assignmentId" IS NOT NULL) OR ("actorType" = 'AI' AND "reviewerProfileId" IS NULL AND "credentialId" IS NULL AND "credentialScopeId" IS NULL AND "assignmentId" IS NULL));
CREATE OR REPLACE FUNCTION p2b_ai_assessment_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD."status" = 'SUBMITTED' THEN RAISE EXCEPTION 'submitted AI assessment is immutable' USING ERRCODE = '55000'; END IF; RETURN NEW; END; $$;
CREATE TRIGGER "CurriculumAIReviewAssessment_submitted_immutable" BEFORE UPDATE OR DELETE ON "CurriculumAIReviewAssessment" FOR EACH ROW EXECUTE FUNCTION p2b_ai_assessment_immutable();
