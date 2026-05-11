-- Autonomous OS Phase 1: additive workflow foundation.
ALTER TABLE "LearningEvent" ADD COLUMN "workflowRunId" TEXT;
ALTER TABLE "LearningEvent" ADD COLUMN "workflowTraceId" TEXT;
ALTER TABLE "LearningEvent" ADD COLUMN "correlationId" TEXT;

CREATE TABLE "WorkflowRun" (
  "id" TEXT NOT NULL,
  "workflowType" TEXT NOT NULL,
  "tenantId" TEXT,
  "schoolId" TEXT,
  "districtId" TEXT,
  "partitionKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "riskLevel" TEXT NOT NULL DEFAULT 'low',
  "traceId" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL,
  "idempotencyKey" TEXT,
  "triggerEventId" TEXT,
  "replayOfRunId" TEXT,
  "isReplay" BOOLEAN NOT NULL DEFAULT false,
  "replayMode" TEXT NOT NULL DEFAULT 'analysis_only',
  "replaySequence" INTEGER,
  "source" TEXT,
  "targetType" TEXT,
  "targetId" TEXT,
  "currentCheckpoint" TEXT,
  "approvalRequired" BOOLEAN NOT NULL DEFAULT false,
  "approvalRequestId" TEXT,
  "attempt" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "nextRetryAt" TIMESTAMP(3),
  "lockedBy" TEXT,
  "lockedUntil" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "evidenceRefs" JSONB,
  "queueMetadata" JSONB,
  "executionMetadata" JSONB,
  "tracingMetadata" JSONB,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "deadLetteredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "WorkflowRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkflowStep" (
  "id" TEXT NOT NULL,
  "workflowRunId" TEXT NOT NULL,
  "stepKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "sequence" INTEGER NOT NULL DEFAULT 0,
  "attempt" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "idempotencyKey" TEXT,
  "traceId" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "nextRetryAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "inputRefs" JSONB,
  "outputRefs" JSONB,
  "executionMetadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkflowStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkflowCheckpoint" (
  "id" TEXT NOT NULL,
  "workflowRunId" TEXT NOT NULL,
  "checkpointKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'recorded',
  "sequence" INTEGER NOT NULL,
  "actorType" TEXT,
  "actorId" TEXT,
  "workerId" TEXT,
  "traceId" TEXT,
  "idempotencyKey" TEXT,
  "state" JSONB,
  "evidenceRefs" JSONB,
  "executionMetadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkflowCheckpoint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentRun" (
  "id" TEXT NOT NULL,
  "workflowRunId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "tenantId" TEXT,
  "schoolId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "traceId" TEXT,
  "idempotencyKey" TEXT,
  "confidence" DOUBLE PRECISION,
  "riskLevel" TEXT,
  "evidenceRefs" JSONB,
  "inputRefs" JSONB,
  "outputRefs" JSONB,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "executionMetadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentDecision" (
  "id" TEXT NOT NULL,
  "workflowRunId" TEXT NOT NULL,
  "agentRunId" TEXT,
  "decisionType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'proposed',
  "riskLevel" TEXT NOT NULL DEFAULT 'low',
  "confidence" DOUBLE PRECISION,
  "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
  "traceId" TEXT,
  "idempotencyKey" TEXT,
  "evidenceRefs" JSONB,
  "decision" JSONB NOT NULL,
  "explanation" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentDecision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActionExecution" (
  "id" TEXT NOT NULL,
  "workflowRunId" TEXT NOT NULL,
  "agentDecisionId" TEXT,
  "approvalRequestId" TEXT,
  "actionType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "riskLevel" TEXT NOT NULL DEFAULT 'low',
  "tenantId" TEXT,
  "schoolId" TEXT,
  "targetType" TEXT,
  "targetId" TEXT,
  "traceId" TEXT,
  "idempotencyKey" TEXT,
  "rollbackStatus" TEXT,
  "rollbackRefs" JSONB,
  "inputRefs" JSONB,
  "outputRefs" JSONB,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "executionMetadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ActionExecution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApprovalRequest" (
  "id" TEXT NOT NULL,
  "workflowRunId" TEXT NOT NULL,
  "actionExecutionId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "riskLevel" TEXT NOT NULL,
  "approvalType" TEXT NOT NULL,
  "tenantId" TEXT,
  "schoolId" TEXT,
  "districtId" TEXT,
  "requestedByType" TEXT,
  "requestedById" TEXT,
  "approverRole" TEXT,
  "approverUserId" TEXT,
  "traceId" TEXT,
  "idempotencyKey" TEXT,
  "evidenceRefs" JSONB,
  "requestPayload" JSONB,
  "decisionPayload" JSONB,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExecutionTrace" (
  "id" TEXT NOT NULL,
  "traceId" TEXT NOT NULL,
  "workflowRunId" TEXT,
  "parentTraceId" TEXT,
  "spanType" TEXT NOT NULL,
  "spanName" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'started',
  "tenantId" TEXT,
  "schoolId" TEXT,
  "actorType" TEXT,
  "actorId" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "durationMs" INTEGER,
  "metadata" JSONB,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExecutionTrace_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LearningEvent_workflowRunId_occurredAt_idx" ON "LearningEvent"("workflowRunId", "occurredAt");
CREATE INDEX "LearningEvent_workflowTraceId_occurredAt_idx" ON "LearningEvent"("workflowTraceId", "occurredAt");
CREATE INDEX "LearningEvent_correlationId_occurredAt_idx" ON "LearningEvent"("correlationId", "occurredAt");

CREATE UNIQUE INDEX "WorkflowRun_traceId_key" ON "WorkflowRun"("traceId");
CREATE UNIQUE INDEX "WorkflowRun_idempotencyKey_key" ON "WorkflowRun"("idempotencyKey");
CREATE INDEX "WorkflowRun_schoolId_status_createdAt_idx" ON "WorkflowRun"("schoolId", "status", "createdAt");
CREATE INDEX "WorkflowRun_tenantId_status_createdAt_idx" ON "WorkflowRun"("tenantId", "status", "createdAt");
CREATE INDEX "WorkflowRun_districtId_status_createdAt_idx" ON "WorkflowRun"("districtId", "status", "createdAt");
CREATE INDEX "WorkflowRun_partitionKey_status_createdAt_idx" ON "WorkflowRun"("partitionKey", "status", "createdAt");
CREATE INDEX "WorkflowRun_workflowType_status_createdAt_idx" ON "WorkflowRun"("workflowType", "status", "createdAt");
CREATE INDEX "WorkflowRun_triggerEventId_idx" ON "WorkflowRun"("triggerEventId");
CREATE INDEX "WorkflowRun_replayOfRunId_idx" ON "WorkflowRun"("replayOfRunId");
CREATE INDEX "WorkflowRun_correlationId_createdAt_idx" ON "WorkflowRun"("correlationId", "createdAt");
CREATE INDEX "WorkflowRun_nextRetryAt_status_idx" ON "WorkflowRun"("nextRetryAt", "status");
CREATE INDEX "WorkflowRun_lockedUntil_idx" ON "WorkflowRun"("lockedUntil");

CREATE UNIQUE INDEX "WorkflowStep_idempotencyKey_key" ON "WorkflowStep"("idempotencyKey");
CREATE INDEX "WorkflowStep_workflowRunId_sequence_idx" ON "WorkflowStep"("workflowRunId", "sequence");
CREATE INDEX "WorkflowStep_workflowRunId_status_idx" ON "WorkflowStep"("workflowRunId", "status");
CREATE INDEX "WorkflowStep_stepKey_status_createdAt_idx" ON "WorkflowStep"("stepKey", "status", "createdAt");
CREATE INDEX "WorkflowStep_nextRetryAt_status_idx" ON "WorkflowStep"("nextRetryAt", "status");

CREATE UNIQUE INDEX "WorkflowCheckpoint_idempotencyKey_key" ON "WorkflowCheckpoint"("idempotencyKey");
CREATE INDEX "WorkflowCheckpoint_workflowRunId_sequence_idx" ON "WorkflowCheckpoint"("workflowRunId", "sequence");
CREATE INDEX "WorkflowCheckpoint_workflowRunId_checkpointKey_createdAt_idx" ON "WorkflowCheckpoint"("workflowRunId", "checkpointKey", "createdAt");
CREATE INDEX "WorkflowCheckpoint_traceId_createdAt_idx" ON "WorkflowCheckpoint"("traceId", "createdAt");

CREATE UNIQUE INDEX "AgentRun_idempotencyKey_key" ON "AgentRun"("idempotencyKey");
CREATE INDEX "AgentRun_workflowRunId_createdAt_idx" ON "AgentRun"("workflowRunId", "createdAt");
CREATE INDEX "AgentRun_agentId_status_createdAt_idx" ON "AgentRun"("agentId", "status", "createdAt");
CREATE INDEX "AgentRun_schoolId_status_createdAt_idx" ON "AgentRun"("schoolId", "status", "createdAt");

CREATE UNIQUE INDEX "AgentDecision_idempotencyKey_key" ON "AgentDecision"("idempotencyKey");
CREATE INDEX "AgentDecision_workflowRunId_createdAt_idx" ON "AgentDecision"("workflowRunId", "createdAt");
CREATE INDEX "AgentDecision_agentRunId_createdAt_idx" ON "AgentDecision"("agentRunId", "createdAt");
CREATE INDEX "AgentDecision_status_riskLevel_createdAt_idx" ON "AgentDecision"("status", "riskLevel", "createdAt");

CREATE UNIQUE INDEX "ActionExecution_idempotencyKey_key" ON "ActionExecution"("idempotencyKey");
CREATE INDEX "ActionExecution_workflowRunId_createdAt_idx" ON "ActionExecution"("workflowRunId", "createdAt");
CREATE INDEX "ActionExecution_schoolId_status_createdAt_idx" ON "ActionExecution"("schoolId", "status", "createdAt");
CREATE INDEX "ActionExecution_actionType_status_createdAt_idx" ON "ActionExecution"("actionType", "status", "createdAt");
CREATE INDEX "ActionExecution_approvalRequestId_idx" ON "ActionExecution"("approvalRequestId");

CREATE UNIQUE INDEX "ApprovalRequest_idempotencyKey_key" ON "ApprovalRequest"("idempotencyKey");
CREATE INDEX "ApprovalRequest_workflowRunId_createdAt_idx" ON "ApprovalRequest"("workflowRunId", "createdAt");
CREATE INDEX "ApprovalRequest_schoolId_status_createdAt_idx" ON "ApprovalRequest"("schoolId", "status", "createdAt");
CREATE INDEX "ApprovalRequest_approverRole_status_createdAt_idx" ON "ApprovalRequest"("approverRole", "status", "createdAt");
CREATE INDEX "ApprovalRequest_traceId_createdAt_idx" ON "ApprovalRequest"("traceId", "createdAt");

CREATE INDEX "ExecutionTrace_traceId_startedAt_idx" ON "ExecutionTrace"("traceId", "startedAt");
CREATE INDEX "ExecutionTrace_workflowRunId_startedAt_idx" ON "ExecutionTrace"("workflowRunId", "startedAt");
CREATE INDEX "ExecutionTrace_schoolId_status_startedAt_idx" ON "ExecutionTrace"("schoolId", "status", "startedAt");
CREATE INDEX "ExecutionTrace_spanType_status_startedAt_idx" ON "ExecutionTrace"("spanType", "status", "startedAt");
