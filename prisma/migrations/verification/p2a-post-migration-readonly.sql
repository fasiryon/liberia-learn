\set ON_ERROR_STOP on

-- Final SELECT-only verification after A, B1, B2, and C.
-- Each assertion divides by zero on failure so psql exits nonzero.

SELECT
  current_database() AS database_name,
  current_user AS database_user,
  inet_server_addr() AS server_address,
  current_setting('server_version') AS server_version,
  current_schema() AS current_schema;

WITH expected_enum(enum_name) AS (
  VALUES
    ('CurriculumProvenanceCompleteness'),
    ('CurriculumLifecycleState'),
    ('CurriculumRevisionKind'),
    ('CurriculumOriginKind'),
    ('CurriculumGovernanceEventType'),
    ('CurriculumGovernanceActorType'),
    ('CurriculumApprovalBasis'),
    ('CurriculumReviewAuthority'),
    ('CurriculumFutureAssignmentPolicy'),
    ('CurriculumExistingAssignmentPolicy'),
    ('CurriculumOfflineCachePolicy'),
    ('CurriculumEvidenceType'),
    ('CurriculumEvidencePurpose'),
    ('CurriculumEvidenceStatus')
), enum_result AS (
  SELECT
    count(found_type.oid)::INTEGER AS installed_count,
    count(*) FILTER (WHERE found_type.oid IS NULL)::INTEGER AS missing_count,
    array_agg(expected.enum_name ORDER BY expected.enum_name)
      FILTER (WHERE found_type.oid IS NULL) AS missing_enums
  FROM expected_enum expected
  LEFT JOIN pg_catalog.pg_type found_type
    ON found_type.typname = expected.enum_name
  LEFT JOIN pg_catalog.pg_namespace type_schema
    ON type_schema.oid = found_type.typnamespace
   AND type_schema.nspname = 'public'
  WHERE found_type.oid IS NULL OR type_schema.oid IS NOT NULL
)
SELECT
  installed_count AS installed_enum_count,
  missing_enums,
  1 / CASE
    WHEN installed_count = 14 AND missing_count = 0 THEN 1
    ELSE 0
  END AS enum_assertion
FROM enum_result;

WITH expected_table(table_name) AS (
  VALUES
    ('CurriculumProvenance'),
    ('CurriculumContentRevision'),
    ('CurriculumGovernanceEvent'),
    ('CurriculumEvidence')
), table_result AS (
  SELECT
    expected.table_name,
    to_regclass(format('public.%I', expected.table_name)) AS relation_name
  FROM expected_table expected
)
SELECT
  table_name,
  relation_name,
  1 / CASE WHEN relation_name IS NOT NULL THEN 1 ELSE 0 END AS table_assertion
FROM table_result
ORDER BY table_name;

WITH risk_column AS (
  SELECT
    column_info.is_nullable,
    column_info.column_default
  FROM information_schema.columns column_info
  WHERE column_info.table_schema = 'public'
    AND column_info.table_name = 'CurriculumGovernanceEvent'
    AND column_info.column_name = 'riskReasons'
)
SELECT
  count(*) AS matching_column_count,
  array_agg(is_nullable) AS nullable_values,
  array_agg(column_default) AS default_values,
  1 / CASE
    WHEN count(*) = 1
      AND bool_and(
        is_nullable = 'NO'
        AND column_default IS NOT NULL
        AND position('ARRAY[]::text[]' IN column_default) > 0
      )
    THEN 1
    ELSE 0
  END AS risk_reasons_assertion
FROM risk_column;

WITH correlation_column AS (
  SELECT
    column_info.is_nullable,
    column_info.column_default
  FROM information_schema.columns column_info
  WHERE column_info.table_schema = 'public'
    AND column_info.table_name = 'AIInteraction'
    AND column_info.column_name = 'generationCorrelationId'
)
SELECT
  count(*) AS matching_column_count,
  array_agg(is_nullable) AS nullable_values,
  array_agg(column_default) AS default_values,
  1 / CASE
    WHEN count(*) = 1
      AND bool_and(is_nullable = 'YES' AND column_default IS NULL)
    THEN 1
    ELSE 0
  END AS generation_correlation_assertion
FROM correlation_column;

