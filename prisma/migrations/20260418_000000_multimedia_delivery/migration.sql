-- Additive multimedia lesson delivery models.

CREATE TABLE "LessonAudio" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "storageUrl" TEXT,
    "voice" TEXT NOT NULL DEFAULT 'alloy',
    "durationSeconds" INTEGER,
    "generatedAt" TIMESTAMP(3),
    "contentVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "estimatedCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "LessonAudio_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LessonVideo" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "storageUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "durationSeconds" INTEGER NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "LessonVideo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LessonAudio_lessonId_contentVersion_voice_key" ON "LessonAudio"("lessonId", "contentVersion", "voice");
CREATE INDEX "LessonAudio_lessonId_status_idx" ON "LessonAudio"("lessonId", "status");
CREATE INDEX "LessonAudio_status_generatedAt_idx" ON "LessonAudio"("status", "generatedAt");
CREATE INDEX "LessonVideo_lessonId_isActive_idx" ON "LessonVideo"("lessonId", "isActive");
CREATE INDEX "LessonVideo_uploadedBy_uploadedAt_idx" ON "LessonVideo"("uploadedBy", "uploadedAt");

ALTER TABLE "LessonAudio" ADD CONSTRAINT "LessonAudio_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "CurriculumContent"("contentId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonVideo" ADD CONSTRAINT "LessonVideo_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "CurriculumContent"("contentId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonVideo" ADD CONSTRAINT "LessonVideo_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
