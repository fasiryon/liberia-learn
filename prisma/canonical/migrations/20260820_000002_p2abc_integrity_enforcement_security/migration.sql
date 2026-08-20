-- P2-A authority-correction linkage. Existing immutable events are preserved;
-- a correction is a new append-only event that points to the misstated row.
ALTER TABLE "CurriculumGovernanceEvent"
  ADD COLUMN "correctsEventId" TEXT;

CREATE UNIQUE INDEX "CurriculumGovernanceEvent_correctsEventId_key"
  ON "CurriculumGovernanceEvent"("correctsEventId");

ALTER TABLE "CurriculumGovernanceEvent"
  ADD CONSTRAINT "CurriculumGovernanceEvent_correctsEventId_fkey"
  FOREIGN KEY ("correctsEventId") REFERENCES "CurriculumGovernanceEvent"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enforce honest approval semantics at the database boundary for every new
-- governance row, including raw-SQL/maintenance writers.
CREATE OR REPLACE FUNCTION p2abc_validate_governance_authority() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."approvalBasis" = 'HUMAN_REVIEW' AND (
    NEW."actorType" <> 'USER'
    OR NEW."actorUserId" IS NULL
    OR NEW."reviewerQualificationRef" IS NULL
    OR btrim(NEW."reviewerQualificationRef") = ''
    OR NEW."reviewerQualificationSnapshot" IS NULL
    OR NEW."reviewerQualificationSnapshot" = 'null'::jsonb
    OR NEW."reviewAuthority" NOT IN ('PLATFORM', 'SCHOOL', 'MOE')
  ) THEN
    RAISE EXCEPTION 'HUMAN_REVIEW requires a qualified USER actor and PLATFORM/SCHOOL/MOE authority'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."approvalBasis" = 'AI_PLATFORM_REVIEW' AND (
    NEW."actorType" <> 'AI'
    OR NEW."aiReviewAgentId" IS NULL
    OR NEW."reviewAuthority" <> 'PLATFORM'
    OR NEW."reviewerQualificationRef" IS NULL
    OR btrim(NEW."reviewerQualificationRef") = ''
    OR NEW."reviewerQualificationSnapshot" IS NULL
    OR NEW."reviewerQualificationSnapshot" = 'null'::jsonb
  ) THEN
    RAISE EXCEPTION 'AI_PLATFORM_REVIEW requires a qualified AI actor with PLATFORM authority'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."reviewAuthority" = 'MOE' AND (
    NEW."actorType" <> 'USER'
    OR NEW."actorUserId" IS NULL
    OR NEW."reviewerQualificationRef" IS NULL
    OR NEW."reviewerQualificationSnapshot" IS NULL
    OR NEW."reviewerQualificationSnapshot" = 'null'::jsonb
  ) THEN
    RAISE EXCEPTION 'MOE authority requires an identified qualified human reviewer'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."eventType" = 'AUTHORITY_CORRECTED' AND (
    NEW."correctsEventId" IS NULL
    OR NEW."correctsEventId" = NEW."id"
    OR NEW."actorType" NOT IN ('USER', 'SYSTEM')
    OR NEW."reason" IS NULL
    OR btrim(NEW."reason") = ''
    OR NEW."approvalBasis" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'AUTHORITY_CORRECTED requires a linked prior event, USER/SYSTEM actor, and reason without a new approval basis'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "CurriculumGovernanceEvent_authority_guard"
  BEFORE INSERT OR UPDATE ON "CurriculumGovernanceEvent"
  FOR EACH ROW EXECUTE FUNCTION p2abc_validate_governance_authority();

-- Evidence-honest external assessment depth. A definite WAEC cognitive depth
-- is only permitted for TOPIC_LEVEL evidence; all broader evidence is
-- explicitly NOT_ESTABLISHED.
UPDATE "AssessmentBaselineCompetency"
SET "assessmentDepth" = 'NOT_ESTABLISHED',
    "cognitiveDimensions" = ARRAY[]::"CognitiveDemandCategory"[]
WHERE "evidenceSpecificity" <> 'TOPIC_LEVEL'
  AND (
    "assessmentDepth" <> 'NOT_ESTABLISHED'
    OR cardinality("cognitiveDimensions") <> 0
  );

ALTER TABLE "AssessmentBaselineCompetency"
  ADD CONSTRAINT "AssessmentBaselineCompetency_depth_evidence_honesty"
  CHECK (
    "assessmentDepth" = 'NOT_ESTABLISHED'
    OR "evidenceSpecificity" = 'TOPIC_LEVEL'
  );

-- Canonical AI interaction remains authoritative. Legacy analytics rows link
-- back to it uniquely so retries/reconciliation repair gaps without double
-- counting.
ALTER TABLE "AIInteraction"
  ADD COLUMN "legacyLogRequired" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "AiInteractionLog"
  ADD COLUMN "aiInteractionId" TEXT;

CREATE UNIQUE INDEX "AiInteractionLog_aiInteractionId_key"
  ON "AiInteractionLog"("aiInteractionId");

ALTER TABLE "AiInteractionLog"
  ADD CONSTRAINT "AiInteractionLog_aiInteractionId_fkey"
  FOREIGN KEY ("aiInteractionId") REFERENCES "AIInteraction"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "AIInteraction_legacyLogRequired_createdAt_idx"
  ON "AIInteraction"("legacyLogRequired", "createdAt");

-- Canonical security convergence. RLS is idempotently enabled on every public
-- table; P2-C's 13 server-only tables additionally expose no anon/authenticated
-- table privileges. Roles are optional in plain PostgreSQL bootstrap images.
DO $$
DECLARE table_name text;
BEGIN
  FOR table_name IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
  END LOOP;
END;
$$;

DO $$
DECLARE role_name text;
DECLARE table_list constant text :=
  '"CurriculumAuthoritySource", "CurriculumAuthoritySourceVersion", "MoeCurriculumObjective", "AssessmentBaselineFramework", "AssessmentBaselineSubject", "AssessmentBaselineCompetency", "CurriculumBaselineAlignment", "CurriculumAlignmentValidityEvent", "CurriculumLearningTarget", "CurriculumCompetencyCoverage", "ExamPreparationProfile", "PolicyConfig", "PolicyOverride"';
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON TABLE %s FROM %I', table_list, role_name);
    END IF;
  END LOOP;
END;
$$;
