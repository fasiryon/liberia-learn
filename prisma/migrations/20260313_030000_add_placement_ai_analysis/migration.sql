ALTER TABLE "PlacementTest"
ALTER COLUMN "band" TYPE TEXT USING "band"::TEXT;

ALTER TABLE "PlacementTest"
ADD COLUMN "aiAnalysis" JSONB;
