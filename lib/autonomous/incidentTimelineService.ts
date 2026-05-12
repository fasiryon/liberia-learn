import { prisma } from "@/lib/db";

export type TimelineEntryType =
  | "workflow_created"
  | "status_change"
  | "trace_span"
  | "audit_event"
  | "cron_recovery"
  | "replay_attempt"
  | "approval_event"
  | "action_execution"
  | "decision"
  | "operator_note";

export type TimelineEntrySeverity = "info" | "warn" | "error" | null;

export interface TimelineEntry {
  id: string;
  type: TimelineEntryType;
  timestamp: string;
  title: string;
  detail: string | null;
  severity: TimelineEntrySeverity;
  metadata: Record<string, unknown>;
}

export interface IncidentTimeline {
  workflowRunId: string;
  entries: TimelineEntry[];
  totalCount: number;
}

export async function getIncidentTimeline(workflowRunId: string): Promise<IncidentTimeline> {
  const [workflowRun, traces, approvals, actions, decisions, auditLogs, notes] = await Promise.all([
    (prisma as any).workflowRun.findUnique({ where: { id: workflowRunId } }),
    (prisma as any).executionTrace.findMany({
      where: { workflowRunId },
      orderBy: { startedAt: "asc" },
      take: 100,
    }),
    (prisma as any).approvalRequest.findMany({
      where: { workflowRunId },
      orderBy: { requestedAt: "asc" },
    }),
    (prisma as any).actionExecution.findMany({
      where: { workflowRunId },
      orderBy: { createdAt: "asc" },
    }),
    (prisma as any).agentDecision.findMany({
      where: { workflowRunId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.auditLog.findMany({
      where: {
        action: { contains: workflowRunId },
      },
      orderBy: { createdAt: "asc" },
      take: 50,
    }),
    (prisma as any).operatorIncidentNote.findMany({
      where: { workflowRunId },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!workflowRun) throw Object.assign(new Error("WorkflowRun not found"), { status: 404 });

  const entries: TimelineEntry[] = [];

  entries.push({
    id: `created__${workflowRunId}`,
    type: "workflow_created",
    timestamp: workflowRun.createdAt?.toISOString() ?? new Date().toISOString(),
    title: `Workflow created: ${workflowRun.workflowType}`,
    detail: `source=${workflowRun.source ?? "unknown"}, risk=${workflowRun.riskLevel}`,
    severity: "info",
    metadata: { workflowType: workflowRun.workflowType, source: workflowRun.source },
  });

  for (const trace of traces) {
    const isFailed = trace.status === "failed";
    entries.push({
      id: `trace__${trace.id}`,
      type: "trace_span",
      timestamp: trace.startedAt?.toISOString() ?? new Date().toISOString(),
      title: `[trace] ${trace.spanType}: ${trace.spanName}`,
      detail: trace.errorMessage ?? (trace.durationMs != null ? `${trace.durationMs}ms` : null),
      severity: isFailed ? "error" : "info",
      metadata: {
        traceId: trace.traceId,
        status: trace.status,
        durationMs: trace.durationMs ?? null,
        errorCode: trace.errorCode ?? null,
      },
    });
  }

  for (const approval of approvals) {
    entries.push({
      id: `approval__${approval.id}`,
      type: "approval_event",
      timestamp: approval.requestedAt?.toISOString() ?? new Date().toISOString(),
      title: `Approval requested: ${approval.approvalType ?? "general"}`,
      detail: approval.decision
        ? `Decision: ${approval.decision} at ${approval.decidedAt?.toISOString()?.slice(0, 16) ?? "?"}`
        : "Awaiting decision",
      severity: approval.status === "REJECTED" ? "warn" : "info",
      metadata: {
        status: approval.status,
        requestedRole: approval.requestedRole ?? null,
        decidedAt: approval.decidedAt?.toISOString() ?? null,
      },
    });
  }

  for (const action of actions) {
    const isFailed = action.status === "failed";
    entries.push({
      id: `action__${action.id}`,
      type: "action_execution",
      timestamp: action.createdAt?.toISOString() ?? new Date().toISOString(),
      title: `Action executed: ${action.actionType}`,
      detail: action.errorCode ?? action.status,
      severity: isFailed ? "error" : "info",
      metadata: { status: action.status, riskLevel: action.riskLevel ?? null },
    });
  }

  for (const decision of decisions) {
    entries.push({
      id: `decision__${decision.id}`,
      type: "decision",
      timestamp: decision.createdAt?.toISOString() ?? new Date().toISOString(),
      title: `Decision: ${decision.decisionType}`,
      detail: decision.rationale ?? decision.outcome ?? null,
      severity: "info",
      metadata: { outcome: decision.outcome ?? null, confidence: decision.confidence ?? null },
    });
  }

  for (const log of auditLogs) {
    const isCronRecovery = log.action?.includes("cron.autonomous") || log.action?.includes("workflow.recovery");
    const isReplay = log.action?.includes("workflow.replay") || log.action?.includes("replay");
    entries.push({
      id: `audit__${log.id}`,
      type: isCronRecovery ? "cron_recovery" : isReplay ? "replay_attempt" : "audit_event",
      timestamp: log.createdAt?.toISOString() ?? new Date().toISOString(),
      title: log.action ?? "audit event",
      detail: typeof log.details === "object" && log.details !== null ? JSON.stringify(log.details).slice(0, 200) : null,
      severity: "info",
      metadata: {
        userId: log.userId ?? null,
        action: log.action,
        resourceType: log.resourceType ?? null,
        resourceId: log.resourceId ?? null,
      },
    });
  }

  for (const note of notes) {
    const severityMap: Record<string, TimelineEntrySeverity> = {
      LOW: "info",
      MEDIUM: "info",
      HIGH: "warn",
      CRITICAL: "error",
    };
    entries.push({
      id: `note__${note.id}`,
      type: "operator_note",
      timestamp: note.createdAt?.toISOString() ?? new Date().toISOString(),
      title: `[${note.noteType}] operator note`,
      detail: note.body,
      severity: note.severity ? (severityMap[note.severity] ?? "info") : "info",
      metadata: {
        noteId: note.id,
        noteType: note.noteType,
        status: note.status,
        severity: note.severity ?? null,
        createdByUserId: note.createdByUserId,
      },
    });
  }

  entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return { workflowRunId, entries, totalCount: entries.length };
}
