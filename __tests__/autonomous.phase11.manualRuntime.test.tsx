import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mockRequirePlatformAdmin = vi.hoisted(() => vi.fn());
const mockProcessStaleApprovals = vi.hoisted(() => vi.fn());
const mockProcessEvaluationWindows = vi.hoisted(() => vi.fn());
const mockRunWorkflowRecovery = vi.hoisted(() => vi.fn());
const mockGetRuntimeHealthSummary = vi.hoisted(() => vi.fn());
const mockRunDeadLetterInspection = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockAuditFindFirst = vi.hoisted(() => vi.fn());
const mockAuditFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requirePlatformAdmin: mockRequirePlatformAdmin,
}));

vi.mock("@/lib/autonomous/actions/staleApprovalWorker", () => ({
  processStaleApprovals: mockProcessStaleApprovals,
}));

vi.mock("@/lib/autonomous/optimization/evaluationWindowScheduler", () => ({
  processDueEvaluationWindows: mockProcessEvaluationWindows,
}));

vi.mock("@/lib/autonomous/runtime/workflowRecoveryService", () => ({
  runWorkflowRecovery: mockRunWorkflowRecovery,
}));

vi.mock("@/lib/autonomous/runtime/runtimeHealthService", () => ({
  getRuntimeHealthSummary: mockGetRuntimeHealthSummary,
}));

vi.mock("@/lib/autonomous/runtime/deadLetterInspectionService", () => ({
  runDeadLetterInspection: mockRunDeadLetterInspection,
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    auditLog: {
      findFirst: mockAuditFindFirst,
      findMany: mockAuditFindMany,
    },
  },
}));