WITH index_result AS (
  SELECT
    index_class.relname AS index_name,
    index_state.indisready,
    index_state.indisvalid,
    pg_catalog.pg_get_indexdef(index_state.indexrelid) AS index_definition
  FROM pg_catalog.pg_index index_state
  JOIN pg_catalog.pg_class index_class
    ON index_class.oid = index_state.indexrelid
  JOIN pg_catalog.pg_namespace index_schema
    ON index_schema.oid = index_class.relnamespace
  WHERE index_schema.nspname = 'public'
    AND index_class.relname = 'AIInteraction_generationCorrelationId_createdAt_idx'
)
SELECT
  count(*) AS matching_index_count,
  array_agg(index_name) AS index_names,
  array_agg(indisready) AS ready_values,
  array_agg(indisvalid) AS valid_values,
  array_agg(index_definition) AS index_definitions,
  1 / CASE
    WHEN count(*) = 1
      AND bool_and(
        indisready
        AND indisvalid
        AND position('"generationCorrelationId", "createdAt"' IN index_definition) > 0
      )
    THEN 1
    ELSE 0
  END AS b2_index_assertion
FROM index_result;

WITH expected_trigger(trigger_name) AS (
  VALUES
    ('curriculum_content_revision_no_update_or_delete'),
    ('curriculum_governance_event_no_update_or_delete'),
    ('curriculum_evidence_no_update_or_delete'),
    ('curriculum_content_revision_no_truncate'),
    ('curriculum_governance_event_no_truncate'),
    ('curriculum_evidence_no_truncate'),
    ('curriculum_provenance_no_delete'),
    ('curriculum_provenance_no_truncate'),
    ('curriculum_provenance_identity_no_update'),
    ('curriculum_provenance_current_revision_guard')
), trigger_result AS (
  SELECT
    expected.trigger_name,
    table_class.relname AS table_name,
    trigger.tgenabled,
    pg_catalog.pg_get_triggerdef(trigger.oid) AS trigger_definition
  FROM expected_trigger expected
  LEFT JOIN pg_catalog.pg_trigger trigger
    ON trigger.tgname = expected.trigger_name
   AND NOT trigger.tgisinternal
  LEFT JOIN pg_catalog.pg_class table_class
    ON table_class.oid = trigger.tgrelid
  LEFT JOIN pg_catalog.pg_namespace table_schema
    ON table_schema.oid = table_class.relnamespace
   AND table_schema.nspname = 'public'
  WHERE trigger.oid IS NULL OR table_schema.oid IS NOT NULL
)
SELECT
  trigger_name,
  table_name,
  tgenabled,
  trigger_definition,
  1 / CASE
    WHEN table_name IS NOT NULL AND tgenabled = 'O' THEN 1
    ELSE 0
  END AS trigger_assertion
FROM trigger_result
ORDER BY trigger_name;

WITH expected_fk(constraint_name) AS (
  VALUES
    ('CurriculumProvenance_curriculumContentId_fkey'),
    ('CurriculumContentRevision_provenanceId_fkey'),
    ('CurriculumContentRevision_authorUserId_fkey'),
    ('CurriculumContentRevision_sourceRevisionId_fkey'),
    ('CurriculumProvenance_currentRevisionId_fkey'),
    ('CurriculumGovernanceEvent_revisionId_provenanceId_fkey'),
    ('CurriculumGovernanceEvent_replacementRevisionId_fkey'),
    ('CurriculumGovernanceEvent_actorUserId_fkey'),
    ('CurriculumGovernanceEvent_auditLogId_fkey'),
    ('CurriculumEvidence_revisionId_fkey'),
    ('CurriculumEvidence_addedByUserId_fkey'),
    ('CurriculumEvidence_supersedesEvidenceId_fkey')
), fk_result AS (
  SELECT
    expected.constraint_name,
    constraint_row.convalidated,
    pg_catalog.pg_get_constraintdef(constraint_row.oid) AS constraint_definition
  FROM expected_fk expected
  LEFT JOIN pg_catalog.pg_constraint constraint_row
    ON constraint_row.conname = expected.constraint_name
   AND constraint_row.contype = 'f'
  LEFT JOIN pg_catalog.pg_namespace constraint_schema
    ON constraint_schema.oid = constraint_row.connamespace
   AND constraint_schema.nspname = 'public'
  WHERE constraint_row.oid IS NULL OR constraint_schema.oid IS NOT NULL
)
SELECT
  constraint_name,
  convalidated,
  constraint_definition,
  1 / CASE
    WHEN convalidated THEN 1
    ELSE 0
  END AS foreign_key_assertion
