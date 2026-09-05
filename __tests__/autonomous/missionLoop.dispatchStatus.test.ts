import { describe, expect, it, vi } from "vitest";
import { main as dispatchPhaseMain } from "@/scripts/manager-loop/dispatch-phase";
import { main as statusMain } from "@/scripts/manager-loop/status";

const phaseNotStarted = {
  id: "phase-1",
  workflowRunId: "run-1",
  sequence: 1,
  title: "Triage",
  objective: "Inventory the stashed work",
  acceptanceCriteria: [{ type: "command", label: "tests", command: "true" }],
  status: "NOT_STARTED",
  dependsOnPhaseIds: [],
  attempt: 0,
  lastProgressAt: null,
  blockedReason: null,
  startedAt: null,
  completedAt: null,
  checklist: [{ id: "item-1", label: "Diff reviewed", required: true, status: "PENDING", evidenceRef: null, completedAt: null }],
};

const mission = {
  id: "run-1",
  objective: "Finish stashed P7C work",
  scope: null,
  constraints: null,
  acceptanceCriteria: [],
  dependsOnRunIds: [],
  status: "IN_PROGRESS",
  phases: [phaseNotStarted],
};

function makeFakeDb() {
  return {
    workflowRun: { findUnique: vi.fn(), findMany: vi.fn() },
    workflowPhase: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    workflowChecklistItem: { findMany: vi.fn() },
  };
}

describe("dispatch-phase.ts main()", () => {
  it("transitions a NOT_STARTED phase to IN_PROGRESS and prints the brief", async () => {
    const db = makeFakeDb();
    db.workflowPhase.findUnique.mockResolvedValue(phaseNotStarted);
    db.workflowChecklistItem.findMany.mockResolvedValue(phaseNotStarted.checklist);
    db.workflowRun.findUnique.mockResolvedValue(mission);
    db.workflowPhase.findMany.mockResolvedValue([phaseNotStarted]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await dispatchPhaseMain(["phase-1"], db as any);
    expect(db.workflowPhase.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "IN_PROGRESS" }) }),
    );
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Triage"));
    logSpy.mockRestore();
  });

  it("does not transition a BLOCKED phase", async () => {
    const blocked = { ...phaseNotStarted, status: "BLOCKED", blockedReason: "waiting" };
    const db = makeFakeDb();
    db.workflowPhase.findUnique.mockResolvedValue(blocked);
    db.workflowChecklistItem.findMany.mockResolvedValue(blocked.checklist);
    db.workflowRun.findUnique.mockResolvedValue(mission);
    db.workflowPhase.findMany.mockResolvedValue([blocked]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await dispatchPhaseMain(["phase-1"], db as any);
    expect(db.workflowPhase.update).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });
});

describe("status.ts main()", () => {
  it("prints mission list when no missionId is given", async () => {
    const db = makeFakeDb();
    db.workflowRun.findMany.mockResolvedValue([{ id: "run-1" }]);
    db.workflowRun.findUnique.mockResolvedValue(mission);
    db.workflowPhase.findMany.mockResolvedValue([phaseNotStarted]);
    db.workflowChecklistItem.findMany.mockResolvedValue(phaseNotStarted.checklist);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await statusMain([], db as any);
    expect(db.workflowRun.findMany).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it("prints full mission detail including the exact next action for a NOT_STARTED phase", async () => {
    const db = makeFakeDb();
    db.workflowRun.findUnique.mockResolvedValue(mission);
    db.workflowPhase.findMany.mockResolvedValue([phaseNotStarted]);
    db.workflowChecklistItem.findMany.mockResolvedValue(phaseNotStarted.checklist);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await statusMain(["run-1"], db as any);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("dispatch-phase.ts phase-1"));
    logSpy.mockRestore();
  });

  it("never calls any mutating repository function", async () => {
    const db = makeFakeDb();
    db.workflowRun.findUnique.mockResolvedValue(mission);
    db.workflowPhase.findMany.mockResolvedValue([phaseNotStarted]);
    db.workflowChecklistItem.findMany.mockResolvedValue(phaseNotStarted.checklist);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    await statusMain(["run-1", "--json"], db as any);
    expect(db.workflowPhase.update).not.toHaveBeenCalled();
  });
});
