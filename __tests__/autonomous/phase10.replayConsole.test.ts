import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
const mockWorkflowRun = {
  id: "wf-run-1",
  workflowType: "LESSON_QUALITY_IMPROVEMENT",
  status: "dead_lettered",
  source: "system.detector",
  riskLevel: "low",
  attempt: 3,
  maxAttempts: 3,
  partitionKey: "school-abc",
  traceId: "trace-1",
  correlationId: "corr-1",
  isReplay: false,
  replayOfRunId: null,
  replayMode: null,
  lastErrorCode: "workflow_timeout",
  lastErrorMessage: "Timed out after 45 minutes",
  deadLetteredAt: new Date("2026-05-12T08:00:00Z"),
  createdAt: new Date("2026-05-12T07:00:00Z"),
  updatedAt: new Date("2026-05-12T08:00:00Z"),
  schoolId: "school-abc",
  tenantId: "tenant-xyz",
  executionMetadata: {},
};

const mockNote = {
  id: "note-1",
  workflowRunId: "wf-run-1",
  noteType: "INVESTIGATION",
  severity: "HIGH",
  status: "OPEN",
  body: "Timeout appears transient, SQS consumer was overloaded.",
  createdByUserId: "admin-user-1",
  schoolId: null,
  tenantId: null,
  resolvedAt: null,
  createdAt: new Date("2026-05-12T09:00:00Z"),
  updatedAt: new Date("2026-05-12T09:00:00Z"),
};

const mockPrisma = vi.hoisted(() => ({
  workflowRun: {
    findUnique: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
  },
  workflowStep: { findMany: vi.fn().mockResolvedValue([]) },
  workflowCheckpoint: { findMany: vi.fn().mockResolvedValue([]) },
  agentDecision: { findMany: vi.fn().mockResolvedValue([]) },
  actionExecution: { findMany: vi.fn().mockResolvedValue([]) },
  approvalRequest: { findMany: vi.fn().mockResolvedValue([]) },
  executionTrace: {
    create: vi.fn().mockResolvedValue({ id: "trace-id-1" }),
    findUnique: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue({}),
  },
  operatorIncidentNote: {
    create: vi.fn().mockResolvedValue({}),
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
  auditLog: {
    create: vi.fn().mockResolvedValue({}),
    findMany: vi.fn().mockResolvedValue([]),
  },
}));

const mockLogAudit = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockGetReplayPlan = vi.hoisted(() => vi.fn());
const mockCreateReplayRun = vi.hoisted(() => vi.fn());
const mockStartTrace = vi.hoisted(() => vi.fn().mockResolvedValue({ id: "trace-id-1" }));
const mockFinishTrace = vi.hoisted(() => vi.fn().mockResolvedValue({}));
const mockWriteThrottle = vi.hoisted(() =>
  vi.fn().mockImplementation((_key: string, fn: () => unknown) => fn())
);

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/autonomous/workflowReplayService", () => ({
  getWorkflowReplayPlan: mockGetReplayPlan,
  createReplayWorkflowRun: mockCreateReplayRun,
}));
vi.mock("@/lib/autonomous/executionTraceService", () => ({
  startExecutionTrace: mockStartTrace,
  finishExecutionTrace: mockFinishTrace,
}));
vi.mock("@/lib/db/writeThrottle", () => ({
  withDbWriteThrottle: mockWriteThrottle,
}));

// ─── workflowExecutionGraphService ───────────────────────────────────────────

