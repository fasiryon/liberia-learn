ALTER TABLE "CurriculumContent"
ADD COLUMN IF NOT EXISTS "orderInUnit" INTEGER,
ADD COLUMN IF NOT EXISTS "lessonType" TEXT;

CREATE INDEX IF NOT EXISTS "CurriculumContent_unitId_orderInUnit_idx"
ON "CurriculumContent"("unitId", "orderInUnit");
