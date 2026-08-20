-- P2-C production cutover: post-apply verification for the dedupeKey
-- unique index. Run via scripts/p2a-production-psql.ps1 -File this-path
-- -UrlVariable DATABASE_URL immediately after
-- p2c-production-dedupekey-apply.sql.
--
-- PASS criteria: exactly one matching index, indisunique=true,
-- indisready=true, indisvalid=true.
--
-- If indisvalid=false: CREATE INDEX CONCURRENTLY failed partway through
-- (e.g. a conflicting concurrent write) and left an INVALID index in
-- place. A re-run of the apply script will silently no-op in this state
-- (IF NOT EXISTS only checks the name, not validity) -- do not re-run it
-- as-is. First DROP INDEX CONCURRENTLY "AIInteraction_dedupeKey_key";
-- then re-run the apply script.

\pset pager off
\set ON_ERROR_STOP on

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
  AND index_class.relname = 'AIInteraction_dedupeKey_key';

SELECT
  count(*) AS matching_indexes,
  bool_and(index_state.indisunique) AS all_unique,
  bool_and(index_state.indisready) AS all_ready,
  bool_and(index_state.indisvalid) AS all_valid
FROM pg_class AS index_class
JOIN pg_index AS index_state ON index_state.indexrelid = index_class.oid
JOIN pg_namespace AS namespace ON namespace.oid = index_class.relnamespace
WHERE namespace.nspname = 'public'
  AND index_class.relname = 'AIInteraction_dedupeKey_key';

-- Confirm the old non-unique index is gone (DROP INDEX CONCURRENTLY IF
-- EXISTS in the apply script should have removed it).
SELECT count(*) AS old_index_still_present
FROM pg_class AS index_class
JOIN pg_namespace AS namespace ON namespace.oid = index_class.relnamespace
WHERE namespace.nspname = 'public'
  AND index_class.relname = 'AIInteraction_dedupeKey_idx';

-- Re-run the duplicate check one more time post-apply, as a final sanity
-- check (should still be zero rows -- nothing in the apply step could have
-- introduced a duplicate, but this closes the loop).
SELECT "dedupeKey", count(*) AS occurrences
FROM public."AIInteraction"
WHERE "dedupeKey" IS NOT NULL
GROUP BY "dedupeKey"
HAVING count(*) > 1;
