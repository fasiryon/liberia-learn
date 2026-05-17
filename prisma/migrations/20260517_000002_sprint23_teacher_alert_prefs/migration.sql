-- Sprint 23: Teacher alert push notification preferences
CREATE TABLE IF NOT EXISTS "TeacherAlertPreference" (
  "id"                   TEXT NOT NULL PRIMARY KEY,
  "teacherId"            TEXT NOT NULL UNIQUE,
  "alertLowGrade"        BOOLEAN NOT NULL DEFAULT true,
  "alertInactive"        BOOLEAN NOT NULL DEFAULT true,
  "alertNewSubmission"   BOOLEAN NOT NULL DEFAULT true,
  "alertGuardianMessage" BOOLEAN NOT NULL DEFAULT true,
  "dailyDigest"          BOOLEAN NOT NULL DEFAULT false,
  "digestHour"           INTEGER NOT NULL DEFAULT 7,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeacherAlertPreference_teacherId_fkey"
    FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
