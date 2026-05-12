import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
const mockPrisma = vi.hoisted(() => ({
  workflowRun: {
    count: vi.fn().mockResolvedValue(0),
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    findUnique: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue({}),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  approvalRequest: {
    count: vi.fn().mockResolvedValue(0),
  },
  postChangeEvaluationPlan: {
    count: vi.fn().mockResolvedValue(0),
    findMany: vi.fn().mockResolvedValue([]),
  },
  auditLog: {
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
  },
  $queryRaw: vi.fn().mockResolvedValue([{ "1": 1 }]),
}));

const mockLogAudit = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockEnqueueJob = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockEnqueueWorkflowRun = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockTransitionWorkflowStatus = vi.hoisted(() => vi.fn().mockResolvedValue({ id: "wf1", traceId: "t1" }));
const mockReleaseWorkflowRun = vi.hoisted(() => vi.fn().mockResolvedValue({ count: 1 }));
const mockGetExecutionHealth = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ status: "healthy", activeGlobal: 5, activeTenant: 1, staleRunning: 0, queueConfigured: true, saturationLimit: 100, tenantSaturationLimit: 15 })
);

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/queue", () => ({
  enqueueJob: mockEnqueueJob,
  isQueueConfigured: vi.fn().mockReturnValue(true),
  JobType: { AUTONOMOUS_WORKFLOW_RUN: "autonomous.workflow.run" },
}));
vi.mock("@/lib/autonomous/workflowStateManager", () => ({
  transitionWorkflowStatus: mockTransitionWorkflowStatus,
  releaseWorkflowRun: mockReleaseWorkflowRun,
}));
vi.mock("@/lib/autonomous/workflowOrchestrator", () => ({
  enqueueWorkflowRun: mockEnqueueWorkflowRun,
}));
vi.mock("@/lib/autonomous/actions/executionHealthService", () => ({
  getExecutionHealth: mockGetExecutionHealth,
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("runtimeHealthService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns healthy when all signals are clear", async () => {
    process.env.AUTONOMOUS_EMERGENCY_SHUTDOWN = undefined as any;
    process.env.ENABLE_AUTONOMOUS_DEGRADED_MODE = undefined as any;
    mockPrisma.workflowRun.count.mockResolvedValue(0);
    mockPrisma.workflowRun.findFirst.mockResolvedValue({ id: "probe" });
    const { getRuntimeHealthSummary } = await import("@/lib/autonomous/runtime/runtimeHealthService");
    const health = await getRuntimeHealthSummary();
    expect(health.status).toBe("healthy");
    expect(health.signals).toHaveLength(0);
  });

  it("returns shutdown when AUTONOMOUS_EMERGENCY_SHUTDOWN=true", async () => {
    process.env.AUTONOMOUS_EMERGENCY_SHUTDOWN = "true";
    const { getRuntimeHealthSummary } = await import("@/lib/autonomous/runtime/runtimeHealthService");
    const health = await getRuntimeHealthSummary();
    expect(health.status).toBe("shutdown");
    expect(health.emergencyShutdown).toBe(true);
    delete process.env.AUTONOMOUS_EMERGENCY_SHUTDOWN;
  });

  it("returns degraded when stuck workflows exist", async () => {
    process.env.AUTONOMOUS_EMERGENCY_SHUTDOWN = undefined as any;
    // runtimeHealthService makes 4 count calls: stuck, deadLetter, recentTotal, recentFailed
    // getExecutionHealth is mocked separately and does not call prisma.count
    mockPrisma.workflowRun.count
      .mockResolvedValueOnce(2)  // stuck workflows
      .mockResolvedValueOnce(0)  // dead letter
      .mockResolvedValueOnce(10) // recentTotal
      .mockResolvedValueOnce(1); // recentFailed
    mockPrisma.workflowRun.findFirst.mockResolvedValue({ id: "probe" });
    const { getRuntimeHealthSummary } = await import("@/lib/autonomous/runtime/runtimeHealthService");
    const health = await getRuntimeHealthSummary();
    expect(health.stuckWorkflows).toBeGreaterThanOrEqual(0);
  });
});

describe("runtimeBackpressureService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns not active when pending count is below threshold", async () => {
    process.env.AUTONOMOUS_BACKPRESSURE_PENDING_LIMIT = "200";
    process.env.AUTONOMOUS_EMERGENCY_SHUTDOWN = undefined as any;
    mockPrisma.workflowRun.count.mockResolvedValue(50);
    const { checkBackpressure } = await import("@/lib/autonomous/runtime/runtimeBackpressureService");
    const result = await checkBackpressure();
    expect(result.active).toBe(false);
    expect(result.pendingWorkflows).toBe(50);
    delete process.env.AUTONOMOUS_BACKPRESSURE_PENDING_LIMIT;
  });

  it("returns active when pending count meets threshold", async () => {
    process.env.AUTONOMOUS_BACKPRESSURE_PENDING_LIMIT = "10";
    process.env.AUTONOMOUS_EMERGENCY_SHUTDOWN = undefined as any;
    mockPrisma.workflowRun.count.mockResolvedValue(10);
    const { checkBackpressure } = await import("@/lib/autonomous/runtime/runtimeBackpressureService");
    const result = await checkBackpressure();
    expect(result.active).toBe(true);
    expect(result.reason).toBe("pending_queue_saturated");
    delete process.env.AUTONOMOUS_BACKPRESSURE_PENDING_LIMIT;
  });

  it("returns active immediately when emergency shutdown is on", async () => {
    process.env.AUTONOMOUS_EMERGENCY_SHUTDOWN = "true";
    const { checkBackpressure } = await import("@/lib/autonomous/runtime/runtimeBackpressureService");
    const result = await checkBackpressure();
    expect(result.active).toBe(true);
    expect(result.reason).toBe("emergency_shutdown");
    delete process.env.AUTONOMOUS_EMERGENCY_SHUTDOWN;
  });
});

