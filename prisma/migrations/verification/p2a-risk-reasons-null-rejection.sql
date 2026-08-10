\set ON_ERROR_STOP on

-- Run after Migration A against the public schema.
-- Every fixture is created inside this transaction and is always rolled back.
BEGIN;
SET LOCAL search_path = public, pg_catalog;

DO $$
DECLARE
  selected_content_id TEXT;
  test_provenance_id TEXT := 'p2a_verify_prov_' || md5(random()::TEXT || clock_timestamp()::TEXT);
  test_revision_id TEXT := 'p2a_verify_rev_' || md5(random()::TEXT || clock_timestamp()::TEXT);
  schema_nullable TEXT;
  schema_default TEXT;
  rejected_schema TEXT;
  rejected_table TEXT;
  rejected_column TEXT;
  default_reasons TEXT[];
BEGIN
  IF current_schema() IS DISTINCT FROM 'public' THEN
    RAISE EXCEPTION
      'P2-A riskReasons verification must run with public as the intended schema; current_schema=%',
      current_schema();
  END IF;

  IF to_regclass('public."CurriculumContent"') IS NULL
     OR to_regclass('public."CurriculumProvenance"') IS NULL
     OR to_regclass('public."CurriculumContentRevision"') IS NULL
     OR to_regclass('public."CurriculumGovernanceEvent"') IS NULL THEN
    RAISE EXCEPTION
      'P2-A riskReasons verification requires the public P2-A Migration A tables';
  END IF;

  SELECT column_info.is_nullable, column_info.column_default
  INTO schema_nullable, schema_default
  FROM information_schema.columns column_info
  WHERE column_info.table_schema = 'public'
    AND column_info.table_name = 'CurriculumGovernanceEvent'
    AND column_info.column_name = 'riskReasons';

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'P2-A riskReasons invariant failed: public.CurriculumGovernanceEvent.riskReasons is missing';
  END IF;

  IF schema_nullable IS DISTINCT FROM 'NO' THEN
    RAISE EXCEPTION
      'P2-A riskReasons invariant failed: schema permits NULL, is_nullable=%',
      schema_nullable;
  END IF;

  IF schema_default IS NULL
     OR position('ARRAY[]::text[]' IN schema_default) = 0 THEN
    RAISE EXCEPTION
      'P2-A riskReasons invariant failed: empty-array default is missing, column_default=%',
      schema_default;
  END IF;

  SELECT content."id"
  INTO selected_content_id
  FROM public."CurriculumContent" content
  LEFT JOIN public."CurriculumProvenance" provenance
    ON provenance."curriculumContentId" = content."id"
  WHERE provenance."id" IS NULL
  ORDER BY content."id"
  LIMIT 1;

  IF selected_content_id IS NULL THEN
    RAISE EXCEPTION
      'P2-A riskReasons verification requires one public.CurriculumContent row without provenance';
  END IF;

  INSERT INTO public."CurriculumProvenance" (
    "id",
    "curriculumContentId",
    "createdAt",
    "updatedAt"
  ) VALUES (
    test_provenance_id,
    selected_content_id,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  );

  INSERT INTO public."CurriculumContentRevision" (
    "id",
    "provenanceId",
    "sequence",
    "revisionKind",
    "originKind",
    "snapshotSchemaVersion",
    "contentSnapshot",
    "contentHash",
    "createdAt"
  ) VALUES (
    test_revision_id,
    test_provenance_id,
    1,
    'BACKFILL_SNAPSHOT',
    'LEGACY_UNKNOWN',
    1,
    '{}'::JSONB,
    repeat('0', 64),
    CURRENT_TIMESTAMP
  );

  BEGIN
    INSERT INTO public."CurriculumGovernanceEvent" (
      "id",
      "provenanceId",
      "sequence",
      "revisionId",
      "eventType",
      "actorType",
      "riskReasons",
      "occurredAt",
      "createdAt"
    ) VALUES (
      'p2a_verify_null_' || md5(random()::TEXT || clock_timestamp()::TEXT),
      test_provenance_id,
      1,
      test_revision_id,
      'SUBMITTED',
      'SYSTEM',
      NULL,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    );

    RAISE EXCEPTION
      'P2-A riskReasons invariant failed: direct SQL NULL was accepted';
  EXCEPTION
    WHEN not_null_violation THEN
      GET STACKED DIAGNOSTICS
        rejected_schema = SCHEMA_NAME,
        rejected_table = TABLE_NAME,
        rejected_column = COLUMN_NAME;

      IF rejected_schema IS DISTINCT FROM 'public'
         OR rejected_table IS DISTINCT FROM 'CurriculumGovernanceEvent'
         OR rejected_column IS DISTINCT FROM 'riskReasons' THEN
        RAISE EXCEPTION
          'P2-A riskReasons invariant failed with unexpected NOT NULL source: %.%.%',
          rejected_schema,
          rejected_table,
          rejected_column;
      END IF;
  END;

  INSERT INTO public."CurriculumGovernanceEvent" (
    "id",
    "provenanceId",
    "sequence",
    "revisionId",
    "eventType",
    "actorType",
    "occurredAt",
    "createdAt"
  ) VALUES (
    'p2a_verify_default_' || md5(random()::TEXT || clock_timestamp()::TEXT),
    test_provenance_id,
    1,
    test_revision_id,
    'SUBMITTED',
    'SYSTEM',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
  RETURNING "riskReasons" INTO default_reasons;

  IF default_reasons IS NULL OR cardinality(default_reasons) <> 0 THEN
    RAISE EXCEPTION
      'P2-A riskReasons invariant failed: omitted value did not become an empty array';
  END IF;
END;
$$;

ROLLBACK;