function request(body: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/admin/ops/runtime/run/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Autonomous OS Phase 11 manual runtime routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.ENABLE_RUNTIME_DASHBOARD = "true";
    process.env.ENABLE_APPROVAL_EXPIRATION_WORKER = "true";
    process.env.ENABLE_IMPLEMENTATION_WORKFLOW = "true";
    process.env.ENABLE_WORKFLOW_RECOVERY_CRON = "true";
    process.env.ENABLE_RUNTIME_HEALTH_CRON = "true";
    process.env.ENABLE_DEAD_LETTER_INSPECTION_CRON = "true";
    delete process.env.AUTONOMOUS_EMERGENCY_SHUTDOWN;
    mockRequirePlatformAdmin.mockResolvedValue({ id: "platform-admin-1", isPlatformAdmin: true });
    mockAuditFindFirst.mockResolvedValue(null);
    mockAuditFindMany.mockResolvedValue([]);
    mockLogAudit.mockResolvedValue(undefined);
    mockProcessStaleApprovals.mockResolvedValue({ enabled: true, expired: 2, escalated: 1, stalePending: 3 });
    mockProcessEvaluationWindows.mockResolvedValue([{ evaluationPlanId: "plan-1", status: "closed" }]);
    mockRunWorkflowRecovery.mockResolvedValue({ scanned: 1, recovered: 1, quarantined: 0, skipped: 0, details: [], requeued: 1 });
    mockGetRuntimeHealthSummary.mockResolvedValue({
      status: "healthy",
      timestamp: "2026-05-12T00:00:00.000Z",
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
    mockRunDeadLetterInspection.mockResolvedValue({ inspected: 4, flaggedForReplay: 2, flaggedForQuarantine: 1 });
  });

  afterEach(() => {
    delete process.env.ENABLE_RUNTIME_DASHBOARD;
    delete process.env.ENABLE_APPROVAL_EXPIRATION_WORKER;
    delete process.env.ENABLE_IMPLEMENTATION_WORKFLOW;
    delete process.env.ENABLE_WORKFLOW_RECOVERY_CRON;
    delete process.env.ENABLE_RUNTIME_HEALTH_CRON;
    delete process.env.ENABLE_DEAD_LETTER_INSPECTION_CRON;
    delete process.env.AUTONOMOUS_EMERGENCY_SHUTDOWN;
    delete process.env.CRON_SECRET;
  });

  it("requires platform_admin for manual run routes", async () => {
    mockRequirePlatformAdmin.mockRejectedValue(Object.assign(new Error("Forbidden"), { status: 403 }));
    const { POST } = await import("@/app/api/admin/ops/runtime/run/stale-approvals/route");
    const res = await POST(request());
    expect(res.status).toBe(403);
    expect(mockProcessStaleApprovals).not.toHaveBeenCalled();
  });

  it("does not require CRON_SECRET for admin manual runs", async () => {
    delete process.env.CRON_SECRET;
    const { POST } = await import("@/app/api/admin/ops/runtime/run/stale-approvals/route");
    const res = await POST(request());
    expect(res.status).toBe(200);
    expect(mockProcessStaleApprovals).toHaveBeenCalledWith({ dryRun: false });
  });

  it("calls the stale approval worker", async () => {
    const { POST } = await import("@/app/api/admin/ops/runtime/run/stale-approvals/route");
    const res = await POST(request());
    const body = await res.json();
    expect(body.processed).toBe(3);
    expect(mockProcessStaleApprovals).toHaveBeenCalledOnce();
  });

  it("calls the evaluation window scheduler", async () => {
    const { POST } = await import("@/app/api/admin/ops/runtime/run/evaluation-windows/route");
    const res = await POST(request());
    const body = await res.json();
    expect(body.processed).toBe(1);
    expect(mockProcessEvaluationWindows).toHaveBeenCalledWith({ actorId: "platform-admin-1", limit: 10 });
  });

  it("calls workflow recovery", async () => {
    const { POST } = await import("@/app/api/admin/ops/runtime/run/workflow-recovery/route");
    const res = await POST(request({ dryRun: true }));
    const body = await res.json();
    expect(body.processed).toBe(2);
    expect(mockRunWorkflowRecovery).toHaveBeenCalledWith({ dryRun: true });
  });

  it("calls runtime health and writes a health snapshot", async () => {
    const { POST } = await import("@/app/api/admin/ops/runtime/run/runtime-health/route");
    const res = await POST(request());
    const body = await res.json();
    expect(body.processed).toBe(1);
    expect(mockGetRuntimeHealthSummary).toHaveBeenCalledOnce();
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "autonomous.runtime.health.snapshot" }));
  });

  it("calls dead-letter inspection", async () => {
    const { POST } = await import("@/app/api/admin/ops/runtime/run/dead-letter-inspection/route");
    const res = await POST(request());
    const body = await res.json();
    expect(body.processed).toBe(4);
    expect(mockRunDeadLetterInspection).toHaveBeenCalledWith({ actorId: "platform-admin-1", dryRun: false });
  });

  it("runs full maintenance through each runtime service", async () => {
    const { POST } = await import("@/app/api/admin/ops/runtime/run/full-maintenance/route");
    const res = await POST(request({ idempotencyKey: "full-1" }));
    const body = await res.json();
    expect(body.kind).toBe("full-maintenance");
    expect(mockProcessStaleApprovals).toHaveBeenCalledOnce();
    expect(mockProcessEvaluationWindows).toHaveBeenCalledOnce();
    expect(mockRunWorkflowRecovery).toHaveBeenCalledOnce();
    expect(mockGetRuntimeHealthSummary).toHaveBeenCalledOnce();
    expect(mockRunDeadLetterInspection).toHaveBeenCalledOnce();
  });

  it("skips mutating manual runs during emergency shutdown", async () => {
    process.env.AUTONOMOUS_EMERGENCY_SHUTDOWN = "true";
    const { POST } = await import("@/app/api/admin/ops/runtime/run/workflow-recovery/route");
    const res = await POST(request());
    const body = await res.json();
    expect(body.skipped).toBe(true);
    expect(body.reason).toBe("emergency_shutdown");
    expect(mockRunWorkflowRecovery).not.toHaveBeenCalled();
  });

  it("skips when the pipeline feature flag is disabled", async () => {
    process.env.ENABLE_DEAD_LETTER_INSPECTION_CRON = "false";
    const { POST } = await import("@/app/api/admin/ops/runtime/run/dead-letter-inspection/route");
    const res = await POST(request());
    const body = await res.json();
    expect(body.skipped).toBe(true);
    expect(body.reason).toBe("dead_letter_inspection_cron_disabled");
    expect(mockRunDeadLetterInspection).not.toHaveBeenCalled();
  });

  it("writes manual audit and cron-equivalent audit logs", async () => {
    const { POST } = await import("@/app/api/admin/ops/runtime/run/stale-approvals/route");
    await POST(request({ idempotencyKey: "audit-1" }));
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "cron.autonomous.stale_approvals.run" }));
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "manual.cron.autonomous.stale_approvals.run" }));
  });

  it("reuses prior idempotent run result without calling the service again", async () => {
    mockAuditFindFirst.mockResolvedValue({
      details: {
        status: "ok",
        skipped: false,
        reason: null,
        processed: 7,
        failed: 0,
        durationMs: 12,
        result: { expired: 7 },
        ranAt: "2026-05-12T00:00:00.000Z",
      },
    });
    const { POST } = await import("@/app/api/admin/ops/runtime/run/stale-approvals/route");
    const res = await POST(request({ idempotencyKey: "same-key" }));
    const body = await res.json();
    expect(body.reused).toBe(true);
    expect(body.processed).toBe(7);
    expect(mockProcessStaleApprovals).not.toHaveBeenCalled();
  });

  it("leaves cron routes requiring CRON_SECRET", async () => {
    delete process.env.CRON_SECRET;
    const { POST } = await import("@/app/api/cron/autonomous/stale-approvals/route");
    const res = await POST(
      new Request("http://localhost/api/cron/autonomous/stale-approvals", {
        method: "POST",
        headers: { authorization: "Bearer missing" },
      })
    );
    expect(res.status).toBe(401);
  });
});

describe("ManualRuntimeControls UI", () => {
  it("renders paused cron warning and manual runtime buttons", async () => {
    const { default: ManualRuntimeControls } = await import("@/components/admin/ManualRuntimeControls");
    const html = renderToStaticMarkup(<ManualRuntimeControls history={[]} cronPaused={true} />);
    expect(html).toContain("Manual Runtime Controls");
    expect(html).toContain("Vercel cron is paused");
    expect(html).toContain("Run full runtime maintenance now");
  });
});
