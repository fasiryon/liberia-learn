-- Phase 10: OperatorIncidentNote
-- Additive: new table only. No column changes to existing tables.

CREATE TABLE "OperatorIncidentNote" (
    "id" TEXT NOT NULL,
    "workflowRunId" TEXT NOT NULL,
    "noteType" TEXT NOT NULL,
    "severity" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "body" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "schoolId" TEXT,
    "tenantId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperatorIncidentNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OperatorIncidentNote_workflowRunId_createdAt_idx"
    ON "OperatorIncidentNote"("workflowRunId", "createdAt");

CREATE INDEX "OperatorIncidentNote_status_createdAt_idx"
    ON "OperatorIncidentNote"("status", "createdAt");

CREATE INDEX "OperatorIncidentNote_createdByUserId_createdAt_idx"
    ON "OperatorIncidentNote"("createdByUserId", "createdAt");
