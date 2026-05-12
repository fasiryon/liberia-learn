import { prisma } from "@/lib/db";

export type EffectivenessDashboardScope = {
  schoolId?: string | null;
  aggregateOnly?: boolean;
};

export type EffectivenessDateRange = {
  from: Date;
  to: Date;
};

type MetricValue = {
  value: number | null;
  numerator?: number;
  denominator?: number;
};

function ratio(numerator: number, denominator: number): MetricValue {
  return {
    value: denominator > 0 ? Number((numerator / denominator).toFixed(3)) : null,
    numerator,
    denominator,
  };
}

function average(values: Array<number | null | undefined>): number | null {
  const numeric = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (numeric.length === 0) return null;
  return Number((numeric.reduce((sum, value) => sum + value, 0) / numeric.length).toFixed(3));
}

function dateWhere(range: EffectivenessDateRange, field = "createdAt") {
  return { [field]: { gte: range.from, lte: range.to } };
}

function scopeWhere(scope: EffectivenessDashboardScope) {
  if (scope.aggregateOnly) return { schoolId: null };
  if (scope.schoolId) return { schoolId: scope.schoolId };
  return {};
}

function isSuccessStatus(status: unknown) {
  return ["completed", "complete", "succeeded", "success", "executed", "approved"].includes(String(status ?? "").toLowerCase());
}

function isFailureStatus(status: unknown) {
  return ["failed", "failure", "cancelled", "canceled", "dead_lettered", "rejected"].includes(String(status ?? "").toLowerCase());
}

function isRollbackComplete(status: unknown) {
  return ["completed", "complete", "rolled_back", "rollback_completed"].includes(String(status ?? "").toLowerCase());
}

function outcomeFromEvent(event: any) {
  return String(event?.metadata?.outcome ?? event?.status ?? "").toLowerCase();
}

function metricDelta(postChangeMetrics: any, baselineMetrics: any, key: string) {
  const after = Number(postChangeMetrics?.[key]);
  const before = Number(baselineMetrics?.[key]);
  if (!Number.isFinite(after) || !Number.isFinite(before)) return null;
  return Number((after - before).toFixed(3));
}

function latestApprovedProposalIds(proposals: any[], reviews: any[]) {
  const latestReviewByProposal = new Map<string, any>();
  for (const review of reviews) {
    const proposalId = review?.metadata?.proposalEventId;
    if (proposalId && !latestReviewByProposal.has(proposalId)) latestReviewByProposal.set(proposalId, review);
  }
  return proposals
    .filter((proposal) => (latestReviewByProposal.get(proposal.id)?.metadata?.reviewStatus ?? proposal?.metadata?.reviewStatus) === "APPROVED")
    .map((proposal) => proposal.id);
}

export function parseEffectivenessDateRange(input: { from?: string | null; to?: string | null } = {}, now = new Date()): EffectivenessDateRange {
  const defaultFrom = new Date(now);
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 30);
  const parsedFrom = input.from ? new Date(`${input.from}T00:00:00.000Z`) : defaultFrom;
  const parsedTo = input.to ? new Date(`${input.to}T23:59:59.999Z`) : now;
  const from = Number.isNaN(parsedFrom.getTime()) ? defaultFrom : parsedFrom;
  const to = Number.isNaN(parsedTo.getTime()) ? now : parsedTo;
  return from <= to ? { from, to } : { from: to, to: from };
}

