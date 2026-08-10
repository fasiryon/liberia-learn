\set ON_ERROR_STOP on

-- Run after Migration A. The transaction is always rolled back.
-- This proves PostgreSQL rejects direct SQL NULL while omission uses [].
BEGIN;

DO $$
DECLARE
  selected_content_id TEXT;
  test_provenance_id TEXT := 'p2a_verify_prov_' || md5(random()::TEXT || clock_timestamp()::TEXT);
  test_revision_id TEXT := 'p2a_verify_rev_' || md5(random()::TEXT || clock_timestamp()::TEXT);
  null_was_rejected BOOLEAN := FALSE;
  default_reason_count INTEGER;
BEGIN
  SELECT content."id"
  INTO selected_content_id
  FROM "CurriculumContent" content
  LEFT JOIN "CurriculumProvenance" provenance
    ON provenance."curriculumContentId" = content."id"
  WHERE provenance."id" IS NULL
  ORDER BY content."id"
  LIMIT 1;

  IF selected_content_id IS NULL THEN
    RAISE EXCEPTION
      'P2-A verification requires one CurriculumContent row without provenance';
  END IF;

  INSERT INTO "CurriculumProvenance" (
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

  INSERT INTO "CurriculumContentRevision" (
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
    INSERT INTO "CurriculumGovernanceEvent" (
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
  EXCEPTION
    WHEN not_null_violation THEN
      null_was_rejected := TRUE;
  END;

  IF NOT null_was_rejected THEN
    RAISE EXCEPTION 'P2-A riskReasons invariant failed: direct SQL NULL was accepted';
  END IF;

  INSERT INTO "CurriculumGovernanceEvent" (
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
  RETURNING cardinality("riskReasons") INTO default_reason_count;

  IF default_reason_count <> 0 THEN
    RAISE EXCEPTION
      'P2-A riskReasons invariant failed: omitted value did not become []';
  END IF;
END;
$$;

ROLLBACK;
