-- Gap 2: ENGINEERING strands + CS G1-6 strand codes
--
-- Addresses three open ACTION items from the MOE Standards Coverage audit:
--   ACTION-2: ENGINEERING subject had 0 MOE standard codes (16 strands, no codes)
--   ACTION-4: COMPUTER_SCIENCE G1_3 band had no standard coverage
--   ACTION-5: COMPUTER_SCIENCE G4_6 hardware concepts lacked a dedicated code
--
-- Uses INSERT ... ON CONFLICT DO UPDATE (upsert) to be safe for re-runs.
-- Code format: LR-{SUBJECT_ABBR}-{GRADE_BAND}-{NN}

-- ── CS G1_3 (ACTION-4) ────────────────────────────────────────────────────────
INSERT INTO "Standard" (id, code, description, subject, band, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'LR-CS-G1_3-01',
  'Use digital devices safely; understand that computers follow instructions and can solve problems',
  'COMPUTER_SCIENCE',
  'G1_3',
  NOW(), NOW()
)
ON CONFLICT (code) DO UPDATE
  SET description = EXCLUDED.description,
      subject     = EXCLUDED.subject,
      band        = EXCLUDED.band,
      "updatedAt" = NOW();

-- ── CS G4_6 hardware strand (ACTION-5) ────────────────────────────────────────
INSERT INTO "Standard" (id, code, description, subject, band, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'LR-CS-G4_6-02',
  'Connect and use input/output devices; understand how hardware and software work together',
  'COMPUTER_SCIENCE',
  'G4_6',
  NOW(), NOW()
)
ON CONFLICT (code) DO UPDATE
  SET description = EXCLUDED.description,
      subject     = EXCLUDED.subject,
      band        = EXCLUDED.band,
      "updatedAt" = NOW();

-- ── ENGINEERING G1_3 (ACTION-2) ───────────────────────────────────────────────
INSERT INTO "Standard" (id, code, description, subject, band, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'LR-ENG-G1_3-01',
  'Identify common tools and their safe use; explore how simple structures are built',
  'ENGINEERING',
  'G1_3',
  NOW(), NOW()
)
ON CONFLICT (code) DO UPDATE
  SET description = EXCLUDED.description, subject = EXCLUDED.subject,
      band = EXCLUDED.band, "updatedAt" = NOW();

INSERT INTO "Standard" (id, code, description, subject, band, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'LR-ENG-G1_3-02',
  'Investigate properties of everyday materials (strength, flexibility, waterproofing) found in Liberia',
  'ENGINEERING',
  'G1_3',
  NOW(), NOW()
)
ON CONFLICT (code) DO UPDATE
  SET description = EXCLUDED.description, subject = EXCLUDED.subject,
      band = EXCLUDED.band, "updatedAt" = NOW();

-- ── ENGINEERING G4_6 (ACTION-2) ───────────────────────────────────────────────
INSERT INTO "Standard" (id, code, description, subject, band, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'LR-ENG-G4_6-01',
  'Follow the engineering design process (define, design, build, test, improve) to solve simple problems',
  'ENGINEERING',
  'G4_6',
  NOW(), NOW()
)
ON CONFLICT (code) DO UPDATE
  SET description = EXCLUDED.description, subject = EXCLUDED.subject,
      band = EXCLUDED.band, "updatedAt" = NOW();

INSERT INTO "Standard" (id, code, description, subject, band, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'LR-ENG-G4_6-02',
  'Investigate forces, levers, and pulleys; explain how they reduce the effort needed to do work',
  'ENGINEERING',
  'G4_6',
  NOW(), NOW()
)
ON CONFLICT (code) DO UPDATE
  SET description = EXCLUDED.description, subject = EXCLUDED.subject,
      band = EXCLUDED.band, "updatedAt" = NOW();

-- ── ENGINEERING G7_9 (ACTION-2) ───────────────────────────────────────────────
INSERT INTO "Standard" (id, code, description, subject, band, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'LR-ENG-G7_9-01',
  'Apply the engineering design process to address a practical community need in Liberia',
  'ENGINEERING',
  'G7_9',
  NOW(), NOW()
)
ON CONFLICT (code) DO UPDATE
  SET description = EXCLUDED.description, subject = EXCLUDED.subject,
      band = EXCLUDED.band, "updatedAt" = NOW();

INSERT INTO "Standard" (id, code, description, subject, band, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'LR-ENG-G7_9-02',
  'Design, build, and test simple electrical circuits; understand voltage, current, and resistance',
  'ENGINEERING',
  'G7_9',
  NOW(), NOW()
)
ON CONFLICT (code) DO UPDATE
  SET description = EXCLUDED.description, subject = EXCLUDED.subject,
      band = EXCLUDED.band, "updatedAt" = NOW();

-- ── ENGINEERING G10_12 (ACTION-2) ─────────────────────────────────────────────
INSERT INTO "Standard" (id, code, description, subject, band, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'LR-ENG-G10_12-01',
  'Design and prototype solutions using locally available materials; evaluate against safety and cost criteria',
  'ENGINEERING',
  'G10_12',
  NOW(), NOW()
)
ON CONFLICT (code) DO UPDATE
  SET description = EXCLUDED.description, subject = EXCLUDED.subject,
      band = EXCLUDED.band, "updatedAt" = NOW();

INSERT INTO "Standard" (id, code, description, subject, band, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'LR-ENG-G10_12-02',
  'Apply principles of structural engineering and construction safety to real-world Liberian infrastructure challenges',
  'ENGINEERING',
  'G10_12',
  NOW(), NOW()
)
ON CONFLICT (code) DO UPDATE
  SET description = EXCLUDED.description, subject = EXCLUDED.subject,
      band = EXCLUDED.band, "updatedAt" = NOW();
