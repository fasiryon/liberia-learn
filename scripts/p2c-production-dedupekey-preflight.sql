-- P2-C production cutover, dedupeKey unique index: read-only preflight.
-- Run via scripts/p2a-production-psql.ps1 -File this-path -UrlVariable DATABASE_URL
-- (.env.p2a-production.local sets DATABASE_URL, not P2A_PRODUCTION_DATABASE_URL)
--
-- Confirms: table exists, current dedupeKey duplicate-free (the hard-stop
-- condition), current state of both the old non-unique index and the new
-- unique index. Mutates nothing.

\pset pager off
\set ON_ERROR_STOP on

-- Positive table existence check.
SELECT to_regclass('public."AIInteraction"') IS NOT NULL AS ai_interaction_exists;

-- Row/dedupeKey statistics -- the hard-stop check.
SELECT
  count(*) AS total_rows,
  count(*) FILTER (WHERE "dedupeKey" IS NULL) AS null_dedupekey_rows,
  count(*) FILTER (WHERE "dedupeKey" IS NOT NULL) AS non_null_dedupekey_rows,
  count(DISTINCT "dedupeKey") FILTER (WHERE "dedupeKey" IS NOT NULL) AS distinct_non_null_dedupekey
FROM public."AIInteraction";

-- Duplicate non-null dedupeKey groups -- must be zero rows returned.
SELECT "dedupeKey", count(*) AS occurrences
FROM public."AIInteraction"
WHERE "dedupeKey" IS NOT NULL
GROUP BY "dedupeKey"
HAVING count(*) > 1
ORDER BY occurrences DESC;

-- Current index state on AIInteraction.dedupeKey (old non-unique, new unique).
SELECT
  index_class.relname AS index_name,
  index_state.indisunique AS is_unique,
  index_state.indisready AS is_ready,
  index_state.indisvalid AS is_valid,
  pg_get_indexdef(index_state.indexrelid) AS definition
FROM pg_class AS index_class
JOIN pg_index AS index_state ON index_state.indexrelid = index_class.oid
JOIN pg_namespace AS namespace ON namespace.oid = index_class.relnamespace
WHERE namespace.nspname = 'public'
  AND index_class.relname IN ('AIInteraction_dedupeKey_idx', 'AIInteraction_dedupeKey_key');

-- Ledger state -- confirms whether this migration is already recorded.
SELECT migration_name, checksum, started_at, finished_at, rolled_back_at
FROM public._prisma_migrations
WHERE migration_name = '20260819_000001_p2c_ai_interaction_dedupekey_unique';
