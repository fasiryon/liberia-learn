-- Migration: 20260224_000000_seed_training_modules
--
-- Seeds the 8 Training Center module records that back the
-- NEXT_PUBLIC_ENABLE_TRAINING_CENTER feature.
--
-- Module IDs match the static `id` fields in lib/training/modules.ts.
-- The `code` column is used for safe re-seeding (ON CONFLICT DO NOTHING).
-- `description` and `content` are nullable — kept minimal for V1.
-- No schema changes — uses the existing TrainingModule table.

INSERT INTO "TrainingModule"
  ("id", "title", "description", "sortOrder", "estimatedMinutes", "isActive", "createdAt", "code")
VALUES
  -- Level 1 — Foundations
  ('l1-login-nav',         'Login & Navigation Basics',             'Learn to log in and navigate LiberiaLearn.',                              1, 5,  true, NOW(), 'l1-login-nav'),
  ('l1-class-work',        'Find Your Class & Today''s Work',       'Discover your classes and find today''s tasks.',                          2, 5,  true, NOW(), 'l1-class-work'),

  -- Level 2 — Core Features
  ('l2-create-lesson',     'Create a Lesson',                       'Build and assign lessons for your students.',                              3, 7,  true, NOW(), 'l2-create-lesson'),
  ('l2-create-assignment', 'Create an Assignment',                  'Create and distribute homework assignments.',                              4, 7,  true, NOW(), 'l2-create-assignment'),
  ('l2-grade-feedback',    'Grade & Give Feedback',                 'Review student submissions and provide feedback.',                         5, 6,  true, NOW(), 'l2-grade-feedback'),
  ('l2-message-guardians', 'Message Guardians Safely',              'Send safe, rate-limited SMS notifications to guardians.',                  6, 5,  true, NOW(), 'l2-message-guardians'),

  -- Level 3 — Advanced Tools
  ('l3-view-reports',      'View Reports & Student Progress',       'Monitor student progress and class performance.',                          7, 7,  true, NOW(), 'l3-view-reports'),
  ('l3-guided-tools',      'Use Guided Onboarding & Accessibility', 'Use built-in help guides and accessibility mode.',                         8, 5,  true, NOW(), 'l3-guided-tools')

ON CONFLICT ("code") DO NOTHING;
