import { prisma } from "@/lib/db";
import { getRecommendationPrecisionAnalytics } from "@/lib/autonomous/evaluation/recommendationOutcomeTracker";
import { getOperationalEffectivenessMetrics } from "@/lib/autonomous/optimization/operationalEffectivenessService";

export type PostChangeMetricSet = {
  capturedAt: string;
  windowDays: number;
  sampleSize: number;
  detectorPrecision: number | null;
  falsePositiveRate: number | null;
  falseNegativeRate: number | null;
  evidenceCoverage: number | null;
  recommendationAcceptanceRate: number | null;
  approvalRejectionRate: number | null;
  rolloutStability: number | null;
  rollbackOccurrence: number;
  workflowStability: number | null;
  queueHealthImpact: number | null;
  workerSaturationImpact: number | null;
  tenantSafetyIncidents: number;
  operationalEffectivenessDelta: number | null;
  sparseData: boolean;
  confidenceMultiplier: number;
  lineageRefs: Array<{ type: string; id: string; schoolId?: string | null; scope?: string }>;
};

function ratio(count: number, total: number): number | null {
  return total > 0 ? Number((count / total).toFixed(2)) : null;
}

function average(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (valid.length === 0) return null;
  return Number((valid.reduce((sum, value) => sum + value, 0) / valid.length).toFixed(2));
}

function windowStart(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export async function aggregatePostChangeOutcomes(input: {
  schoolId?: string | null;
  districtId?: string | null;
  evaluationWindowDays?: number | null;
}): Promise<PostChangeMetricSet> {
  const windowDays = input.evaluationWindowDays ?? 14;
  const occurredAt = { gte: windowStart(windowDays) };
  const scoped: any = {};
  if (input.schoolId) scoped.schoolId = input.schoolId;
  if (input.districtId) scoped.districtId = input.districtId;

  const [precision, effectiveness, evaluationEvents, workflows, actions, traces, safetyEvents] = await Promise.all([
    getRecommendationPrecisionAnalytics({ schoolId: input.schoolId }),
    getOperationalEffectivenessMetrics({ schoolId: input.schoolId }),
    (prisma as any).learningEvent.findMany({
      where: { eventType: "autonomous.evaluation.recorded", occurredAt, ...scoped },
      orderBy: { occurredAt: "desc" },
      take: 500,
    }),
    (prisma as any).workflowRun.findMany({
      where: { createdAt: occurredAt, ...scoped },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    (prisma as any).actionExecution.findMany({
      where: { createdAt: occurredAt, ...scoped },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    (prisma as any).executionTrace.findMany({
      where: { startedAt: occurredAt, ...scoped },
      orderBy: { startedAt: "desc" },
      take: 500,
    }),
    (prisma as any).learningEvent.findMany({
      where: {
        occurredAt,
        ...scoped,
        eventType: { in: ["autonomous.tenant_safety.incident", "autonomous.security.tenant_isolation_violation"] },
      },
      take: 100,
    }),
  ]);

  const falseNegatives = evaluationEvents.filter((event: any) => (event.metadata?.outcome ?? event.status) === "false_negative").length;
  const accepted = evaluationEvents.filter((event: any) => ["accepted", "executed", "improved"].includes(event.metadata?.outcome ?? event.status)).length;
  const evidenceCoverage = average(evaluationEvents.map((event: any) => event.metadata?.evidenceCoverageScore));
  const rejectedApprovals = actions.filter((action: any) => action.status === "REJECTED" || action.approvalStatus === "REJECTED").length;
  const completedWorkflows = workflows.filter((workflow: any) => ["completed", "succeeded"].includes(String(workflow.status).toLowerCase())).length;
  const failedWorkflows = workflows.filter((workflow: any) => ["failed", "cancelled"].includes(String(workflow.status).toLowerCase())).length;
  const rollbackOccurrence = actions.filter((action: any) => ["COMPLETED", "completed", "REQUIRED"].includes(String(action.rollbackStatus))).length;
  const failedTraces = traces.filter((trace: any) => String(trace.status).toLowerCase() === "failed").length;
  const queueTraceCount = traces.filter((trace: any) => String(trace.spanType ?? "").toLowerCase().includes("queue")).length;
  const workerTraceCount = traces.filter((trace: any) => String(trace.spanType ?? "").toLowerCase().includes("worker")).length;
  const sampleSize = evaluationEvents.length + workflows.length + actions.length + traces.length;
  const sparseData = sampleSize < 10 || evaluationEvents.length < 3;

  const approvalRate = effectiveness.approvalSLA?.total
    ? effectiveness.approvalSLA.buckets.approved / effectiveness.approvalSLA.total
    : null;

  return {
    capturedAt: new Date().toISOString(),
    windowDays,
    sampleSize,
    detectorPrecision: precision.total > 0 ? precision.precision : null,
    falsePositiveRate: precision.total > 0 ? precision.falsePositiveRate : null,
    falseNegativeRate: ratio(falseNegatives, evaluationEvents.length),
    evidenceCoverage,
    recommendationAcceptanceRate: ratio(accepted, evaluationEvents.length),
    approvalRejectionRate: ratio(rejectedApprovals, actions.length),
    rolloutStability: ratio(completedWorkflows, completedWorkflows + failedWorkflows),
    rollbackOccurrence,
    workflowStability: effectiveness.workflowStability,
    queueHealthImpact: queueTraceCount > 0 ? Number((1 - failedTraces / Math.max(1, queueTraceCount)).toFixed(2)) : null,
    workerSaturationImpact: workerTraceCount > 0 ? Number((failedTraces / Math.max(1, workerTraceCount)).toFixed(2)) : null,
    tenantSafetyIncidents: safetyEvents.length,
    operationalEffectivenessDelta: average([
      effectiveness.executionSuccessRate,
      effectiveness.workflowStability,
      approvalRate,
    ]),
    sparseData,
    confidenceMultiplier: sparseData ? 0.55 : 1,
    lineageRefs: [
      ...evaluationEvents.slice(0, 20).map((event: any) => ({ type: "LearningEvent", id: event.id, schoolId: event.schoolId })),
      ...workflows.slice(0, 10).map((workflow: any) => ({ type: "WorkflowRun", id: workflow.id, schoolId: workflow.schoolId })),
      ...actions.slice(0, 10).map((action: any) => ({ type: "ActionExecution", id: action.id, schoolId: action.schoolId })),
    ],
  };
}
