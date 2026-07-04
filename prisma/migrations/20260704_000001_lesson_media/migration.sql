-- PHASE 4A: Hybrid Lesson Media (hero + inline illustrations / curated photos).
-- Additive, non-destructive. Distinct from the dormant thumbnail* card fields.
ALTER TABLE "CurriculumContent"
  ADD COLUMN IF NOT EXISTS "heroImageUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "heroImageMeta" JSONB,
  ADD COLUMN IF NOT EXISTS "inlineIllustrations" JSONB,
  ADD COLUMN IF NOT EXISTS "imageGenerationStatus" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "imageGenerationCost" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "imageCategory" TEXT;

-- Fast filtering for the admin content-media dashboard.
CREATE INDEX IF NOT EXISTS "CurriculumContent_imageCategory_imageGenerationStatus_idx"
  ON "CurriculumContent" ("imageCategory", "imageGenerationStatus");
