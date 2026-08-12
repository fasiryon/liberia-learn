\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

SELECT concat_ws('|',
  (SELECT count(*) FROM public."_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL),
  (SELECT count(*) FROM public."_prisma_migrations" WHERE migration_name = '20260803_000001_privileged_identity_hardening' AND finished_at IS NOT NULL AND rolled_back_at IS NULL),
  (SELECT COALESCE(string_agg(migration_name, ',' ORDER BY started_at), '') FROM public."_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL),
  (SELECT count(*) FROM public."_prisma_migrations" WHERE migration_name LIKE '%p2a%'),
  (SELECT count(*) FROM public."CurriculumContent" WHERE "contentId" IN ('p2a-staging-fixture-content-1', 'p2a-staging-fixture-content-2')),
  (SELECT count(*) FROM (VALUES
    (to_regclass('public."CurriculumProvenance"')),
    (to_regclass('public."CurriculumContentRevision"')),
    (to_regclass('public."CurriculumGovernanceEvent"')),
    (to_regclass('public."CurriculumEvidence"'))
  ) AS relations(relation_name) WHERE relation_name IS NOT NULL)
);