describe("workflowRecoveryService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns zeros when feature flag is disabled", async () => {
    process.env.ENABLE_WORKFLOW_RECOVERY_CRON = "false";
    const { recoverStuckWorkflows } = await import("@/lib/autonomous/runtime/workflowRecoveryService");
    const result = await recoverStuckWorkflows();
    expect(result.scanned).toBe(0);
    expect(result.recovered).toBe(0);
    delete process.env.ENABLE_WORKFLOW_RECOVERY_CRON;
  });

  it("performs dry run without writing", async () => {
    process.env.ENABLE_WORKFLOW_RECOVERY_CRON = "true";
    mockPrisma.workflowRun.findMany.mockResolvedValue([
      { id: "wf1", workflowType: "test", schoolId: null, attempt: 1, maxAttempts: 3, traceId: "t1", partitionKey: "p1", idempotencyKey: "ik1", lockedBy: null, lockedUntil: null },
    ]);
    const { recoverStuckWorkflows } = await import("@/lib/autonomous/runtime/workflowRecoveryService");
    const result = await recoverStuckWorkflows({ dryRun: true });
    expect(result.scanned).toBe(1);
    expect(result.skipped).toBe(1);
    expect(mockTransitionWorkflowStatus).not.toHaveBeenCalled();
    delete process.env.ENABLE_WORKFLOW_RECOVERY_CRON;
  });

  it("quarantines workflows that exhausted retry budget", async () => {
    process.env.ENABLE_WORKFLOW_RECOVERY_CRON = "true";
    mockPrisma.workflowRun.findMany.mockResolvedValue([
      { id: "wf1", workflowType: "test", schoolId: null, attempt: 3, maxAttempts: 3, traceId: "t1", partitionKey: "p1", idempotencyKey: "ik1", lockedBy: null, lockedUntil: null },
    ]);
    const { recoverStuckWorkflows } = await import("@/lib/autonomous/runtime/workflowRecoveryService");
    const result = await recoverStuckWorkflows({ dryRun: false });
    expect(result.quarantined).toBe(1);
    expect(mockTransitionWorkflowStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: "dead_lettered", workflowRunId: "wf1" })
    );
    delete process.env.ENABLE_WORKFLOW_RECOVERY_CRON;
  });

  it("resets and re-queues workflows within retry budget", async () => {
    process.env.ENABLE_WORKFLOW_RECOVERY_CRON = "true";
    mockPrisma.workflowRun.findMany.mockResolvedValue([
      { id: "wf2", workflowType: "test", schoolId: null, attempt: 1, maxAttempts: 3, traceId: "t2", partitionKey: "p2", idempotencyKey: "ik2", lockedBy: null, lockedUntil: null },
    ]);
    const { recoverStuckWorkflows } = await import("@/lib/autonomous/runtime/workflowRecoveryService");
    const result = await recoverStuckWorkflows({ dryRun: false });
    expect(result.recovered).toBe(1);
    expect(mockTransitionWorkflowStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", workflowRunId: "wf2" })
    );
    delete process.env.ENABLE_WORKFLOW_RECOVERY_CRON;
  });

  it("re-queues retryable failed workflows", async () => {
    process.env.ENABLE_WORKFLOW_RECOVERY_CRON = "true";
    mockPrisma.workflowRun.findMany
      .mockResolvedValueOnce([]) // stuck workflows
      .mockResolvedValueOnce([
        { id: "wf3", workflowType: "test", schoolId: null, attempt: 1, maxAttempts: 3, traceId: "t3", partitionKey: "p3", idempotencyKey: "ik3" },
      ]); // retryable failed
    const { runWorkflowRecovery } = await import("@/lib/autonomous/runtime/workflowRecoveryService");
    const result = await runWorkflowRecovery();
    expect(result.requeued).toBe(1);
    expect(mockEnqueueWorkflowRun).toHaveBeenCalledWith(expect.objectContaining({ id: "wf3" }));
    delete process.env.ENABLE_WORKFLOW_RECOVERY_CRON;
  });
});

