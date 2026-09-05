import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { main as createMissionMain } from "@/scripts/manager-loop/create-mission";
import { main as planPhasesMain } from "@/scripts/manager-loop/plan-phases";

function makeFakeDb() {
  return {
    workflowRun: { create: vi.fn() },
    workflowPhase: { create: vi.fn() },
    workflowChecklistItem: { create: vi.fn() },
  };
}

describe("create-mission.ts main()", () => {
  it("creates a mission from --slug and --objective", async () => {
    const db = makeFakeDb();
    db.workflowRun.create.mockResolvedValue({ id: "run-1" });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await createMissionMain(["--slug", "p7c-remediation", "--objective", "Finish stashed work"], db as any);
    expect(db.workflowRun.create).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("run-1"));
    logSpy.mockRestore();
  });

  it("throws a usage error when required flags are missing", async () => {
    const db = makeFakeDb();
    await expect(createMissionMain([], db as any)).rejects.toThrow(/Usage/);
  });
});

describe("plan-phases.ts main()", () => {
  it("reads a phases JSON file and persists phases + checklist", async () => {
    const db = makeFakeDb();
    db.workflowPhase.create.mockResolvedValue({ id: "phase-1" });
    const dir = mkdtempSync(join(tmpdir(), "manager-loop-test-"));
    const phasesFile = join(dir, "phases.json");
    writeFileSync(
      phasesFile,
      JSON.stringify([
        { sequence: 1, title: "Triage", objective: "Inventory", acceptanceCriteria: [], checklist: [{ label: "Diff reviewed" }] },
      ]),
    );
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await planPhasesMain(["--mission", "run-1", "--phases-file", phasesFile], db as any);
    expect(db.workflowPhase.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ workflowRunId: "run-1", title: "Triage" }) }),
    );
    logSpy.mockRestore();
  });
});
