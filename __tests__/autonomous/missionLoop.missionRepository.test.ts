// __tests__/autonomous/missionLoop.missionRepository.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMission,
  getMissionDetail,
  getPhaseDetail,
  listOpenMissions,
  planPhases,
  recordPhaseDecision,
  transitionPhase,
  updateChecklistItem,
  writeCheckpoint,
} from "@/lib/autonomous/missionLoop/missionRepository";
import { IllegalPhaseTransitionError } from "@/lib/autonomous/missionLoop/phaseStateMachine";

function makeFakeDb() {
  return {
    workflowRun: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    workflowPhase: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    workflowChecklistItem: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    workflowCheckpoint: {
      create: vi.fn(),
      count: vi.fn(),
    },
    agentDecision: {
      create: vi.fn(),
    },
  };
}

type FakeDb = ReturnType<typeof makeFakeDb>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createMission", () => {
  it("creates a WorkflowRun namespaced mission.<slug>", async () => {
    const db = makeFakeDb();
    db.workflowRun.create.mockResolvedValue({ id: "run-1" });
    const result = await createMission(
      { slug: "p7c-remediation", objective: "Finish stashed P7C work" },
      db as unknown as Parameters<typeof createMission>[1],
    );
    expect(result).toEqual({ id: "run-1" });
    expect(db.workflowRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workflowType: "mission.p7c-remediation",
          objective: "Finish stashed P7C work",
        }),
      }),
    );
  });
});

describe("planPhases", () => {
  it("creates phases in order with their checklist items", async () => {
    const db = makeFakeDb();
    db.workflowPhase.create
      .mockResolvedValueOnce({ id: "phase-1" })
      .mockResolvedValueOnce({ id: "phase-2" });
    db.workflowChecklistItem.create.mockResolvedValue({ id: "item-1" });
    const result = await planPhases(
      "run-1",
      [
        {
          sequence: 1,
          title: "Triage",
          objective: "Inventory the stashed work",
          acceptanceCriteria: [],
          checklist: [{ label: "Diff reviewed" }],
        },
        {
          sequence: 2,
          title: "Fix",
          objective: "Apply the fixes",
          acceptanceCriteria: [],
          checklist: [],
        },
      ],
      db as unknown as Parameters<typeof planPhases>[2],
    );
    expect(result.phaseIds).toEqual(["phase-1", "phase-2"]);
    expect(db.workflowChecklistItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ workflowPhaseId: "phase-1", label: "Diff reviewed" }),
      }),
    );
  });
});

describe("getMissionDetail / getPhaseDetail", () => {
  it("returns null for a mission that does not exist", async () => {
    const db = makeFakeDb();
    db.workflowRun.findUnique.mockResolvedValue(null);
    const result = await getMissionDetail("missing", db as unknown as Parameters<typeof getMissionDetail>[1]);
    expect(result).toBeNull();
  });

  it("assembles a mission with its phases and checklist items, deriving mission status", async () => {
    const db = makeFakeDb();
    db.workflowRun.findUnique.mockResolvedValue({
      id: "run-1",
      objective: "Finish stashed P7C work",
      scope: null,
      constraints: null,
      acceptanceCriteria: [],
      dependsOnRunIds: [],
    });
    db.workflowPhase.findMany.mockResolvedValue([
      {
        id: "phase-1",
        workflowRunId: "run-1",
        sequence: 1,
        title: "Triage",
        objective: "Inventory",
        acceptanceCriteria: [],
        status: "COMPLETE",
        dependsOnPhaseIds: [],
        attempt: 1,
        lastProgressAt: null,
        blockedReason: null,
        startedAt: null,
        completedAt: null,
      },
    ]);
    db.workflowChecklistItem.findMany.mockResolvedValue([
      { id: "item-1", label: "Diff reviewed", required: true, status: "DONE", evidenceRef: null, completedAt: null },
    ]);
    const result = await getMissionDetail("run-1", db as unknown as Parameters<typeof getMissionDetail>[1]);
    expect(result?.status).toBe("COMPLETE");
    expect(result?.phases[0].checklist[0].label).toBe("Diff reviewed");
  });

  it("returns null for a phase that does not exist", async () => {
    const db = makeFakeDb();
    db.workflowPhase.findUnique.mockResolvedValue(null);
    const result = await getPhaseDetail("missing", db as unknown as Parameters<typeof getPhaseDetail>[1]);
    expect(result).toBeNull();
  });
});

