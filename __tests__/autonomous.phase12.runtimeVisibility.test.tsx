import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mockRequirePlatformAdmin = vi.hoisted(() => vi.fn());
const mockRequireUser = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockGetRuntimeHealthSummary = vi.hoisted(() => vi.fn());
const mockGetRuntimeOverview = vi.hoisted(() => vi.fn());
const mockGetExecutionHealth = vi.hoisted(() => vi.fn());

const mockPrisma = vi.hoisted(() => ({
  auditLog: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
  },
  executionTrace: {
    findMany: vi.fn(),
  },
  workflowRun: {
    findFirst: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  requirePlatformAdmin: mockRequirePlatformAdmin,
  requireUser: mockRequireUser,
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/queue", () => ({
  isQueueConfigured: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/autonomous/actions/executionHealthService", () => ({
  getExecutionHealth: mockGetExecutionHealth,
}));

vi.mock("@/lib/autonomous/runtime/runtimeHealthService", () => ({
  getRuntimeHealthSummary: mockGetRuntimeHealthSummary,
}));

vi.mock("@/lib/autonomous/runtime/autonomousRuntimeService", () => ({
  getRuntimeOverview: mockGetRuntimeOverview,
}));

function resetEnv() {
  process.env.ENABLE_RUNTIME_DASHBOARD = "true";
  process.env.ENABLE_WORKFLOW_RECOVERY_CRON = "false";
  process.env.ENABLE_RUNTIME_HEALTH_CRON = "true";
  process.env.ENABLE_DEAD_LETTER_INSPECTION_CRON = "false";
  process.env.ENABLE_APPROVAL_EXPIRATION_WORKER = "false";
  process.env.ENABLE_IMPLEMENTATION_WORKFLOW = "false";
  delete process.env.AUTONOMOUS_EMERGENCY_SHUTDOWN;
}

const platformUser = { id: "platform-1", role: "ADMIN", isPlatformAdmin: true, schoolId: null, name: "Operator" };

