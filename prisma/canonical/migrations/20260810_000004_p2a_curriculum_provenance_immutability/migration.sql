-- P2-A Migration C: immutable-history and provenance-root guards.
-- Prepared in Step 1 only. Do not apply without separate database approval.

-- Fail promptly on metadata-lock contention and cap total statement time.
SET lock_timeout = '5s';
SET statement_timeout = '5min';

CREATE OR REPLACE FUNCTION p2a_reject_immutable_curriculum_history_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % is not permitted', TG_TABLE_NAME, TG_OP;
END;
$$;

CREATE TRIGGER curriculum_content_revision_no_update_or_delete
BEFORE UPDATE OR DELETE ON "CurriculumContentRevision"
FOR EACH ROW
EXECUTE FUNCTION p2a_reject_immutable_curriculum_history_mutation();

CREATE TRIGGER curriculum_governance_event_no_update_or_delete
BEFORE UPDATE OR DELETE ON "CurriculumGovernanceEvent"
FOR EACH ROW
EXECUTE FUNCTION p2a_reject_immutable_curriculum_history_mutation();

CREATE TRIGGER curriculum_evidence_no_update_or_delete
BEFORE UPDATE OR DELETE ON "CurriculumEvidence"
FOR EACH ROW
EXECUTE FUNCTION p2a_reject_immutable_curriculum_history_mutation();

CREATE TRIGGER curriculum_content_revision_no_truncate
BEFORE TRUNCATE ON "CurriculumContentRevision"
FOR EACH STATEMENT
EXECUTE FUNCTION p2a_reject_immutable_curriculum_history_mutation();

CREATE TRIGGER curriculum_governance_event_no_truncate
BEFORE TRUNCATE ON "CurriculumGovernanceEvent"
FOR EACH STATEMENT
EXECUTE FUNCTION p2a_reject_immutable_curriculum_history_mutation();

CREATE TRIGGER curriculum_evidence_no_truncate
BEFORE TRUNCATE ON "CurriculumEvidence"
FOR EACH STATEMENT
EXECUTE FUNCTION p2a_reject_immutable_curriculum_history_mutation();

CREATE OR REPLACE FUNCTION p2a_reject_curriculum_provenance_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'CurriculumProvenance is durable and cannot be deleted';
END;
$$;

CREATE TRIGGER curriculum_provenance_no_delete
BEFORE DELETE ON "CurriculumProvenance"
FOR EACH ROW
EXECUTE FUNCTION p2a_reject_curriculum_provenance_delete();

CREATE TRIGGER curriculum_provenance_no_truncate
BEFORE TRUNCATE ON "CurriculumProvenance"
FOR EACH STATEMENT
EXECUTE FUNCTION p2a_reject_curriculum_provenance_delete();

CREATE OR REPLACE FUNCTION p2a_guard_curriculum_provenance_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."id" IS DISTINCT FROM OLD."id"
     OR NEW."curriculumContentId" IS DISTINCT FROM OLD."curriculumContentId"
     OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'CurriculumProvenance identity fields are immutable';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER curriculum_provenance_identity_no_update
BEFORE UPDATE ON "CurriculumProvenance"
FOR EACH ROW
EXECUTE FUNCTION p2a_guard_curriculum_provenance_identity();

CREATE OR REPLACE FUNCTION p2a_validate_current_curriculum_revision()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."currentRevisionId" IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM "CurriculumContentRevision" revision
    WHERE revision."id" = NEW."currentRevisionId"
      AND revision."provenanceId" = NEW."id"
  ) THEN
    RAISE EXCEPTION
      'currentRevisionId % does not belong to CurriculumProvenance %',
      NEW."currentRevisionId",
      NEW."id";
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER curriculum_provenance_current_revision_guard
BEFORE INSERT OR UPDATE OF "currentRevisionId" ON "CurriculumProvenance"
FOR EACH ROW
EXECUTE FUNCTION p2a_validate_current_curriculum_revision();

RESET statement_timeout;
RESET lock_timeout;
