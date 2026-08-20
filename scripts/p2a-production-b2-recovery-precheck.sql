\pset pager off
\set ON_ERROR_STOP on

SELECT table_name, column_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'AIInteraction'
  AND column_name = 'generationCorrelationId';

SELECT index_class.relname, index_state.indisready, index_state.indisvalid,
  pg_get_indexdef(index_state.indexrelid) AS definition
FROM pg_class AS index_class
JOIN pg_index AS index_state ON index_state.indexrelid = index_class.oid
JOIN pg_namespace AS namespace ON namespace.oid = index_class.relnamespace
WHERE namespace.nspname = 'public'
  AND index_class.relname = 'AIInteraction_generationCorrelationId_createdAt_idx';

SELECT migration_name, started_at, finished_at, rolled_back_at, applied_steps_count,
  CASE WHEN logs IS NULL OR logs = '' THEN NULL ELSE left(logs, 240) END AS log_excerpt
FROM public._prisma_migrations
WHERE migration_name IN (
  '20260728_000003_canonical_production_state_baseline',
  '20260803_000001_privileged_identity_hardening',
  '20260810_000001_p2a_curriculum_provenance_core',
  '20260810_000002_p2a_ai_generation_correlation',
  '20260810_000003_p2a_ai_generation_correlation_index',
  '20260810_000004_p2a_curriculum_provenance_immutability'
)
ORDER BY migration_name, started_at;

SELECT
  count(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL) AS unfinished_rows,
  count(*) FILTER (
    WHERE migration_name = '20260810_000003_p2a_ai_generation_correlation_index'
      AND finished_at IS NULL
      AND rolled_back_at IS NULL
  ) AS unfinished_b2_rows
FROM public._prisma_migrations;

SELECT
  to_regclass('public."CurriculumProvenance"') IS NOT NULL AS provenance_exists,
  to_regclass('public."CurriculumContentRevision"') IS NOT NULL AS revision_exists,
  to_regclass('public."CurriculumGovernanceEvent"') IS NOT NULL AS governance_exists,
  to_regclass('public."CurriculumEvidence"') IS NOT NULL AS evidence_exists;

SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'CurriculumProvenance',
    'CurriculumContentRevision',
    'CurriculumGovernanceEvent',
    'CurriculumEvidence'
  )
  AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, table_name, privilege_type;