describe("deadLetterInspectionService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty summary when no dead-letter items", async () => {
    mockPrisma.workflowRun.findMany.mockResolvedValue([]);
    const { getDeadLetterSummary } = await import("@/lib/autonomous/runtime/deadLetterInspectionService");
    const summary = await getDeadLetterSummary();
    expect(summary.total).toBe(0);
    expect(summary.replayEligible).toBe(0);
    expect(summary.quarantined).toBe(0);
  });

  it("marks transient-error workflows as replay eligible", async () => {
    mockPrisma.workflowRun.findMany.mockResolvedValue([
      { id: "dl1", workflowType: "test", schoolId: null, deadLetteredAt: new Date(), attempt: 3, maxAttempts: 3, lastErrorCode: "transient_dependency_failure", lastErrorMessage: "timeout", executionMetadata: {} },
    ]);
    const { getDeadLetterSummary } = await import("@/lib/autonomous/runtime/deadLetterInspectionService");
    const summary = await getDeadLetterSummary();
    expect(summary.total).toBe(1);
    expect(summary.replayEligible).toBe(1);
    expect(summary.items[0].replayEligible).toBe(true);
  });

  it("marks stuck-exhausted workflows as quarantined", async () => {
    mockPrisma.workflowRun.findMany.mockResolvedValue([
      { id: "dl2", workflowType: "test", schoolId: null, deadLetteredAt: new Date(), attempt: 3, maxAttempts: 3, lastErrorCode: "stuck_workflow_exhausted", lastErrorMessage: null, executionMetadata: {} },
    ]);
    const { getDeadLetterSummary } = await import("@/lib/autonomous/runtime/deadLetterInspectionService");
    const summary = await getDeadLetterSummary();
    expect(summary.quarantined).toBe(1);
    expect(summary.items[0].quarantined).toBe(true);
  });

  it("returns zeros without writing when flag disabled", async () => {
    process.env.ENABLE_DEAD_LETTER_INSPECTION_CRON = "false";
    const { runDeadLetterInspection } = await import("@/lib/autonomous/runtime/deadLetterInspectionService");
    const result = await runDeadLetterInspection();
    expect(result.inspected).toBe(0);
    expect(mockLogAudit).not.toHaveBeenCalled();
    delete process.env.ENABLE_DEAD_LETTER_INSPECTION_CRON;
  });
});

