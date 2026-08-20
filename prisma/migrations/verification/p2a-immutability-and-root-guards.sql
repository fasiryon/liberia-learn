\set ON_ERROR_STOP on

-- Run after Migration C and before any provenance writer is enabled.
-- Every fixture and the helper function are inside this rolled-back transaction.
BEGIN;
SET LOCAL search_path = public, pg_catalog;

CREATE OR REPLACE FUNCTION pg_temp.p2a_expect_rejected(
  statement_text TEXT,
  assertion_name TEXT,
  expected_sqlstate TEXT,
  expected_message_fragment TEXT
) RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  actual_sqlstate TEXT;
  actual_message TEXT;
BEGIN
  BEGIN
    EXECUTE statement_text;
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS
        actual_sqlstate = RETURNED_SQLSTATE,
        actual_message = MESSAGE_TEXT;

      IF actual_sqlstate IS DISTINCT FROM expected_sqlstate
         OR position(expected_message_fragment IN actual_message) = 0 THEN
        RAISE EXCEPTION
          'P2-A guard assertion failed: % produced unexpected rejection SQLSTATE=% message=%; expected SQLSTATE=% message containing=%',
          assertion_name,
          actual_sqlstate,
          actual_message,
          expected_sqlstate,
          expected_message_fragment;
      END IF;

      RETURN;
  END;

  RAISE EXCEPTION 'P2-A guard assertion failed: % unexpectedly succeeded', assertion_name;
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
  projection_state public."CurriculumLifecycleState";
  projection_completeness public."CurriculumProvenanceCompleteness";
