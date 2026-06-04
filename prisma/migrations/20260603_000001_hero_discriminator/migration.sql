-- Add isHero discriminator to CurriculumContent
-- Identifies high-quality demo lessons for preferential routing in the demo schedule

ALTER TABLE "CurriculumContent" ADD COLUMN IF NOT EXISTS "isHero" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "CurriculumContent_isHero_idx"
  ON "CurriculumContent"("isHero") WHERE "isHero" = true;