describe("workflowExecutionGraphService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun);
    mockPrisma.workflowStep.findMany.mockResolvedValue([
      { id: "step-1", stepType: "detector", stepKey: "quality_check", status: "failed", sequence: 1, createdAt: new Date(), startedAt: new Date(), durationMs: 500, errorCode: null },
    ]);
    mockPrisma.workflowCheckpoint.findMany.mockResolvedValue([
      { id: "cp-1", checkpointKey: "before_analysis", sequence: 1, createdAt: new Date() },
    ]);
    mockPrisma.agentDecision.findMany.mockResolvedValue([
      { id: "dec-1", decisionType: "ROUTE", outcome: "proceed", confidence: 0.9, rationale: null, createdAt: new Date() },
    ]);
    mockPrisma.actionExecution.findMany.mockResolvedValue([]);
    mockPrisma.approvalRequest.findMany.mockResolvedValue([]);
  });

  it("returns correct node count including trigger + workflow + steps + checkpoints + decisions + dead_letter", async () => {
    const { getWorkflowExecutionGraph } = await import(
      "@/lib/autonomous/workflowExecutionGraphService"
    );
    const graph = await getWorkflowExecutionGraph("wf-run-1");
    // trigger(1) + workflow(1) + step(1) + checkpoint(1) + decision(1) + dead_letter(1) = 6
    expect(graph.nodeCount).toBe(6);
  });

  it("marks workflow as replaySafe when no actions succeeded", async () => {
    const { getWorkflowExecutionGraph } = await import(
      "@/lib/autonomous/workflowExecutionGraphService"
    );
    const graph = await getWorkflowExecutionGraph("wf-run-1");
    expect(graph.replaySafe).toBe(true);
  });

  it("marks workflow as NOT replaySafe when an action succeeded", async () => {
    mockPrisma.actionExecution.findMany.mockResolvedValue([
      { id: "act-1", actionType: "ASSIGN_REVIEW", status: "succeeded", riskLevel: "low", requiresApproval: false, createdAt: new Date() },
    ]);
    const { getWorkflowExecutionGraph } = await import(
      "@/lib/autonomous/workflowExecutionGraphService"
    );
    vi.resetModules();
    const mod = await import("@/lib/autonomous/workflowExecutionGraphService");
    const graph = await mod.getWorkflowExecutionGraph("wf-run-1");
    expect(graph.replaySafe).toBe(false);
  });

  it("throws 404 when workflow run not found", async () => {
    mockPrisma.workflowRun.findUnique.mockResolvedValue(null);
    vi.resetModules();
    const { getWorkflowExecutionGraph } = await import(
      "@/lib/autonomous/workflowExecutionGraphService"
    );
    await expect(getWorkflowExecutionGraph("missing-id")).rejects.toMatchObject({ status: 404 });
  });

  it("does not include dead_letter node for non-dead-lettered workflow", async () => {
    mockPrisma.workflowRun.findUnique.mockResolvedValue({
      ...mockWorkflowRun,
      status: "succeeded",
    });
    vi.resetModules();
    const { getWorkflowExecutionGraph } = await import(
      "@/lib/autonomous/workflowExecutionGraphService"
    );
    const graph = await getWorkflowExecutionGraph("wf-run-1");
    const dlNodes = graph.nodes.filter((n) => n.type === "dead_letter");
    expect(dlNodes).toHaveLength(0);
  });
});

// ─── incidentTimelineService ──────────────────────────────────────────────────