BEGIN
  IF current_schema() IS DISTINCT FROM 'public' THEN
    RAISE EXCEPTION
      'P2-A guard verification must run with public as the intended schema; current_schema=%',
      current_schema();
  END IF;

  IF to_regclass('public."CurriculumContent"') IS NULL
     OR to_regclass('public."CurriculumProvenance"') IS NULL
     OR to_regclass('public."CurriculumContentRevision"') IS NULL
     OR to_regclass('public."CurriculumGovernanceEvent"') IS NULL
     OR to_regclass('public."CurriculumEvidence"') IS NULL THEN
    RAISE EXCEPTION
      'P2-A guard verification requires the public P2-A Migration C tables';
  END IF;

  SELECT available."id"
  INTO first_content_id
  FROM (
    SELECT content."id"
    FROM public."CurriculumContent" content
    LEFT JOIN public."CurriculumProvenance" provenance
      ON provenance."curriculumContentId" = content."id"
    WHERE provenance."id" IS NULL
    ORDER BY content."id"
    LIMIT 1
  ) available;

  SELECT available."id"
  INTO second_content_id
  FROM (
    SELECT content."id"
    FROM public."CurriculumContent" content
    LEFT JOIN public."CurriculumProvenance" provenance
      ON provenance."curriculumContentId" = content."id"
    WHERE provenance."id" IS NULL
      AND content."id" IS DISTINCT FROM first_content_id
    ORDER BY content."id"
    LIMIT 1
  ) available;

  IF first_content_id IS NULL OR second_content_id IS NULL THEN
    RAISE EXCEPTION
      'P2-A guard verification requires two public.CurriculumContent rows without provenance';
  END IF;

  INSERT INTO public."CurriculumProvenance" (
    "id", "curriculumContentId", "createdAt", "updatedAt"
  ) VALUES
    (first_provenance_id, first_content_id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (second_provenance_id, second_content_id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

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
    event_id,
    first_provenance_id,
    1,
    first_revision_id,
    'SUBMITTED',
    'SYSTEM',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  );

  INSERT INTO public."CurriculumEvidence" (
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
    format('UPDATE public."CurriculumContentRevision" SET "contentHash" = %L WHERE "id" = %L', repeat('9', 64), first_revision_id),
    'CurriculumContentRevision UPDATE',
    'P0001',
    'CurriculumContentRevision is append-only: UPDATE is not permitted'
  );
  PERFORM pg_temp.p2a_expect_rejected(
    format('DELETE FROM public."CurriculumContentRevision" WHERE "id" = %L', first_revision_id),
    'CurriculumContentRevision DELETE',
    'P0001',
    'CurriculumContentRevision is append-only: DELETE is not permitted'
  );
  PERFORM pg_temp.p2a_expect_rejected(
    'TRUNCATE TABLE public."CurriculumContentRevision" CASCADE',
    'CurriculumContentRevision TRUNCATE',
    'P0001',
    'CurriculumContentRevision is append-only: TRUNCATE is not permitted'
  );

  PERFORM pg_temp.p2a_expect_rejected(
    format('UPDATE public."CurriculumGovernanceEvent" SET "reason" = %L WHERE "id" = %L', 'forbidden', event_id),
    'CurriculumGovernanceEvent UPDATE',
    'P0001',
    'CurriculumGovernanceEvent is append-only: UPDATE is not permitted'
  );
  PERFORM pg_temp.p2a_expect_rejected(
    format('DELETE FROM public."CurriculumGovernanceEvent" WHERE "id" = %L', event_id),
    'CurriculumGovernanceEvent DELETE',
    'P0001',
    'CurriculumGovernanceEvent is append-only: DELETE is not permitted'
  );
  PERFORM pg_temp.p2a_expect_rejected(
    'TRUNCATE TABLE public."CurriculumGovernanceEvent"',
    'CurriculumGovernanceEvent TRUNCATE',
    'P0001',
    'CurriculumGovernanceEvent is append-only: TRUNCATE is not permitted'
  );

  PERFORM pg_temp.p2a_expect_rejected(
    format('UPDATE public."CurriculumEvidence" SET "title" = %L WHERE "id" = %L', 'forbidden', evidence_id),
    'CurriculumEvidence UPDATE',
    'P0001',
    'CurriculumEvidence is append-only: UPDATE is not permitted'
  );
  PERFORM pg_temp.p2a_expect_rejected(
    format('DELETE FROM public."CurriculumEvidence" WHERE "id" = %L', evidence_id),
    'CurriculumEvidence DELETE',
    'P0001',
    'CurriculumEvidence is append-only: DELETE is not permitted'
  );
  PERFORM pg_temp.p2a_expect_rejected(
    'TRUNCATE TABLE public."CurriculumEvidence"',
    'CurriculumEvidence TRUNCATE',
    'P0001',
    'CurriculumEvidence is append-only: TRUNCATE is not permitted'
  );

  PERFORM pg_temp.p2a_expect_rejected(
    format('DELETE FROM public."CurriculumProvenance" WHERE "id" = %L', first_provenance_id),
    'CurriculumProvenance DELETE',
    'P0001',
    'CurriculumProvenance is durable and cannot be deleted'
  );
  PERFORM pg_temp.p2a_expect_rejected(
    'TRUNCATE TABLE public."CurriculumProvenance" CASCADE',
    'CurriculumProvenance TRUNCATE',
    'P0001',
    'CurriculumProvenance is durable and cannot be deleted'
  );

  UPDATE public."CurriculumProvenance"
  SET
    "lifecycleState" = 'PENDING_REVIEW',
    "provenanceCompleteness" = 'PARTIAL',
    "updatedAt" = CURRENT_TIMESTAMP
  WHERE "id" = first_provenance_id
  RETURNING "lifecycleState", "provenanceCompleteness"
  INTO projection_state, projection_completeness;

  IF projection_state <> 'PENDING_REVIEW'
     OR projection_completeness <> 'PARTIAL' THEN
    RAISE EXCEPTION
      'P2-A guard assertion failed: allowed lifecycle/completeness projection update did not persist';
  END IF;

  PERFORM pg_temp.p2a_expect_rejected(
    format(
      'UPDATE public."CurriculumProvenance" SET "curriculumContentId" = %L WHERE "id" = %L',
      second_content_id,
      first_provenance_id
    ),
    'CurriculumProvenance identity update',
    'P0001',
    'CurriculumProvenance identity fields are immutable'
  );

  PERFORM pg_temp.p2a_expect_rejected(
    format(
      'UPDATE public."CurriculumProvenance" SET "currentRevisionId" = %L WHERE "id" = %L',
      second_revision_id,
      first_provenance_id
    ),
    'cross-root currentRevisionId update',
    'P0001',
    'does not belong to CurriculumProvenance'
  );

  UPDATE public."CurriculumProvenance"
  SET
    "currentRevisionId" = first_revision_id,
    "updatedAt" = CURRENT_TIMESTAMP
  WHERE "id" = first_provenance_id;

  IF NOT EXISTS (
    SELECT 1
    FROM public."CurriculumProvenance"
    WHERE "id" = first_provenance_id
      AND "currentRevisionId" = first_revision_id
  ) THEN
    RAISE EXCEPTION
      'P2-A guard assertion failed: same-root currentRevisionId update failed';
  END IF;
END;
$$;

ROLLBACK;
