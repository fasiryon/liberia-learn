-- Sprint 6: Live Class Sessions via Jitsi
-- Extend Meeting model with live session fields

ALTER TABLE "Meeting" ADD COLUMN IF NOT EXISTS "subject" TEXT;
ALTER TABLE "Meeting" ADD COLUMN IF NOT EXISTS "periodName" TEXT;
ALTER TABLE "Meeting" ADD COLUMN IF NOT EXISTS "jitsiRoomId" TEXT;
ALTER TABLE "Meeting" ADD COLUMN IF NOT EXISTS "joinUrl" TEXT;
ALTER TABLE "Meeting" ADD COLUMN IF NOT EXISTS "liveStatus" TEXT NOT NULL DEFAULT 'SCHEDULED';
ALTER TABLE "Meeting" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3);
ALTER TABLE "Meeting" ADD COLUMN IF NOT EXISTS "endedAt" TIMESTAMP(3);
ALTER TABLE "Meeting" ADD COLUMN IF NOT EXISTS "hostUserId" TEXT;

-- Index for live status queries
CREATE INDEX IF NOT EXISTS "Meeting_liveStatus_idx" ON "Meeting"("liveStatus");

-- Foreign key for meeting host
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_hostUserId_fkey"
  FOREIGN KEY ("hostUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- MeetingAttendee: tracks who joined the Jitsi session
CREATE TABLE IF NOT EXISTS "MeetingAttendee" (
  "id"        TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "joinedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MeetingAttendee_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MeetingAttendee_meetingId_userId_key"
  ON "MeetingAttendee"("meetingId", "userId");

CREATE INDEX IF NOT EXISTS "MeetingAttendee_meetingId_idx"
  ON "MeetingAttendee"("meetingId");

ALTER TABLE "MeetingAttendee" ADD CONSTRAINT "MeetingAttendee_meetingId_fkey"
  FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MeetingAttendee" ADD CONSTRAINT "MeetingAttendee_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