describe("incidentTimelineService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun);
    mockPrisma.executionTrace.findMany.mockResolvedValue([
      {
        id: "tr-1",
        traceId: "trace-uuid-1",
        spanType: "detector",
        spanName: "quality_check",
        status: "failed",
        errorMessage: "quality check failed",
        errorCode: "quality_check_failed",
        durationMs: 1200,
        startedAt: new Date("2026-05-12T07:10:00Z"),
      },
    ]);
    mockPrisma.approvalRequest.findMany.mockResolvedValue([]);
    mockPrisma.actionExecution.findMany.mockResolvedValue([]);
    mockPrisma.agentDecision.findMany.mockResolvedValue([]);
    mockPrisma.auditLog.findMany.mockResolvedValue([
      {
        id: "audit-1",
        action: "cron.autonomous.workflow-recovery.run",
        userId: null,
        targetType: null,
        targetId: null,
        detail: "recovered 1 workflows",
        timestamp: new Date("2026-05-12T07:30:00Z"),
        createdAt: new Date("2026-05-12T07:30:00Z"),
      },
    ]);
    mockPrisma.operatorIncidentNote.findMany.mockResolvedValue([mockNote]);
  });

  it("merges trace spans, audit events, and operator notes into sorted timeline", async () => {
    const { getIncidentTimeline } = await import(
      "@/lib/autonomous/incidentTimelineService"
    );
    const timeline = await getIncidentTimeline("wf-run-1");
    expect(timeline.entries.length).toBeGreaterThanOrEqual(4); // created + trace + audit + note
    const types = timeline.entries.map((e) => e.type);
    expect(types).toContain("workflow_created");
    expect(types).toContain("trace_span");
    expect(types).toContain("cron_recovery");
    expect(types).toContain("operator_note");
  });

  it("entries are sorted ascending by timestamp", async () => {
    const { getIncidentTimeline } = await import(
      "@/lib/autonomous/incidentTimelineService"
    );
    const timeline = await getIncidentTimeline("wf-run-1");
    for (let i = 1; i < timeline.entries.length; i++) {
      expect(new Date(timeline.entries[i].timestamp).getTime()).toBeGreaterThanOrEqual(
        new Date(timeline.entries[i - 1].timestamp).getTime()
      );
    }
  });

  it("classifies failed trace span as error severity", async () => {
    const { getIncidentTimeline } = await import(
      "@/lib/autonomous/incidentTimelineService"
    );
    const timeline = await getIncidentTimeline("wf-run-1");
    const failedTrace = timeline.entries.find((e) => e.type === "trace_span");
    expect(failedTrace?.severity).toBe("error");
  });

  it("throws 404 when workflow run not found", async () => {
    mockPrisma.workflowRun.findUnique.mockResolvedValue(null);
    vi.resetModules();
    const { getIncidentTimeline } = await import(
      "@/lib/autonomous/incidentTimelineService"
    );
    await expect(getIncidentTimeline("missing-id")).rejects.toMatchObject({ status: 404 });
  });
});

// ─── operatorIncidentNoteService ─────────────────────────────────────────────

