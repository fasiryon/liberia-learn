-- NR-14B: Adaptive Learning Engine — 6 new tables
-- Applied manually via: npx dotenv -e .env.production -- npx prisma db execute --file prisma/migrations/20260529_000001_adaptive_engine/migration.sql

-- 1. StudentSession
CREATE TABLE IF NOT EXISTS "StudentSession" (
  "id"                 TEXT NOT NULL,
  "studentId"          TEXT NOT NULL,
  "lessonId"           TEXT NOT NULL,
  "startedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt"            TIMESTAMP(3),
  "totalMs"            INTEGER NOT NULL DEFAULT 0,
  "questionsAttempted" INTEGER NOT NULL DEFAULT 0,
  "questionsCorrect"   INTEGER NOT NULL DEFAULT 0,
  "stuckEventCount"    INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "StudentSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudentSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "StudentSession_studentId_lessonId_idx" ON "StudentSession"("studentId", "lessonId");
CREATE INDEX IF NOT EXISTS "StudentSession_startedAt_idx" ON "StudentSession"("startedAt");

-- 2. LessonPrerequisite
CREATE TABLE IF NOT EXISTS "LessonPrerequisite" (
  "id"                   TEXT NOT NULL,
  "lessonId"             TEXT NOT NULL,
  "prerequisiteLessonId" TEXT NOT NULL,
  "strength"             TEXT NOT NULL DEFAULT 'required',
  CONSTRAINT "LessonPrerequisite_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LessonPrerequisite_lessonId_prerequisiteLessonId_key" UNIQUE ("lessonId", "prerequisiteLessonId")
);
CREATE INDEX IF NOT EXISTS "LessonPrerequisite_lessonId_idx" ON "LessonPrerequisite"("lessonId");
CREATE INDEX IF NOT EXISTS "LessonPrerequisite_prerequisiteLessonId_idx" ON "LessonPrerequisite"("prerequisiteLessonId");

-- 3. LessonVariant
CREATE TABLE IF NOT EXISTS "LessonVariant" (
  "id"          TEXT NOT NULL,
  "lessonId"    TEXT NOT NULL,
  "variantType" TEXT NOT NULL,
  "body"        TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LessonVariant_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "LessonVariant_lessonId_variantType_idx" ON "LessonVariant"("lessonId", "variantType");

-- 4. AdaptiveMasteryRecord (NR-14B rolling EMA mastery — distinct from Block 7B MasteryRecord)
CREATE TABLE IF NOT EXISTS "AdaptiveMasteryRecord" (
  "id"                 TEXT NOT NULL,
  "studentId"          TEXT NOT NULL,
  "skillKey"           TEXT NOT NULL,
  "score"              DOUBLE PRECISION NOT NULL DEFAULT 0,
  "consecutiveCorrect" INTEGER NOT NULL DEFAULT 0,
  "masteredAt"         TIMESTAMP(3),
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdaptiveMasteryRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdaptiveMasteryRecord_studentId_skillKey_key" UNIQUE ("studentId", "skillKey"),
  CONSTRAINT "AdaptiveMasteryRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "AdaptiveMasteryRecord_studentId_idx" ON "AdaptiveMasteryRecord"("studentId");

-- 5. StuckEvent
CREATE TABLE IF NOT EXISTS "StuckEvent" (
  "id"        TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "lessonId"  TEXT NOT NULL,
  "sessionId" TEXT,
  "signal"    TEXT NOT NULL,
  "detail"    JSONB,
  "routedTo"  TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StuckEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StuckEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "StuckEvent_studentId_lessonId_idx" ON "StuckEvent"("studentId", "lessonId");
CREATE INDEX IF NOT EXISTS "StuckEvent_createdAt_idx" ON "StuckEvent"("createdAt");

-- 6. LearningPathQueue
CREATE TABLE IF NOT EXISTS "LearningPathQueue" (
  "id"         TEXT NOT NULL,
  "studentId"  TEXT NOT NULL,
  "lessonId"   TEXT NOT NULL,
  "reason"     TEXT NOT NULL,
  "priority"   INTEGER NOT NULL DEFAULT 0,
  "resolvedAt" TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LearningPathQueue_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LearningPathQueue_studentId_lessonId_key" UNIQUE ("studentId", "lessonId"),
  CONSTRAINT "LearningPathQueue_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "LearningPathQueue_studentId_resolvedAt_idx" ON "LearningPathQueue"("studentId", "resolvedAt");
