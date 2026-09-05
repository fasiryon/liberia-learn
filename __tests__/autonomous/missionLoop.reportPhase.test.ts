import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { main as reportPhaseMain } from "@/scripts/manager-loop/report-phase";

function makeFakeDb() {
  return {
    workflowPhase: { findUnique: vi.fn(), update: vi.fn() },
    workflowChecklistItem: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    workflowCheckpoint: { count: vi.fn().mockResolvedValue(0), create: vi.fn().mockResolvedValue({ id: "checkpoint-1" }) },
  };
}

function writeEvidenceFile(content: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "manager-loop-test-"));
  const path = join(dir, "evidence.json");
  writeFileSync(path, JSON.stringify(content));
  return path;
}

describe("report-phase.ts main()", () => {
  it("updates checklist items, writes a checkpoint, and moves the phase to VERIFYING", async () => {
    const db = makeFakeDb();
    db.workflowPhase.findUnique.mockResolvedValue({ id: "phase-1", workflowRunId: "run-1", status: "IN_PROGRESS", attempt: 1, startedAt: new Date(), completedAt: null });
    db.workflowChecklistItem.findUnique.mockResolvedValue({ id: "item-1", workflowPhaseId: "phase-1", status: "PENDING", evidenceRef: null });
    const evidencePath = writeEvidenceFile({
      checklist: [{ itemId: "item-1", status: "DONE", evidenceRef: { path: "stash-inventory.md" } }],
      checkpointKey: "triage.complete",
      state: { insight: "two threads found, one broken" },
    });
    await reportPhaseMain(["phase-1", "--status", "VERIFYING", "--evidence", evidencePath], db as any);
    expect(db.workflowChecklistItem.update).toHaveBeenCalled();
    expect(db.workflowCheckpoint.create).toHaveBeenCalled();
    expect(db.workflowPhase.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "VERIFYING" }) }),
    );
  });

  it("rejects a --status value other than VERIFYING or BLOCKED", async () => {
    const db = makeFakeDb();
    const evidencePath = writeEvidenceFile({ checkpointKey: "x" });
    await expect(
      reportPhaseMain(["phase-1", "--status", "COMPLETE", "--evidence", evidencePath], db as any),
    ).rejects.toThrow(/may only set VERIFYING or BLOCKED/);
  });

  it("records blockedReason when reporting BLOCKED", async () => {
    const db = makeFakeDb();
    db.workflowPhase.findUnique.mockResolvedValue({ id: "phase-1", workflowRunId: "run-1", status: "IN_PROGRESS", attempt: 1, startedAt: new Date(), completedAt: null });
    const evidencePath = writeEvidenceFile({ checkpointKey: "x", blockedReason: "missing lib/ops/operationalSnapshot.ts" });
    await reportPhaseMain(["phase-1", "--status", "BLOCKED", "--evidence", evidencePath], db as any);
    expect(db.workflowPhase.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "BLOCKED", blockedReason: "missing lib/ops/operationalSnapshot.ts" }) }),
    );
  });
});
