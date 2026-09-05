import { describe, expect, it, vi } from "vitest";
import { main as reviewPhaseMain } from "@/scripts/manager-loop/review-phase";
import { main as acceptPhaseMain } from "@/scripts/manager-loop/accept-phase";
import { main as rejectPhaseMain } from "@/scripts/manager-loop/reject-phase";

const doneChecklist = [{ id: "item-1", label: "Diff reviewed", required: true, status: "DONE", evidenceRef: null, completedAt: new Date() }];

function makeFakeDb() {
  return {
    workflowPhase: { findUnique: vi.fn(), update: vi.fn() },
    workflowChecklistItem: { findMany: vi.fn().mockResolvedValue(doneChecklist) },
    agentDecision: { create: vi.fn().mockResolvedValue({ id: "decision-1" }) },
    approvalRequest: { findUnique: vi.fn() },
    qualityReviewTask: { findUnique: vi.fn() },
  };
}

describe("review-phase.ts main()", () => {
  it("reports READY TO ACCEPT when the phase is VERIFYING, checklist complete, and gate passes", async () => {
    const db = makeFakeDb();
    db.workflowPhase.findUnique.mockResolvedValue({
      id: "phase-1", workflowRunId: "run-1", sequence: 1, title: "Triage", objective: "x",
      // node -e is used instead of a POSIX builtin (true/false) so this runs
      // identically on Windows (execSync's default shell is cmd.exe there,
      // which has no "true" command) and on Linux CI.
      acceptanceCriteria: [{ type: "command", label: "tests", command: 'node -e "process.exit(0)"' }],
      status: "VERIFYING", dependsOnPhaseIds: [], attempt: 1, lastProgressAt: new Date(),
      blockedReason: null, startedAt: new Date(), completedAt: null,
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const result = await reviewPhaseMain(["phase-1"], db as any);
    expect(result.readyToAccept).toBe(true);
    logSpy.mockRestore();
  });
});

describe("accept-phase.ts main() — the gate-block test", () => {
  it("refuses to accept when a required checklist item is incomplete, even if the phase says VERIFYING", async () => {
    const db = makeFakeDb();
    db.workflowChecklistItem.findMany.mockResolvedValue([{ ...doneChecklist[0], status: "PENDING" }]);
    db.workflowPhase.findUnique.mockResolvedValue({
      id: "phase-1", workflowRunId: "run-1", sequence: 1, title: "Triage", objective: "x",
      acceptanceCriteria: [], status: "VERIFYING", dependsOnPhaseIds: [], attempt: 1,
      lastProgressAt: new Date(), blockedReason: null, startedAt: new Date(), completedAt: null,
    });
    await expect(acceptPhaseMain(["phase-1"], db as any)).rejects.toThrow(/required checklist item/);
    expect(db.workflowPhase.update).not.toHaveBeenCalled();
  });

  it("refuses to accept when a named acceptance-criterion command fails live, even with checklist complete", async () => {
    const db = makeFakeDb();
    db.workflowPhase.findUnique.mockResolvedValue({
      id: "phase-1", workflowRunId: "run-1", sequence: 1, title: "Triage", objective: "x",
      acceptanceCriteria: [{ type: "command", label: "tsc", command: 'node -e "process.exit(1)"' }],
      status: "VERIFYING", dependsOnPhaseIds: [], attempt: 1, lastProgressAt: new Date(),
      blockedReason: null, startedAt: new Date(), completedAt: null,
    });
    await expect(acceptPhaseMain(["phase-1"], db as any)).rejects.toThrow(/acceptance criteria failed/);
    expect(db.workflowPhase.update).not.toHaveBeenCalled();
  });

  it("accepts and marks COMPLETE when checklist is done and every criterion passes", async () => {
    const db = makeFakeDb();
    db.workflowPhase.findUnique.mockResolvedValue({
      id: "phase-1", workflowRunId: "run-1", sequence: 1, title: "Triage", objective: "x",
      acceptanceCriteria: [{ type: "command", label: "tests", command: 'node -e "process.exit(0)"' }],
      status: "VERIFYING", dependsOnPhaseIds: [], attempt: 1, lastProgressAt: new Date(),
      blockedReason: null, startedAt: new Date(), completedAt: null,
    });
    await acceptPhaseMain(["phase-1"], db as any);
    expect(db.agentDecision.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ decisionType: "phase_acceptance" }) }),
    );
    expect(db.workflowPhase.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "COMPLETE" }) }),
    );
  });

  it("refuses to accept a phase that is not VERIFYING", async () => {
    const db = makeFakeDb();
    db.workflowPhase.findUnique.mockResolvedValue({
      id: "phase-1", workflowRunId: "run-1", sequence: 1, title: "Triage", objective: "x",
      acceptanceCriteria: [], status: "IN_PROGRESS", dependsOnPhaseIds: [], attempt: 1,
      lastProgressAt: new Date(), blockedReason: null, startedAt: new Date(), completedAt: null,
    });
    await expect(acceptPhaseMain(["phase-1"], db as any)).rejects.toThrow(/not VERIFYING/);
  });
});

describe("reject-phase.ts main()", () => {
  it("records a REJECT decision and returns the phase to IN_PROGRESS", async () => {
    const db = makeFakeDb();
    db.workflowPhase.findUnique.mockResolvedValue({
      id: "phase-1", workflowRunId: "run-1", sequence: 1, title: "Triage", objective: "x",
      acceptanceCriteria: [], status: "VERIFYING", dependsOnPhaseIds: [], attempt: 1,
      lastProgressAt: new Date(), blockedReason: null, startedAt: new Date(), completedAt: null,
    });
    await rejectPhaseMain(["phase-1", "--reason", "checklist evidence is thin"], db as any);
    expect(db.agentDecision.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ decisionType: "phase_acceptance", status: "rejected" }) }),
    );
    expect(db.workflowPhase.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "IN_PROGRESS" }) }),
    );
  });
});
