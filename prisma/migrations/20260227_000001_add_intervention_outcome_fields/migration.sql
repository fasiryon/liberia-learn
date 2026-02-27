-- Add outcome resolution fields to InterventionLog
ALTER TABLE "InterventionLog"
  ADD COLUMN "outcomeEffectSize" DOUBLE PRECISION,
  ADD COLUMN "outcomeBaselineStart" TIMESTAMP(3),
  ADD COLUMN "outcomeBaselineEnd" TIMESTAMP(3),
  ADD COLUMN "outcomeFollowupStart" TIMESTAMP(3),
  ADD COLUMN "outcomeFollowupEnd" TIMESTAMP(3),
  ADD COLUMN "outcomeBaselineCount" INTEGER,
  ADD COLUMN "outcomeFollowupCount" INTEGER;

