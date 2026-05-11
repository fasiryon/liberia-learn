import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyActionRisk } from "@/lib/autonomous/actions/actionRiskClassifier";
import { evaluateActionPolicy } from "@/lib/autonomous/actions/actionPolicyEngine";
import { buildActionIdempotencyKey } from "@/lib/autonomous/actions/actionIdempotencyService";

const mockPrisma = vi.hoisted(() => ({
  agentDecision: { findUnique: vi.fn() },
  workflowRun: { findUnique: vi.fn(), update: vi.fn() },
  actionExecution: { upsert: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
  approvalRequest: { upsert: vi.fn(), findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  interventionRecommendation: { upsert: vi.fn() },
  curriculumFlag: { upsert: vi.fn() },
}));
const mockRecordActionTrace = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockLogLearningEvent = vi.hoisted(() => vi.fn());
const mockRecordWorkflowCheckpoint = vi.hoisted(() => vi.fn());
const mockTransitionWorkflowStatus = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/db/writeThrottle", () => ({ withDbWriteThrottle: (_name: string, fn: () => unknown) => fn() }));
vi.mock("@/lib/autonomous/actions/actionTraceService", () => ({ recordActionTrace: mockRecordActionTrace }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/events/logLearningEvent", () => ({ logLearningEvent: mockLogLearningEvent }));
vi.mock("@/lib/autonomous/workflowStateManager", () => ({
  recordWorkflowCheckpoint: mockRecordWorkflowCheckpoint,
  transitionWorkflowStatus: mockTransitionWorkflowStatus,
}));

const adminUser = { id: "admin-1", role: "ADMIN", schoolId: "school-1", isPlatformAdmin: false } as any;
const teacherUser = { id: "teacher-1", role: "TEACHER", schoolId: "school-1", isPlatformAdmin: false } as any;
const moeUser = { id: "moe-1", role: "MOE_OFFICIAL", schoolId: null, isPlatformAdmin: false } as any;
const platformUser = { id: "platform-1", role: "ADMIN", schoolId: null, isPlatformAdmin: true } as any;

function decision(overrides: Record<string, unknown> = {}) {
  return {
    id: "decision-1",
    workflowRunId: "wf-1",
    decisionType: "detector.recommendation.student-risk",
    riskLevel: "medium",
    traceId: "trace-1",
    evidenceRefs: { refs: [{ type: "MasterySnapshot", id: "ms-1", schoolId: "school-1" }] },
    decision: { targetType: "student", targetId: "student-1", detectorId: "student-risk", title: "Review risk" },
    ...overrides,
  };
}

function workflow(overrides: Record<string, unknown> = {}) {
  return {
    id: "wf-1",
    tenantId: "school-1",
    schoolId: "school-1",
    districtId: null,
    traceId: "trace-1",
    targetType: "student",
    targetId: "student-1",
    ...overrides,
  };
}

function action(overrides: Record<string, unknown> = {}) {
  return {
    id: "action-1",
    workflowRunId: "wf-1",
    agentDecisionId: "decision-1",
    approvalRequestId: "approval-1",
    actionType: "student_intervention",
    status: "WAITING_APPROVAL",
    riskLevel: "medium",
    schoolId: "school-1",
    targetType: "student",
    targetId: "student-1",
    traceId: "trace-1",
    executionMetadata: {},
    ...overrides,
  };
}

function approval(overrides: Record<string, unknown> = {}) {
  return {
    id: "approval-1",
    workflowRunId: "wf-1",
    actionExecutionId: "action-1",
    status: "PENDING",
    riskLevel: "medium",
    approvalType: "action.student_intervention",
    schoolId: "school-1",
    districtId: null,
    approverRole: "TEACHER",
    requestedById: "admin-1",
    traceId: "trace-1",
    expiresAt: new Date(Date.now() + 86_400_000),
    ...overrides,
  };
}

afterEach(() => {
  vi.resetAllMocks();
  delete process.env.ENABLE_ACTION_GOVERNANCE;
  delete process.env.ENABLE_ACTION_EXECUTION;
  delete process.env.FORCE_AUTONOMOUS_RECOMMEND_ONLY;
});

describe("action policy and risk classification", () => {
  it("classifies guardian communication as high risk and draft-only", () => {
    expect(classifyActionRisk({ actionType: "guardian_communication", sourceRisk: "medium", targetType: "student" })).toBe("high");
    const policy = evaluateActionPolicy({ actionType: "guardian_communication", targetType: "student", schoolId: "school-1" });
    expect(policy.approvalRequired).toBe(true);
    expect(policy.draftOnly).toBe(true);
    expect(policy.requiredApproverRole).toBe("ADMIN");
  });

  it("blocks MOE governance when aggregate scope is unsafe", () => {
    const policy = evaluateActionPolicy({ actionType: "moe_governance", targetType: "student", schoolId: "school-1" });
    expect(policy.aggregateSafe).toBe(false);
    expect(policy.executionAllowed).toBe(false);
    expect(policy.riskLevel).toBe("critical");
  });

  it("allows aggregate-only national trend review with governance approval", () => {
    const policy = evaluateActionPolicy({ actionType: "national_trend", targetType: "national_aggregate", schoolId: null });
    expect(policy.aggregateSafe).toBe(true);
    expect(policy.requiredApproverRole).toBe("MOE_OFFICIAL");
    expect(policy.approvalRequired).toBe(true);
  });

  it("builds stable action idempotency keys", () => {
    const a = buildActionIdempotencyKey({ agentDecisionId: "d1", actionType: "student_intervention", schoolId: "s1", targetType: "student", targetId: "st1" });
    const b = buildActionIdempotencyKey({ agentDecisionId: "d1", actionType: "student_intervention", schoolId: "s1", targetType: "student", targetId: "st1" });
    expect(a).toBe(b);
  });
});

describe("recommendation-to-action preparation", () => {
  it("fails closed when action governance is disabled", async () => {
    const { prepareActionFromRecommendation } = await import("@/lib/autonomous/actions/actionExecutor");
    await expect(prepareActionFromRecommendation({ agentDecisionId: "decision-1", requestedBy: adminUser })).rejects.toMatchObject({
      code: "action_governance_disabled",
    });
  });

  it("creates an approval-gated action from a detector recommendation", async () => {
    process.env.ENABLE_ACTION_GOVERNANCE = "true";
    mockPrisma.agentDecision.findUnique.mockResolvedValueOnce(decision());
    mockPrisma.workflowRun.findUnique.mockResolvedValueOnce(workflow());
    mockPrisma.actionExecution.upsert.mockResolvedValueOnce(action({ approvalRequestId: null }));
    mockPrisma.approvalRequest.upsert.mockResolvedValueOnce(approval());
    mockPrisma.actionExecution.update.mockResolvedValueOnce(action());
    mockPrisma.workflowRun.update.mockResolvedValueOnce({ id: "wf-1" });
    const { prepareActionFromRecommendation } = await import("@/lib/autonomous/actions/actionExecutor");

    const result = await prepareActionFromRecommendation({ agentDecisionId: "decision-1", requestedBy: adminUser });

    expect(result.policy.approvalRequired).toBe(true);
    expect(mockPrisma.actionExecution.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          actionType: "student_intervention",
          status: "WAITING_APPROVAL",
          riskLevel: "medium",
        }),
      })
    );
    expect(mockPrisma.approvalRequest.upsert).toHaveBeenCalled();
    expect(mockRecordActionTrace).toHaveBeenCalledWith(expect.objectContaining({ status: "WAITING_APPROVAL" }));
  });

  it("enforces tenant isolation during action preparation", async () => {
    process.env.ENABLE_ACTION_GOVERNANCE = "true";
    mockPrisma.agentDecision.findUnique.mockResolvedValueOnce(decision());
    mockPrisma.workflowRun.findUnique.mockResolvedValueOnce(workflow({ schoolId: "school-2" }));
    const { prepareActionFromRecommendation } = await import("@/lib/autonomous/actions/actionExecutor");
    await expect(prepareActionFromRecommendation({ agentDecisionId: "decision-1", requestedBy: adminUser })).rejects.toMatchObject({
      code: "action_tenant_scope_denied",
    });
  });
});

