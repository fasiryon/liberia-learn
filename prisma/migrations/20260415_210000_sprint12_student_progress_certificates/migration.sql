-- Sprint 12: Student Progress + Certificates
-- Additive only. Safe to apply without modifying prior certificate or assessment tables.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CertificateType') THEN
    CREATE TYPE "CertificateType" AS ENUM ('LESSON', 'SUBJECT');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Certificate" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "studentId" TEXT NOT NULL,
  "type" "CertificateType" NOT NULL,
  "referenceId" TEXT NOT NULL,
  "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "certificateCode" TEXT NOT NULL,
  CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Certificate_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Certificate_certificateCode_key"
  ON "Certificate"("certificateCode");

CREATE UNIQUE INDEX IF NOT EXISTS "Certificate_studentId_type_referenceId_key"
  ON "Certificate"("studentId", "type", "referenceId");

CREATE INDEX IF NOT EXISTS "Certificate_studentId_awardedAt_idx"
  ON "Certificate"("studentId", "awardedAt");

CREATE INDEX IF NOT EXISTS "Certificate_type_referenceId_idx"
  ON "Certificate"("type", "referenceId");
