-- Phase 2 subject reconciliation
-- Manual migration to align the applied Phase 2 table shape with the validated Prisma schema.
-- Safe: backfills enum-backed subject values, fails loudly on ambiguous duplicates,
-- and removes only superseded Phase 2 subject columns/indexes.

ALTER TABLE "TeacherAssignment"
ADD COLUMN IF NOT EXISTS "subject" "Subject";

ALTER TABLE "Timetable"
ADD COLUMN IF NOT EXISTS "subject" "Subject";

WITH teacher_assignment_backfill AS (
  SELECT
    ta."id",
    CASE
      WHEN normalized.subject_value IN ('MATH', 'SCIENCE', 'COMPUTER_SCIENCE', 'ENGINEERING', 'LITERACY', 'CIVICS', 'ARTS', 'PE', 'CAREER')
        THEN normalized.subject_value
      WHEN normalized.subject_value IN ('ENGLISH')
        THEN 'LITERACY'
      WHEN normalized.subject_value IN ('PHYSICS', 'CHEMISTRY', 'BIOLOGY')
        THEN 'SCIENCE'
      WHEN normalized.subject_value IN ('ICT', 'COMPUTING', 'CS')
        THEN 'COMPUTER_SCIENCE'
      WHEN normalized.subject_value IN ('HISTORY', 'GEOGRAPHY', 'SOCIAL_STUDIES')
        THEN 'CIVICS'
      WHEN normalized.subject_value IN ('ECONOMICS', 'BUSINESS_STUDIES')
        THEN 'CAREER'
      WHEN normalized.subject_value IN ('CREATIVITY')
        THEN 'ARTS'
      ELSE NULL
    END AS mapped_subject
  FROM "TeacherAssignment" ta
  JOIN "Class" c
    ON c."id" = ta."classId"
  CROSS JOIN LATERAL (
    SELECT UPPER(
      REPLACE(
        REPLACE(
          TRIM(
            COALESCE(
              NULLIF(ta."subjectId", ''),
              NULLIF(ta."subjectName", ''),
              c."subject"::text
            )
          ),
          ' ',
          '_'
        ),
        '-',
        '_'
      )
    ) AS subject_value
  ) normalized
)
UPDATE "TeacherAssignment" ta
SET "subject" = teacher_assignment_backfill.mapped_subject::"Subject"
FROM teacher_assignment_backfill
WHERE ta."id" = teacher_assignment_backfill."id"
  AND ta."subject" IS NULL
  AND teacher_assignment_backfill.mapped_subject IS NOT NULL;

WITH timetable_backfill AS (
  SELECT
    tt."id",
    CASE
      WHEN normalized.subject_value IN ('MATH', 'SCIENCE', 'COMPUTER_SCIENCE', 'ENGINEERING', 'LITERACY', 'CIVICS', 'ARTS', 'PE', 'CAREER')
        THEN normalized.subject_value
      WHEN normalized.subject_value IN ('ENGLISH')
        THEN 'LITERACY'
      WHEN normalized.subject_value IN ('PHYSICS', 'CHEMISTRY', 'BIOLOGY')
        THEN 'SCIENCE'
      WHEN normalized.subject_value IN ('ICT', 'COMPUTING', 'CS')
        THEN 'COMPUTER_SCIENCE'
      WHEN normalized.subject_value IN ('HISTORY', 'GEOGRAPHY', 'SOCIAL_STUDIES')
        THEN 'CIVICS'
      WHEN normalized.subject_value IN ('ECONOMICS', 'BUSINESS_STUDIES')
        THEN 'CAREER'
      WHEN normalized.subject_value IN ('CREATIVITY')
        THEN 'ARTS'
      ELSE NULL
    END AS mapped_subject
  FROM "Timetable" tt
  JOIN "Class" c
    ON c."id" = tt."classId"
  CROSS JOIN LATERAL (
    SELECT UPPER(
      REPLACE(
        REPLACE(
          TRIM(
            COALESCE(
              NULLIF(tt."subjectId", ''),
              NULLIF(tt."subjectName", ''),
              c."subject"::text
            )
          ),
          ' ',
          '_'
        ),
        '-',
        '_'
      )
    ) AS subject_value
  ) normalized
)
UPDATE "Timetable" tt
SET "subject" = timetable_backfill.mapped_subject::"Subject"
FROM timetable_backfill
WHERE tt."id" = timetable_backfill."id"
  AND tt."subject" IS NULL
  AND timetable_backfill.mapped_subject IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "TeacherAssignment"
    WHERE "subject" IS NULL
  ) THEN
    RAISE EXCEPTION 'TeacherAssignment subject reconciliation failed: one or more rows could not be mapped to Subject enum';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Timetable"
    WHERE "subject" IS NULL
  ) THEN
    RAISE EXCEPTION 'Timetable subject reconciliation failed: one or more rows could not be mapped to Subject enum';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT "schoolId", "teacherId", "classId", "subject", COUNT(*) AS duplicate_count
      FROM "TeacherAssignment"
      GROUP BY "schoolId", "teacherId", "classId", "subject"
      HAVING COUNT(*) > 1
    ) duplicates
  ) THEN
    RAISE EXCEPTION 'TeacherAssignment reconciliation would violate the validated unique key on (schoolId, teacherId, classId, subject)';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT "schoolId", "classId", "dayOfWeek", "periodLabel", COUNT(*) AS duplicate_count
      FROM "Timetable"
      GROUP BY "schoolId", "classId", "dayOfWeek", "periodLabel"
      HAVING COUNT(*) > 1
    ) duplicates
  ) THEN
    RAISE EXCEPTION 'Timetable reconciliation would violate the validated unique key on (schoolId, classId, dayOfWeek, periodLabel)';
  END IF;
END $$;

ALTER TABLE "TeacherAssignment"
ALTER COLUMN "subject" SET NOT NULL;

ALTER TABLE "Timetable"
ALTER COLUMN "subject" SET NOT NULL;

DROP INDEX IF EXISTS "TeacherAssignment_teacherId_classId_subject_key";

CREATE UNIQUE INDEX IF NOT EXISTS "TeacherAssignment_schoolId_teacherId_classId_subject_key"
ON "TeacherAssignment"("schoolId", "teacherId", "classId", "subject");

CREATE UNIQUE INDEX IF NOT EXISTS "Timetable_schoolId_classId_dayOfWeek_periodLabel_key"
ON "Timetable"("schoolId", "classId", "dayOfWeek", "periodLabel");

ALTER TABLE "TeacherAssignment"
DROP COLUMN IF EXISTS "subjectId",
DROP COLUMN IF EXISTS "subjectName";

ALTER TABLE "Timetable"
DROP COLUMN IF EXISTS "subjectId",
DROP COLUMN IF EXISTS "subjectName";
