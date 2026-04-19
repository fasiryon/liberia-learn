-- Migration: CurriculumVersion table + versionId column on CurriculumContent
-- Additive only — safe to run on live data.

-- 1. Enum for version status (if not exists)
DO $$ BEGIN
  CREATE TYPE "CurriculumVersionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. CurriculumVersion table
CREATE TABLE IF NOT EXISTS "CurriculumVersion" (
  "id"          TEXT NOT NULL,
  "versionName" TEXT NOT NULL,
  "status"      "CurriculumVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "createdById" TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CurriculumVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CurriculumVersion_versionName_key"
  ON "CurriculumVersion"("versionName");

CREATE INDEX IF NOT EXISTS "CurriculumVersion_status_createdAt_idx"
  ON "CurriculumVersion"("status", "createdAt");

DO $$ BEGIN
  ALTER TABLE "CurriculumVersion"
    ADD CONSTRAINT "CurriculumVersion_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Add versionId column to CurriculumContent (nullable)
ALTER TABLE "CurriculumContent"
  ADD COLUMN IF NOT EXISTS "versionId" TEXT;

-- 4. Index on (versionId, status)
CREATE INDEX IF NOT EXISTS "CurriculumContent_versionId_status_idx"
  ON "CurriculumContent"("versionId", "status");

-- 5. Foreign key from CurriculumContent.versionId -> CurriculumVersion.id
DO $$ BEGIN
  ALTER TABLE "CurriculumContent"
    ADD CONSTRAINT "CurriculumContent_versionId_fkey"
    FOREIGN KEY ("versionId") REFERENCES "CurriculumVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
