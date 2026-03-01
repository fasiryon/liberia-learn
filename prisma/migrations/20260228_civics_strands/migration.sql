-- Migration: 20260228_civics_strands
-- ACTION-1: Add CIVICS strands to StrandCatalog (MOE Standards Coverage GAP-1)
--
-- CIVICS had 6 MOE standard codes but zero StrandCatalog entries.
-- This broke mastery tracking and the intervention signal path for all
-- Civics standards. These 6 strands align 1:1 with the 6 CIVICS MOE codes.

INSERT INTO "StrandCatalog" ("id", "subject", "strandKey", "name", "gradeBand", "isActive", "createdAt")
VALUES
  (gen_random_uuid()::text, 'CIVICS', 'national_identity',       'National Identity & Symbols',             'G1_3',   true, NOW()),
  (gen_random_uuid()::text, 'CIVICS', 'government_basics',       'Structure of Government',                 'G4_6',   true, NOW()),
  (gen_random_uuid()::text, 'CIVICS', 'rights_responsibilities', 'Rights & Civic Duties',                   'G4_6',   true, NOW()),
  (gen_random_uuid()::text, 'CIVICS', 'liberian_history',        'Liberian History',                        'G7_9',   true, NOW()),
  (gen_random_uuid()::text, 'CIVICS', 'constitutional_law',      'Constitutional Government',               'G7_9',   true, NOW()),
  (gen_random_uuid()::text, 'CIVICS', 'international_relations', 'International Relations & Global Bodies', 'G10_12', true, NOW())
ON CONFLICT ("subject", "strandKey") DO NOTHING;
