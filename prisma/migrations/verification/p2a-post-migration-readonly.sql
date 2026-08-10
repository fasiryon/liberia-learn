\set ON_ERROR_STOP on

SELECT
  current_database() AS database_name,
  current_user AS database_user,
  inet_server_addr() AS server_address,
  current_setting('server_version') AS server_version;

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
)
SELECT
  count(found.typname) AS installed_enum_count,
  array_agg(expected.enum_name ORDER BY expected.enum_name)
    FILTER (WHERE found.typname IS NULL) AS missing_enums
FROM expected_enum expected
LEFT JOIN pg_type found ON found.typname = expected.enum_name;

SELECT
  table_name,
  to_regclass(format('public.%I', table_name)) IS NOT NULL AS exists
FROM (
  VALUES
    ('CurriculumProvenance'),
    ('CurriculumContentRevision'),
    ('CurriculumGovernanceEvent'),
    ('CurriculumEvidence')
) AS expected_table(table_name)
ORDER BY table_name;

SELECT
  table_name,
  column_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'CurriculumGovernanceEvent' AND column_name = 'riskReasons')
    OR
    (table_name = 'AIInteraction' AND column_name = 'generationCorrelationId')
  )
ORDER BY table_name, column_name;

SELECT
  index_class.relname AS index_name,
  index_state.indisready,
  index_state.indisvalid,
  pg_get_indexdef(index_state.indexrelid) AS index_definition
FROM pg_index index_state
JOIN pg_class index_class ON index_class.oid = index_state.indexrelid
WHERE index_class.relname = 'AIInteraction_generationCorrelationId_createdAt_idx';

SELECT
  table_class.relname AS table_name,
  trigger.tgname AS trigger_name,
  trigger.tgenabled,
  pg_get_triggerdef(trigger.oid) AS trigger_definition
FROM pg_trigger trigger
JOIN pg_class table_class ON table_class.oid = trigger.tgrelid
WHERE NOT trigger.tgisinternal
  AND trigger.tgname IN (
    'curriculum_content_revision_no_update_or_delete',
    'curriculum_governance_event_no_update_or_delete',
    'curriculum_evidence_no_update_or_delete',
    'curriculum_content_revision_no_truncate',
    'curriculum_governance_event_no_truncate',
    'curriculum_evidence_no_truncate',
    'curriculum_provenance_no_delete',
    'curriculum_provenance_no_truncate',
    'curriculum_provenance_identity_no_update',
    'curriculum_provenance_current_revision_guard'
  )
ORDER BY table_name, trigger_name;

SELECT
  migration_name,
  started_at,
  finished_at,
  rolled_back_at,
  logs
FROM "_prisma_migrations"
WHERE migration_name IN (
  '20260810_000001_p2a_curriculum_provenance_core',
  '20260810_000002_p2a_ai_generation_correlation',
  '20260810_000003_p2a_ai_generation_correlation_index',
  '20260810_000004_p2a_curriculum_provenance_immutability'
)
ORDER BY migration_name;
