-- CreateTable
CREATE TABLE "DistrictUpdateDraft" (
    "id" TEXT NOT NULL,
    "agentName" TEXT NOT NULL DEFAULT 'district-update',
    "type" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "draftText" TEXT NOT NULL,
    "dataSnapshot" JSONB NOT NULL,
    "changesSummary" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DistrictUpdateDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DistrictUpdateDraft_type_scope_scopeId_createdAt_idx" ON "DistrictUpdateDraft"("type", "scope", "scopeId", "createdAt");