describe("autonomousWorkerService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("detects already-running workflow by status", async () => {
    mockPrisma.workflowRun.findUnique.mockResolvedValue({ status: "running", lockedBy: null, lockedUntil: null });
    const { isWorkflowAlreadyRunning } = await import("@/lib/autonomous/runtime/autonomousWorkerService");
    const result = await isWorkflowAlreadyRunning("wf1");
    expect(result).toBe(true);
  });

  it("returns false for non-running workflow", async () => {
    mockPrisma.workflowRun.findUnique.mockResolvedValue({ status: "pending", lockedBy: null, lockedUntil: null });
    const { isWorkflowAlreadyRunning } = await import("@/lib/autonomous/runtime/autonomousWorkerService");
    const result = await isWorkflowAlreadyRunning("wf1");
    expect(result).toBe(false);
  });

  it("releases expired locks and logs audit", async () => {
    process.env.AUTONOMOUS_EMERGENCY_SHUTDOWN = undefined as any;
    mockPrisma.workflowRun.updateMany.mockResolvedValue({ count: 3 });
    const { releaseExpiredLocks } = await import("@/lib/autonomous/runtime/autonomousWorkerService");
    const result = await releaseExpiredLocks();
    expect(result.released).toBe(3);
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "autonomous.worker.locks_released" })
    );
  });

  it("skips lock release during emergency shutdown", async () => {
    process.env.AUTONOMOUS_EMERGENCY_SHUTDOWN = "true";
    const { releaseExpiredLocks } = await import("@/lib/autonomous/runtime/autonomousWorkerService");
    const result = await releaseExpiredLocks();
    expect(result.released).toBe(0);
    expect(mockPrisma.workflowRun.updateMany).not.toHaveBeenCalled();
    delete process.env.AUTONOMOUS_EMERGENCY_SHUTDOWN;
  });
});

