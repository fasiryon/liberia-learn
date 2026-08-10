\set ON_ERROR_STOP on

-- Run after Migration C and before any provenance writer is enabled.
-- Every test row and helper function is rolled back.
BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.p2a_expect_rejected(
  statement_text TEXT,
  assertion_name TEXT
) RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  BEGIN
    EXECUTE statement_text;
  EXCEPTION
    WHEN raise_exception THEN
      RETURN;
  END;

  RAISE EXCEPTION 'P2-A guard assertion failed: % was accepted', assertion_name;
END;
$$;

DO $$
DECLARE
  first_content_id TEXT;
  second_content_id TEXT;
  first_provenance_id TEXT := 'p2a_guard_prov_1_' || md5(random()::TEXT || clock_timestamp()::TEXT);
  second_provenance_id TEXT := 'p2a_guard_prov_2_' || md5(random()::TEXT || clock_timestamp()::TEXT);
  first_revision_id TEXT := 'p2a_guard_rev_1_' || md5(random()::TEXT || clock_timestamp()::TEXT);
  second_revision_id TEXT := 'p2a_guard_rev_2_' || md5(random()::TEXT || clock_timestamp()::TEXT);
  event_id TEXT := 'p2a_guard_event_' || md5(random()::TEXT || clock_timestamp()::TEXT);
  evidence_id TEXT := 'p2a_guard_evidence_' || md5(random()::TEXT || clock_timestamp()::TEXT);
  projection_state "CurriculumLifecycleState";
