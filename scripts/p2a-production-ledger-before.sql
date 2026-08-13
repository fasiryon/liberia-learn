\pset pager off
\set ON_ERROR_STOP on

SELECT
  count(*) AS ledger_rows,
  count(DISTINCT migration_name) AS distinct_names,
  count(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) AS active_rows,
  count(*) FILTER (WHERE rolled_back_at IS NOT NULL) AS rolled_back_rows,
  count(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL) AS unfinished_rows,
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
    )) AS ledger_md5
FROM public._prisma_migrations;

SELECT migration_name, count(*) AS rows,
  count(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) AS active_rows,
  count(*) FILTER (WHERE rolled_back_at IS NOT NULL) AS rolled_back_rows
FROM public._prisma_migrations
GROUP BY migration_name
HAVING count(*) > 1
ORDER BY migration_name;

SELECT
  to_regclass('p2a_legacy_migration_history._prisma_migrations') IS NOT NULL
    AS legacy_archive_already_exists,
  to_regclass('public._prisma_migrations') IS NOT NULL AS public_ledger_exists;
