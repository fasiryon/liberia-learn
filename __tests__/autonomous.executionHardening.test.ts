import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyApprovalSLA } from "@/lib/autonomous/actions/approvalSLAService";

const mockPrisma = vi.hoisted(() => ({
  actionExecution: {
    count: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  approvalRequest: {
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  agentDecision: { findUnique: vi.fn() },
  workflowRun: { findUnique: vi.fn(), update: vi.fn() },
  curriculumFlag: { upsert: vi.fn() },
}));
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockRecordWorkflowCheckpoint = vi.hoisted(() => vi.fn());
const mockRecordActionTrace = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/db/writeThrottle", () => ({ withDbWriteThrottle: (_name: string, fn: () => unknown) => fn() }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/autonomous/workflowStateManager", () => ({
  recordWorkflowCheckpoint: mockRecordWorkflowCheckpoint,
  transitionWorkflowStatus: vi.fn(),
}));
vi.mock("@/lib/autonomous/actions/actionTraceService", () => ({ recordActionTrace: mockRecordActionTrace }));
vi.mock("@/lib/events/logLearningEvent", () => ({ logLearningEvent: vi.fn() }));

const adminUser = { id: "admin-1", role: "ADMIN", schoolId: "school-1", isPlatformAdmin: false } as any;

function approval(overrides: Record<string, unknown> = {}) {
  return {
    id: "approval-1",
    workflowRunId: "wf-1",
    actionExecutionId: "action-1",
    status: "PENDING",
    riskLevel: "medium",
    approvalType: "action.teacher_support",
    schoolId: "school-1",
    approverRole: "TEACHER",
    requestedAt: new Date(Date.now() - 8 * 24 * 60 * 60_000),
    expiresAt: new Date(Date.now() + 60_000),
    requestPayload: {},
    traceId: "trace-1",
    ...overrides,
  };
}

function action(overrides: Record<string, unknown> = {}) {
  return {
    id: "action-1",
    workflowRunId: "wf-1",
    actionType: "teacher_support",
    status: "PREPARED",
    riskLevel: "low",
    schoolId: "school-1",
    targetType: "teacher",
    targetId: "teacher-1",
    traceId: "trace-1",
    rollbackRefs: { rollbackPossible: true, operation: "cancel_draft_or_alert" },
    executionMetadata: {},
    ...overrides,
  };
}

afterEach(() => {
  vi.resetAllMocks();
  delete process.env.ENABLE_LOW_RISK_AUTONOMY;
  delete process.env.ENABLE_ACTION_EXECUTION;
  delete process.env.FORCE_AUTONOMOUS_RECOMMEND_ONLY;
  delete process.env.AUTONOMOUS_EMERGENCY_SHUTDOWN;
  delete process.env.ENABLE_APPROVAL_EXPIRATION_WORKER;
  delete process.env.ENABLE_ACTION_ROLLBACK;
});

describe("approval SLA and escalation", () => {
  it("classifies expired and warning approval SLA states", () => {
    expect(
      classifyApprovalSLA({
        requestedAt: new Date(Date.now() - 8 * 24 * 60 * 60_000),
        expiresAt: new Date(Date.now() - 1000),
        riskLevel: "medium",
      }).status
    ).toBe("expired");
    expect(
      classifyApprovalSLA({
        requestedAt: new Date(Date.now() - 5 * 24 * 60 * 60_000),
        expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60_000),
        riskLevel: "medium",
      }).status
    ).toBe("warning");
  });

  it("escalates a pending approval and records governance traces", async () => {
    mockPrisma.approvalRequest.findUnique.mockResolvedValueOnce(approval());
    mockPrisma.approvalRequest.update.mockResolvedValueOnce(approval({ approverRole: "ADMIN" }));
    const { escalateApproval } = await import("@/lib/autonomous/actions/escalationService");
    const result: any = await escalateApproval({ approvalRequestId: "approval-1", actorId: "admin-1", reason: "sla_breached" });
    expect(result.approverRole).toBe("ADMIN");
    expect(mockRecordWorkflowCheckpoint).toHaveBeenCalledWith(expect.objectContaining({ checkpointKey: "approval_escalated" }));
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "approval.escalated" }));
  });

  it("stale approval worker is disabled unless its flag is enabled", async () => {
    const { processStaleApprovals } = await import("@/lib/autonomous/actions/staleApprovalWorker");
    await expect(processStaleApprovals()).resolves.toMatchObject({ enabled: false, expired: 0 });
  });
});

