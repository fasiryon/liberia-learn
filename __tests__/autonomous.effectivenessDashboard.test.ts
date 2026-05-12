import { afterEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  workflowRun: { findMany: vi.fn() },
  agentDecision: { findMany: vi.fn() },
  learningEvent: { findMany: vi.fn() },
  approvalRequest: { findMany: vi.fn() },
  actionExecution: { findMany: vi.fn() },
  optimizationChangeRequest: { findMany: vi.fn() },
  postChangeEvaluationPlan: { findMany: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

const range = {
  from: new Date("2026-04-01T00:00:00.000Z"),
  to: new Date("2026-04-30T23:59:59.999Z"),
};

function workflow(id: string, status: string, schoolId = "school-1") {
  return { id, status, schoolId, workflowType: "detector.student-risk", createdAt: new Date("2026-04-10T00:00:00.000Z") };
}

function resetDefaultMocks() {
  mockPrisma.workflowRun.findMany.mockResolvedValue([]);
  mockPrisma.agentDecision.findMany.mockResolvedValue([]);
  mockPrisma.learningEvent.findMany.mockResolvedValue([]);
  mockPrisma.approvalRequest.findMany.mockResolvedValue([]);
  mockPrisma.actionExecution.findMany.mockResolvedValue([]);
  mockPrisma.optimizationChangeRequest.findMany.mockResolvedValue([]);
  mockPrisma.postChangeEvaluationPlan.findMany.mockResolvedValue([]);
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("Autonomous OS effectiveness dashboard service", () => {
  it("derives executive metrics from persisted rows without fake defaults", async () => {
    resetDefaultMocks();
    mockPrisma.workflowRun.findMany.mockResolvedValueOnce([
      workflow("wf-1", "completed"),
      workflow("wf-2", "failed"),
      workflow("wf-3", "completed"),
    ]);
    mockPrisma.agentDecision.findMany.mockResolvedValueOnce([
      { id: "rec-1", workflowRunId: "wf-1", decisionType: "detector.recommendation.student-risk", confidence: 0.8 },
      { id: "rec-2", workflowRunId: "wf-2", decisionType: "detector.recommendation.student-risk", confidence: 0.6 },
    ]);
    mockPrisma.learningEvent.findMany
      .mockResolvedValueOnce([
        { id: "eval-1", eventType: "autonomous.evaluation.recorded", status: "accepted", metadata: { outcome: "accepted" } },
        { id: "eval-2", eventType: "autonomous.evaluation.recorded", status: "false_positive", metadata: { outcome: "false_positive" } },
      ])
      .mockResolvedValueOnce([{ id: "memory-1", eventType: "autonomous.memory.recorded" }])
      .mockResolvedValueOnce([{ id: "proposal-1", eventType: "autonomous.optimization.proposed", metadata: { reviewStatus: "PENDING_REVIEW" } }])
      .mockResolvedValueOnce([{ id: "review-1", eventType: "autonomous.optimization.reviewed", metadata: { proposalEventId: "proposal-1", reviewStatus: "APPROVED" } }]);
    mockPrisma.approvalRequest.findMany.mockResolvedValueOnce([
      { id: "approval-1", status: "APPROVED", decidedAt: new Date("2026-04-11T00:00:00.000Z") },
      { id: "approval-2", status: "PENDING", decidedAt: null },
    ]);
    mockPrisma.actionExecution.findMany.mockResolvedValueOnce([
      { id: "action-1", status: "EXECUTED", rollbackStatus: null },
      { id: "action-2", status: "FAILED", rollbackStatus: "COMPLETED" },
    ]);
    mockPrisma.optimizationChangeRequest.findMany.mockResolvedValueOnce([
      { id: "cr-1", title: "Tune detector", implementationOutcome: "POSITIVE" },
      { id: "cr-2", title: "Tune approvals", implementationOutcome: "MIXED" },
    ]);
    mockPrisma.postChangeEvaluationPlan.findMany.mockResolvedValueOnce([
      {
        id: "eval-plan-1",
        changeRequestId: "cr-1",
        status: "CLOSED",
        feedbackLoopStatus: "COMPLETE",
        overallOutcome: "POSITIVE",
        confidenceScore: 0.7,
        baselineMetrics: { detectorPrecision: 0.4, falsePositiveRate: 0.4, recommendationAcceptanceRate: 0.3 },
        postChangeMetrics: { detectorPrecision: 0.7, falsePositiveRate: 0.1, recommendationAcceptanceRate: 0.6, sparseData: false },
        changeRequest: { id: "cr-1", title: "Tune detector", schoolId: "school-1" },
      },
    ]);

    const { getAutonomousEffectivenessDashboard } = await import("@/lib/autonomous/optimization/effectivenessDashboardService");
    const dashboard = await getAutonomousEffectivenessDashboard({ scope: { schoolId: "school-1" }, range });

    expect(dashboard.metrics.totalWorkflows).toBe(3);
    expect(dashboard.metrics.workflowSuccessRate.value).toBe(0.667);
    expect(dashboard.metrics.detectorRecommendationVolume).toBe(2);
    expect(dashboard.metrics.recommendationAcceptanceRate.value).toBe(0.5);
    expect(dashboard.metrics.falsePositiveRate.value).toBe(0.5);
    expect(dashboard.metrics.approvalThroughput).toBe(1);
    expect(dashboard.metrics.actionExecutionSuccessRate.value).toBe(0.5);
    expect(dashboard.metrics.rollbackRate.value).toBe(0.5);
    expect(dashboard.metrics.evaluationClosureRate.value).toBe(1);
    expect(dashboard.metrics.averageConfidenceScore).toBe(0.7);
    expect(dashboard.metrics.implementationOutcomes).toEqual({ positive: 1, negative: 0, mixed: 1 });
    expect(dashboard.metrics.memoryUpdatesCreated).toBe(1);
    expect(dashboard.metrics.optimizationProposalsCreated).toBe(1);
    expect(dashboard.metrics.approvedOptimizationProposals).toBe(1);
    expect(dashboard.recent.postChangeTrends[0].deltas.detectorPrecision).toBe(0.3);
  });

  it("scopes detector recommendations through tenant-visible workflow IDs", async () => {
    resetDefaultMocks();
    mockPrisma.workflowRun.findMany.mockResolvedValueOnce([workflow("wf-school-1", "completed", "school-1")]);

    const { getAutonomousEffectivenessDashboard } = await import("@/lib/autonomous/optimization/effectivenessDashboardService");
    await getAutonomousEffectivenessDashboard({ scope: { schoolId: "school-1" }, range });

    expect(mockPrisma.workflowRun.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ schoolId: "school-1" }),
    }));
    expect(mockPrisma.agentDecision.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ workflowRunId: { in: ["wf-school-1"] } }),
    }));
  });

  it("uses aggregate-only schoolId null filters for MOE-safe national rows", async () => {
    resetDefaultMocks();
    mockPrisma.workflowRun.findMany.mockResolvedValueOnce([workflow("wf-aggregate", "completed", null as any)]);

    const { getAutonomousEffectivenessDashboard } = await import("@/lib/autonomous/optimization/effectivenessDashboardService");
    await getAutonomousEffectivenessDashboard({ scope: { aggregateOnly: true }, range });

    expect(mockPrisma.workflowRun.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ schoolId: null }),
    }));
    expect(mockPrisma.learningEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ schoolId: null, eventType: "autonomous.evaluation.recorded" }),
    }));
    expect(mockPrisma.postChangeEvaluationPlan.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ changeRequest: expect.objectContaining({ schoolId: null }) }),
    }));
  });

  it("returns null rates and sparse warnings when persisted evidence is absent", async () => {
    resetDefaultMocks();

    const { getAutonomousEffectivenessDashboard } = await import("@/lib/autonomous/optimization/effectivenessDashboardService");
    const dashboard = await getAutonomousEffectivenessDashboard({ scope: {}, range });

    expect(dashboard.metrics.workflowSuccessRate.value).toBeNull();
    expect(dashboard.metrics.recommendationAcceptanceRate.value).toBeNull();
    expect(dashboard.metrics.averageConfidenceScore).toBeNull();
    expect(dashboard.warnings.length).toBeGreaterThan(0);
  });
});
