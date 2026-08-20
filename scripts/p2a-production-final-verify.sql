\pset pager off
\set ON_ERROR_STOP on

BEGIN TRANSACTION READ ONLY;

DO $$
DECLARE
  enum_count integer;
  table_count integer;
  trigger_count integer;
  disabled_trigger_count integer;
  fk_count integer;
  invalid_fk_count integer;
  unique_index_count integer;
  invalid_unique_index_count integer;
  content_count bigint;
  root_count bigint;
  missing_pointer_count bigint;
  duplicate_sequence_count bigint;
  unaudited_event_count bigint;
  unsafe_grant_count bigint;
  unfinished_migration_count bigint;
  active_p2a_migration_count bigint;
BEGIN
  SELECT count(*) INTO enum_count
  FROM pg_type t
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public'
    AND t.typname IN (
      'CurriculumProvenanceCompleteness', 'CurriculumLifecycleState',
      'CurriculumRevisionKind', 'CurriculumOriginKind',
      'CurriculumGovernanceEventType', 'CurriculumGovernanceActorType',
      'CurriculumApprovalBasis', 'CurriculumReviewAuthority',
      'CurriculumFutureAssignmentPolicy', 'CurriculumExistingAssignmentPolicy',
      'CurriculumOfflineCachePolicy', 'CurriculumEvidenceType',
      'CurriculumEvidencePurpose', 'CurriculumEvidenceStatus'
    );
  IF enum_count <> 14 THEN RAISE EXCEPTION 'Expected 14 P2-A enums, found %', enum_count; END IF;

  SELECT count(*) INTO table_count
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
    AND c.relname IN ('CurriculumProvenance', 'CurriculumContentRevision', 'CurriculumGovernanceEvent', 'CurriculumEvidence');
  IF table_count <> 4 THEN RAISE EXCEPTION 'Expected four P2-A tables, found %', table_count; END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'CurriculumContent' AND column_name = 'provenance'
  ) THEN RAISE EXCEPTION 'Unexpected physical provenance column exists'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'CurriculumGovernanceEvent'
      AND column_name = 'riskReasons' AND is_nullable = 'NO'
      AND column_default LIKE '%ARRAY[]%'
  ) THEN RAISE EXCEPTION 'riskReasons invariant failed'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'AIInteraction'
      AND column_name = 'generationCorrelationId' AND is_nullable = 'YES' AND column_default IS NULL
  ) THEN RAISE EXCEPTION 'AI generation correlation column invariant failed'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'AIInteraction_generationCorrelationId_createdAt_idx'
      AND i.indisready AND i.indisvalid
  ) THEN RAISE EXCEPTION 'B2 index is not ready and valid'; END IF;

  SELECT count(*), count(*) FILTER (WHERE t.tgenabled <> 'O')
    INTO trigger_count, disabled_trigger_count
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND NOT t.tgisinternal
    AND c.relname IN ('CurriculumProvenance', 'CurriculumContentRevision', 'CurriculumGovernanceEvent', 'CurriculumEvidence');
  IF trigger_count <> 10 OR disabled_trigger_count <> 0 THEN
    RAISE EXCEPTION 'P2-A trigger invariant failed: total %, disabled %', trigger_count, disabled_trigger_count;
  END IF;

  SELECT count(*), count(*) FILTER (WHERE NOT convalidated)
    INTO fk_count, invalid_fk_count
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND con.contype = 'f'
    AND c.relname IN ('CurriculumProvenance', 'CurriculumContentRevision', 'CurriculumGovernanceEvent', 'CurriculumEvidence');
  IF fk_count <> 12 OR invalid_fk_count <> 0 THEN
    RAISE EXCEPTION 'P2-A FK invariant failed: total %, invalid %', fk_count, invalid_fk_count;
  END IF;

  SELECT count(*), count(*) FILTER (WHERE NOT i.indisready OR NOT i.indisvalid)
    INTO unique_index_count, invalid_unique_index_count
  FROM pg_index i
  JOIN pg_class c ON c.oid = i.indrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND i.indisunique
    AND c.relname IN ('CurriculumProvenance', 'CurriculumContentRevision', 'CurriculumGovernanceEvent', 'CurriculumEvidence');
  -- Four primary-key indexes plus ten reviewed unique indexes.
  IF unique_index_count <> 14 OR invalid_unique_index_count <> 0 THEN
    RAISE EXCEPTION 'P2-A unique index invariant failed: total %, invalid %', unique_index_count, invalid_unique_index_count;
  END IF;

  SELECT count(*) INTO content_count FROM "CurriculumContent";
  SELECT count(*) INTO root_count FROM "CurriculumProvenance";
  SELECT count(*) INTO missing_pointer_count
  FROM "CurriculumProvenance" p
  LEFT JOIN "CurriculumContentRevision" r
    ON r.id = p."currentRevisionId" AND r."provenanceId" = p.id
  WHERE p."currentRevisionId" IS NULL OR r.id IS NULL;
  SELECT count(*) INTO duplicate_sequence_count FROM (
    SELECT "provenanceId", sequence FROM "CurriculumContentRevision"
    GROUP BY 1, 2 HAVING count(*) > 1
  ) duplicates;
  SELECT count(*) INTO unaudited_event_count
  FROM "CurriculumGovernanceEvent" WHERE "auditLogId" IS NULL;
  IF content_count <> root_count OR missing_pointer_count <> 0 OR duplicate_sequence_count <> 0 OR unaudited_event_count <> 0 THEN
    RAISE EXCEPTION 'Provenance integrity failed: content %, roots %, missing pointers %, duplicate sequences %, unaudited events %',
      content_count, root_count, missing_pointer_count, duplicate_sequence_count, unaudited_event_count;
  END IF;

  SELECT count(*) INTO unsafe_grant_count
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name IN ('CurriculumProvenance', 'CurriculumContentRevision', 'CurriculumGovernanceEvent', 'CurriculumEvidence')
    AND grantee IN ('anon', 'authenticated', 'service_role');
  IF unsafe_grant_count <> 0 THEN RAISE EXCEPTION 'Unsafe direct P2-A client grants found: %', unsafe_grant_count; END IF;

  SELECT count(*) INTO unfinished_migration_count
  FROM public._prisma_migrations
  WHERE finished_at IS NULL AND rolled_back_at IS NULL;
  SELECT count(*) INTO active_p2a_migration_count
  FROM public._prisma_migrations
  WHERE migration_name LIKE '20260810_00000%_p2a_%'
    AND finished_at IS NOT NULL AND rolled_back_at IS NULL;
  IF unfinished_migration_count <> 0 OR active_p2a_migration_count <> 4 THEN
    RAISE EXCEPTION 'Migration ledger invariant failed: unfinished %, active P2-A %',
      unfinished_migration_count, active_p2a_migration_count;
  END IF;
