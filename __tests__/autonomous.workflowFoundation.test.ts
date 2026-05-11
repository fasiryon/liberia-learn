import { beforeEach, describe, expect, it, vi } from "vitest";

const mockWorkflowRun = {
  count: vi.fn(),
  create: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
};
const mockWorkflowCheckpoint = {
  count: vi.fn(),
  upsert: vi.fn(),
  findMany: vi.fn(),
};
const mockWorkflowStep = { findMany: vi.fn() };
const mockAgentDecision = { findMany: vi.fn() };
const mockActionExecution = { findMany: vi.fn() };
const mockApprovalRequest = {
  upsert: vi.fn(),
  findMany: vi.fn(),
};
const mockExecutionTrace = {
  create: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
};
const mockLogLearningEvent = vi.fn();
const mockLogAudit = vi.fn();
const mockEnqueueJob = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    workflowRun: mockWorkflowRun,
    workflowCheckpoint: mockWorkflowCheckpoint,
    workflowStep: mockWorkflowStep,
    agentDecision: mockAgentDecision,
    actionExecution: mockActionExecution,
    approvalRequest: mockApprovalRequest,
    executionTrace: mockExecutionTrace,
  },
}));

vi.mock("@/lib/events/logLearningEvent", () => ({
  logLearningEvent: mockLogLearningEvent,
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
}));

vi.mock("@/lib/db/writeThrottle", () => ({
  withDbWriteThrottle: (_name: string, write: () => Promise<unknown>) => write(),
}));

