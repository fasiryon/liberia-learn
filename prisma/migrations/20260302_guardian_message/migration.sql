-- Migration: Guardian Messaging model
-- Creates the GuardianMessage table for direct guardian-teacher communication

CREATE TABLE IF NOT EXISTS "GuardianMessage" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "guardianId" TEXT NOT NULL,
  "teacherId"  TEXT NOT NULL,
  "studentId"  TEXT NOT NULL,
  "schoolId"   TEXT NOT NULL,
  "fromRole"   TEXT NOT NULL,
  "body"       TEXT NOT NULL,
  "sentAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "read"       BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GuardianMessage_guardianId_fkey"
    FOREIGN KEY ("guardianId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "GuardianMessage_teacherId_fkey"
    FOREIGN KEY ("teacherId")  REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "GuardianMessage_studentId_fkey"
    FOREIGN KEY ("studentId")  REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "GuardianMessage_schoolId_fkey"
    FOREIGN KEY ("schoolId")   REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "GuardianMessage_guardianId_sentAt_idx"
  ON "GuardianMessage"("guardianId", "sentAt");

CREATE INDEX IF NOT EXISTS "GuardianMessage_teacherId_sentAt_idx"
  ON "GuardianMessage"("teacherId", "sentAt");

CREATE INDEX IF NOT EXISTS "GuardianMessage_studentId_idx"
  ON "GuardianMessage"("studentId");

CREATE INDEX IF NOT EXISTS "GuardianMessage_schoolId_idx"
  ON "GuardianMessage"("schoolId");
