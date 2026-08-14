SET lock_timeout = '5s';
SET statement_timeout = '5min';

ALTER TABLE "CurriculumReviewTask"
  ADD COLUMN "reviewCycle" INTEGER NOT NULL DEFAULT 1,
  ADD CONSTRAINT "CurriculumReviewTask_review_cycle_check" CHECK ("reviewCycle" > 0);

DROP INDEX "CurriculumReviewTask_revisionId_policyKey_policyVersion_key";

CREATE UNIQUE INDEX "CurriculumReviewTask_revisionId_policyKey_policyVersion_reviewCycle_key"
  ON "CurriculumReviewTask"("revisionId", "policyKey", "policyVersion", "reviewCycle");

RESET statement_timeout;
RESET lock_timeout;
