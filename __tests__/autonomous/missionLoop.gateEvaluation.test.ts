import { describe, expect, it, vi } from "vitest";
import { evaluateAcceptanceCriteria } from "@/lib/autonomous/missionLoop/gateEvaluation";
import type { AcceptanceCriterion } from "@/lib/autonomous/missionLoop/types";

function makeFakeDb() {
  return {
    approvalRequest: { findUnique: vi.fn() },
    qualityReviewTask: { findUnique: vi.fn() },
  };
}

describe("evaluateAcceptanceCriteria — command", () => {
  it("passes when the command exits 0", async () => {
    const criteria: AcceptanceCriterion[] = [{ type: "command", label: "tests", command: "true" }];
    const runCommand = vi.fn().mockReturnValue({ exitCode: 0, output: "ok" });
    const result = await evaluateAcceptanceCriteria(criteria, makeFakeDb() as any, runCommand);
    expect(result.passed).toBe(true);
    expect(runCommand).toHaveBeenCalledWith("true");
  });

  it("fails when the command exits nonzero", async () => {
    const criteria: AcceptanceCriterion[] = [{ type: "command", label: "tests", command: "false" }];
    const runCommand = vi.fn().mockReturnValue({ exitCode: 1, output: "boom" });
    const result = await evaluateAcceptanceCriteria(criteria, makeFakeDb() as any, runCommand);
    expect(result.passed).toBe(false);
    expect(result.results[0].detail).toContain("boom");
  });
});

describe("evaluateAcceptanceCriteria — approval_resolved", () => {
  it("passes only when ApprovalRequest.status is APPROVED", async () => {
    const db = makeFakeDb();
    db.approvalRequest.findUnique.mockResolvedValue({ status: "APPROVED" });
    const result = await evaluateAcceptanceCriteria(
      [{ type: "approval_resolved", approvalRequestId: "approval-1" }],
      db as any,
    );
    expect(result.passed).toBe(true);
  });

  it("fails when the approval is still PENDING", async () => {
    const db = makeFakeDb();
    db.approvalRequest.findUnique.mockResolvedValue({ status: "PENDING" });
    const result = await evaluateAcceptanceCriteria(
      [{ type: "approval_resolved", approvalRequestId: "approval-1" }],
      db as any,
    );
    expect(result.passed).toBe(false);
  });

  it("fails when the approval does not exist", async () => {
    const db = makeFakeDb();
    db.approvalRequest.findUnique.mockResolvedValue(null);
    const result = await evaluateAcceptanceCriteria(
      [{ type: "approval_resolved", approvalRequestId: "missing" }],
      db as any,
    );
    expect(result.passed).toBe(false);
  });
});

describe("evaluateAcceptanceCriteria — review_task_resolved", () => {
  it("passes only when status is DECIDED and outcome is PASS", async () => {
    const db = makeFakeDb();
    db.qualityReviewTask.findUnique.mockResolvedValue({ status: "DECIDED", assessment: { outcome: "PASS" } });
    const result = await evaluateAcceptanceCriteria(
      [{ type: "review_task_resolved", qualityReviewTaskId: "task-1" }],
      db as any,
    );
    expect(result.passed).toBe(true);
  });

  it("fails when the outcome is FAIL", async () => {
    const db = makeFakeDb();
    db.qualityReviewTask.findUnique.mockResolvedValue({ status: "DECIDED", assessment: { outcome: "FAIL" } });
    const result = await evaluateAcceptanceCriteria(
      [{ type: "review_task_resolved", qualityReviewTaskId: "task-1" }],
      db as any,
    );
    expect(result.passed).toBe(false);
  });
});

describe("evaluateAcceptanceCriteria — multiple criteria", () => {
  it("passes only when every criterion passes", async () => {
    const db = makeFakeDb();
    db.approvalRequest.findUnique.mockResolvedValue({ status: "APPROVED" });
    const runCommand = vi.fn().mockReturnValue({ exitCode: 1, output: "fail" });
    const result = await evaluateAcceptanceCriteria(
      [
        { type: "approval_resolved", approvalRequestId: "approval-1" },
        { type: "command", label: "build", command: "npm run build" },
      ],
      db as any,
      runCommand,
    );
    expect(result.passed).toBe(false);
    expect(result.results).toHaveLength(2);
  });
});
