-- Sprint 14: AssessmentAttemptDetail, StudentStreak, WeeklyLeaderboard, FTS indexes

-- AssessmentAttemptDetail
CREATE TABLE IF NOT EXISTS "AssessmentAttemptDetail" (
  "id" TEXT NOT NULL,
  "attemptId" TEXT NOT NULL,
  "questionIdx" INTEGER NOT NULL,
  "questionText" TEXT NOT NULL,
  "selectedAnswer" TEXT NOT NULL,
  "correctAnswer" TEXT NOT NULL,
  "isCorrect" BOOLEAN NOT NULL,
  "timeSpentSecs" INTEGER,
  CONSTRAINT "AssessmentAttemptDetail_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AssessmentAttemptDetail" ADD CONSTRAINT "AssessmentAttemptDetail_attemptId_fkey"
  FOREIGN KEY ("attemptId") REFERENCES "AssessmentAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "AssessmentAttemptDetail_attemptId_questionIdx_idx"
  ON "AssessmentAttemptDetail"("attemptId", "questionIdx");

-- StudentStreak
CREATE TABLE IF NOT EXISTS "StudentStreak" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "currentStreak" INTEGER NOT NULL DEFAULT 0,
  "longestStreak" INTEGER NOT NULL DEFAULT 0,
  "lastActiveDate" TIMESTAMP(3),
  "optOut" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentStreak_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StudentStreak_studentId_key" ON "StudentStreak"("studentId");

ALTER TABLE "StudentStreak" ADD CONSTRAINT "StudentStreak_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- WeeklyLeaderboard
CREATE TABLE IF NOT EXISTS "WeeklyLeaderboard" (
  "id" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "weekStart" TIMESTAMP(3) NOT NULL,
  "entries" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WeeklyLeaderboard_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyLeaderboard_classId_weekStart_key"
  ON "WeeklyLeaderboard"("classId", "weekStart");
CREATE INDEX IF NOT EXISTS "WeeklyLeaderboard_classId_weekStart_idx"
  ON "WeeklyLeaderboard"("classId", "weekStart");

-- FTS indexes
CREATE INDEX IF NOT EXISTS curriculum_content_fts
  ON "CurriculumContent" USING gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(subject, '')));

CREATE INDEX IF NOT EXISTS school_event_fts
  ON "SchoolEvent" USING gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '')));
