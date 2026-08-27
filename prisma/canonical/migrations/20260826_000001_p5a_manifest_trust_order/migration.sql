-- P5-A Phase B: make the current curriculum revision a forward-only trust pointer.
-- This replaces the existing ownership-only guard without changing table shape.

SET lock_timeout = '5s';
SET statement_timeout = '5min';

CREATE OR REPLACE FUNCTION p2a_validate_current_curriculum_revision()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  new_sequence INTEGER;
  old_sequence INTEGER;
  maximum_sequence INTEGER;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW."currentRevisionId" IS NOT DISTINCT FROM OLD."currentRevisionId" THEN
    RETURN NEW;
  END IF;

  IF NEW."currentRevisionId" IS NULL THEN
    IF TG_OP = 'UPDATE' AND OLD."currentRevisionId" IS NOT NULL THEN
      RAISE EXCEPTION 'currentRevisionId cannot regress to NULL';
    END IF;
    RETURN NEW;
  END IF;

  SELECT revision.sequence
  INTO new_sequence
  FROM "CurriculumContentRevision" revision
  WHERE revision."id" = NEW."currentRevisionId"
    AND revision."provenanceId" = NEW."id";

  IF new_sequence IS NULL THEN
    RAISE EXCEPTION
      'currentRevisionId % does not belong to CurriculumProvenance %',
      NEW."currentRevisionId",
      NEW."id";
  END IF;

  SELECT max(revision.sequence)
  INTO maximum_sequence
  FROM "CurriculumContentRevision" revision
  WHERE revision."provenanceId" = NEW."id";

  IF new_sequence IS DISTINCT FROM maximum_sequence THEN
    RAISE EXCEPTION
      'currentRevisionId sequence % must equal latest revision sequence % for CurriculumProvenance %',
      new_sequence,
      maximum_sequence,
      NEW."id";
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."currentRevisionId" IS NOT NULL THEN
    SELECT revision.sequence
    INTO old_sequence
    FROM "CurriculumContentRevision" revision
    WHERE revision."id" = OLD."currentRevisionId"
      AND revision."provenanceId" = OLD."id";

    IF old_sequence IS NULL OR new_sequence <= old_sequence THEN
      RAISE EXCEPTION
        'currentRevisionId sequence cannot move backward or sideways from % to %',
        old_sequence,
        new_sequence;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

RESET statement_timeout;
RESET lock_timeout;