describe("operatorIncidentNoteService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.operatorIncidentNote.create.mockResolvedValue(mockNote);
    mockPrisma.operatorIncidentNote.findMany.mockResolvedValue([mockNote]);
    mockPrisma.operatorIncidentNote.findUnique.mockResolvedValue(mockNote);
    mockPrisma.operatorIncidentNote.update.mockResolvedValue({
      ...mockNote,
      status: "RESOLVED",
      resolvedAt: new Date(),
    });
    mockPrisma.operatorIncidentNote.delete.mockResolvedValue(mockNote);
  });

  it("creates a note with valid noteType and severity", async () => {
    const { createOperatorNote } = await import(
      "@/lib/autonomous/operatorIncidentNoteService"
    );
    const note = await createOperatorNote({
      workflowRunId: "wf-run-1",
      noteType: "INVESTIGATION",
      severity: "HIGH",
      body: "Initial investigation",
      createdByUserId: "admin-1",
    });
    expect(note.noteType).toBe("INVESTIGATION");
    expect(mockPrisma.operatorIncidentNote.create).toHaveBeenCalledOnce();
  });

  it("rejects invalid noteType with 400", async () => {
    const { createOperatorNote } = await import(
      "@/lib/autonomous/operatorIncidentNoteService"
    );
    await expect(
      createOperatorNote({
        workflowRunId: "wf-run-1",
        noteType: "INVALID_TYPE" as any,
        body: "test",
        createdByUserId: "admin-1",
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  it("lists notes for a workflow run", async () => {
    const { listOperatorNotes } = await import(
      "@/lib/autonomous/operatorIncidentNoteService"
    );
    const notes = await listOperatorNotes("wf-run-1");
    expect(notes).toHaveLength(1);
  });

  it("updates note status to RESOLVED and sets resolvedAt", async () => {
    const { updateOperatorNote } = await import(
      "@/lib/autonomous/operatorIncidentNoteService"
    );
    const updated = await updateOperatorNote("note-1", "admin-1", { status: "RESOLVED" });
    expect(updated.status).toBe("RESOLVED");
    expect(mockPrisma.operatorIncidentNote.update).toHaveBeenCalledOnce();
  });

  it("rejects invalid status with 400", async () => {
    const { updateOperatorNote } = await import(
      "@/lib/autonomous/operatorIncidentNoteService"
    );
    await expect(
      updateOperatorNote("note-1", "admin-1", { status: "INVALID" as any })
    ).rejects.toMatchObject({ status: 400 });
  });

  it("throws 404 on update when note does not exist", async () => {
    mockPrisma.operatorIncidentNote.findUnique.mockResolvedValue(null);
    const { updateOperatorNote } = await import(
      "@/lib/autonomous/operatorIncidentNoteService"
    );
    await expect(
      updateOperatorNote("missing-note", "admin-1", { status: "RESOLVED" })
    ).rejects.toMatchObject({ status: 404 });
  });

  it("deletes an existing note", async () => {
    const { deleteOperatorNote } = await import(
      "@/lib/autonomous/operatorIncidentNoteService"
    );
    await expect(deleteOperatorNote("note-1")).resolves.not.toThrow();
    expect(mockPrisma.operatorIncidentNote.delete).toHaveBeenCalledOnce();
  });
});

// ─── Replay API route: safety gates ──────────────────────────────────────────

describe("replay route safety", () => {
  const safePlan = {
    workflowRun: mockWorkflowRun,
    replaySafe: true,
    sideEffectsBlockedByDefault: true,
    checkpoints: [{ id: "cp-1" }],
    steps: [{ id: "s-1" }],
    decisions: [],
    actions: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetReplayPlan.mockResolvedValue(safePlan);
    mockCreateReplayRun.mockResolvedValue({ id: "new-wf-run-2" });
    mockStartTrace.mockResolvedValue({ id: "trace-id-1" });
    mockFinishTrace.mockResolvedValue({});
  });

  it("dry-run returns plan metadata without mutating state", async () => {
    const { POST } = await import(
      "@/app/api/admin/ops/workflows/[workflowRunId]/replay/route"
    );
    const req = new Request("http://localhost/api/admin/ops/workflows/wf-run-1/replay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dryRun: true, replayMode: "analysis_only" }),
    });
    (req as any).user = { isPlatformAdmin: true, id: "admin-1" };

    vi.doMock("@/lib/auth", () => ({
      requireUser: vi.fn().mockResolvedValue({ isPlatformAdmin: true, id: "admin-1" }),
    }));
    vi.doMock("@/lib/serverFlags", () => ({
      isRuntimeDashboardEnabled: vi.fn().mockReturnValue(true),
    }));

    vi.resetModules();
    const { POST: freshPOST } = await import(
      "@/app/api/admin/ops/workflows/[workflowRunId]/replay/route"
    );
    const freshReq = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dryRun: true, replayMode: "analysis_only" }),
    });
    const res = await freshPOST(freshReq as any, { params: { workflowRunId: "wf-run-1" } });
    const data = await res.json();

    expect(data.dryRun).toBe(true);
    expect(data.replaySafe).toBe(true);
    expect(mockCreateReplayRun).not.toHaveBeenCalled();
  });

  it("live replay without confirm=true returns 409 confirmation_required", async () => {
    vi.doMock("@/lib/auth", () => ({
      requireUser: vi.fn().mockResolvedValue({ isPlatformAdmin: true, id: "admin-1" }),
    }));
    vi.doMock("@/lib/serverFlags", () => ({
      isRuntimeDashboardEnabled: vi.fn().mockReturnValue(true),
    }));

    vi.resetModules();
    const { POST } = await import(
      "@/app/api/admin/ops/workflows/[workflowRunId]/replay/route"
    );
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dryRun: false, confirm: false, replayMode: "analysis_only" }),
    });
    const res = await POST(req as any, { params: { workflowRunId: "wf-run-1" } });
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.code).toBe("confirmation_required");
    expect(mockCreateReplayRun).not.toHaveBeenCalled();
  });

  it("unsafe replay blocked when actions succeeded and mode is not analysis_only", async () => {
    mockGetReplayPlan.mockResolvedValue({ ...safePlan, replaySafe: false });

    vi.doMock("@/lib/auth", () => ({
      requireUser: vi.fn().mockResolvedValue({ isPlatformAdmin: true, id: "admin-1" }),
    }));
    vi.doMock("@/lib/serverFlags", () => ({
      isRuntimeDashboardEnabled: vi.fn().mockReturnValue(true),
    }));

    vi.resetModules();
    const { POST } = await import(
      "@/app/api/admin/ops/workflows/[workflowRunId]/replay/route"
    );
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dryRun: false, confirm: true, replayMode: "approved_action_replay" }),
    });
    const res = await POST(req as any, { params: { workflowRunId: "wf-run-1" } });
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.code).toBe("workflow_replay_side_effect_guard");
    expect(mockCreateReplayRun).not.toHaveBeenCalled();
  });

  it("returns 403 for non-platform-admin", async () => {
    vi.doMock("@/lib/auth", () => ({
      requireUser: vi.fn().mockResolvedValue({ isPlatformAdmin: false, id: "teacher-1", role: "TEACHER" }),
    }));
    vi.doMock("@/lib/serverFlags", () => ({
      isRuntimeDashboardEnabled: vi.fn().mockReturnValue(true),
    }));

    vi.resetModules();
    const { POST } = await import(
      "@/app/api/admin/ops/workflows/[workflowRunId]/replay/route"
    );
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dryRun: true, replayMode: "analysis_only" }),
    });
    const res = await POST(req as any, { params: { workflowRunId: "wf-run-1" } });
    expect(res.status).toBe(403);
  });

  it("returns 403 when ENABLE_RUNTIME_DASHBOARD is false", async () => {
    vi.doMock("@/lib/auth", () => ({
      requireUser: vi.fn().mockResolvedValue({ isPlatformAdmin: true, id: "admin-1" }),
    }));
    vi.doMock("@/lib/serverFlags", () => ({
      isRuntimeDashboardEnabled: vi.fn().mockReturnValue(false),
    }));

    vi.resetModules();
    const { POST } = await import(
      "@/app/api/admin/ops/workflows/[workflowRunId]/replay/route"
    );
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dryRun: true, replayMode: "analysis_only" }),
    });
    const res = await POST(req as any, { params: { workflowRunId: "wf-run-1" } });
    expect(res.status).toBe(403);
  });
});

