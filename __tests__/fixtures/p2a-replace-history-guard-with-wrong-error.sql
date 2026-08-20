-- Disposable PostgreSQL negative-path fixture only.
CREATE TRIGGER curriculum_content_revision_no_update_or_delete
BEFORE UPDATE OR DELETE ON public."CurriculumContentRevision"
FOR EACH ROW
EXECUTE FUNCTION p2a_reject_immutable_curriculum_history_mutation();

CREATE OR REPLACE FUNCTION p2a_reject_immutable_curriculum_history_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '23505',
    MESSAGE = 'intentional wrong rejection type for local negative-path testing';
END;
$$;
