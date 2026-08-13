\pset pager off
\set ON_ERROR_STOP on

SELECT
  current_database() AS database,
  current_user AS database_user,
  current_setting('server_version') AS server_version,
  ssl.ssl AS ssl_active,
  ssl.version AS ssl_version
FROM pg_stat_ssl AS ssl
WHERE ssl.pid = pg_backend_pid();

SELECT
  count(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL) AS unfinished_migrations,
  count(*) FILTER (WHERE migration_name LIKE '20260810_00000%_p2a_%') AS p2a_ledger_rows,
  count(*) AS total_ledger_rows
FROM public._prisma_migrations;

SELECT migration_name, started_at, finished_at, rolled_back_at, applied_steps_count
FROM public._prisma_migrations
WHERE migration_name LIKE '20260810_00000%_p2a_%'
ORDER BY migration_name;

SELECT
  to_regclass('public."CurriculumProvenance"') IS NOT NULL AS provenance_exists,
  to_regclass('public."CurriculumContentRevision"') IS NOT NULL AS revision_exists,
  to_regclass('public."CurriculumGovernanceEvent"') IS NOT NULL AS governance_exists,
  to_regclass('public."CurriculumEvidence"') IS NOT NULL AS evidence_exists;

SELECT
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'AIInteraction'
      AND column_name = 'generationCorrelationId'
  ) AS correlation_column_exists,
  to_regclass('public."AIInteraction_generationCorrelationId_createdAt_idx"') IS NOT NULL
    AS correlation_index_exists;

SELECT
  current_setting('pgrst.db_schemas', true) AS postgrest_exposed_schemas,
  has_schema_privilege('anon', 'public', 'USAGE') AS anon_public_usage,
  has_schema_privilege('authenticated', 'public', 'USAGE') AS authenticated_public_usage,
  has_schema_privilege('service_role', 'public', 'USAGE') AS service_role_public_usage;

SELECT
  owner_role.rolname AS owner_role,
  namespace.nspname AS schema_name,
  defaults.defaclobjtype AS object_type,
  grantee_role.rolname AS grantee_role,
  privileges.privilege_type,
  privileges.is_grantable
FROM pg_default_acl AS defaults
JOIN pg_roles AS owner_role ON owner_role.oid = defaults.defaclrole
LEFT JOIN pg_namespace AS namespace ON namespace.oid = defaults.defaclnamespace
CROSS JOIN LATERAL aclexplode(defaults.defaclacl) AS privileges
JOIN pg_roles AS grantee_role ON grantee_role.oid = privileges.grantee
WHERE COALESCE(namespace.nspname, 'public') = 'public'
  AND grantee_role.rolname IN ('anon', 'authenticated', 'service_role')
ORDER BY owner_role.rolname, grantee_role.rolname, privileges.privilege_type;

SELECT
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'CurriculumContent'
  AND grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY grantee, privilege_type;

SELECT
  cls.relrowsecurity AS curriculum_content_rls_enabled,
  cls.relforcerowsecurity AS curriculum_content_rls_forced
FROM pg_class AS cls
JOIN pg_namespace AS namespace ON namespace.oid = cls.relnamespace
WHERE namespace.nspname = 'public'
  AND cls.relname = 'CurriculumContent';

SELECT
  count(*) FILTER (
    WHERE backend_xid IS NOT NULL
      AND xact_start < clock_timestamp() - interval '5 minutes'
  ) AS active_transactions_over_five_minutes,
  count(*) FILTER (WHERE wait_event_type = 'Lock') AS sessions_waiting_on_locks
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid();

SELECT
  count(*) AS ungranted_locks
FROM pg_locks
WHERE NOT granted;
