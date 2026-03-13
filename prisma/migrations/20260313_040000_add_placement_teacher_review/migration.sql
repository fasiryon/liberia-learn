ALTER TABLE "PlacementTest"
ADD COLUMN "teacherDecision" TEXT,
ADD COLUMN "teacherGrade" INTEGER,
ADD COLUMN "teacherReason" TEXT,
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "reviewedBy" TEXT;

CREATE INDEX "PlacementTest_teacherDecision_createdAt_idx"
ON "PlacementTest"("teacherDecision", "createdAt");
