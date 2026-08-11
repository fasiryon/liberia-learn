\set ON_ERROR_STOP on

-- Synthetic, non-PII fixtures for the P2-A staging verification scripts.
-- Run only after the staging foundation preflight passes and before Migration A.
BEGIN;

INSERT INTO public."CurriculumContent" (
  "id",
  "contentId",
  "title",
  "grade",
  "subject",
  "contentType",
  "status",
  "version",
  "payload",
  "createdAt",
  "updatedAt"
) VALUES
  (
    'p2a-staging-fixture-content-1',
    'p2a-staging-fixture-content-1',
    'P2-A Staging Mathematics Fixture',
    5,
    'MATH',
    'lesson',
    'DRAFT',
    '1.0',
    '{"body":"Synthetic staging-only curriculum fixture one."}'::JSONB,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'p2a-staging-fixture-content-2',
    'p2a-staging-fixture-content-2',
    'P2-A Staging Science Fixture',
    5,
    'SCIENCE',
    'lesson',
    'DRAFT',
    '1.0',
    '{"body":"Synthetic staging-only curriculum fixture two."}'::JSONB,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("contentId") DO NOTHING;

DO $$
BEGIN
  IF (
    SELECT count(*)
    FROM public."CurriculumContent"
    WHERE "contentId" IN (
      'p2a-staging-fixture-content-1',
      'p2a-staging-fixture-content-2'
    )
  ) <> 2 THEN
    RAISE EXCEPTION 'P2-A staging curriculum fixtures are incomplete';
  END IF;
END;
$$;

COMMIT;
