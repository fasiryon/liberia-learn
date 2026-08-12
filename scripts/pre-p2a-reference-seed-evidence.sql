\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

SELECT jsonb_build_object(
  'trainingModuleCount', (
    SELECT count(*)
    FROM "TrainingModule"
    WHERE "code" IN (
      'l1-login-nav', 'l1-class-work', 'l2-create-lesson', 'l2-create-assignment',
      'l2-grade-feedback', 'l2-message-guardians', 'l3-view-reports', 'l3-guided-tools'
    )
  ),
  'strandCount', (
    SELECT count(*) FROM "StrandCatalog" WHERE "id" LIKE 'ref-v1-strand-%'
  ),
  'standardCount', (
    SELECT count(*) FROM "Standard" WHERE "id" LIKE 'ref-v1-standard-%'
  ),
  'dataHash', md5(
    (SELECT string_agg(row_to_json(module_row)::text, '' ORDER BY module_row."code" COLLATE "C")
     FROM (
       SELECT "id", "code", "title", "description", "sortOrder", "estimatedMinutes", "isActive"
       FROM "TrainingModule"
       WHERE "code" IN (
         'l1-login-nav', 'l1-class-work', 'l2-create-lesson', 'l2-create-assignment',
         'l2-grade-feedback', 'l2-message-guardians', 'l3-view-reports', 'l3-guided-tools'
       )
     ) module_row) ||
    (SELECT string_agg(row_to_json(strand_row)::text, '' ORDER BY strand_row."subject"::text COLLATE "C", strand_row."strandKey" COLLATE "C")
     FROM (
       SELECT "id", "subject", "strandKey", "name", "gradeBand", "waecRef", "isActive"
       FROM "StrandCatalog"
       WHERE "id" LIKE 'ref-v1-strand-%'
     ) strand_row) ||
    (SELECT string_agg(row_to_json(standard_row)::text, '' ORDER BY standard_row."code" COLLATE "C")
     FROM (
       SELECT "id", "code", "description", "subject", "band"
       FROM "Standard"
       WHERE "id" LIKE 'ref-v1-standard-%'
     ) standard_row)
  )
);