vi.mock("@/lib/queue", () => ({
  JobType: { AUTONOMOUS_WORKFLOW_RUN: "autonomous.workflow.run" },
  enqueueJob: mockEnqueueJob,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockWorkflowRun.count.mockResolvedValue(0);
  mockWorkflowCheckpoint.count.mockResolvedValue(0);
  mockWorkflowCheckpoint.upsert.mockImplementation(async ({ create }) => ({
    id: "checkpoint-1",
    ...create,
  }));
  mockWorkflowRun.update.mockImplementation(async ({ where, data }) => ({
    id: where.id,
    workflowType: "risk.scan",
    schoolId: "school-1",
    traceId: "trace-1",
    correlationId: "corr-1",
    partitionKey: "school:school-1",
    ...data,
  }));
  mockLogLearningEvent.mockResolvedValue({ id: "event-1" });
  mockLogAudit.mockResolvedValue(undefined);
});

describe("autonomous workflow foundation", () => {
  it("creates a tenant-partitioned workflow with correlation, checkpoint, audit, and learning event", async () => {
    mockWorkflowRun.findUnique.mockResolvedValueOnce(null);
    mockWorkflowRun.create.mockImplementation(async ({ data }) => ({
      id: "wf-1",
      ...data,
    }));

    const { createWorkflowRun } = await import("@/lib/autonomous/workflowStateManager");
    const result = await createWorkflowRun({
      workflowType: "risk.scan",
      schoolId: "school-1",
      targetType: "student",
      targetId: "student-1",
      triggerEventId: "evt-1",
      riskLevel: "medium",
      approvalRequired: true,
      traceId: "trace-1",
      correlationId: "corr-1",
      evidenceRefs: { eventIds: ["evt-1"] },
    });

    expect(result.created).toBe(true);
    expect(mockWorkflowRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workflowType: "risk.scan",
          schoolId: "school-1",
          partitionKey: "school:school-1",
          status: "waiting_for_approval",
          traceId: "trace-1",
          correlationId: "corr-1",
          triggerEventId: "evt-1",
        }),
      })
    );
    expect(mockWorkflowCheckpoint.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ checkpointKey: "trigger_received" }),
      })
    );
    expect(mockLogLearningEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowRunId: "wf-1",
        workflowTraceId: "trace-1",
        correlationId: "corr-1",
        eventType: "workflow.started",
      })
    );
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "workflow.started",
        resourceType: "WorkflowRun",
        resourceId: "wf-1",
      })
    );
  });

  it("uses idempotency to return an existing workflow instead of duplicating state", async () => {
    mockWorkflowRun.findUnique.mockResolvedValueOnce({ id: "wf-existing", idempotencyKey: "idem-1" });

    const { createWorkflowRun } = await import("@/lib/autonomous/workflowStateManager");
    const result = await createWorkflowRun({
      workflowType: "risk.scan",
      schoolId: "school-1",
      idempotencyKey: "idem-1",
    });

    expect(result).toEqual({
      workflowRun: { id: "wf-existing", idempotencyKey: "idem-1" },
      created: false,
    });
    expect(mockWorkflowRun.create).not.toHaveBeenCalled();
  });

  it("blocks concurrent active workflows for the same tenant partition and target", async () => {
    mockWorkflowRun.findUnique.mockResolvedValueOnce(null);
    mockWorkflowRun.count.mockResolvedValueOnce(1);

    const { createWorkflowRun } = await import("@/lib/autonomous/workflowStateManager");

    await expect(
      createWorkflowRun({
        workflowType: "risk.scan",
        schoolId: "school-1",
        targetType: "student",
        targetId: "student-1",
      })
    ).rejects.toMatchObject({ code: "workflow_concurrency_conflict" });
  });

  it("records checkpoints idempotently and advances current checkpoint", async () => {
    const { recordWorkflowCheckpoint } = await import("@/lib/autonomous/workflowStateManager");

    await recordWorkflowCheckpoint({
      workflowRunId: "wf-1",
      checkpointKey: "evidence_loaded",
      traceId: "trace-1",
      idempotencyKey: "wf-1:evidence_loaded",
    });

    expect(mockWorkflowCheckpoint.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { idempotencyKey: "wf-1:evidence_loaded" },
        update: {},
        create: expect.objectContaining({
          workflowRunId: "wf-1",
          checkpointKey: "evidence_loaded",
          sequence: 1,
        }),
      })
    );
    expect(mockWorkflowRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "wf-1" },
        data: expect.objectContaining({ currentCheckpoint: "evidence_loaded" }),
      })
    );
  });

  it("protects worker concurrency with a workflow lock", async () => {
    mockWorkflowRun.updateMany.mockResolvedValueOnce({ count: 0 });

    const { acquireWorkflowRun } = await import("@/lib/autonomous/workflowStateManager");

    await expect(acquireWorkflowRun({ workflowRunId: "wf-1", workerId: "worker-a" })).rejects.toMatchObject({
      code: "workflow_lock_unavailable",
    });
  });

  it("moves workflows into approval wait state with an approval request", async () => {
    mockWorkflowRun.findUnique.mockResolvedValueOnce({
      id: "wf-1",
      tenantId: "tenant-1",
      schoolId: "school-1",
      districtId: null,
      traceId: "trace-1",
    });
    mockApprovalRequest.upsert.mockImplementation(async ({ create }) => ({
      id: "approval-1",
      ...create,
    }));

    const { createApprovalRequest } = await import("@/lib/autonomous/workflowStateManager");
    const approval = await createApprovalRequest({
      workflowRunId: "wf-1",
      approvalType: "teacher_intervention",
      riskLevel: "medium",
      approverRole: "TEACHER",
    }) as any;

    expect(approval.id).toBe("approval-1");
    expect(mockWorkflowRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "waiting_for_approval",
          approvalRequired: true,
          approvalRequestId: "approval-1",
        }),
      })
    );
  });

  it("keeps replay analysis side-effect safe by default", async () => {
    mockWorkflowRun.findUnique.mockResolvedValueOnce({
      id: "wf-1",
      workflowType: "risk.scan",
      tenantId: null,
      schoolId: "school-1",
      districtId: null,
      targetType: "student",
      targetId: "student-1",
      triggerEventId: "evt-1",
      riskLevel: "medium",
      replaySequence: 0,
    });
    mockWorkflowCheckpoint.findMany.mockResolvedValueOnce([{ id: "cp-1" }]);
    mockWorkflowStep.findMany.mockResolvedValueOnce([]);
    mockAgentDecision.findMany.mockResolvedValueOnce([]);
    mockActionExecution.findMany.mockResolvedValueOnce([{ id: "action-1", status: "succeeded" }]);

    const { getWorkflowReplayPlan, createReplayWorkflowRun } = await import("@/lib/autonomous/workflowReplayService");
    const plan = await getWorkflowReplayPlan("wf-1");

    expect(plan.replaySafe).toBe(false);
    mockWorkflowRun.findUnique.mockResolvedValueOnce({
      id: "wf-1",
      workflowType: "risk.scan",
      tenantId: null,
      schoolId: "school-1",
      districtId: null,
      targetType: "student",
      targetId: "student-1",
      triggerEventId: "evt-1",
      riskLevel: "medium",
      replaySequence: 0,
    });
    mockWorkflowCheckpoint.findMany.mockResolvedValueOnce([{ id: "cp-1" }]);
    mockWorkflowStep.findMany.mockResolvedValueOnce([]);
    mockAgentDecision.findMany.mockResolvedValueOnce([]);
    mockActionExecution.findMany.mockResolvedValueOnce([{ id: "action-1", status: "succeeded" }]);
    await expect(
      createReplayWorkflowRun({ workflowRunId: "wf-1", replayMode: "approved_action_replay" })
    ).rejects.toMatchObject({ code: "workflow_replay_side_effect_guard" });
  });

  it("enqueues workflow execution through the existing queue contract", async () => {
    const { enqueueWorkflowRun } = await import("@/lib/autonomous/workflowOrchestrator");

    await enqueueWorkflowRun({
      id: "wf-1",
      workflowType: "risk.scan",
      partitionKey: "school:school-1",
      idempotencyKey: "idem-1",
      attempt: 0,
    });

    expect(mockEnqueueJob).toHaveBeenCalledWith(
      "autonomous.workflow.run",
      expect.objectContaining({ workflowRunId: "wf-1" }),
      expect.objectContaining({
        messageGroupId: "school:school-1:risk.scan",
        messageDeduplicationId: expect.any(String),
      })
    );
  });
});
