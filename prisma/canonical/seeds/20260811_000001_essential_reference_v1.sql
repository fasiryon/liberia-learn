-- LiberiaLearn essential reference seed, version 20260811.000001.
-- This file is transaction-safe, deterministic, and independent from application startup.
-- Conflict updates deliberately preserve existing primary keys and createdAt values.

BEGIN;

INSERT INTO "TrainingModule"
  ("id", "title", "description", "sortOrder", "estimatedMinutes", "isActive", "createdAt", "code")
VALUES
  ('l1-login-nav', 'Login & Navigation Basics', 'Learn to log in and navigate LiberiaLearn.', 1, 5, true, TIMESTAMP '2026-08-11 00:00:00', 'l1-login-nav'),
  ('l1-class-work', 'Find Your Class & Today''s Work', 'Discover your classes and find today''s tasks.', 2, 5, true, TIMESTAMP '2026-08-11 00:00:00', 'l1-class-work'),
  ('l2-create-lesson', 'Create a Lesson', 'Build and assign lessons for your students.', 3, 7, true, TIMESTAMP '2026-08-11 00:00:00', 'l2-create-lesson'),
  ('l2-create-assignment', 'Create an Assignment', 'Create and distribute homework assignments.', 4, 7, true, TIMESTAMP '2026-08-11 00:00:00', 'l2-create-assignment'),
  ('l2-grade-feedback', 'Grade & Give Feedback', 'Review student submissions and provide feedback.', 5, 6, true, TIMESTAMP '2026-08-11 00:00:00', 'l2-grade-feedback'),
  ('l2-message-guardians', 'Message Guardians Safely', 'Send safe, rate-limited SMS notifications to guardians.', 6, 5, true, TIMESTAMP '2026-08-11 00:00:00', 'l2-message-guardians'),
  ('l3-view-reports', 'View Reports & Student Progress', 'Monitor student progress and class performance.', 7, 7, true, TIMESTAMP '2026-08-11 00:00:00', 'l3-view-reports'),
  ('l3-guided-tools', 'Use Guided Onboarding & Accessibility', 'Use built-in help guides and accessibility mode.', 8, 5, true, TIMESTAMP '2026-08-11 00:00:00', 'l3-guided-tools')
ON CONFLICT ("code") DO UPDATE SET
  "title" = EXCLUDED."title",
  "description" = EXCLUDED."description",
  "sortOrder" = EXCLUDED."sortOrder",
  "estimatedMinutes" = EXCLUDED."estimatedMinutes",
  "isActive" = EXCLUDED."isActive";

INSERT INTO "StrandCatalog"
  ("id", "subject", "strandKey", "name", "gradeBand", "waecRef", "isActive", "createdAt")
VALUES
  ('ref-v1-strand-civics-national-identity', 'CIVICS', 'national_identity', 'National Identity & Symbols', 'G1_3', NULL, true, TIMESTAMP '2026-08-11 00:00:00'),
  ('ref-v1-strand-civics-government-basics', 'CIVICS', 'government_basics', 'Structure of Government', 'G4_6', NULL, true, TIMESTAMP '2026-08-11 00:00:00'),
  ('ref-v1-strand-civics-rights-responsibilities', 'CIVICS', 'rights_responsibilities', 'Rights & Civic Duties', 'G4_6', NULL, true, TIMESTAMP '2026-08-11 00:00:00'),
  ('ref-v1-strand-civics-liberian-history', 'CIVICS', 'liberian_history', 'Liberian History', 'G7_9', NULL, true, TIMESTAMP '2026-08-11 00:00:00'),
  ('ref-v1-strand-civics-constitutional-law', 'CIVICS', 'constitutional_law', 'Constitutional Government', 'G7_9', NULL, true, TIMESTAMP '2026-08-11 00:00:00'),
  ('ref-v1-strand-civics-international-relations', 'CIVICS', 'international_relations', 'International Relations & Global Bodies', 'G10_12', NULL, true, TIMESTAMP '2026-08-11 00:00:00'),
  ('ref-v1-strand-math-financial-sequences', 'MATH', 'financial_sequences', 'Sequences, Series & Financial Math', 'G10_12', 'WASSCE-MATH-A6', true, TIMESTAMP '2026-08-11 00:00:00'),
  ('ref-v1-strand-math-matrices-vectors', 'MATH', 'matrices_vectors', 'Matrices & Vectors', 'G10_12', 'WASSCE-MATH-A7', true, TIMESTAMP '2026-08-11 00:00:00'),
  ('ref-v1-strand-math-time-calendar', 'MATH', 'time_calendar', 'Time, Calendar & Sequencing', 'G1_3', NULL, true, TIMESTAMP '2026-08-11 00:00:00')
ON CONFLICT ("subject", "strandKey") DO UPDATE SET
  "name" = EXCLUDED."name",
  "gradeBand" = EXCLUDED."gradeBand",
  "waecRef" = EXCLUDED."waecRef",
  "isActive" = EXCLUDED."isActive";

INSERT INTO "Standard" ("id", "code", "description", "subject", "band")
VALUES
  ('ref-v1-standard-lr-cs-g1-3-01', 'LR-CS-G1_3-01', 'Use digital devices safely; understand that computers follow instructions and can solve problems', 'COMPUTER_SCIENCE', 'G1_3'),
  ('ref-v1-standard-lr-cs-g4-6-02', 'LR-CS-G4_6-02', 'Connect and use input/output devices; understand how hardware and software work together', 'COMPUTER_SCIENCE', 'G4_6'),
  ('ref-v1-standard-lr-eng-g1-3-01', 'LR-ENG-G1_3-01', 'Identify common tools and their safe use; explore how simple structures are built', 'ENGINEERING', 'G1_3'),
  ('ref-v1-standard-lr-eng-g1-3-02', 'LR-ENG-G1_3-02', 'Investigate properties of everyday materials (strength, flexibility, waterproofing) found in Liberia', 'ENGINEERING', 'G1_3'),
  ('ref-v1-standard-lr-eng-g4-6-01', 'LR-ENG-G4_6-01', 'Follow the engineering design process (define, design, build, test, improve) to solve simple problems', 'ENGINEERING', 'G4_6'),
  ('ref-v1-standard-lr-eng-g4-6-02', 'LR-ENG-G4_6-02', 'Investigate forces, levers, and pulleys; explain how they reduce the effort needed to do work', 'ENGINEERING', 'G4_6'),
  ('ref-v1-standard-lr-eng-g7-9-01', 'LR-ENG-G7_9-01', 'Apply the engineering design process to address a practical community need in Liberia', 'ENGINEERING', 'G7_9'),
  ('ref-v1-standard-lr-eng-g7-9-02', 'LR-ENG-G7_9-02', 'Design, build, and test simple electrical circuits; understand voltage, current, and resistance', 'ENGINEERING', 'G7_9'),
  ('ref-v1-standard-lr-eng-g10-12-01', 'LR-ENG-G10_12-01', 'Design and prototype solutions using locally available materials; evaluate against safety and cost criteria', 'ENGINEERING', 'G10_12'),
  ('ref-v1-standard-lr-eng-g10-12-02', 'LR-ENG-G10_12-02', 'Apply principles of structural engineering and construction safety to real-world Liberian infrastructure challenges', 'ENGINEERING', 'G10_12')
ON CONFLICT ("code") DO UPDATE SET
  "description" = EXCLUDED."description",
  "subject" = EXCLUDED."subject",
  "band" = EXCLUDED."band";

COMMIT;
