-- Reconcile the one live application field that was never represented in
-- executable history. This is additive and preserves every existing row.
ALTER TABLE "InterventionRecommendation"
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- The shipped capstone state machine creates projects as DRAFT. Align only
-- the default for omitted values; existing rows are not rewritten.
ALTER TABLE "CapstoneProject"
  ALTER COLUMN "status" SET DEFAULT 'DRAFT';
