import { afterEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  learningEvent: { findMany: vi.fn(), findUnique: vi.fn() },
  approvalRequest: { findMany: vi.fn() },
  actionExecution: { findMany: vi.fn(), count: vi.fn() },
  workflowRun: { findMany: vi.fn() },
  executionTrace: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
}));
const mockLogLearningEvent = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/db/writeThrottle", () => ({ withDbWriteThrottle: (_name: string, fn: () => unknown) => fn() }));
vi.mock("@/lib/events/logLearningEvent", () => ({ logLearningEvent: mockLogLearningEvent }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/queue", () => ({ isQueueConfigured: () => true }));

const adminUser = { id: "admin-1", role: "ADMIN", schoolId: "school-1", isPlatformAdmin: false } as any;
const platformUser = { id: "platform-1", role: "PLATFORM_ADMIN", schoolId: null, isPlatformAdmin: true } as any;
const moeUser = { id: "moe-1", role: "MOE_OFFICIAL", schoolId: null, isPlatformAdmin: false } as any;

function evaluationEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "eval-1",
    eventType: "autonomous.evaluation.recorded",
    schoolId: "school-1",
    status: "false_positive",
    occurredAt: new Date(),
    metadata: {
      detectorId: "student-risk",
      outcome: "false_positive",
      evidenceCoverageScore: 0.45,
      effectivenessScore: 0.2,
    },
    ...overrides,
  };
}

function proposalEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "proposal-1",
    eventType: "autonomous.optimization.proposed",
    schoolId: "school-1",
    districtId: null,
    workflowTraceId: "optimization_trace",
    occurredAt: new Date(),
    metadata: {
      category: "detector_threshold",
      title: "Review detector threshold before next rollout stage",
      confidence: 0.6,
      riskLevel: "medium",
      targetScope: "school",
      approvalRequirement: "Optimization review approval required",
      expectedImpact: "Reduce unnecessary recommendations.",
      rollbackGuidance: "Restore prior config.",
      evidenceRefs: { metrics: { precision: 0.4 } },
      lineage: { source: "detectorTuningService" },
      proposedChange: { recommendationOnly: true, suggestedDirection: "raise_threshold" },
      reviewStatus: "PENDING_REVIEW",
      applied: false,
    },
    ...overrides,
  };
}

function mockOptimizationInputs() {
  mockPrisma.learningEvent.findMany
    .mockResolvedValueOnce([evaluationEvent()])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([evaluationEvent()])
    .mockResolvedValueOnce([]);
  mockPrisma.approvalRequest.findMany.mockResolvedValue([]);
  mockPrisma.actionExecution.findMany.mockResolvedValue([]);
  mockPrisma.workflowRun.findMany.mockResolvedValue([]);
  mockPrisma.actionExecution.count.mockResolvedValue(0);
  mockPrisma.executionTrace.create.mockResolvedValue({ id: "trace-row", startedAt: new Date() });
  mockPrisma.executionTrace.findUnique.mockResolvedValue({ id: "trace-row", startedAt: new Date() });
  mockPrisma.executionTrace.update.mockResolvedValue({});
  mockLogLearningEvent.mockResolvedValue({ id: "proposal-created" });
}

afterEach(() => {
  vi.resetAllMocks();
  delete process.env.ENABLE_AUTONOMOUS_OPTIMIZATION;
});