// ─── notes route: operator auth ──────────────────────────────────────────────

describe("notes route authorization", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET notes returns 403 for non-platform-admin", async () => {
    vi.doMock("@/lib/auth", () => ({
      requireUser: vi.fn().mockResolvedValue({ isPlatformAdmin: false, id: "teacher-1", role: "TEACHER" }),
    }));
    vi.doMock("@/lib/serverFlags", () => ({
      isRuntimeDashboardEnabled: vi.fn().mockReturnValue(true),
    }));

    vi.resetModules();
    const { GET } = await import(
      "@/app/api/admin/ops/workflows/[workflowRunId]/notes/route"
    );
    const req = new Request("http://localhost");
    const res = await GET(req as any, { params: { workflowRunId: "wf-run-1" } });
    expect(res.status).toBe(403);
  });

  it("POST note with invalid noteType returns 400", async () => {
    vi.doMock("@/lib/auth", () => ({
      requireUser: vi.fn().mockResolvedValue({ isPlatformAdmin: true, id: "admin-1" }),
    }));
    vi.doMock("@/lib/serverFlags", () => ({
      isRuntimeDashboardEnabled: vi.fn().mockReturnValue(true),
    }));

    vi.resetModules();
    const { POST } = await import(
      "@/app/api/admin/ops/workflows/[workflowRunId]/notes/route"
    );
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ noteType: "BOGUS_TYPE", body: "test" }),
    });
    const res = await POST(req as any, { params: { workflowRunId: "wf-run-1" } });
    expect(res.status).toBe(400);
  });
});
