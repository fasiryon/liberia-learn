-- Sprint 25: teacher content creation — add edit tracking to CurriculumContent,
-- and create LessonVersion + LessonShare models.

-- Add edit tracking columns to CurriculumContent
ALTER TABLE "CurriculumContent"
  ADD COLUMN IF NOT EXISTS "editedById" TEXT,
  ADD COLUMN IF NOT EXISTS "editedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "editReviewStatus" TEXT DEFAULT 'PENDING';

-- FK: CurriculumContent.editedById -> User.id
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CurriculumContent_editedById_fkey') THEN
    ALTER TABLE "CurriculumContent"
      ADD CONSTRAINT "CurriculumContent_editedById_fkey"
      FOREIGN KEY ("editedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "CurriculumContent_editedById_editReviewStatus_idx"
  ON "CurriculumContent"("editedById", "editReviewStatus");

-- LessonVersion
CREATE TABLE IF NOT EXISTS "LessonVersion" (
  "id"        TEXT NOT NULL,
  "lessonId"  TEXT NOT NULL,
  "authorId"  TEXT NOT NULL,
  "bodyHtml"  TEXT NOT NULL,
  "metadata"  JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LessonVersion_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LessonVersion_lessonId_fkey') THEN
    ALTER TABLE "LessonVersion"
      ADD CONSTRAINT "LessonVersion_lessonId_fkey"
      FOREIGN KEY ("lessonId") REFERENCES "CurriculumContent"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LessonVersion_authorId_fkey') THEN
    ALTER TABLE "LessonVersion"
      ADD CONSTRAINT "LessonVersion_authorId_fkey"
      FOREIGN KEY ("authorId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "LessonVersion_lessonId_createdAt_idx"
  ON "LessonVersion"("lessonId", "createdAt");

-- LessonShare
CREATE TABLE IF NOT EXISTS "LessonShare" (
  "id"         TEXT NOT NULL,
  "lessonId"   TEXT NOT NULL,
  "sharedById" TEXT NOT NULL,
  "schoolId"   TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LessonShare_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LessonShare_lessonId_fkey') THEN
    ALTER TABLE "LessonShare"
      ADD CONSTRAINT "LessonShare_lessonId_fkey"
      FOREIGN KEY ("lessonId") REFERENCES "CurriculumContent"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LessonShare_sharedById_fkey') THEN
    ALTER TABLE "LessonShare"
      ADD CONSTRAINT "LessonShare_sharedById_fkey"
      FOREIGN KEY ("sharedById") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LessonShare_schoolId_fkey') THEN
    ALTER TABLE "LessonShare"
      ADD CONSTRAINT "LessonShare_schoolId_fkey"
      FOREIGN KEY ("schoolId") REFERENCES "School"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "LessonShare_lessonId_schoolId_key"
  ON "LessonShare"("lessonId", "schoolId");

CREATE INDEX IF NOT EXISTS "LessonShare_schoolId_idx"
  ON "LessonShare"("schoolId");
