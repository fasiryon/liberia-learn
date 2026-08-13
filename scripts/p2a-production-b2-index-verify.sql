\pset pager off
\set ON_ERROR_STOP on

SELECT index_class.relname, index_state.indisready, index_state.indisvalid,
  pg_get_indexdef(index_state.indexrelid) AS definition
FROM pg_class AS index_class
JOIN pg_index AS index_state ON index_state.indexrelid = index_class.oid
JOIN pg_namespace AS namespace ON namespace.oid = index_class.relnamespace
WHERE namespace.nspname = 'public'
  AND index_class.relname = 'AIInteraction_generationCorrelationId_createdAt_idx';

SELECT count(*) AS matching_indexes,
  bool_and(index_state.indisready) AS all_ready,
  bool_and(index_state.indisvalid) AS all_valid
FROM pg_class AS index_class
JOIN pg_index AS index_state ON index_state.indexrelid = index_class.oid
JOIN pg_namespace AS namespace ON namespace.oid = index_class.relnamespace
WHERE namespace.nspname = 'public'
  AND index_class.relname = 'AIInteraction_generationCorrelationId_createdAt_idx';
