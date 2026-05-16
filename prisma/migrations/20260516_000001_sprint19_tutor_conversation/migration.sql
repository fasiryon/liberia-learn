-- CreateTable
CREATE TABLE "TutorConversation" (
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
CREATE TABLE "LessonHelpFlag" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "note" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonHelpFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TutorConversation_studentId_contentId_sessionDate_idx" ON "TutorConversation"("studentId", "contentId", "sessionDate");

-- CreateIndex
CREATE INDEX "LessonHelpFlag_studentId_contentId_idx" ON "LessonHelpFlag"("studentId", "contentId");

-- AddForeignKey
ALTER TABLE "TutorConversation" ADD CONSTRAINT "TutorConversation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorConversation" ADD CONSTRAINT "TutorConversation_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "CurriculumContent"("contentId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonHelpFlag" ADD CONSTRAINT "LessonHelpFlag_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonHelpFlag" ADD CONSTRAINT "LessonHelpFlag_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "CurriculumContent"("contentId") ON DELETE RESTRICT ON UPDATE CASCADE;