describe("approval decisions", () => {
  it("enforces approver role and tenant scope", async () => {
    mockPrisma.approvalRequest.findUnique.mockResolvedValueOnce(approval({ schoolId: "school-2" }));
    mockPrisma.actionExecution.findUnique.mockResolvedValueOnce(action({ schoolId: "school-2" }));
    mockPrisma.agentDecision.findUnique.mockResolvedValueOnce(decision());
    const { approveAction } = await import("@/lib/autonomous/actions/approvalDecisionService");
    await expect(approveAction({ approvalRequestId: "approval-1", decidedBy: teacherUser })).rejects.toMatchObject({ status: 403 });
  });

  it("approves but keeps execution draft-only when recommend-only mode is active", async () => {
    process.env.FORCE_AUTONOMOUS_RECOMMEND_ONLY = "true";
    mockPrisma.approvalRequest.findUnique.mockResolvedValueOnce(approval());
    mockPrisma.actionExecution.findUnique.mockResolvedValueOnce(action());
    mockPrisma.agentDecision.findUnique.mockResolvedValueOnce(decision());
    mockPrisma.approvalRequest.update.mockResolvedValueOnce(approval({ status: "APPROVED" }));
    mockPrisma.actionExecution.update
      .mockResolvedValueOnce(action({ status: "APPROVED" }))
      .mockResolvedValueOnce(action({ status: "APPROVED", outputRefs: { draftOnly: true } }));
    const { approveAction } = await import("@/lib/autonomous/actions/approvalDecisionService");
    const result = await approveAction({ approvalRequestId: "approval-1", decidedBy: teacherUser, comment: "Approved for follow-up" });

    expect(result.status).toBe("APPROVED");
    expect(mockLogLearningEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "action.approved" }));
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "approval.approved" }));
  });

  it("rejects a pending approval and updates the action", async () => {
    mockPrisma.approvalRequest.findUnique.mockResolvedValueOnce(approval());
    mockPrisma.actionExecution.findUnique.mockResolvedValueOnce(action());
    mockPrisma.approvalRequest.update.mockResolvedValueOnce(approval({ status: "REJECTED" }));
    mockPrisma.actionExecution.update.mockResolvedValueOnce(action({ status: "REJECTED" }));
    const { rejectAction } = await import("@/lib/autonomous/actions/approvalDecisionService");
    const result = await rejectAction({ approvalRequestId: "approval-1", decidedBy: teacherUser, comment: "Needs more evidence" });
    expect(result.status).toBe("REJECTED");
    expect(mockRecordActionTrace).toHaveBeenCalledWith(expect.objectContaining({ status: "REJECTED" }));
  });

  it("cancels an approval by requester or platform admin", async () => {
    mockPrisma.approvalRequest.findUnique.mockResolvedValueOnce(approval());
    mockPrisma.actionExecution.findUnique.mockResolvedValueOnce(action());
    mockPrisma.approvalRequest.update.mockResolvedValueOnce(approval({ status: "CANCELLED" }));
    mockPrisma.actionExecution.update.mockResolvedValueOnce(action({ status: "CANCELLED" }));
    const { cancelActionApproval } = await import("@/lib/autonomous/actions/approvalDecisionService");
    const result = await cancelActionApproval({ approvalRequestId: "approval-1", decidedBy: adminUser, comment: "Superseded" });
    expect(result.status).toBe("CANCELLED");
  });

  it("allows MOE aggregate approval but not school-scoped PII approval", async () => {
    mockPrisma.approvalRequest.findUnique.mockResolvedValueOnce(approval({ schoolId: null, approverRole: "MOE_OFFICIAL", riskLevel: "high" }));
    mockPrisma.actionExecution.findUnique.mockResolvedValueOnce(action({ actionType: "national_trend", schoolId: null, targetType: "national_aggregate", targetId: "national" }));
    mockPrisma.agentDecision.findUnique.mockResolvedValueOnce(decision({ decisionType: "detector.recommendation.national-trend", decision: { targetType: "national_aggregate", targetId: "national" } }));
    mockPrisma.approvalRequest.update.mockResolvedValueOnce(approval({ status: "APPROVED" }));
    mockPrisma.actionExecution.update
      .mockResolvedValueOnce(action({ actionType: "national_trend", schoolId: null, targetType: "national_aggregate", status: "APPROVED" }))
      .mockResolvedValueOnce(action({ actionType: "national_trend", schoolId: null, targetType: "national_aggregate", status: "APPROVED" }));
    const { approveAction } = await import("@/lib/autonomous/actions/approvalDecisionService");
    const result = await approveAction({ approvalRequestId: "approval-1", decidedBy: moeUser });
    expect(result.status).toBe("APPROVED");

    mockPrisma.approvalRequest.findUnique.mockResolvedValueOnce(approval({ schoolId: "school-1", approverRole: "MOE_OFFICIAL", riskLevel: "high" }));
    mockPrisma.actionExecution.findUnique.mockResolvedValueOnce(action({ actionType: "moe_governance", targetType: "student", schoolId: "school-1" }));
    mockPrisma.agentDecision.findUnique.mockResolvedValueOnce(decision({ decisionType: "detector.recommendation.moe-governance", decision: { targetType: "student", targetId: "student-1" } }));
    await expect(approveAction({ approvalRequestId: "approval-1", decidedBy: platformUser })).rejects.toMatchObject({ status: 403 });
  });
});
