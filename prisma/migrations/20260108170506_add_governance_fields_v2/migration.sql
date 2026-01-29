/*
  SAFE MIGRATION: add_governance_fields_v2
  - Fix NOT NULL adds on non-empty table by backfilling first
  - Preserve governanceDecision/governanceReason into new decision/reason
  - Set updatedAt for existing rows
  - Then drop legacy columns that Prisma wants removed
*/

-- Drop old indexes (safe)
DROP INDEX IF EXISTS "public"."GovernedArtifact_ewoId_idx";
DROP INDEX IF EXISTS "public"."GovernedArtifact_schemaId_idx";

-- 1) Add new columns SAFELY (nullable first where required)
ALTER TABLE "GovernedArtifact"
  ADD COLUMN IF NOT EXISTS "agent1Path" TEXT,
  ADD COLUMN IF NOT EXISTS "agent5Path" TEXT,
  ADD COLUMN IF NOT EXISTS "appliedPatch" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "curriculumContentId" TEXT,
  ADD COLUMN IF NOT EXISTS "decision" TEXT,
  ADD COLUMN IF NOT EXISTS "governanceModel" TEXT,
  ADD COLUMN IF NOT EXISTS "governancePath" TEXT,
  ADD COLUMN IF NOT EXISTS "governanceTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "patchJson" JSONB,
  ADD COLUMN IF NOT EXISTS "reason" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);

-- 2) Backfill existing rows (you have 5)
-- decision comes from old governanceDecision
-- reason comes from old governanceReason
-- updatedAt uses createdAt if present, else NOW()
UPDATE "GovernedArtifact"
SET
  "decision" = COALESCE("decision", "governanceDecision", 'ACCEPT'),
  "reason"   = COALESCE("reason", "governanceReason"),
  "updatedAt" = COALESCE("updatedAt", "createdAt", NOW());

-- 3) Ensure schemaId is not NULL before enforcing NOT NULL
UPDATE "GovernedArtifact"
SET "schemaId" = COALESCE("schemaId", 'UNKNOWN_SCHEMA')
WHERE "schemaId" IS NULL;

-- 4) Enforce NOT NULL AFTER backfill
ALTER TABLE "GovernedArtifact"
  ALTER COLUMN "decision" SET NOT NULL,
  ALTER COLUMN "updatedAt" SET NOT NULL,
  ALTER COLUMN "schemaId" SET NOT NULL;

-- 5) NOW drop legacy columns Prisma planned to drop (data already preserved where needed)
ALTER TABLE "GovernedArtifact"
  DROP COLUMN IF EXISTS "artifactJson",
  DROP COLUMN IF EXISTS "contentType",
  DROP COLUMN IF EXISTS "governanceDecision",
  DROP COLUMN IF EXISTS "governanceReason",
  DROP COLUMN IF EXISTS "grade",
  DROP COLUMN IF EXISTS "language",
  DROP COLUMN IF EXISTS "scale",
  DROP COLUMN IF EXISTS "subject";

-- 6) Indexes (unique index is safe because multiple NULLs are allowed in Postgres)
CREATE UNIQUE INDEX IF NOT EXISTS "GovernedArtifact_curriculumContentId_key"
  ON "GovernedArtifact"("curriculumContentId");

CREATE INDEX IF NOT EXISTS "GovernedArtifact_decision_idx"
  ON "GovernedArtifact"("decision");

CREATE INDEX IF NOT EXISTS "GovernedArtifact_governanceTimestamp_idx"
  ON "GovernedArtifact"("governanceTimestamp");

-- 7) Foreign key
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'GovernedArtifact_curriculumContentId_fkey'
  ) THEN
    ALTER TABLE "GovernedArtifact"
      ADD CONSTRAINT "GovernedArtifact_curriculumContentId_fkey"
      FOREIGN KEY ("curriculumContentId")
      REFERENCES "CurriculumContent"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;
