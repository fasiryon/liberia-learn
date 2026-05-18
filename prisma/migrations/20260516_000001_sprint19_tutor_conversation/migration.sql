-- CreateTable
CREATE TABLE IF NOT EXISTS "TutorConversation" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "messages" JSONB NOT NULL,
    "questionsAsked" INTEGER NOT NULL DEFAULT 0,
    "sessionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TutorConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LessonHelpFlag" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "note" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonHelpFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TutorConversation_studentId_contentId_sessionDate_idx" ON "TutorConversation"("studentId", "contentId", "sessionDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LessonHelpFlag_studentId_contentId_idx" ON "LessonHelpFlag"("studentId", "contentId");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TutorConversation_studentId_fkey') THEN
    ALTER TABLE "TutorConversation" ADD CONSTRAINT "TutorConversation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TutorConversation_contentId_fkey') THEN
    ALTER TABLE "TutorConversation" ADD CONSTRAINT "TutorConversation_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "CurriculumContent"("contentId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LessonHelpFlag_studentId_fkey') THEN
    ALTER TABLE "LessonHelpFlag" ADD CONSTRAINT "LessonHelpFlag_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LessonHelpFlag_contentId_fkey') THEN
    ALTER TABLE "LessonHelpFlag" ADD CONSTRAINT "LessonHelpFlag_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "CurriculumContent"("contentId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
