-- Block 7B: Adaptive Baseline
-- Adds StudentBaselineAbility table and BaselineSource enum.
--
-- Additive only: no existing tables or columns are modified.
-- All new columns have defaults or are nullable.
-- Safe to apply with ENABLE_ADAPTIVE_BASELINE flag off.

-- CreateEnum: BaselineSource
CREATE TYPE "BaselineSource" AS ENUM (
  'initial',
  'practice',
  'assessment',
  'manual'
);

-- CreateTable: StudentBaselineAbility
-- Stores one adaptive ability estimate per student × school × subject × strand.
-- Ability is on the [-2, +2] EMA scale (not a raw 0–1 score).
-- schoolId enforces tenant isolation — every query MUST filter by schoolId.
CREATE TABLE "StudentBaselineAbility" (
    "id"            TEXT            NOT NULL,
    "schoolId"      TEXT            NOT NULL,
    "studentId"     TEXT            NOT NULL,
    "subject"       "Subject"       NOT NULL,
    "strandKey"     TEXT            NOT NULL,
    "ability"       DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastUpdatedAt" TIMESTAMP(3)    NOT NULL,
    "source"        "BaselineSource" NOT NULL DEFAULT 'initial',
    "updatedBy"     TEXT,
    "createdAt"     TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3)    NOT NULL,

    CONSTRAINT "StudentBaselineAbility_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one row per (school, student, subject, strand)
CREATE UNIQUE INDEX "StudentBaselineAbility_schoolId_studentId_subject_strandKey_key"
    ON "StudentBaselineAbility"("schoolId", "studentId", "subject", "strandKey");

-- Supporting indexes
CREATE INDEX "StudentBaselineAbility_schoolId_idx"
    ON "StudentBaselineAbility"("schoolId");

CREATE INDEX "StudentBaselineAbility_studentId_idx"
    ON "StudentBaselineAbility"("studentId");

CREATE INDEX "StudentBaselineAbility_subject_strandKey_idx"
    ON "StudentBaselineAbility"("subject", "strandKey");

-- FK: StudentBaselineAbility → Student (CASCADE on student delete)
ALTER TABLE "StudentBaselineAbility"
    ADD CONSTRAINT "StudentBaselineAbility_studentId_fkey"
    FOREIGN KEY ("studentId")
    REFERENCES "Student"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- FK: StudentBaselineAbility → StrandCatalog (composite key, RESTRICT on strand delete)
ALTER TABLE "StudentBaselineAbility"
    ADD CONSTRAINT "StudentBaselineAbility_subject_strandKey_fkey"
    FOREIGN KEY ("subject", "strandKey")
    REFERENCES "StrandCatalog"("subject", "strandKey")
    ON DELETE RESTRICT ON UPDATE CASCADE;
