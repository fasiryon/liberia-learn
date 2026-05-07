-- Additive Canva asset automation fields.

ALTER TABLE "Certificate"
  ADD COLUMN IF NOT EXISTS "schoolId" TEXT,
  ADD COLUMN IF NOT EXISTS "canvaUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "designId" TEXT,
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "generatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Certificate_schoolId_fkey'
  ) THEN
    ALTER TABLE "Certificate"
      ADD CONSTRAINT "Certificate_schoolId_fkey"
      FOREIGN KEY ("schoolId") REFERENCES "School"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Certificate_schoolId_status_idx"
  ON "Certificate"("schoolId", "status");

ALTER TABLE "CurriculumContent"
  ADD COLUMN IF NOT EXISTS "thumbnailUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "thumbnailStatus" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "thumbnailGeneratedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "thumbnailError" TEXT;

ALTER TABLE "School"
  ADD COLUMN IF NOT EXISTS "onboardingKitUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "onboardingKitStatus" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "onboardingGeneratedAt" TIMESTAMP(3);

ALTER TABLE "ExamCertification"
  ADD COLUMN IF NOT EXISTS "bannerUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "videoUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "assetGenerationStatus" TEXT NOT NULL DEFAULT 'pending';
