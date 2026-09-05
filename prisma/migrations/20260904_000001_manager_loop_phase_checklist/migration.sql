-- Manager Loop Sub-project 1: extend the Autonomous OS Phase 1 workflow schema with
-- Mission/Phase/Checklist concepts. All changes additive; no existing table, column,
-- or row is altered, renamed, or dropped.

ALTER TABLE "WorkflowRun" ADD COLUMN "objective" TEXT;
ALTER TABLE "WorkflowRun" ADD COLUMN "scope" JSONB;
ALTER TABLE "WorkflowRun" ADD COLUMN "constraints" JSONB;
ALTER TABLE "WorkflowRun" ADD COLUMN "acceptanceCriteria" JSONB;
ALTER TABLE "WorkflowRun" ADD COLUMN "dependsOnRunIds" JSONB;

ALTER TABLE "WorkflowStep" ADD COLUMN "workflowPhaseId" TEXT;
ALTER TABLE "AgentRun" ADD COLUMN "workflowPhaseId" TEXT;

CREATE TABLE "WorkflowPhase" (
  "id" TEXT NOT NULL,
  "workflowRunId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "objective" TEXT NOT NULL,
  "acceptanceCriteria" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
  "dependsOnPhaseIds" JSONB NOT NULL DEFAULT '[]',
  "attempt" INTEGER NOT NULL DEFAULT 0,
  "lastProgressAt" TIMESTAMP(3),
  "blockedReason" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkflowPhase_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkflowPhase_workflowRunId_sequence_idx" ON "WorkflowPhase"("workflowRunId", "sequence");
CREATE INDEX "WorkflowPhase_workflowRunId_status_idx" ON "WorkflowPhase"("workflowRunId", "status");

CREATE TABLE "WorkflowChecklistItem" (
  "id" TEXT NOT NULL,
  "workflowPhaseId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "evidenceRef" JSONB,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkflowChecklistItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkflowChecklistItem_workflowPhaseId_status_idx" ON "WorkflowChecklistItem"("workflowPhaseId", "status");

CREATE INDEX "WorkflowStep_workflowPhaseId_idx" ON "WorkflowStep"("workflowPhaseId");
CREATE INDEX "AgentRun_workflowPhaseId_idx" ON "AgentRun"("workflowPhaseId");