BEGIN
  SELECT available."id"
  INTO first_content_id
  FROM (
    SELECT content."id"
    FROM "CurriculumContent" content
    LEFT JOIN "CurriculumProvenance" provenance
      ON provenance."curriculumContentId" = content."id"
    WHERE provenance."id" IS NULL
    ORDER BY content."id"
    LIMIT 1
  ) available;

  SELECT available."id"
  INTO second_content_id
  FROM (
    SELECT content."id"
    FROM "CurriculumContent" content
    LEFT JOIN "CurriculumProvenance" provenance
      ON provenance."curriculumContentId" = content."id"
    WHERE provenance."id" IS NULL
      AND content."id" IS DISTINCT FROM first_content_id
    ORDER BY content."id"
    LIMIT 1
  ) available;

  IF first_content_id IS NULL OR second_content_id IS NULL THEN
    RAISE EXCEPTION
      'P2-A guard verification requires two CurriculumContent rows without provenance';
  END IF;

  INSERT INTO "CurriculumProvenance" (
    "id", "curriculumContentId", "createdAt", "updatedAt"
  ) VALUES
    (first_provenance_id, first_content_id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (second_provenance_id, second_content_id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

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
  ) VALUES
    (
      first_revision_id,
      first_provenance_id,
      1,
      'BACKFILL_SNAPSHOT',
      'LEGACY_UNKNOWN',
      1,
      '{}'::JSONB,
      repeat('1', 64),
      CURRENT_TIMESTAMP
    ),
    (
      second_revision_id,
      second_provenance_id,
      1,
      'BACKFILL_SNAPSHOT',
      'LEGACY_UNKNOWN',
      1,
      '{}'::JSONB,
      repeat('2', 64),
      CURRENT_TIMESTAMP
    );

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
    event_id,
    first_provenance_id,
    1,
    first_revision_id,
    'SUBMITTED',
    'SYSTEM',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  );

  INSERT INTO "CurriculumEvidence" (
    "id",
    "revisionId",
    "evidenceType",
    "evidencePurpose",
    "title",
    "createdAt"
  ) VALUES (
    evidence_id,
    first_revision_id,
    'REVIEWER_NOTE',
    'REVIEW_SUPPORT',
    'P2-A staging guard verification',
    CURRENT_TIMESTAMP
  );

  PERFORM pg_temp.p2a_expect_rejected(
    format('UPDATE "CurriculumContentRevision" SET "contentHash" = %L WHERE "id" = %L', repeat('9', 64), first_revision_id),
    'CurriculumContentRevision UPDATE'
  );
  PERFORM pg_temp.p2a_expect_rejected(
    format('DELETE FROM "CurriculumContentRevision" WHERE "id" = %L', first_revision_id),
    'CurriculumContentRevision DELETE'
  );
  PERFORM pg_temp.p2a_expect_rejected(
    'TRUNCATE TABLE "CurriculumContentRevision" CASCADE',
    'CurriculumContentRevision TRUNCATE'
  );

  PERFORM pg_temp.p2a_expect_rejected(
    format('UPDATE "CurriculumGovernanceEvent" SET "reason" = %L WHERE "id" = %L', 'forbidden', event_id),
    'CurriculumGovernanceEvent UPDATE'
  );
  PERFORM pg_temp.p2a_expect_rejected(
    format('DELETE FROM "CurriculumGovernanceEvent" WHERE "id" = %L', event_id),
    'CurriculumGovernanceEvent DELETE'
  );
  PERFORM pg_temp.p2a_expect_rejected(
    'TRUNCATE TABLE "CurriculumGovernanceEvent"',
    'CurriculumGovernanceEvent TRUNCATE'
  );

  PERFORM pg_temp.p2a_expect_rejected(
    format('UPDATE "CurriculumEvidence" SET "title" = %L WHERE "id" = %L', 'forbidden', evidence_id),
    'CurriculumEvidence UPDATE'
  );
  PERFORM pg_temp.p2a_expect_rejected(
    format('DELETE FROM "CurriculumEvidence" WHERE "id" = %L', evidence_id),
    'CurriculumEvidence DELETE'
  );
  PERFORM pg_temp.p2a_expect_rejected(
    'TRUNCATE TABLE "CurriculumEvidence"',
    'CurriculumEvidence TRUNCATE'
  );

  PERFORM pg_temp.p2a_expect_rejected(
    format('DELETE FROM "CurriculumProvenance" WHERE "id" = %L', first_provenance_id),
    'CurriculumProvenance DELETE'
  );
  PERFORM pg_temp.p2a_expect_rejected(
    'TRUNCATE TABLE "CurriculumProvenance" CASCADE',
    'CurriculumProvenance TRUNCATE'
  );

  UPDATE "CurriculumProvenance"
  SET
    "lifecycleState" = 'PENDING_REVIEW',
    "provenanceCompleteness" = 'PARTIAL',
    "updatedAt" = CURRENT_TIMESTAMP
  WHERE "id" = first_provenance_id
  RETURNING "lifecycleState" INTO projection_state;

  IF projection_state <> 'PENDING_REVIEW' THEN
    RAISE EXCEPTION 'P2-A guard assertion failed: allowed projection update did not persist';
  END IF;

  PERFORM pg_temp.p2a_expect_rejected(
    format(
      'UPDATE "CurriculumProvenance" SET "curriculumContentId" = %L WHERE "id" = %L',
      second_content_id,
      first_provenance_id
    ),
    'CurriculumProvenance identity update'
  );

  PERFORM pg_temp.p2a_expect_rejected(
    format(
      'UPDATE "CurriculumProvenance" SET "currentRevisionId" = %L WHERE "id" = %L',
      second_revision_id,
      first_provenance_id
    ),
    'cross-root currentRevisionId update'
  );

  UPDATE "CurriculumProvenance"
  SET
    "currentRevisionId" = first_revision_id,
    "updatedAt" = CURRENT_TIMESTAMP
  WHERE "id" = first_provenance_id;

  IF NOT EXISTS (
    SELECT 1
    FROM "CurriculumProvenance"
    WHERE "id" = first_provenance_id
      AND "currentRevisionId" = first_revision_id
  ) THEN
    RAISE EXCEPTION 'P2-A guard assertion failed: same-root currentRevisionId update failed';
  END IF;
END;
$$;

ROLLBACK;
