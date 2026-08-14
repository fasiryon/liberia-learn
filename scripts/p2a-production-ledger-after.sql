\pset pager off
\set ON_ERROR_STOP on

SELECT
  count(*) AS archived_rows,
  count(DISTINCT migration_name) AS archived_distinct_names,
  count(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) AS archived_active_rows,
  count(*) FILTER (WHERE rolled_back_at IS NOT NULL) AS archived_rolled_back_rows,
  count(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL) AS archived_unfinished_rows,
  md5(string_agg(
      concat_ws('|',
        id,
        migration_name,
        checksum,
        started_at::text,
        COALESCE(finished_at::text, ''),
        COALESCE(rolled_back_at::text, ''),
        applied_steps_count::text
      ),
      E'\n' ORDER BY started_at, id
    )) AS archived_ledger_md5
FROM p2a_legacy_migration_history._prisma_migrations;

SELECT migration_name, checksum, started_at, finished_at, rolled_back_at,
  finished_at IS NOT NULL AS finished,
  rolled_back_at IS NOT NULL AS rolled_back, applied_steps_count
FROM public._prisma_migrations
ORDER BY started_at, migration_name;

SELECT client_role.rolname AS client_role,
  has_schema_privilege(client_role.oid, 'p2a_legacy_migration_history', 'USAGE') AS archive_usage,
  has_table_privilege(client_role.oid, 'p2a_legacy_migration_history._prisma_migrations', 'SELECT') AS archive_select
FROM pg_roles AS client_role
WHERE client_role.rolname IN ('anon', 'authenticated', 'service_role')
ORDER BY client_role.rolname;

SELECT
  to_regclass('public."PrivilegedIdentity"') IS NOT NULL AS privileged_identity_exists,
  to_regclass('public."PrivilegedSessionAssurance"') IS NOT NULL AS privileged_session_exists,
  (SELECT count(*) FROM public."PrivilegedIdentity") AS privileged_identity_rows,
  (SELECT count(*) FROM public."PrivilegedSessionAssurance") AS privileged_session_rows;
