-- Server-authoritative placement assessment (closes December audit D01/F11).
-- Canonical migration, additive only. Placement items and answer keys live
-- server-side; reviews and official decisions are append-only; an item's
-- learner response is write-once. RLS is enabled from creation and no
-- anon/authenticated privileges are granted (server-only table convention).

-- Fail promptly on metadata-lock contention and cap total statement time.
SET lock_timeout = '5s';
SET statement_timeout = '5min';

-- AlterTable
ALTER TABLE "PlacementTest" ADD COLUMN     "scoringVersion" TEXT,
ADD COLUMN     "sessionId" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'legacy_client';

-- CreateTable
CREATE TABLE "PlacementSession" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "assessmentVersion" TEXT NOT NULL,
    "gradeMin" INTEGER NOT NULL DEFAULT 1,
    "gradeMax" INTEGER NOT NULL DEFAULT 12,
    "maxItems" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "placementTestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlacementSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlacementSessionItem" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "itemVersion" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "strand" TEXT NOT NULL,
    "moeStandard" TEXT,
    "prompt" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctIndex" INTEGER NOT NULL,
    "explanation" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "selectedIndex" INTEGER,
    "isCorrect" BOOLEAN,
    "responseOperationId" TEXT,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "PlacementSessionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlacementReview" (
    "id" TEXT NOT NULL,
    "placementTestId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "recommendedGrade" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlacementReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlacementDecision" (
    "id" TEXT NOT NULL,
    "placementTestId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "decidedById" TEXT NOT NULL,
    "recommendedGrade" INTEGER NOT NULL,
    "finalGrade" INTEGER NOT NULL,
    "previousGrade" INTEGER,
    "isOverride" BOOLEAN NOT NULL,
    "reason" TEXT,
    "assessmentSource" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlacementDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlacementSession_placementTestId_key" ON "PlacementSession"("placementTestId");

-- CreateIndex
CREATE INDEX "PlacementSession_studentId_status_idx" ON "PlacementSession"("studentId", "status");

-- CreateIndex
CREATE INDEX "PlacementSession_schoolId_createdAt_idx" ON "PlacementSession"("schoolId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlacementSessionItem_responseOperationId_key" ON "PlacementSessionItem"("responseOperationId");

-- CreateIndex
CREATE UNIQUE INDEX "PlacementSessionItem_sessionId_sequence_key" ON "PlacementSessionItem"("sessionId", "sequence");

-- CreateIndex
CREATE INDEX "PlacementReview_placementTestId_createdAt_idx" ON "PlacementReview"("placementTestId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlacementDecision_placementTestId_key" ON "PlacementDecision"("placementTestId");

-- CreateIndex
CREATE INDEX "PlacementDecision_schoolId_createdAt_idx" ON "PlacementDecision"("schoolId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlacementTest_sessionId_key" ON "PlacementTest"("sessionId");

-- AddForeignKey
ALTER TABLE "PlacementSession" ADD CONSTRAINT "PlacementSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacementSessionItem" ADD CONSTRAINT "PlacementSessionItem_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PlacementSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacementReview" ADD CONSTRAINT "PlacementReview_placementTestId_fkey" FOREIGN KEY ("placementTestId") REFERENCES "PlacementTest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacementDecision" ADD CONSTRAINT "PlacementDecision_placementTestId_fkey" FOREIGN KEY ("placementTestId") REFERENCES "PlacementTest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Official decisions and instructional reviews are append-only.
CREATE OR REPLACE FUNCTION placement_reject_history_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % is not permitted', TG_TABLE_NAME, TG_OP;
END;
$$;

CREATE TRIGGER placement_decision_no_update_or_delete
BEFORE UPDATE OR DELETE ON "PlacementDecision"
FOR EACH ROW
EXECUTE FUNCTION placement_reject_history_mutation();

CREATE TRIGGER placement_review_no_update_or_delete
BEFORE UPDATE OR DELETE ON "PlacementReview"
FOR EACH ROW
EXECUTE FUNCTION placement_reject_history_mutation();

-- An issued item's content and a recorded response can never be rewritten.
CREATE OR REPLACE FUNCTION placement_item_response_write_once()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."itemVersion" IS DISTINCT FROM OLD."itemVersion"
     OR NEW."prompt" IS DISTINCT FROM OLD."prompt"
     OR NEW."options" IS DISTINCT FROM OLD."options"
     OR NEW."correctIndex" IS DISTINCT FROM OLD."correctIndex" THEN
    RAISE EXCEPTION 'PlacementSessionItem content is immutable once issued';
  END IF;
  IF OLD."respondedAt" IS NOT NULL AND (
       NEW."selectedIndex" IS DISTINCT FROM OLD."selectedIndex"
       OR NEW."isCorrect" IS DISTINCT FROM OLD."isCorrect"
       OR NEW."responseOperationId" IS DISTINCT FROM OLD."responseOperationId"
       OR NEW."respondedAt" IS DISTINCT FROM OLD."respondedAt") THEN
    RAISE EXCEPTION 'PlacementSessionItem response is write-once';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER placement_session_item_write_once
BEFORE UPDATE ON "PlacementSessionItem"
FOR EACH ROW
EXECUTE FUNCTION placement_item_response_write_once();

-- Security convergence from creation.
ALTER TABLE "PlacementSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlacementSessionItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlacementReview" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlacementDecision" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE role_name text;
DECLARE table_list constant text := '"PlacementSession", "PlacementSessionItem", "PlacementReview", "PlacementDecision"';
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON TABLE %s FROM %I', table_list, role_name);
    END IF;
  END LOOP;
END;
$$;

RESET statement_timeout;
RESET lock_timeout;
