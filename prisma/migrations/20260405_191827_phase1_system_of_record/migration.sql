-- Phase 1 system of record
-- Manual migration aligned to the validated Prisma schema.
-- Safe: creates missing enum, tables, indexes, and foreign keys only.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'AcademicEnrollmentStatus'
  ) THEN
    CREATE TYPE "AcademicEnrollmentStatus" AS ENUM (
      'ACTIVE',
      'PROMOTED',
      'GRADUATED',
      'TRANSFERRED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "AcademicYear" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "yearLabel" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AcademicYear_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Term" (
  "id" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Term_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AcademicEnrollment" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "grade" INTEGER NOT NULL,
  "status" "AcademicEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AcademicEnrollment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Transcript" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "grade" INTEGER NOT NULL,
  "gpa" DOUBLE PRECISION,
  "summary" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Transcript_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AcademicYear_schoolId_yearLabel_key"
ON "AcademicYear"("schoolId", "yearLabel");

CREATE INDEX IF NOT EXISTS "AcademicYear_schoolId_isActive_idx"
ON "AcademicYear"("schoolId", "isActive");

CREATE INDEX IF NOT EXISTS "AcademicYear_schoolId_startDate_idx"
ON "AcademicYear"("schoolId", "startDate");

CREATE UNIQUE INDEX IF NOT EXISTS "Term_academicYearId_name_key"
ON "Term"("academicYearId", "name");

CREATE INDEX IF NOT EXISTS "Term_academicYearId_startDate_idx"
ON "Term"("academicYearId", "startDate");

CREATE UNIQUE INDEX IF NOT EXISTS "AcademicEnrollment_studentId_schoolId_academicYearId_key"
ON "AcademicEnrollment"("studentId", "schoolId", "academicYearId");

CREATE INDEX IF NOT EXISTS "AcademicEnrollment_schoolId_academicYearId_status_idx"
ON "AcademicEnrollment"("schoolId", "academicYearId", "status");

CREATE INDEX IF NOT EXISTS "AcademicEnrollment_studentId_academicYearId_idx"
ON "AcademicEnrollment"("studentId", "academicYearId");

CREATE UNIQUE INDEX IF NOT EXISTS "Transcript_studentId_academicYearId_key"
ON "Transcript"("studentId", "academicYearId");

CREATE INDEX IF NOT EXISTS "Transcript_schoolId_academicYearId_idx"
ON "Transcript"("schoolId", "academicYearId");

CREATE INDEX IF NOT EXISTS "Transcript_studentId_createdAt_idx"
ON "Transcript"("studentId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'AcademicYear_schoolId_fkey'
  ) THEN
    ALTER TABLE "AcademicYear"
    ADD CONSTRAINT "AcademicYear_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Term_academicYearId_fkey'
  ) THEN
    ALTER TABLE "Term"
    ADD CONSTRAINT "Term_academicYearId_fkey"
    FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'AcademicEnrollment_studentId_fkey'
  ) THEN
    ALTER TABLE "AcademicEnrollment"
    ADD CONSTRAINT "AcademicEnrollment_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'AcademicEnrollment_schoolId_fkey'
  ) THEN
    ALTER TABLE "AcademicEnrollment"
    ADD CONSTRAINT "AcademicEnrollment_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'AcademicEnrollment_academicYearId_fkey'
  ) THEN
    ALTER TABLE "AcademicEnrollment"
    ADD CONSTRAINT "AcademicEnrollment_academicYearId_fkey"
    FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Transcript_studentId_fkey'
  ) THEN
    ALTER TABLE "Transcript"
    ADD CONSTRAINT "Transcript_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Transcript_schoolId_fkey'
  ) THEN
    ALTER TABLE "Transcript"
    ADD CONSTRAINT "Transcript_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Transcript_academicYearId_fkey'
  ) THEN
    ALTER TABLE "Transcript"
    ADD CONSTRAINT "Transcript_academicYearId_fkey"
    FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
