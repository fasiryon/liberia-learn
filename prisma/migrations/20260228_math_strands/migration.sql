-- Migration: 20260228_math_strands
-- ACTION-3: Add missing MATH G10_12 strands (resolves LR-MATH-G10_12-04 and -05)
-- ACTION-8: Add MATH G1_3 time_calendar strand (resolves LR-MATH-G1_3-05 mismatch)
--
-- These strands close the last intervention-path gaps in MATH:
--   LR-MATH-G10_12-04 (sequences/series/financial math) → financial_sequences
--   LR-MATH-G10_12-05 (matrices/vectors) → matrices_vectors
--   LR-MATH-G1_3-05   (time/calendar) → time_calendar
--     (previously mapped to "patterns" strand — wrong content domain)

INSERT INTO "StrandCatalog" ("id", "subject", "strandKey", "name", "gradeBand", "waecRef", "isActive", "createdAt")
VALUES
  (gen_random_uuid()::text, 'MATH', 'financial_sequences', 'Sequences, Series & Financial Math', 'G10_12', 'WASSCE-MATH-A6', true, NOW()),
  (gen_random_uuid()::text, 'MATH', 'matrices_vectors',    'Matrices & Vectors',                  'G10_12', 'WASSCE-MATH-A7', true, NOW()),
  (gen_random_uuid()::text, 'MATH', 'time_calendar',       'Time, Calendar & Sequencing',         'G1_3',   NULL,             true, NOW())
ON CONFLICT ("subject", "strandKey") DO NOTHING;