describe("governance-safe optimization", () => {
  it("fails closed when optimization is disabled", async () => {
    const { generateOptimizationRecommendations } = await import("@/lib/autonomous/optimization/optimizationEngine");
    await expect(generateOptimizationRecommendations()).rejects.toMatchObject({ code: "autonomous_optimization_disabled" });
  });

  it("generates review-required optimization recommendations without policy mutation", async () => {
    process.env.ENABLE_AUTONOMOUS_OPTIMIZATION = "true";
    mockOptimizationInputs();
    const { generateOptimizationRecommendations } = await import("@/lib/autonomous/optimization/optimizationEngine");
    const result = await generateOptimizationRecommendations({ schoolId: "school-1", actorId: "admin-1" });
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations[0].proposedChange).toMatchObject({ recommendationOnly: true });
    expect(result.recommendations[0].approvalRequirement).toContain("review");
    expect(mockLogLearningEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "autonomous.optimization.proposed",
        status: "PENDING_REVIEW",
        metadata: expect.objectContaining({ applied: false, reviewStatus: "PENDING_REVIEW" }),
      }),
      { throwOnError: true }
    );
  });

  it("keeps replay generation side-effect free", async () => {
    process.env.ENABLE_AUTONOMOUS_OPTIMIZATION = "true";
    mockOptimizationInputs();
    const { generateOptimizationRecommendations } = await import("@/lib/autonomous/optimization/optimizationEngine");
    const result = await generateOptimizationRecommendations({ schoolId: "school-1", isReplay: true });
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.persisted).toHaveLength(0);
    expect(mockLogLearningEvent).not.toHaveBeenCalled();
  });

  it("records human review as an append-only event and does not apply tuning", async () => {
    process.env.ENABLE_AUTONOMOUS_OPTIMIZATION = "true";
    mockPrisma.learningEvent.findUnique.mockResolvedValueOnce(proposalEvent());
    mockLogLearningEvent.mockResolvedValueOnce({ id: "review-1" });
    const { reviewOptimizationRecommendation } = await import("@/lib/autonomous/optimization/optimizationReviewService");
    await reviewOptimizationRecommendation({ proposalEventId: "proposal-1", reviewer: adminUser, status: "APPROVED", comment: "Looks reasonable" });
    expect(mockLogLearningEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "autonomous.optimization.reviewed",
        status: "APPROVED",
        metadata: expect.objectContaining({ applied: false, policySafety: "review_event_only_no_policy_mutation" }),
      }),
      { throwOnError: true }
    );
  });

  it("enforces tenant-safe optimization retrieval", async () => {
    process.env.ENABLE_AUTONOMOUS_OPTIMIZATION = "true";
    mockPrisma.learningEvent.findMany
      .mockResolvedValueOnce([proposalEvent(), proposalEvent({ id: "proposal-2", schoolId: "school-2" })])
      .mockResolvedValueOnce([]);
    const { listOptimizationRecommendations } = await import("@/lib/autonomous/optimization/optimizationReviewService");
    const visible = await listOptimizationRecommendations({ requester: adminUser });
    expect(visible).toHaveLength(1);
    expect(visible[0].id).toBe("proposal-1");
  });

  it("allows MOE retrieval only for aggregate optimization recommendations", async () => {
    process.env.ENABLE_AUTONOMOUS_OPTIMIZATION = "true";
    mockPrisma.learningEvent.findMany
      .mockResolvedValueOnce([proposalEvent({ id: "national-proposal", schoolId: null, metadata: { ...proposalEvent().metadata, targetScope: "national" } })])
      .mockResolvedValueOnce([]);
    const { listOptimizationRecommendations } = await import("@/lib/autonomous/optimization/optimizationReviewService");
    const visible = await listOptimizationRecommendations({ requester: moeUser, aggregateOnly: true });
    expect(visible).toHaveLength(1);
    expect(visible[0].schoolId).toBeNull();
  });

  it("produces governance-safe autonomy readiness scores", async () => {
    mockPrisma.learningEvent.findMany.mockResolvedValue([]);
    mockPrisma.approvalRequest.findMany.mockResolvedValue([]);
    mockPrisma.actionExecution.findMany.mockResolvedValue([]);
    mockPrisma.workflowRun.findMany.mockResolvedValue([]);
    mockPrisma.actionExecution.count.mockResolvedValue(0);
    const { scoreAutonomyReadiness } = await import("@/lib/autonomous/optimization/rolloutCalibrationService");
    const score = await scoreAutonomyReadiness({ schoolId: "school-1" });
    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.score).toBeLessThanOrEqual(1);
    expect(score.rationale.join(" ")).toContain("advisory only");
  });

  it("requires platform approval for aggregate optimization reviews", async () => {
    process.env.ENABLE_AUTONOMOUS_OPTIMIZATION = "true";
    mockPrisma.learningEvent.findUnique.mockResolvedValueOnce(proposalEvent({ schoolId: null, metadata: { ...proposalEvent().metadata, targetScope: "national" } }));
    const { reviewOptimizationRecommendation } = await import("@/lib/autonomous/optimization/optimizationReviewService");
    await expect(
      reviewOptimizationRecommendation({ proposalEventId: "proposal-1", reviewer: moeUser, status: "APPROVED" })
    ).rejects.toMatchObject({ status: 403 });
    mockPrisma.learningEvent.findUnique.mockResolvedValueOnce(proposalEvent({ schoolId: null, metadata: { ...proposalEvent().metadata, targetScope: "national" } }));
    await expect(reviewOptimizationRecommendation({ proposalEventId: "proposal-1", reviewer: platformUser, status: "APPROVED" })).resolves.not.toThrow();
    expect(mockLogLearningEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "autonomous.optimization.reviewed" }), { throwOnError: true });
  });
});
