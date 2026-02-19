-- Pilot checklist items
CREATE TABLE "PilotChecklistItem" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PilotChecklistItem_pkey" PRIMARY KEY ("id")
);

-- Pilot checklist statuses
CREATE TABLE "PilotChecklistStatus" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "completedAt" TIMESTAMP(3),
  "completedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PilotChecklistStatus_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PilotChecklistStatus_schoolId_itemId_key" ON "PilotChecklistStatus"("schoolId", "itemId");
CREATE INDEX "PilotChecklistStatus_schoolId_completedAt_idx" ON "PilotChecklistStatus"("schoolId", "completedAt");
CREATE INDEX "PilotChecklistItem_active_sortOrder_idx" ON "PilotChecklistItem"("active", "sortOrder");

ALTER TABLE "PilotChecklistStatus"
ADD CONSTRAINT "PilotChecklistStatus_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PilotChecklistStatus"
ADD CONSTRAINT "PilotChecklistStatus_itemId_fkey"
FOREIGN KEY ("itemId") REFERENCES "PilotChecklistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