export async function getAutonomousEffectivenessDashboard(input: {
  scope?: EffectivenessDashboardScope;
  range: EffectivenessDateRange;
}) {
  const scope = input.scope ?? {};
  const baseScope = scopeWhere(scope);

  const workflows = await (prisma as any).workflowRun.findMany({
    where: { ...baseScope, ...dateWhere(input.range) },
    orderBy: { createdAt: "desc" },
    take: 1000,
    select: { id: true, workflowType: true, status: true, schoolId: true, createdAt: true },
  });

  const workflowIds = workflows.map((workflow: any) => workflow.id);
  const decisionWhere: any = {
    decisionType: { startsWith: "detector.recommendation." },
    ...dateWhere(input.range),
  };
  if (workflowIds.length > 0) decisionWhere.workflowRunId = { in: workflowIds };
  else if (scope.schoolId || scope.aggregateOnly) decisionWhere.workflowRunId = { in: [] };

  const [
    recommendations,
    evaluations,
    approvals,
    actions,
    memoryEvents,
    optimizationProposals,
    optimizationReviews,
    changeRequests,
    postChangePlans,
  ] = await Promise.all([
    (prisma as any).agentDecision.findMany({
      where: decisionWhere,
      orderBy: { createdAt: "desc" },
      take: 1000,
      select: { id: true, workflowRunId: true, decisionType: true, status: true, riskLevel: true, confidence: true, createdAt: true },
    }),
    (prisma as any).learningEvent.findMany({
      where: { ...baseScope, eventType: "autonomous.evaluation.recorded", ...dateWhere(input.range, "occurredAt") },
      orderBy: { occurredAt: "desc" },
      take: 1000,
    }),
    (prisma as any).approvalRequest.findMany({
      where: { ...baseScope, ...dateWhere(input.range, "requestedAt") },
      orderBy: { requestedAt: "desc" },
      take: 1000,
      select: { id: true, workflowRunId: true, actionExecutionId: true, status: true, riskLevel: true, schoolId: true, requestedAt: true, decidedAt: true },
    }),
    (prisma as any).actionExecution.findMany({
      where: { ...baseScope, ...dateWhere(input.range) },
      orderBy: { createdAt: "desc" },
      take: 1000,
      select: { id: true, workflowRunId: true, status: true, actionType: true, rollbackStatus: true, schoolId: true, createdAt: true, completedAt: true },
    }),
    (prisma as any).learningEvent.findMany({
      where: { ...baseScope, eventType: "autonomous.memory.recorded", ...dateWhere(input.range, "occurredAt") },
      orderBy: { occurredAt: "desc" },
      take: 100,
    }),
    (prisma as any).learningEvent.findMany({
      where: { ...baseScope, eventType: "autonomous.optimization.proposed", ...dateWhere(input.range, "occurredAt") },
      orderBy: { occurredAt: "desc" },
      take: 1000,
    }),
    (prisma as any).learningEvent.findMany({
      where: { ...baseScope, eventType: "autonomous.optimization.reviewed", ...dateWhere(input.range, "occurredAt") },
      orderBy: { occurredAt: "desc" },
      take: 1000,
    }),
    (prisma as any).optimizationChangeRequest.findMany({
      where: { ...baseScope, ...dateWhere(input.range) },
      orderBy: { createdAt: "desc" },
      take: 1000,
      select: { id: true, title: true, status: true, implementationOutcome: true, proposalEventId: true, schoolId: true, createdAt: true },
    }),
    (prisma as any).postChangeEvaluationPlan.findMany({
      where: {
        ...dateWhere(input.range),
        ...(scope.schoolId || scope.aggregateOnly ? { changeRequest: baseScope } : {}),
      },
      include: { changeRequest: { select: { id: true, title: true, schoolId: true } } },
      orderBy: { updatedAt: "desc" },
      take: 1000,
    }),
  ]);

  const completedWorkflows = workflows.filter((workflow: any) => isSuccessStatus(workflow.status)).length;
  const failedWorkflows = workflows.filter((workflow: any) => isFailureStatus(workflow.status)).length;
  const executedActions = actions.filter((action: any) => isSuccessStatus(action.status)).length;
  const failedActions = actions.filter((action: any) => isFailureStatus(action.status)).length;
  const rollbackCount = actions.filter((action: any) => isRollbackComplete(action.rollbackStatus)).length;
  const acceptedEvaluations = evaluations.filter((event: any) => ["accepted", "executed", "improved"].includes(outcomeFromEvent(event))).length;
  const falsePositiveEvaluations = evaluations.filter((event: any) => outcomeFromEvent(event) === "false_positive").length;
  const closedEvaluations = postChangePlans.filter((plan: any) => String(plan.feedbackLoopStatus).toUpperCase() === "COMPLETE" || String(plan.status).toUpperCase() === "CLOSED").length;
  const decidedApprovals = approvals.filter((approval: any) => approval.decidedAt || ["APPROVED", "REJECTED", "CANCELLED", "CANCELED", "EXPIRED"].includes(String(approval.status).toUpperCase())).length;
  const approvedProposalIds = latestApprovedProposalIds(optimizationProposals, optimizationReviews);

  const outcomes = {
    positive: changeRequests.filter((request: any) => request.implementationOutcome === "POSITIVE").length,
    negative: changeRequests.filter((request: any) => request.implementationOutcome === "NEGATIVE").length,
    mixed: changeRequests.filter((request: any) => request.implementationOutcome === "MIXED").length,
  };

  const trendRows = postChangePlans.slice(0, 10).map((plan: any) => ({
    id: plan.id,
    changeRequestId: plan.changeRequestId,
    title: plan.changeRequest?.title ?? plan.changeRequestId,
    status: plan.status,
    feedbackLoopStatus: plan.feedbackLoopStatus,
    overallOutcome: plan.overallOutcome,
    confidenceScore: plan.confidenceScore,
    sparseData: plan.postChangeMetrics?.sparseData === true,
    deltas: {
      detectorPrecision: metricDelta(plan.postChangeMetrics, plan.baselineMetrics, "detectorPrecision"),
      falsePositiveRate: metricDelta(plan.postChangeMetrics, plan.baselineMetrics, "falsePositiveRate"),
      recommendationAcceptanceRate: metricDelta(plan.postChangeMetrics, plan.baselineMetrics, "recommendationAcceptanceRate"),
      workflowStability: metricDelta(plan.postChangeMetrics, plan.baselineMetrics, "workflowStability"),
      operationalEffectivenessDelta: metricDelta(plan.postChangeMetrics, plan.baselineMetrics, "operationalEffectivenessDelta"),
    },
  }));

  const warnings: string[] = [];
  if (workflows.length < 5) warnings.push("Workflow sample is below 5 runs; workflow rates are directional only.");
  if (recommendations.length < 5) warnings.push("Detector recommendation sample is below 5; acceptance and confidence should not be treated as stable.");
  if (evaluations.length < 5) warnings.push("Evaluation sample is below 5; false-positive and acceptance rates are sparse.");
  if (approvals.length < 5) warnings.push("Approval sample is below 5; throughput is sparse.");
  if (actions.length < 5) warnings.push("Action execution sample is below 5; execution and rollback rates are sparse.");
  if (closedEvaluations < 3) warnings.push("Fewer than 3 post-change evaluations have closed in this window.");
  if (postChangePlans.some((plan: any) => plan.postChangeMetrics?.sparseData === true)) warnings.push("At least one post-change evaluation marked its persisted evidence as sparse.");

  return {
    range: input.range,
    scope: {
      schoolId: scope.schoolId ?? null,
      aggregateOnly: scope.aggregateOnly === true,
    },
    metrics: {
      totalWorkflows: workflows.length,
      workflowSuccessRate: ratio(completedWorkflows, completedWorkflows + failedWorkflows),
      workflowFailureRate: ratio(failedWorkflows, completedWorkflows + failedWorkflows),
      detectorRecommendationVolume: recommendations.length,
      recommendationAcceptanceRate: ratio(acceptedEvaluations, evaluations.length),
      falsePositiveRate: ratio(falsePositiveEvaluations, evaluations.length),
      approvalThroughput: decidedApprovals,
      approvalDecisionRate: ratio(decidedApprovals, approvals.length),
      actionExecutionSuccessRate: ratio(executedActions, executedActions + failedActions),
      rollbackRate: ratio(rollbackCount, actions.length),
      evaluationClosureRate: ratio(closedEvaluations, postChangePlans.length),
      averageConfidenceScore: average(recommendations.map((recommendation: any) => recommendation.confidence)),
      implementationOutcomes: outcomes,
      memoryUpdatesCreated: memoryEvents.length,
      optimizationProposalsCreated: optimizationProposals.length,
      approvedOptimizationProposals: approvedProposalIds.length,
    },
    links: {
      workflows: "/admin/ops/workflows",
      recommendations: "/admin/ops/recommendations",
      approvals: "/admin/ops/approvals",
      evaluations: "/admin/ops/evaluations",
      outcomes: "/admin/ops/optimization/outcomes",
      memory: "/admin/ops/memory",
      optimization: "/admin/ops/optimization",
      changeRequests: "/admin/ops/optimization/change-requests",
    },
    counts: {
      completedWorkflows,
      failedWorkflows,
      evaluations: evaluations.length,
      acceptedEvaluations,
      falsePositiveEvaluations,
      approvals: approvals.length,
      decidedApprovals,
      actions: actions.length,
      executedActions,
      failedActions,
      rollbackCount,
      postChangePlans: postChangePlans.length,
      closedEvaluations,
    },
    recent: {
      workflows: workflows.slice(0, 8),
      recommendations: recommendations.slice(0, 8),
      approvals: approvals.slice(0, 8),
      changeRequests: changeRequests.slice(0, 8),
      postChangeTrends: trendRows,
    },
    warnings,
  };
}