describe("execution hardening guards", () => {
  it("blocks execution when quotas are exhausted", async () => {
    process.env.ENABLE_LOW_RISK_AUTONOMY = "true";
    process.env.LOW_RISK_AUTONOMY_GLOBAL_HOURLY_LIMIT = "1";
    mockPrisma.actionExecution.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    const { evaluateExecutionQuota } = await import("@/lib/autonomous/actions/executionQuotaService");
    await expect(evaluateExecutionQuota({ actionType: "teacher_support", schoolId: "school-1" })).resolves.toMatchObject({
      allowed: false,
      reason: "global_quota_exceeded",
    });
  });

  it("opens the circuit breaker during emergency shutdown", async () => {
    process.env.AUTONOMOUS_EMERGENCY_SHUTDOWN = "true";
    const { evaluateExecutionCircuit } = await import("@/lib/autonomous/actions/executionCircuitBreaker");
    await expect(evaluateExecutionCircuit({ actionType: "teacher_support", schoolId: "school-1" })).resolves.toMatchObject({
      allowed: false,
      reason: "emergency_shutdown",
    });
  });

  it("reports saturated worker health from active execution counts", async () => {
    process.env.AUTONOMOUS_ACTIVE_EXECUTION_LIMIT = "1";
    mockPrisma.actionExecution.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    const { evaluateExecutionHealth } = await import("@/lib/autonomous/actions/executionHealthService");
    await expect(evaluateExecutionHealth({ schoolId: "school-1" })).resolves.toMatchObject({
      allowed: false,
      reason: "worker_saturated",
    });
  });

  it("prevents rollback when rollback support is disabled", async () => {
    mockPrisma.actionExecution.findUnique.mockResolvedValueOnce(action());
    const { rollbackActionExecution } = await import("@/lib/autonomous/actions/rollbackEnforcementService");
    await expect(rollbackActionExecution({ actionExecutionId: "action-1", actorId: "admin-1" })).rejects.toMatchObject({
      code: "rollback_disabled",
    });
  });

  it("keeps low-risk pilots draft-only when the execution kill switch is active", async () => {
    process.env.ENABLE_LOW_RISK_AUTONOMY = "true";
    process.env.ENABLE_ACTION_EXECUTION = "true";
    process.env.FORCE_AUTONOMOUS_RECOMMEND_ONLY = "false";
    process.env.AUTONOMOUS_EMERGENCY_SHUTDOWN = "true";
    const { executeLowRiskPreparedAction } = await import("@/lib/autonomous/actions/actionExecutor");
    const result = await executeLowRiskPreparedAction({
      actionExecution: action(),
      actor: adminUser,
      policy: {
        actionType: "teacher_support",
        riskLevel: "low",
        approvalRequired: false,
        executionAllowed: true,
        draftOnly: false,
        aggregateSafe: true,
        requiredApproverRole: "ADMIN",
        reason: "test",
      },
    });
    expect(result.status).toBe("APPROVED");
    expect(result.outputRefs?.executionSkipped).toBe("emergency_shutdown");
  });

  it("executes an internal teacher support summary when all low-risk guards pass", async () => {
    process.env.ENABLE_LOW_RISK_AUTONOMY = "true";
    process.env.ENABLE_ACTION_EXECUTION = "true";
    process.env.FORCE_AUTONOMOUS_RECOMMEND_ONLY = "false";
    mockPrisma.actionExecution.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    const { executeLowRiskPreparedAction } = await import("@/lib/autonomous/actions/actionExecutor");
    const result = await executeLowRiskPreparedAction({
      actionExecution: action(),
      actor: adminUser,
      policy: {
        actionType: "teacher_support",
        riskLevel: "low",
        approvalRequired: false,
        executionAllowed: true,
        draftOnly: false,
        aggregateSafe: true,
        requiredApproverRole: "ADMIN",
        reason: "test",
      },
    });
    expect(result.status).toBe("EXECUTED");
    expect(result.outputRefs?.artifactType).toBe("teacher_support_summary");
    expect(result.outputRefs?.lowRiskPilot).toBe(true);
  });
});