describe("transitionPhase", () => {
  it("increments attempt each time the phase enters IN_PROGRESS", async () => {
    const db = makeFakeDb();
    db.workflowPhase.findUnique.mockResolvedValue({ id: "phase-1", status: "NOT_STARTED", attempt: 0, startedAt: null, completedAt: null });
    await transitionPhase("phase-1", "IN_PROGRESS", {}, db as unknown as Parameters<typeof transitionPhase>[3]);
    expect(db.workflowPhase.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "IN_PROGRESS", attempt: 1 }) }),
    );
  });

  it("throws IllegalPhaseTransitionError and does not write when the transition is illegal", async () => {
    const db = makeFakeDb();
    db.workflowPhase.findUnique.mockResolvedValue({ id: "phase-1", status: "COMPLETE", attempt: 1, startedAt: null, completedAt: null });
    await expect(
      transitionPhase("phase-1", "IN_PROGRESS", {}, db as unknown as Parameters<typeof transitionPhase>[3]),
    ).rejects.toBeInstanceOf(IllegalPhaseTransitionError);
    expect(db.workflowPhase.update).not.toHaveBeenCalled();
  });

  it("records blockedReason when transitioning to BLOCKED", async () => {
    const db = makeFakeDb();
    db.workflowPhase.findUnique.mockResolvedValue({ id: "phase-1", status: "IN_PROGRESS", attempt: 1, startedAt: new Date(), completedAt: null });
    await transitionPhase("phase-1", "BLOCKED", { blockedReason: "waiting on DB access" }, db as unknown as Parameters<typeof transitionPhase>[3]);
    expect(db.workflowPhase.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "BLOCKED", blockedReason: "waiting on DB access" }) }),
    );
  });
});

describe("updateChecklistItem", () => {
  it("updates status and bumps the parent phase's lastProgressAt", async () => {
    const db = makeFakeDb();
    db.workflowChecklistItem.findUnique.mockResolvedValue({ id: "item-1", workflowPhaseId: "phase-1", status: "PENDING", evidenceRef: null });
    await updateChecklistItem("item-1", "DONE", { path: "evidence.json" }, db as unknown as Parameters<typeof updateChecklistItem>[3]);
    expect(db.workflowChecklistItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "DONE" }) }),
    );
    expect(db.workflowPhase.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "phase-1" }, data: expect.objectContaining({ lastProgressAt: expect.any(Date) }) }),
    );
  });

  it("is a no-op (does not touch lastProgressAt) when status is unchanged", async () => {
    const db = makeFakeDb();
    db.workflowChecklistItem.findUnique.mockResolvedValue({ id: "item-1", workflowPhaseId: "phase-1", status: "DONE", evidenceRef: null });
    await updateChecklistItem("item-1", "DONE", null, db as unknown as Parameters<typeof updateChecklistItem>[3]);
    expect(db.workflowChecklistItem.update).not.toHaveBeenCalled();
    expect(db.workflowPhase.update).not.toHaveBeenCalled();
  });
});

describe("writeCheckpoint", () => {
  it("computes the next sequence number and bumps lastProgressAt", async () => {
    const db = makeFakeDb();
    db.workflowCheckpoint.count.mockResolvedValue(2);
    db.workflowCheckpoint.create.mockResolvedValue({ id: "checkpoint-3" });
    const result = await writeCheckpoint(
      { phaseId: "phase-1", workflowRunId: "run-1", checkpointKey: "triage.complete" },
      db as unknown as Parameters<typeof writeCheckpoint>[1],
    );
    expect(result).toEqual({ id: "checkpoint-3" });
    expect(db.workflowCheckpoint.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sequence: 3 }) }),
    );
    expect(db.workflowPhase.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "phase-1" } }),
    );
  });
});

describe("recordPhaseDecision", () => {
  it("writes an AgentDecision with decisionType phase_acceptance", async () => {
    const db = makeFakeDb();
    db.agentDecision.create.mockResolvedValue({ id: "decision-1" });
    const result = await recordPhaseDecision(
      { phaseId: "phase-1", workflowRunId: "run-1", outcome: "ACCEPT" },
      db as unknown as Parameters<typeof recordPhaseDecision>[1],
    );
    expect(result).toEqual({ id: "decision-1" });
    expect(db.agentDecision.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ decisionType: "phase_acceptance" }) }),
    );
  });
});

describe("listOpenMissions", () => {
  it("filters workflowType by the mission. prefix", async () => {
    const db = makeFakeDb();
    db.workflowRun.findMany.mockResolvedValue([{ id: "run-1" }]);
    db.workflowRun.findUnique.mockResolvedValue({
      id: "run-1",
      objective: "Finish stashed P7C work",
      scope: null,
      constraints: null,
      acceptanceCriteria: [],
      dependsOnRunIds: [],
    });
    db.workflowPhase.findMany.mockResolvedValue([]);
    const result = await listOpenMissions(db as unknown as Parameters<typeof listOpenMissions>[0]);
    expect(db.workflowRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workflowType: { startsWith: "mission." } } }),
    );
    expect(result).toEqual([{ id: "run-1", objective: "Finish stashed P7C work", status: "NOT_STARTED" }]);
  });
});
