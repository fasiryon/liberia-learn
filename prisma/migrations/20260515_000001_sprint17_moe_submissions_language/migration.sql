-- Sprint 17: MoeSubmission model
CREATE TABLE IF NOT EXISTS "MoeSubmission" (
  "id"            TEXT NOT NULL,
  "schoolId"      TEXT NOT NULL,
  "schoolName"    TEXT NOT NULL,
  "submittedBy"   TEXT NOT NULL,
  "type"          TEXT NOT NULL,
  "title"         TEXT NOT NULL,
  "description"   TEXT,
  "fileUrl"       TEXT NOT NULL,
  "fileName"      TEXT NOT NULL,
  "fileSizeBytes" INTEGER NOT NULL,
  "status"        TEXT NOT NULL DEFAULT 'SUBMITTED',
  "moeNotes"      TEXT,
  "reviewedBy"    TEXT,
  "reviewedAt"    TIMESTAMP(3),
  "submittedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MoeSubmission_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MoeSubmission_schoolId_fkey'
  ) THEN
    ALTER TABLE "MoeSubmission"
      ADD CONSTRAINT "MoeSubmission_schoolId_fkey"
      FOREIGN KEY ("schoolId") REFERENCES "School"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "MoeSubmission_schoolId_idx" ON "MoeSubmission"("schoolId");
CREATE INDEX IF NOT EXISTS "MoeSubmission_status_idx" ON "MoeSubmission"("status");
CREATE INDEX IF NOT EXISTS "MoeSubmission_submittedAt_idx" ON "MoeSubmission"("submittedAt");

-- Sprint 17: User language preference
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "languagePreference" TEXT DEFAULT 'en';
