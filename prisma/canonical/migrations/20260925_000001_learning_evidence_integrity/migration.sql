-- Learning evidence integrity hardening V1. Canonical migration, additive only.
--
-- 1. Lesson completion side effects become claim-once. Each consequential
--    effect of a StudentProgress completion (mastery evidence, certificate /
--    progression, streak, guardian notification) has a nullable claim
--    timestamp that the server sets with a conditional UPDATE before running
--    the effect, so a replayed or concurrent completion cannot run it twice.
--    Completions recorded before this migration already ran their effects
--    under the previous pipeline, so they are backfilled as claimed.
-- 2. A learner may hold at most one ACTIVE placement session, so concurrent
--    starts cannot open parallel sessions to preview items.

-- Fail promptly on metadata-lock contention and cap total statement time.
SET lock_timeout = '5s';
SET statement_timeout = '5min';

-- AlterTable
ALTER TABLE "StudentProgress" ADD COLUMN     "masteryEffectAt" TIMESTAMP(3),
ADD COLUMN     "progressionEffectAt" TIMESTAMP(3),
ADD COLUMN     "streakEffectAt" TIMESTAMP(3),
ADD COLUMN     "guardianNotifiedAt" TIMESTAMP(3);

-- Backfill: pre-existing completions must not re-run effects on replay.
UPDATE "StudentProgress"
SET "masteryEffectAt" = "completedAt",
    "progressionEffectAt" = "completedAt",
    "streakEffectAt" = "completedAt",
    "guardianNotifiedAt" = "completedAt"
WHERE "completedAt" IS NOT NULL;

-- Close any duplicate ACTIVE sessions left by concurrent starts (newest wins)
-- so the partial unique index below can be created.
UPDATE "PlacementSession" s
SET "status" = 'EXPIRED'
WHERE s."status" = 'ACTIVE'
  AND EXISTS (
    SELECT 1 FROM "PlacementSession" newer
    WHERE newer."studentId" = s."studentId"
      AND newer."status" = 'ACTIVE'
      AND (newer."createdAt", newer."id") > (s."createdAt", s."id")
  );

-- CreateIndex (partial; Prisma cannot express the predicate)
CREATE UNIQUE INDEX "PlacementSession_one_active_per_student_key"
ON "PlacementSession"("studentId") WHERE ("status" = 'ACTIVE');
