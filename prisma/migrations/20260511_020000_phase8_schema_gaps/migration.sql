-- Phase 8: schema gaps — overallOutcome, confidenceScore, evaluationWindowClosedAt on
-- PostChangeEvaluationPlan and implementationOutcome on OptimizationChangeRequest.
-- All changes are additive; safe to apply to a live database.

ALTER TABLE "PostChangeEvaluationPlan"
  ADD COLUMN IF NOT EXISTS "overallOutcome" TEXT,
  ADD COLUMN IF NOT EXISTS "confidenceScore" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "evaluationWindowClosedAt" TIMESTAMP(3);

ALTER TABLE "OptimizationChangeRequest"
  ADD COLUMN IF NOT EXISTS "implementationOutcome" TEXT;
