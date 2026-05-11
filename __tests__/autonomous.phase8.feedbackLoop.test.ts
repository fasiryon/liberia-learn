import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  postChangeEvaluationPlan: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  stagedRolloutPlan: { findUnique: vi.fn() },
  learningEvent: { findMany: vi.fn() },
  workflowRun: { findMany: vi.fn() },
  actionExecution: { findMany: vi.fn() },
  executionTrace: { findMany: vi.fn() },
}));
const mockLogLearningEvent = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/db/writeThrottle", () => ({ withDbWriteThrottle: (_name: string, fn: () => unknown) => fn() }));
vi.mock("@/lib/events/logLearningEvent", () => ({ logLearningEvent: mockLogLearningEvent }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));

const baseline = {
  detectorPrecision: 0.5,
  falsePositiveRate: 0.3,
  falseNegativeRate: 0.2,
  evidenceCoverage: 0.6,
  recommendationAcceptanceRate: 0.4,
  approvalRejectionRate: 0.2,
  rolloutStability: 0.8,
  workflowStability: 0.8,
  operationalEffectivenessDelta: 0.6,
};

function plan(overrides: Record<string, unknown> = {}) {
  return {
    id: "eval-1",
    changeRequestId: "cr-1",
    baselineMetrics: baseline,
    postChangeMetrics: null,
    findings: null,
    evaluationWindowDays: 1,
    status: "BASELINE_RECORDED",
    feedbackLoopStatus: "pending",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    traceId: "trace-1",
    changeRequest: { id: "cr-1", schoolId: "school-1", districtId: null, title: "Tune detector" },
    ...overrides,
  };
}

function actual(overrides: Record<string, unknown> = {}) {
  return {
    capturedAt: new Date().toISOString(),
    windowDays: 1,
    sampleSize: 12,
    detectorPrecision: 0.7,
    falsePositiveRate: 0.1,
    falseNegativeRate: 0.1,
    evidenceCoverage: 0.8,
    recommendationAcceptanceRate: 0.7,
    approvalRejectionRate: 0.1,
    rolloutStability: 0.95,
    rollbackOccurrence: 0,
    workflowStability: 0.95,
    queueHealthImpact: 1,
    workerSaturationImpact: 0,
    tenantSafetyIncidents: 0,
    operationalEffectivenessDelta: 0.8,
    sparseData: false,
    confidenceMultiplier: 1,
    lineageRefs: [{ type: "LearningEvent", id: "event-1", schoolId: "school-1" }],
    ...overrides,
  };
}

beforeEach(() => {
  process.env.ENABLE_IMPLEMENTATION_WORKFLOW = "true";
  process.env.ENABLE_AUTONOMOUS_MEMORY = "true";
  mockLogLearningEvent.mockResolvedValue({ id: "memory-event-1" });
  mockLogAudit.mockResolvedValue(undefined);
  mockPrisma.stagedRolloutPlan.findUnique.mockResolvedValue({ id: "rollout-1", rolloutVerification: { outcome: "PASSED" } });
  mockPrisma.postChangeEvaluationPlan.update.mockImplementation(({ data }: any) => Promise.resolve({ ...plan(), ...data }));
  mockPrisma.learningEvent.findMany.mockResolvedValue([]);
  mockPrisma.workflowRun.findMany.mockResolvedValue([]);
  mockPrisma.actionExecution.findMany.mockResolvedValue([]);
  mockPrisma.executionTrace.findMany.mockResolvedValue([]);
});

afterEach(() => {
  vi.resetAllMocks();
  delete process.env.ENABLE_IMPLEMENTATION_WORKFLOW;
  delete process.env.ENABLE_AUTONOMOUS_MEMORY;
});

