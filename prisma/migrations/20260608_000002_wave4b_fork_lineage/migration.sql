-- Wave 4B: add derivedFromContentId for fork lineage tracking
ALTER TABLE "CurriculumContent"
  ADD COLUMN IF NOT EXISTS "derivedFromContentId" TEXT;
