-- CreateTable
CREATE TABLE "ReportDraft" (
    "id" TEXT NOT NULL,
    "agentName" TEXT NOT NULL DEFAULT 'moe-narrative-report',
    "scope" TEXT NOT NULL,
    "scopeId" TEXT,
    "periodType" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "narrativeText" TEXT NOT NULL,
    "dataSnapshot" JSONB NOT NULL,
    "changesSummary" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportDraft_scope_scopeId_periodType_createdAt_idx" ON "ReportDraft"("scope", "scopeId", "periodType", "createdAt");