describe("Phase 8 feedback loop closure", () => {
  it("fails closed when implementation workflow flag is disabled", async () => {
    delete process.env.ENABLE_IMPLEMENTATION_WORKFLOW;
    const { recordPostChangeMetrics } = await import("@/lib/autonomous/optimization/postChangeEvaluationService");
    await expect(recordPostChangeMetrics({ evaluationPlanId: "eval-1" })).rejects.toMatchObject({ status: 404 });
  });

  it("requires rollout verification before recording actual metrics", async () => {
    mockPrisma.postChangeEvaluationPlan.findUnique.mockResolvedValue(plan());
    mockPrisma.stagedRolloutPlan.findUnique.mockResolvedValue({ id: "rollout-1", rolloutVerification: null });
    const { recordPostChangeMetrics } = await import("@/lib/autonomous/optimization/postChangeEvaluationService");
    await expect(recordPostChangeMetrics({ evaluationPlanId: "eval-1" })).rejects.toMatchObject({ code: "rollout_verification_required" });
  });

  it("sparse data lowers implementation confidence instead of fabricating certainty", async () => {
    const { generateImplementationFindings } = await import("@/lib/autonomous/optimization/implementationOutcomeService");
    const findings = generateImplementationFindings({
      baselineMetrics: baseline,
      actualMetrics: actual({ sampleSize: 1, sparseData: true, confidenceMultiplier: 0.55 }),
    });
    expect(findings.findings).toContain("insufficient_evidence");
    expect(findings.effectiveness.confidence).toBeLessThan(0.5);
  });

  it("generates deterministic improvement findings from baseline vs actual metrics", async () => {
    const { generateImplementationFindings } = await import("@/lib/autonomous/optimization/implementationOutcomeService");
    const findings = generateImplementationFindings({ baselineMetrics: baseline, actualMetrics: actual() });
    expect(findings.findings).toContain("improvement_confirmed");
    expect(findings.advisoryOnly).toBe(true);
    expect(findings.policyMutation).toBe(false);
  });

  it("does not complete feedback loop without persisted outcome lineage", async () => {
    mockPrisma.postChangeEvaluationPlan.findUnique.mockResolvedValue(plan({ postChangeMetrics: actual({ lineageRefs: [] }) }));
    const { completeFeedbackLoop } = await import("@/lib/autonomous/optimization/feedbackLoopCompletionService");
    await expect(completeFeedbackLoop({ evaluationPlanId: "eval-1" })).rejects.toMatchObject({ code: "outcome_lineage_required" });
  });

  it("updates feedbackLoopStatus, writes lineage event, and records tenant-safe memory", async () => {
    mockPrisma.postChangeEvaluationPlan.findUnique.mockResolvedValue(plan({ postChangeMetrics: actual() }));
    const { completeFeedbackLoop } = await import("@/lib/autonomous/optimization/feedbackLoopCompletionService");
    const result = await completeFeedbackLoop({ evaluationPlanId: "eval-1", actorId: "platform-1" });
    expect(result.findings.findings).toContain("improvement_confirmed");
    expect(mockPrisma.postChangeEvaluationPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ feedbackLoopStatus: "COMPLETE", status: "CLOSED" }) })
    );
    expect(mockLogLearningEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "autonomous.implementation.feedback_loop.completed",
        metadata: expect.objectContaining({ policyMutation: false, lineageRefs: expect.any(Array) }),
      }),
      { throwOnError: true }
    );
    expect(mockLogLearningEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "autonomous.memory.recorded",
        schoolId: "school-1",
        metadata: expect.objectContaining({ sensitivity: "tenant" }),
      }),
      { throwOnError: true }
    );
  });

  it("is replay-safe and does not persist closure updates during replay", async () => {
    mockPrisma.postChangeEvaluationPlan.findUnique.mockResolvedValue(plan({ postChangeMetrics: actual() }));
    const { completeFeedbackLoop } = await import("@/lib/autonomous/optimization/feedbackLoopCompletionService");
    const result = await completeFeedbackLoop({ evaluationPlanId: "eval-1", isReplay: true });
    expect(result.replay).toBe(true);
    expect(mockPrisma.postChangeEvaluationPlan.update).not.toHaveBeenCalled();
    expect(mockLogLearningEvent).not.toHaveBeenCalled();
  });

  it("keeps MOE visibility aggregate-safe for national memory", async () => {
    mockPrisma.postChangeEvaluationPlan.findUnique.mockResolvedValue(
      plan({ postChangeMetrics: actual({ lineageRefs: [{ type: "LearningEvent", id: "agg-1", scope: "aggregate" }] }), changeRequest: { id: "cr-1", schoolId: null, districtId: null, title: "National rollout" } })
    );
    const { completeFeedbackLoop } = await import("@/lib/autonomous/optimization/feedbackLoopCompletionService");
    await completeFeedbackLoop({ evaluationPlanId: "eval-1" });
    expect(mockLogLearningEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "autonomous.memory.recorded",
        schoolId: null,
        metadata: expect.objectContaining({ sensitivity: "aggregate" }),
      }),
      { throwOnError: true }
    );
  });
});
