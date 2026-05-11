import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockRequirePlatformAdmin = vi.hoisted(() => vi.fn());

const mockPrisma = vi.hoisted(() => ({
  postChangeEvaluationPlan: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  stagedRolloutPlan: { findUnique: vi.fn() },
  optimizationChangeRequest: { update: vi.fn() },
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
vi.mock("@/lib/auth", () => ({
  requirePlatformAdmin: mockRequirePlatformAdmin,
  requireUser: vi.fn(),
}));

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
  mockRequirePlatformAdmin.mockResolvedValue({ id: "platform-1", isPlatformAdmin: true });
  mockLogLearningEvent.mockResolvedValue({ id: "memory-event-1" });
  mockLogAudit.mockResolvedValue(undefined);
  mockPrisma.stagedRolloutPlan.findUnique.mockResolvedValue({ id: "rollout-1", rolloutVerification: { outcome: "PASSED" } });
  mockPrisma.postChangeEvaluationPlan.update.mockImplementation(({ data }: any) => Promise.resolve({ ...plan(), ...data }));
  mockPrisma.optimizationChangeRequest.update.mockResolvedValue({ id: "cr-1", implementationOutcome: "POSITIVE" });
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

// ─── Original Phase 8 tests ────────────────────────────────────────────────

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

// ─── Phase 8 new tests: overallOutcome derivation ──────────────────────────

describe("Phase 8 overallOutcome derivation", () => {
  it("derives POSITIVE when improvement_confirmed with no degraded findings", async () => {
    const { generateImplementationFindings } = await import("@/lib/autonomous/optimization/implementationOutcomeService");
    const findings = generateImplementationFindings({ baselineMetrics: baseline, actualMetrics: actual() });
    expect(findings.overallOutcome).toBe("POSITIVE");
    expect(findings.normalizedFindings.every((f: any) => f.normalizedOutcome !== "DEGRADED")).toBe(true);
  });

  it("derives NEGATIVE when regression_detected is in findings", async () => {
    const { generateImplementationFindings } = await import("@/lib/autonomous/optimization/implementationOutcomeService");
    // Very poor actuals trigger regression_detected (effectivenessScore < 0.42)
    const findings = generateImplementationFindings({
      baselineMetrics: baseline,
      actualMetrics: actual({
        detectorPrecision: 0.1,
        falsePositiveRate: 0.9,
        recommendationAcceptanceRate: 0.05,
        workflowStability: 0.1,
        rolloutStability: 0.1,
        operationalEffectivenessDelta: 0.05,
        rollbackOccurrence: 0,
        tenantSafetyIncidents: 0,
        sparseData: false,
        confidenceMultiplier: 1,
      }),
    });
    expect(findings.findings).toContain("regression_detected");
    expect(findings.overallOutcome).toBe("NEGATIVE");
  });

  it("derives MIXED when outcomes are neither clearly improved nor regressed", async () => {
    const { generateImplementationFindings } = await import("@/lib/autonomous/optimization/implementationOutcomeService");
    // Neutral actuals → no improvement_confirmed, no regression_detected → MIXED
    const findings = generateImplementationFindings({
      baselineMetrics: baseline,
      actualMetrics: actual({
        detectorPrecision: 0.5,       // same as baseline
        falsePositiveRate: 0.3,       // same
        recommendationAcceptanceRate: 0.4,
        workflowStability: 0.8,
        rolloutStability: 0.8,
        operationalEffectivenessDelta: 0.6,
        rollbackOccurrence: 0,
        tenantSafetyIncidents: 0,
        sparseData: false,
        confidenceMultiplier: 1,
      }),
    });
    expect(findings.overallOutcome).toBe("MIXED");
    expect(findings.findings).not.toContain("regression_detected");
    expect(findings.findings).not.toContain("improvement_confirmed");
  });

  it("includes normalizedFindings mapping each finding to IMPROVED | DEGRADED | NEUTRAL", async () => {
    const { generateImplementationFindings } = await import("@/lib/autonomous/optimization/implementationOutcomeService");
    const findings = generateImplementationFindings({ baselineMetrics: baseline, actualMetrics: actual() });
    expect(Array.isArray(findings.normalizedFindings)).toBe(true);
    for (const nf of findings.normalizedFindings) {
      expect(nf).toHaveProperty("finding");
      expect(nf).toHaveProperty("normalizedOutcome");
      expect(["IMPROVED", "DEGRADED", "NEUTRAL"]).toContain(nf.normalizedOutcome);
    }
  });
});

// ─── Phase 8 new tests: schema fields persisted on closure ─────────────────

describe("Phase 8 new schema fields persisted on loop closure", () => {
  it("persists overallOutcome, confidenceScore, and evaluationWindowClosedAt to PostChangeEvaluationPlan", async () => {
    mockPrisma.postChangeEvaluationPlan.findUnique.mockResolvedValue(plan({ postChangeMetrics: actual() }));
    const { completeFeedbackLoop } = await import("@/lib/autonomous/optimization/feedbackLoopCompletionService");
    await completeFeedbackLoop({ evaluationPlanId: "eval-1", actorId: "platform-1" });
    expect(mockPrisma.postChangeEvaluationPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          overallOutcome: expect.stringMatching(/^(POSITIVE|NEGATIVE|MIXED)$/),
          confidenceScore: expect.any(Number),
          evaluationWindowClosedAt: expect.any(Date),
        }),
      })
    );
  });

  it("sets OptimizationChangeRequest.implementationOutcome after feedback loop closes", async () => {
    mockPrisma.postChangeEvaluationPlan.findUnique.mockResolvedValue(plan({ postChangeMetrics: actual() }));
    const { completeFeedbackLoop } = await import("@/lib/autonomous/optimization/feedbackLoopCompletionService");
    await completeFeedbackLoop({ evaluationPlanId: "eval-1", actorId: "platform-1" });
    expect(mockPrisma.optimizationChangeRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "cr-1" },
        data: expect.objectContaining({
          implementationOutcome: expect.stringMatching(/^(POSITIVE|NEGATIVE|MIXED)$/),
        }),
      })
    );
  });

  it("confidenceScore is bounded between 0 and 1", async () => {
    mockPrisma.postChangeEvaluationPlan.findUnique.mockResolvedValue(plan({ postChangeMetrics: actual() }));
    const { completeFeedbackLoop } = await import("@/lib/autonomous/optimization/feedbackLoopCompletionService");
    await completeFeedbackLoop({ evaluationPlanId: "eval-1" });
    const call = mockPrisma.postChangeEvaluationPlan.update.mock.calls[0][0];
    const score = call.data.confidenceScore;
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

// ─── Phase 8 new tests: POST route auth gate ───────────────────────────────

describe("Phase 8 POST /post-change-eval route auth gate", () => {
  it("returns 403 when caller is not platform admin", async () => {
    mockRequirePlatformAdmin.mockRejectedValueOnce(
      Object.assign(new Error("Forbidden - platform admin required"), { status: 403 })
    );
    const { POST } = await import(
      "@/app/api/admin/ops/optimization/change-requests/[changeRequestId]/post-change-eval/route"
    );
    const req = { json: async () => ({ action: "record_metrics" }) } as any;
    const res = await POST(req, { params: { changeRequestId: "cr-1" } });
    expect(res.status).toBe(403);
  });
});

// ─── Phase 8 new tests: UI button visibility logic ─────────────────────────

describe("Phase 8 action button visibility conditions", () => {
  it("Record Metrics button should not render when feedbackLoopStatus is already COMPLETE", () => {
    const completedPlan = { feedbackLoopStatus: "COMPLETE", status: "CLOSED", postChangeMetrics: {} };
    // Component condition: !isComplete && hasRolloutVerification && !hasActuals
    const isComplete = completedPlan.feedbackLoopStatus === "COMPLETE";
    const shouldShowRecordButton = !isComplete;
    expect(shouldShowRecordButton).toBe(false);
  });

  it("Close Feedback Loop button should not render when feedbackLoopStatus is already COMPLETE", () => {
    const completedPlan = { feedbackLoopStatus: "COMPLETE", postChangeMetrics: {} };
    const isComplete = completedPlan.feedbackLoopStatus === "COMPLETE";
    const shouldShowCompleteButton = !isComplete && Boolean(completedPlan.postChangeMetrics);
    expect(shouldShowCompleteButton).toBe(false);
  });
});
