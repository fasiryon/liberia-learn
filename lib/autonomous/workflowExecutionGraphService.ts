import { prisma } from "@/lib/db";

export type ExecutionNodeType =
  | "trigger" | "workflow" | "step" | "checkpoint"
  | "decision" | "action" | "approval" | "dead_letter";

export type ExecutionNodeStatus =
  | "pending" | "running" | "succeeded" | "failed" | "skipped"
  | "dead_lettered" | "cancelled" | "waiting_for_approval" | string;

export interface ExecutionNode {
  id: string;
  type: ExecutionNodeType;
  label: string;
  status: ExecutionNodeStatus;
  timestamp: string | null;
  metadata: Record<string, unknown>;
  parentId: string | null;
}

export interface WorkflowExecutionGraph {
  workflowRunId: string;
  workflowType: string;
  overallStatus: string;
  replaySafe: boolean;
  nodes: ExecutionNode[];
  nodeCount: number;
}

export async function getWorkflowExecutionGraph(workflowRunId: string): Promise<WorkflowExecutionGraph> {
  const [workflowRun, steps, checkpoints, decisions, actions, approvals] = await Promise.all([
    (prisma as any).workflowRun.findUnique({ where: { id: workflowRunId } }),
    (prisma as any).workflowStep.findMany({ where: { workflowRunId }, orderBy: { sequence: "asc" } }),
    (prisma as any).workflowCheckpoint.findMany({ where: { workflowRunId }, orderBy: { sequence: "asc" } }),
    (prisma as any).agentDecision.findMany({ where: { workflowRunId }, orderBy: { createdAt: "asc" } }),
    (prisma as any).actionExecution.findMany({ where: { workflowRunId }, orderBy: { createdAt: "asc" } }),
    (prisma as any).approvalRequest.findMany({ where: { workflowRunId }, orderBy: { requestedAt: "asc" } }),
  ]);

  if (!workflowRun) throw Object.assign(new Error("WorkflowRun not found"), { status: 404 });

  const nodes: ExecutionNode[] = [];
  const triggerId = `trigger__${workflowRunId}`;

  nodes.push({
    id: triggerId,
    type: "trigger",
    label: workflowRun.source ?? "system.trigger",
    status: "succeeded",
    timestamp: workflowRun.createdAt?.toISOString() ?? null,
    metadata: {
      triggerEventId: workflowRun.triggerEventId ?? null,
      source: workflowRun.source ?? null,
      correlationId: workflowRun.correlationId ?? null,
    },
    parentId: null,
  });

  nodes.push({
    id: workflowRunId,
    type: "workflow",
    label: workflowRun.workflowType,
    status: workflowRun.status,
    timestamp: workflowRun.createdAt?.toISOString() ?? null,
    metadata: {
      riskLevel: workflowRun.riskLevel,
      attempt: workflowRun.attempt,
      maxAttempts: workflowRun.maxAttempts,
      partitionKey: workflowRun.partitionKey ?? null,
      isReplay: workflowRun.isReplay ?? false,
      replayOfRunId: workflowRun.replayOfRunId ?? null,
    },
    parentId: triggerId,
  });

  for (const step of steps) {
    nodes.push({
      id: step.id,
      type: "step",
      label: `${step.stepType ?? "step"}: ${step.stepKey ?? step.id}`,
      status: step.status ?? "pending",
      timestamp: step.startedAt?.toISOString() ?? step.createdAt?.toISOString() ?? null,
      metadata: {
        sequence: step.sequence ?? null,
        durationMs: step.durationMs ?? null,
        errorCode: step.errorCode ?? null,
      },
      parentId: workflowRunId,
    });
  }

  for (const cp of checkpoints) {
    nodes.push({
      id: cp.id,
      type: "checkpoint",
      label: cp.checkpointKey ?? `checkpoint:${cp.sequence}`,
      status: "succeeded",
      timestamp: cp.createdAt?.toISOString() ?? null,
      metadata: { sequence: cp.sequence ?? null },
      parentId: workflowRunId,
    });
  }

  for (const decision of decisions) {
    nodes.push({
      id: decision.id,
      type: "decision",
      label: decision.decisionType ?? "decision",
      status: decision.outcome ?? "pending",
      timestamp: decision.createdAt?.toISOString() ?? null,
      metadata: {
        confidence: decision.confidence ?? null,
        rationale: decision.rationale ?? null,
      },
      parentId: workflowRunId,
    });
  }

  for (const action of actions) {
    nodes.push({
      id: action.id,
      type: "action",
      label: action.actionType ?? "action",
      status: action.status ?? "pending",
      timestamp: action.createdAt?.toISOString() ?? null,
      metadata: {
        riskLevel: action.riskLevel ?? null,
        requiresApproval: action.requiresApproval ?? false,
        errorCode: action.errorCode ?? null,
      },
      parentId: workflowRunId,
    });
  }

  for (const approval of approvals) {
    nodes.push({
      id: approval.id,
      type: "approval",
      label: `approval: ${approval.approvalType ?? "general"}`,
      status: (approval.status ?? "PENDING").toLowerCase(),
      timestamp: approval.requestedAt?.toISOString() ?? null,
      metadata: {
        requestedRole: approval.requestedRole ?? null,
        decidedAt: approval.decidedAt?.toISOString() ?? null,
        decision: approval.decision ?? null,
      },
      parentId: workflowRunId,
    });
  }

  if (workflowRun.status === "dead_lettered") {
    nodes.push({
      id: `dead_letter__${workflowRunId}`,
      type: "dead_letter",
      label: "dead_lettered",
      status: "dead_lettered",
      timestamp:
        workflowRun.deadLetteredAt?.toISOString() ??
        workflowRun.updatedAt?.toISOString() ??
        null,
      metadata: {
        lastErrorCode: workflowRun.lastErrorCode ?? null,
        lastErrorMessage: workflowRun.lastErrorMessage ?? null,
        attempt: workflowRun.attempt,
        maxAttempts: workflowRun.maxAttempts,
      },
      parentId: workflowRunId,
    });
  }

  const replaySafe =
    actions.length === 0 ||
    actions.every((a: any) => a.status !== "succeeded");

  return {
    workflowRunId,
    workflowType: workflowRun.workflowType,
    overallStatus: workflowRun.status,
    replaySafe,
    nodes,
    nodeCount: nodes.length,
  };
}