FROM fk_result
ORDER BY constraint_name;

WITH expected_unique(index_name) AS (
  VALUES
    ('CurriculumProvenance_curriculumContentId_key'),
    ('CurriculumProvenance_currentRevisionId_key'),
    ('CurriculumContentRevision_idempotencyKey_key'),
    ('CurriculumContentRevision_provenanceId_sequence_key'),
    ('CurriculumContentRevision_id_provenanceId_key'),
    ('CurriculumGovernanceEvent_auditLogId_key'),
    ('CurriculumGovernanceEvent_idempotencyKey_key'),
    ('CurriculumGovernanceEvent_provenanceId_sequence_key'),
    ('CurriculumEvidence_supersedesEvidenceId_key'),
    ('CurriculumEvidence_idempotencyKey_key')
), unique_result AS (
  SELECT
    expected.index_name,
    index_state.indisunique,
    index_state.indisready,
    index_state.indisvalid,
    pg_catalog.pg_get_indexdef(index_state.indexrelid) AS index_definition
  FROM expected_unique expected
  LEFT JOIN pg_catalog.pg_class index_class
    ON index_class.relname = expected.index_name
  LEFT JOIN pg_catalog.pg_namespace index_schema
    ON index_schema.oid = index_class.relnamespace
   AND index_schema.nspname = 'public'
  LEFT JOIN pg_catalog.pg_index index_state
    ON index_state.indexrelid = index_class.oid
  WHERE index_class.oid IS NULL OR index_schema.oid IS NOT NULL
)
SELECT
  index_name,
  indisunique,
  indisready,
  indisvalid,
  index_definition,
  1 / CASE
    WHEN indisunique AND indisready AND indisvalid THEN 1
    ELSE 0
  END AS unique_index_assertion
FROM unique_result
ORDER BY index_name;

WITH expected_migration(migration_name) AS (
  VALUES
    ('20260810_000001_p2a_curriculum_provenance_core'),
    ('20260810_000002_p2a_ai_generation_correlation'),
    ('20260810_000003_p2a_ai_generation_correlation_index'),
    ('20260810_000004_p2a_curriculum_provenance_immutability')
), migration_result AS (
  SELECT
    expected.migration_name,
    count(*) FILTER (
      WHERE migration.finished_at IS NOT NULL
        AND migration.rolled_back_at IS NULL
    )::INTEGER AS applied_count,
    count(*) FILTER (
      WHERE migration.finished_at IS NULL
        AND migration.rolled_back_at IS NOT NULL
    )::INTEGER AS rolled_back_count,
    count(*) FILTER (
      WHERE migration.finished_at IS NULL
        AND migration.rolled_back_at IS NULL
    )::INTEGER AS unresolved_count
  FROM expected_migration expected
  LEFT JOIN public."_prisma_migrations" migration
    ON migration.migration_name = expected.migration_name
  GROUP BY expected.migration_name
)
SELECT
  migration_name,
  applied_count,
  rolled_back_count,
  unresolved_count,
  1 / CASE
    WHEN applied_count = 1
      AND unresolved_count = 0
      AND (
        (migration_name = '20260810_000003_p2a_ai_generation_correlation_index'
          AND rolled_back_count IN (0, 1))
        OR
        (migration_name <> '20260810_000003_p2a_ai_generation_correlation_index'
          AND rolled_back_count = 0)
      )
    THEN 1
    ELSE 0
  END AS migration_state_assertion
FROM migration_result
ORDER BY migration_name;

WITH unexpected_column AS (
  SELECT column_info.column_name
  FROM information_schema.columns column_info
  WHERE column_info.table_schema = 'public'
    AND column_info.table_name = 'CurriculumContent'
    AND lower(column_info.column_name) LIKE '%provenance%'
)
SELECT
  array_agg(column_name ORDER BY column_name) AS unexpected_provenance_columns,
  1 / CASE WHEN count(*) = 0 THEN 1 ELSE 0 END AS curriculum_content_column_assertion
FROM unexpected_column;