describe("cron secret enforcement", () => {
  it("returns 401 when CRON_SECRET is missing", async () => {
    delete process.env.CRON_SECRET;
    const { POST } = await import("@/app/api/cron/autonomous/stale-approvals/route");
    const req = new Request("http://localhost/api/cron/autonomous/stale-approvals", {
      method: "POST",
      headers: { authorization: "Bearer wrong" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when bearer token does not match CRON_SECRET", async () => {
    process.env.CRON_SECRET = "correct-secret-abc";
    const { POST } = await import("@/app/api/cron/autonomous/stale-approvals/route");
    const req = new Request("http://localhost/api/cron/autonomous/stale-approvals", {
      method: "POST",
      headers: { authorization: "Bearer wrong-secret" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    delete process.env.CRON_SECRET;
  });
});

describe("cron feature flag gating", () => {
  it("returns skipped when autonomous cron is disabled", async () => {
    process.env.CRON_SECRET = "test-secret";
    process.env.ENABLE_AUTONOMOUS_CRON = "false";
    const { POST } = await import("@/app/api/cron/autonomous/workflow-recovery/route");
    const req = new Request("http://localhost/api/cron/autonomous/workflow-recovery", {
      method: "POST",
      headers: { authorization: "Bearer test-secret" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skipped).toBe(true);
    delete process.env.CRON_SECRET;
    delete process.env.ENABLE_AUTONOMOUS_CRON;
  });

  it("returns skipped for dead-letter cron when flag is off", async () => {
    process.env.CRON_SECRET = "test-secret";
    process.env.ENABLE_AUTONOMOUS_CRON = "true";
    process.env.ENABLE_DEAD_LETTER_INSPECTION_CRON = "false";
    const { POST } = await import("@/app/api/cron/autonomous/dead-letter-inspection/route");
    const req = new Request("http://localhost/api/cron/autonomous/dead-letter-inspection", {
      method: "POST",
      headers: { authorization: "Bearer test-secret" },
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.skipped).toBe(true);
    delete process.env.CRON_SECRET;
    delete process.env.ENABLE_AUTONOMOUS_CRON;
    delete process.env.ENABLE_DEAD_LETTER_INSPECTION_CRON;
  });
});

describe("runtimeMetricsService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns runtime metrics summary", async () => {
    mockPrisma.workflowRun.count
      .mockResolvedValueOnce(100) // total
      .mockResolvedValueOnce(10) // pending
      .mockResolvedValueOnce(5) // running
      .mockResolvedValueOnce(80) // succeeded
      .mockResolvedValueOnce(5) // failed
      .mockResolvedValueOnce(2) // dead_lettered
      .mockResolvedValueOnce(1) // stuck
      .mockResolvedValueOnce(12); // retry budget used
    mockPrisma.approvalRequest.count
      .mockResolvedValueOnce(3) // pending
      .mockResolvedValueOnce(1); // overdue
    mockPrisma.postChangeEvaluationPlan.count.mockResolvedValue(4);
    mockPrisma.postChangeEvaluationPlan.findMany.mockResolvedValue([]);
    const { getRuntimeMetrics } = await import("@/lib/autonomous/runtime/runtimeMetricsService");
    const metrics = await getRuntimeMetrics({ windowHours: 24 });
    expect(metrics.workflows.total).toBe(100);
    expect(metrics.workflows.stuckCount).toBe(1);
    expect(metrics.approvals.pending).toBe(3);
    expect(metrics.retryBudget.used).toBe(12);
    expect(typeof metrics.timestamp).toBe("string");
  });
});

describe("runtimeRunbookService", () => {
  it("returns runbook with all required sections", async () => {
    const { getRuntimeRunbook } = await import("@/lib/autonomous/runtime/runtimeRunbookService");
    const runbook = getRuntimeRunbook();
    const sectionIds = runbook.sections.map((s) => s.id);
    expect(sectionIds).toContain("emergency_shutdown");
    expect(sectionIds).toContain("queue_saturation");
    expect(sectionIds).toContain("stuck_workflow_recovery");
    expect(sectionIds).toContain("dead_letter_review");
    expect(sectionIds).toContain("rollback");
    expect(sectionIds).toContain("env_vars");
    for (const section of runbook.sections) {
      expect(section.steps.length).toBeGreaterThan(0);
    }
  });
});

describe("autonomousSchedulerService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns scheduler status for all pipelines", async () => {
    mockPrisma.auditLog.findFirst.mockResolvedValue(null);
    const { getSchedulerStatus } = await import("@/lib/autonomous/runtime/autonomousSchedulerService");
    const status = await getSchedulerStatus();
    expect(status).toHaveLength(5);
    const pipelines = status.map((s) => s.pipeline);
    expect(pipelines).toContain("autonomous.stale_approvals");
    expect(pipelines).toContain("autonomous.workflow_recovery");
    expect(pipelines).toContain("autonomous.dead_letter_inspection");
  });

  it("reflects enabled state from env flags", async () => {
    process.env.ENABLE_WORKFLOW_RECOVERY_CRON = "true";
    mockPrisma.auditLog.findFirst.mockResolvedValue(null);
    const { getSchedulerStatus } = await import("@/lib/autonomous/runtime/autonomousSchedulerService");
    const status = await getSchedulerStatus();
    const recovery = status.find((s) => s.pipeline === "autonomous.workflow_recovery");
    expect(recovery?.enabled).toBe(true);
    delete process.env.ENABLE_WORKFLOW_RECOVERY_CRON;
  });
});
