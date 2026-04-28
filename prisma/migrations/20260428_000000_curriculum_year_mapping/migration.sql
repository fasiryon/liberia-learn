-- Phase 5: Full-year curriculum organization.
-- Mapping-only additions. Existing CurriculumContent rows are not generated,
-- duplicated, or overwritten by this migration.

CREATE TYPE "CurriculumLessonType" AS ENUM ('CORE', 'REVIEW', 'LAB', 'ASSESSMENT', 'PROJECT');
CREATE TYPE "CurriculumMappedSource" AS ENUM ('EXISTING', 'GENERATED');

ALTER TABLE "CurriculumUnit"
  ADD COLUMN "title" TEXT,
  ADD COLUMN "gradeLevel" INTEGER,
  ADD COLUMN "academicYearId" TEXT,
  ADD COLUMN "orderIndex" INTEGER,
  ALTER COLUMN "schoolId" DROP NOT NULL,
  ALTER COLUMN "createdById" DROP NOT NULL;

UPDATE "CurriculumUnit"
SET
  "title" = COALESCE("title", "name"),
  "gradeLevel" = COALESCE("gradeLevel", "grade"),
  "orderIndex" = COALESCE("orderIndex", "weekStart");

CREATE TABLE "CurriculumWeek" (
  "id" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "weekNumber" INTEGER NOT NULL,
  "theme" TEXT NOT NULL,
  "orderIndex" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CurriculumWeek_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CurriculumLessonPlan" (
  "id" TEXT NOT NULL,
  "weekId" TEXT NOT NULL,
  "curriculumContentId" TEXT NOT NULL,
  "dayNumber" INTEGER NOT NULL,
  "lessonType" "CurriculumLessonType" NOT NULL DEFAULT 'CORE',
  "mappedSource" "CurriculumMappedSource" NOT NULL DEFAULT 'EXISTING',
  "orderIndex" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CurriculumLessonPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CurriculumWeek_unitId_weekNumber_key" ON "CurriculumWeek"("unitId", "weekNumber");
CREATE INDEX "CurriculumWeek_weekNumber_idx" ON "CurriculumWeek"("weekNumber");

CREATE UNIQUE INDEX "CurriculumLessonPlan_curriculumContentId_key" ON "CurriculumLessonPlan"("curriculumContentId");
CREATE UNIQUE INDEX "CurriculumLessonPlan_weekId_dayNumber_orderIndex_key" ON "CurriculumLessonPlan"("weekId", "dayNumber", "orderIndex");
CREATE INDEX "CurriculumLessonPlan_weekId_dayNumber_idx" ON "CurriculumLessonPlan"("weekId", "dayNumber");

CREATE INDEX "CurriculumUnit_gradeLevel_subject_orderIndex_idx" ON "CurriculumUnit"("gradeLevel", "subject", "orderIndex");
CREATE INDEX "CurriculumUnit_academicYearId_idx" ON "CurriculumUnit"("academicYearId");

ALTER TABLE "CurriculumUnit"
  ADD CONSTRAINT "CurriculumUnit_academicYearId_fkey"
  FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CurriculumWeek"
  ADD CONSTRAINT "CurriculumWeek_unitId_fkey"
  FOREIGN KEY ("unitId") REFERENCES "CurriculumUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CurriculumLessonPlan"
  ADD CONSTRAINT "CurriculumLessonPlan_weekId_fkey"
  FOREIGN KEY ("weekId") REFERENCES "CurriculumWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CurriculumLessonPlan"
  ADD CONSTRAINT "CurriculumLessonPlan_curriculumContentId_fkey"
  FOREIGN KEY ("curriculumContentId") REFERENCES "CurriculumContent"("contentId") ON DELETE CASCADE ON UPDATE CASCADE;
