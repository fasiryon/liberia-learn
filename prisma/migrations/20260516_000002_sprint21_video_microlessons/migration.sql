-- Sprint 21: Video micro-lessons — moderation, watch tracking, storage quota

-- Extend LessonVideo with moderation + analytics fields
ALTER TABLE "LessonVideo"
  ADD COLUMN IF NOT EXISTS "thumbnailFile"   TEXT,
  ADD COLUMN IF NOT EXISTS "status"          TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "schoolId"        TEXT,
  ADD COLUMN IF NOT EXISTS "approvedBy"      TEXT,
  ADD COLUMN IF NOT EXISTS "approvedAt"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejectedReason"  TEXT,
  ADD COLUMN IF NOT EXISTS "viewCount"       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "storageBytes"    INTEGER;

-- Existing isActive=true videos are considered approved (pre-moderation)
UPDATE "LessonVideo" SET "status" = 'APPROVED' WHERE "isActive" = true;

-- Indexes on new LessonVideo fields
CREATE INDEX IF NOT EXISTS "LessonVideo_status_idx"          ON "LessonVideo"("status");
CREATE INDEX IF NOT EXISTS "LessonVideo_schoolId_status_idx"  ON "LessonVideo"("schoolId", "status");

-- VideoWatchEvent model
CREATE TABLE IF NOT EXISTS "VideoWatchEvent" (
  "id"          TEXT NOT NULL,
  "videoId"     TEXT NOT NULL,
  "studentId"   TEXT NOT NULL,
  "watchedSecs" INTEGER NOT NULL,
  "totalSecs"   INTEGER NOT NULL,
  "completedAt" TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VideoWatchEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VideoWatchEvent_videoId_studentId_key" UNIQUE ("videoId", "studentId"),
  CONSTRAINT "VideoWatchEvent_videoId_fkey"   FOREIGN KEY ("videoId")   REFERENCES "LessonVideo"("id") ON DELETE CASCADE,
  CONSTRAINT "VideoWatchEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id")        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "VideoWatchEvent_videoId_idx"   ON "VideoWatchEvent"("videoId");
CREATE INDEX IF NOT EXISTS "VideoWatchEvent_studentId_idx" ON "VideoWatchEvent"("studentId");

-- SchoolStorageQuota model
CREATE TABLE IF NOT EXISTS "SchoolStorageQuota" (
  "id"         TEXT NOT NULL,
  "schoolId"   TEXT NOT NULL,
  "usedBytes"  INTEGER NOT NULL DEFAULT 0,
  "limitBytes" INTEGER NOT NULL DEFAULT 5368709120,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SchoolStorageQuota_pkey"     PRIMARY KEY ("id"),
  CONSTRAINT "SchoolStorageQuota_schoolId_key" UNIQUE ("schoolId"),
  CONSTRAINT "SchoolStorageQuota_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE
);
