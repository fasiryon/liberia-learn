-- Sprint 15: Announcements + Notification Inbox
-- Migration: 20260514_000002_sprint15_features

-- Announcement table
CREATE TABLE IF NOT EXISTS "Announcement" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "audience" TEXT NOT NULL DEFAULT 'ALL',
  "isPinned" BOOLEAN NOT NULL DEFAULT false,
  "publishedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Announcement_schoolId_publishedAt_idx"
  ON "Announcement"("schoolId", "publishedAt");

CREATE INDEX IF NOT EXISTS "Announcement_schoolId_audience_publishedAt_idx"
  ON "Announcement"("schoolId", "audience", "publishedAt");

-- NotificationInboxItem table
CREATE TABLE IF NOT EXISTS "NotificationInboxItem" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "url" TEXT,
  "type" TEXT NOT NULL DEFAULT 'info',
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationInboxItem_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "NotificationInboxItem" ADD CONSTRAINT "NotificationInboxItem_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "NotificationInboxItem_userId_isRead_idx"
  ON "NotificationInboxItem"("userId", "isRead");

CREATE INDEX IF NOT EXISTS "NotificationInboxItem_userId_createdAt_idx"
  ON "NotificationInboxItem"("userId", "createdAt");