END $$;

SELECT
  current_database() AS database,
  current_user AS database_user,
  current_setting('server_version') AS server_version,
  (SELECT count(*) FROM "CurriculumContent") AS curriculum_rows,
  (SELECT count(*) FROM "CurriculumProvenance") AS provenance_roots,
  (SELECT count(*) FROM "CurriculumContentRevision") AS revisions,
  (SELECT count(*) FROM "CurriculumGovernanceEvent") AS governance_events,
  (SELECT count(*) FROM "CurriculumEvidence") AS evidence_rows,
  (SELECT count(*) FROM "CurriculumProvenance" WHERE "provenanceCompleteness" = 'VERIFIED') AS verified,
  (SELECT count(*) FROM "CurriculumProvenance" WHERE "provenanceCompleteness" = 'PARTIAL') AS partial,
  (SELECT count(*) FROM "CurriculumProvenance" WHERE "provenanceCompleteness" = 'UNVERIFIED') AS unverified,
  (SELECT count(*) FROM pg_stat_activity
    WHERE datname = current_database() AND pid <> pg_backend_pid()
      AND backend_xid IS NOT NULL AND xact_start < clock_timestamp() - interval '5 minutes') AS long_transactions,
  (SELECT count(*) FROM pg_locks WHERE NOT granted) AS ungranted_locks;

ROLLBACK;
