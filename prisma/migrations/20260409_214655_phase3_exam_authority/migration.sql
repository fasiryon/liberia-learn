-- Phase 3 exams and results authority

ALTER TABLE "Exam"
  ADD COLUMN IF NOT EXISTS "academicYearId" TEXT,
  ADD COLUMN IF NOT EXISTS "classId" TEXT,
  ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "resultsPublishedAt" TIMESTAMP(3);

ALTER TABLE "ExamAttempt"
  ADD COLUMN IF NOT EXISTS "tabSwitchCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "durationSeconds" INTEGER,
  ADD COLUMN IF NOT EXISTS "integrityMetadata" JSONB,
  ADD COLUMN IF NOT EXISTS "submissionLog" JSONB;

CREATE INDEX IF NOT EXISTS "Exam_schoolId_status_idx"
  ON "Exam"("schoolId", "status");

CREATE INDEX IF NOT EXISTS "Exam_schoolId_publishedAt_idx"
  ON "Exam"("schoolId", "publishedAt");

CREATE INDEX IF NOT EXISTS "Exam_academicYearId_idx"
  ON "Exam"("academicYearId");

CREATE INDEX IF NOT EXISTS "Exam_classId_idx"
  ON "Exam"("classId");

CREATE INDEX IF NOT EXISTS "ExamAttempt_examId_submittedAt_idx"
  ON "ExamAttempt"("examId", "submittedAt");

CREATE INDEX IF NOT EXISTS "ExamAttempt_studentId_submittedAt_idx"
  ON "ExamAttempt"("studentId", "submittedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Exam_academicYearId_fkey'
  ) THEN
    ALTER TABLE "Exam"
      ADD CONSTRAINT "Exam_academicYearId_fkey"
      FOREIGN KEY ("academicYearId")
      REFERENCES "AcademicYear"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Exam_classId_fkey'
  ) THEN
    ALTER TABLE "Exam"
      ADD CONSTRAINT "Exam_classId_fkey"
      FOREIGN KEY ("classId")
      REFERENCES "Class"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END
$$;