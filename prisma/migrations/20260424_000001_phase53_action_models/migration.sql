-- Phase 5.3 — Intelligence-to-Action Automation
-- Additive: extends InterventionRecommendation + new TeacherAlert + CurriculumFlag tables

-- ──────────────────────────────────────────────
-- Extend InterventionRecommendation with lifecycle fields
-- ──────────────────────────────────────────────
ALTER TABLE "InterventionRecommendation" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
ALTER TABLE "InterventionRecommendation" ADD COLUMN IF NOT EXISTS "severity"       TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE "InterventionRecommendation" ADD COLUMN IF NOT EXISTS "sourceSignal"   TEXT;
ALTER TABLE "InterventionRecommendation" ADD COLUMN IF NOT EXISTS "targetType"     TEXT;
ALTER TABLE "InterventionRecommendation" ADD COLUMN IF NOT EXISTS "targetId"       TEXT;
ALTER TABLE "InterventionRecommendation" ADD COLUMN IF NOT EXISTS "resolvedAt"     TIMESTAMP(3);
ALTER TABLE "InterventionRecommendation" ADD COLUMN IF NOT EXISTS "resolvedBy"     TEXT;
ALTER TABLE "InterventionRecommendation" ADD COLUMN IF NOT EXISTS "dismissedAt"    TIMESTAMP(3);
ALTER TABLE "InterventionRecommendation" ADD COLUMN IF NOT EXISTS "dismissReason"  TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "InterventionRecommendation_idempotencyKey_key"
  ON "InterventionRecommendation"("idempotencyKey")
  WHERE "idempotencyKey" IS NOT NULL;

-- ──────────────────────────────────────────────
-- TeacherAlert — persistent alert lifecycle for teacher portal
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "TeacherAlert" (
  "id"                TEXT        NOT NULL,
  "teacherUserId"     TEXT        NOT NULL,
  "schoolId"          TEXT        NOT NULL,
  "studentId"         TEXT,
  "alertType"         TEXT        NOT NULL,
  "severity"          TEXT        NOT NULL DEFAULT 'medium',
  "reason"            TEXT        NOT NULL,
  "weakConcept"       TEXT,
  "weakLesson"        TEXT,
  "recommendedAction" TEXT,
  "idempotencyKey"    TEXT,
  "status"            TEXT        NOT NULL DEFAULT 'ACTIVE',
  "reviewedAt"        TIMESTAMP(3),
  "reviewedByUserId"  TEXT,
  "dismissedAt"       TIMESTAMP(3),
  "dismissReason"     TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeacherAlert_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TeacherAlert_idempotencyKey_key"
  ON "TeacherAlert"("idempotencyKey")
  WHERE "idempotencyKey" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "TeacherAlert_teacherUserId_status_idx"
  ON "TeacherAlert"("teacherUserId", "status");

CREATE INDEX IF NOT EXISTS "TeacherAlert_schoolId_status_idx"
  ON "TeacherAlert"("schoolId", "status");

-- ──────────────────────────────────────────────
-- CurriculumFlag — school/lesson-scoped curriculum review flags
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "CurriculumFlag" (
  "id"                TEXT         NOT NULL,
  "lessonId"          TEXT,
  "schoolId"          TEXT,
  "flagType"          TEXT         NOT NULL DEFAULT 'FLAG_CURRICULUM_REVIEW',
  "sourceSignal"      TEXT         NOT NULL,
  "severity"          TEXT         NOT NULL DEFAULT 'medium',
  "status"            TEXT         NOT NULL DEFAULT 'ACTIVE',
  "idempotencyKey"    TEXT         NOT NULL,
  "avgScore"          DOUBLE PRECISION,
  "retryRate"         DOUBLE PRECISION,
  "schoolCount"       INTEGER      NOT NULL DEFAULT 1,
  "details"           JSONB,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt"        TIMESTAMP(3),
  "resolvedByUserId"  TEXT,
  CONSTRAINT "CurriculumFlag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CurriculumFlag_idempotencyKey_key"
  ON "CurriculumFlag"("idempotencyKey");

CREATE INDEX IF NOT EXISTS "CurriculumFlag_lessonId_status_idx"
  ON "CurriculumFlag"("lessonId", "status");

CREATE INDEX IF NOT EXISTS "CurriculumFlag_status_idx"
  ON "CurriculumFlag"("status");
