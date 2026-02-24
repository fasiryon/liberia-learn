-- Block 7A: Mastery Engine Foundation
-- Creates StrandCatalog, QuestionTag, StudentMasteryProfile
-- and the ProficiencyState / MasteryState enum types.
--
-- Safe to apply on top of existing DB: no existing tables are modified.
-- Migration is idempotent via IF NOT EXISTS guards where possible.
-- Backward-compatible: all new columns have defaults or are nullable.

-- CreateEnum: ProficiencyState
CREATE TYPE "ProficiencyState" AS ENUM (
  'NOT_ASSESSED',
  'BELOW_PROFICIENT',
  'APPROACHING',
  'PROFICIENT'
);

-- CreateEnum: MasteryState
CREATE TYPE "MasteryState" AS ENUM (
  'NOT_ASSESSED',
  'DEVELOPING',
  'APPROACHING',
  'MASTERED',
  'DECAYING'
);

-- CreateTable: StrandCatalog
-- Subject × strand × grade-band catalogue (data-driven taxonomy).
CREATE TABLE "StrandCatalog" (
    "id"        TEXT        NOT NULL,
    "subject"   "Subject"   NOT NULL,
    "strandKey" TEXT        NOT NULL,
    "name"      TEXT        NOT NULL,
    "gradeBand" "GradeBand" NOT NULL,
    "waecRef"   TEXT,
    "isActive"  BOOLEAN     NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrandCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable: QuestionTag
-- Links question/item IDs to strand + difficulty metadata.
CREATE TABLE "QuestionTag" (
    "id"             TEXT        NOT NULL,
    "subject"        "Subject"   NOT NULL,
    "strandKey"      TEXT        NOT NULL,
    "difficulty"     "Difficulty" NOT NULL,
    "itemType"       "ItemType"  NOT NULL,
    "practiceItemId" TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable: StudentMasteryProfile
-- Per-student, per-subject, per-strand mastery state.
-- All score/rate columns default to 0; state columns default to NOT_ASSESSED.
-- baselineConfidence and baselineCompletedAt are nullable (Block 7B adaptive baseline).
CREATE TABLE "StudentMasteryProfile" (
    "id"                  TEXT             NOT NULL,
    "studentId"           TEXT             NOT NULL,
    "subject"             "Subject"        NOT NULL,
    "strandKey"           TEXT             NOT NULL,
    "baselineScore"       DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentScore"        DOUBLE PRECISION NOT NULL DEFAULT 0,
    "proficiencyState"    "ProficiencyState" NOT NULL DEFAULT 'NOT_ASSESSED',
    "masteryState"        "MasteryState"   NOT NULL DEFAULT 'NOT_ASSESSED',
    "sustainabilityIndex" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "decayRate"           DOUBLE PRECISION NOT NULL DEFAULT 0,
    "aiRelianceRate"      DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastAssessedAt"      TIMESTAMP(3),
    "baselineConfidence"  DOUBLE PRECISION,
    "baselineCompletedAt" TIMESTAMP(3),
    "createdAt"           TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3)     NOT NULL,

    CONSTRAINT "StudentMasteryProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: StrandCatalog
CREATE UNIQUE INDEX "StrandCatalog_subject_strandKey_key"
    ON "StrandCatalog"("subject", "strandKey");

CREATE INDEX "StrandCatalog_subject_gradeBand_idx"
    ON "StrandCatalog"("subject", "gradeBand");

CREATE INDEX "StrandCatalog_isActive_subject_idx"
    ON "StrandCatalog"("isActive", "subject");

-- CreateIndex: QuestionTag
CREATE INDEX "QuestionTag_subject_strandKey_idx"
    ON "QuestionTag"("subject", "strandKey");

CREATE INDEX "QuestionTag_practiceItemId_idx"
    ON "QuestionTag"("practiceItemId");

-- CreateIndex: StudentMasteryProfile
CREATE UNIQUE INDEX "StudentMasteryProfile_studentId_subject_strandKey_key"
    ON "StudentMasteryProfile"("studentId", "subject", "strandKey");

CREATE INDEX "StudentMasteryProfile_studentId_idx"
    ON "StudentMasteryProfile"("studentId");

CREATE INDEX "StudentMasteryProfile_subject_strandKey_idx"
    ON "StudentMasteryProfile"("subject", "strandKey");

CREATE INDEX "StudentMasteryProfile_masteryState_idx"
    ON "StudentMasteryProfile"("masteryState");

CREATE INDEX "StudentMasteryProfile_proficiencyState_idx"
    ON "StudentMasteryProfile"("proficiencyState");

-- AddForeignKey: QuestionTag → PracticeItem (nullable, SET NULL on delete)
ALTER TABLE "QuestionTag"
    ADD CONSTRAINT "QuestionTag_practiceItemId_fkey"
    FOREIGN KEY ("practiceItemId")
    REFERENCES "PracticeItem"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: QuestionTag → StrandCatalog (composite key)
ALTER TABLE "QuestionTag"
    ADD CONSTRAINT "QuestionTag_subject_strandKey_fkey"
    FOREIGN KEY ("subject", "strandKey")
    REFERENCES "StrandCatalog"("subject", "strandKey")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: StudentMasteryProfile → Student (CASCADE delete)
ALTER TABLE "StudentMasteryProfile"
    ADD CONSTRAINT "StudentMasteryProfile_studentId_fkey"
    FOREIGN KEY ("studentId")
    REFERENCES "Student"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: StudentMasteryProfile → StrandCatalog (composite key)
ALTER TABLE "StudentMasteryProfile"
    ADD CONSTRAINT "StudentMasteryProfile_subject_strandKey_fkey"
    FOREIGN KEY ("subject", "strandKey")
    REFERENCES "StrandCatalog"("subject", "strandKey")
    ON DELETE RESTRICT ON UPDATE CASCADE;
