-- Sprint 26: SMS Assessments, National League Table, Portable Credential

-- FIX 1: Add student phone field to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT;

-- FIX 1: Add smsEnabled to Assignment
ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "smsEnabled" BOOLEAN NOT NULL DEFAULT FALSE;

-- FIX 1: SmsSession
CREATE TABLE IF NOT EXISTS "SmsSession" (
  "id"           TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "studentPhone" TEXT NOT NULL,
  "studentId"    TEXT,
  "questions"    JSONB NOT NULL,
  "currentIndex" INTEGER NOT NULL DEFAULT 0,
  "score"        INTEGER NOT NULL DEFAULT 0,
  "status"       TEXT NOT NULL DEFAULT 'ACTIVE',
  "expiresAt"    TIMESTAMP(3) NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SmsSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SmsSession_studentPhone_status_idx" ON "SmsSession"("studentPhone", "status");
CREATE INDEX IF NOT EXISTS "SmsSession_assignmentId_idx"        ON "SmsSession"("assignmentId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SmsSession_assignmentId_fkey') THEN
    ALTER TABLE "SmsSession"
      ADD CONSTRAINT "SmsSession_assignmentId_fkey"
      FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SmsSession_studentId_fkey') THEN
    ALTER TABLE "SmsSession"
      ADD CONSTRAINT "SmsSession_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- FIX 1: SmsResponse
CREATE TABLE IF NOT EXISTS "SmsResponse" (
  "id"          TEXT NOT NULL,
  "sessionId"   TEXT NOT NULL,
  "questionIdx" INTEGER NOT NULL,
  "answer"      TEXT NOT NULL,
  "correct"     BOOLEAN NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SmsResponse_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SmsResponse_sessionId_idx" ON "SmsResponse"("sessionId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SmsResponse_sessionId_fkey') THEN
    ALTER TABLE "SmsResponse"
      ADD CONSTRAINT "SmsResponse_sessionId_fkey"
      FOREIGN KEY ("sessionId") REFERENCES "SmsSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- FIX 5: LeagueSnapshot (county/district already exist on School)
CREATE TABLE IF NOT EXISTS "LeagueSnapshot" (
  "id"               TEXT NOT NULL,
  "schoolId"         TEXT NOT NULL,
  "term"             TEXT NOT NULL,
  "avgGrade"         DOUBLE PRECISION NOT NULL,
  "attendance"       DOUBLE PRECISION NOT NULL,
  "lessonCompletion" DOUBLE PRECISION NOT NULL,
  "studentCount"     INTEGER NOT NULL,
  "countyRank"       INTEGER,
  "nationalRank"     INTEGER,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeagueSnapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LeagueSnapshot_schoolId_term_key" UNIQUE ("schoolId", "term")
);

CREATE INDEX IF NOT EXISTS "LeagueSnapshot_term_nationalRank_idx" ON "LeagueSnapshot"("term", "nationalRank");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LeagueSnapshot_schoolId_fkey') THEN
    ALTER TABLE "LeagueSnapshot"
      ADD CONSTRAINT "LeagueSnapshot_schoolId_fkey"
      FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- FIX 8: PortfolioCredential
CREATE TABLE IF NOT EXISTS "PortfolioCredential" (
  "id"              TEXT NOT NULL,
  "studentId"       TEXT NOT NULL,
  "verifyToken"     TEXT NOT NULL,
  "term"            TEXT NOT NULL,
  "schoolName"      TEXT NOT NULL,
  "studentName"     TEXT NOT NULL,
  "grade"           TEXT NOT NULL,
  "avgScore"        DOUBLE PRECISION NOT NULL,
  "attendance"      DOUBLE PRECISION NOT NULL,
  "lessonsComplete" INTEGER NOT NULL,
  "blobUrl"         TEXT,
  "generatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PortfolioCredential_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PortfolioCredential_verifyToken_key" UNIQUE ("verifyToken")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PortfolioCredential_studentId_term_key" ON "PortfolioCredential"("studentId", "term");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PortfolioCredential_studentId_fkey') THEN
    ALTER TABLE "PortfolioCredential"
      ADD CONSTRAINT "PortfolioCredential_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