describe("Autonomous OS Phase 12 runtime visibility", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    resetEnv();
    mockRequirePlatformAdmin.mockResolvedValue(platformUser);
    mockRequireUser.mockResolvedValue(platformUser);
    mockLogAudit.mockResolvedValue(undefined);
    mockPrisma.auditLog.count.mockResolvedValue(1);
    mockPrisma.auditLog.findMany.mockResolvedValue([]);
    mockPrisma.auditLog.findFirst.mockResolvedValue(null);
    mockPrisma.executionTrace.findMany.mockResolvedValue([]);
    mockPrisma.workflowRun.findFirst.mockResolvedValue({ id: "wf-probe" });
    mockPrisma.workflowRun.count.mockResolvedValue(0);
    mockGetExecutionHealth.mockResolvedValue({ status: "healthy", activeGlobal: 0 });
    mockGetRuntimeHealthSummary.mockResolvedValue({
      status: "healthy",
      timestamp: "2026-05-12T12:00:00.000Z",
      queueConfigured: true,
      dbReachable: true,
      activeExecutions: 0,
      stuckWorkflows: 0,
      deadLetterCount: 0,
      recentFailureRate: null,
      backpressureActive: false,
      emergencyShutdown: false,
      degradedMode: false,
      signals: [],
    });
    mockGetRuntimeOverview.mockResolvedValue({
      health: {
        status: "healthy",
        timestamp: "2026-05-12T12:00:00.000Z",
        signals: [],
        activeExecutions: 0,
        stuckWorkflows: 0,
        deadLetterCount: 0,
      },
      metrics: {
        approvals: { pending: 0, overdue: 0 },
        evaluationWindows: { open: 0, due: 0 },
        workflows: { succeeded: 0, failed: 0, deadLettered: 0, pending: 0, running: 0, stuckCount: 0 },
      },
      backpressure: { active: false },
      workerStatus: [],
      schedulerStatus: [],
    });
  });

  afterEach(() => {
    delete process.env.ENABLE_RUNTIME_DASHBOARD;
    delete process.env.ENABLE_WORKFLOW_RECOVERY_CRON;
    delete process.env.ENABLE_RUNTIME_HEALTH_CRON;
    delete process.env.ENABLE_DEAD_LETTER_INSPECTION_CRON;
    delete process.env.ENABLE_APPROVAL_EXPIRATION_WORKER;
    delete process.env.ENABLE_IMPLEMENTATION_WORKFLOW;
    delete process.env.AUTONOMOUS_EMERGENCY_SHUTDOWN;
  });

  it("run history reads manual runtime run logs", async () => {
    mockPrisma.auditLog.findMany.mockResolvedValue([
      {
        id: "run-1",
        action: "manual.cron.autonomous.runtime_health.run",
        resourceId: "autonomous.runtime_health",
        createdAt: new Date("2026-05-12T12:00:00Z"),
        details: {
          kind: "runtime-health",
          status: "ok",
          processed: 1,
          failed: 0,
          durationMs: 15,
          result: { health: { status: "healthy" } },
        },
        user: { id: "platform-1", name: "Operator" },
      },
    ]);
    const { getManualRuntimeRunHistory } = await import("@/lib/autonomous/runtime/manualRuntimeRunService");
    const rows = await getManualRuntimeRunHistory();
    expect(rows[0]).toMatchObject({
      id: "run-1",
      kind: "runtime-health",
      pipeline: "autonomous.runtime_health",
      processed: 1,
      actor: { id: "platform-1", name: "Operator" },
      resultSummary: "runtime healthy",
    });
  });

  it("run detail resolves linked audit and trace records", async () => {
    mockPrisma.auditLog.findFirst.mockResolvedValue({
      id: "run-1",
      action: "manual.cron.autonomous.workflow_recovery.run",
      resourceType: "autonomous_manual_run",
      resourceId: "autonomous.workflow_recovery",
      traceId: "trace-1",
      createdAt: new Date("2026-05-12T12:00:00Z"),
      details: {
        kind: "workflow-recovery",
        status: "ok",
        processed: 1,
        failed: 0,
        durationMs: 20,
        result: { details: [{ workflowRunId: "wf-1", approvalRequestId: "ap-1", evaluationPlanId: "ev-1" }] },
      },
      user: { id: "platform-1", name: "Operator" },
    });
    mockPrisma.auditLog.findMany.mockResolvedValue([
      {
        id: "run-1",
        action: "manual.cron.autonomous.workflow_recovery.run",
        resourceType: "autonomous_manual_run",
        resourceId: "autonomous.workflow_recovery",
        createdAt: new Date("2026-05-12T12:00:00Z"),
      },
    ]);
    mockPrisma.executionTrace.findMany.mockResolvedValue([
      {
        id: "trace-row-1",
        traceId: "trace-1",
        workflowRunId: "wf-1",
        spanType: "worker",
        spanName: "workflow recovery",
        status: "succeeded",
        startedAt: new Date("2026-05-12T12:00:00Z"),
      },
    ]);
    const { getManualRuntimeRunDetail } = await import("@/lib/autonomous/runtime/manualRuntimeRunService");
    const detail = await getManualRuntimeRunDetail("run-1");
    expect(detail?.linkedAuditLogs).toHaveLength(1);
    expect(detail?.linkedExecutionTraces[0].workflowRunId).toBe("wf-1");
    expect(detail?.links.workflows[0].href).toBe("/admin/ops/workflows/wf-1");
    expect(detail?.links.deadLetters[0].href).toBe("/admin/ops/runtime/dead-letter/wf-1");
  });

  it("blocks non-platform-admin from smoke", async () => {
    mockRequirePlatformAdmin.mockRejectedValue(Object.assign(new Error("Forbidden"), { status: 403 }));
    const { POST } = await import("@/app/api/admin/ops/runtime/smoke/route");
    const res = await POST();
    expect(res.status).toBe(403);
    expect(mockLogAudit).not.toHaveBeenCalled();
  });

  it("smoke writes harmless audit event and does not expose env secrets", async () => {
    process.env.CRON_SECRET = "super-secret-cron-value";
    const { POST } = await import("@/app/api/admin/ops/runtime/smoke/route");
    const res = await POST();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "autonomous.runtime.smoke.checked" }));
    expect(JSON.stringify(body)).not.toContain("super-secret-cron-value");
    delete process.env.CRON_SECRET;
  });

  it("smoke detects cron paused state and manual routes reachable", async () => {
    const { runRuntimeSmokeVerification } = await import("@/lib/autonomous/runtime/runtimeSmokeVerificationService");
    const result = await runRuntimeSmokeVerification({ actorId: "platform-1", actorRole: "ADMIN", isPlatformAdmin: true });
    expect(result.checks.find((c) => c.key === "cron_paused_state")?.status).toBe("PASS");
    expect(result.checks.find((c) => c.key === "manual_runtime_api")?.summary).toContain("no runtime job was executed");
  });

  it("returns 404 when runtime dashboard feature flag is disabled", async () => {
    process.env.ENABLE_RUNTIME_DASHBOARD = "false";
    const { POST } = await import("@/app/api/admin/ops/runtime/smoke/route");
    const res = await POST();
    expect(res.status).toBe(404);
  });

  it("runtime page links to run history and smoke page", async () => {
    const { default: RuntimeHubPage } = await import("@/app/admin/ops/runtime/page");
    const html = renderToStaticMarkup(await RuntimeHubPage());
    expect(html).toContain("/admin/ops/runtime/runs");
    expect(html).toContain("/admin/ops/runtime/smoke");
  });
});
