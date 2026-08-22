import { beforeEach, describe, expect, it, vi } from "vitest";

const logAuditWithId = vi.hoisted(() => vi.fn());
const tx = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  curriculumReviewTask: { findUnique: vi.fn(), update: vi.fn() },
  curriculumAIReviewAssessment: { findMany: vi.fn() },
  curriculumReviewDecision: { create: vi.fn(), update: vi.fn() },
}));

vi.mock("@/lib/db", () => ({
  prisma: { $transaction: (fn: (client: unknown) => unknown) => fn(tx) },
}));
vi.mock("@/lib/audit", () => ({ logAuditRequiredWithId: logAuditWithId }));
vi.mock("@/lib/ai/routedCompletion", () => ({ routedCompletion: vi.fn() }));

import { finalizeAIReviewTask } from "@/lib/curriculum/review/aiReview";

const task = {
  id: "task-1",
  revisionId: "revision-1",
  provenanceId: "provenance-1",
  priorityBand: "STANDARD",
  requiredAuthority: "SCHOOL",
  requiredReviewCount: 2,
  policyKey: "p2b.policy.v1",
  policyVersion: 1,
  rubricKey: "p2b.rubric.v1",
  rubricVersion: 1,
  specialistRequirements: null,
  evidenceRequirements: null,
  schoolId: "school-a",
  provenance: {
    currentRevisionId: "revision-1",
    curriculumContent: { contentId: "content-1" },
  },
};

function aiAssessment(id: string, specialty: string, validationPassed = true) {
  return {
    id,
    taskId: "task-1",
    aiReviewAgentId: `agent-${id}`,
    recommendation: "APPROVE",
    confidence: 95,
    rationale: "Advisory recommendation only.",
    rubricResponses: {},
    aiReviewSnapshot: { deterministicValidation: { passed: validationPassed } },
    aiReviewAgent: { agentKey: `agent-${id}`, specialty },
  };
}

describe("P2-B AI authority boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.$queryRaw.mockResolvedValue([]);
    tx.curriculumReviewTask.findUnique.mockResolvedValue(task);
    tx.curriculumAIReviewAssessment.findMany.mockResolvedValue([
      aiAssessment("subject", "SUBJECT_MATTER"),
      aiAssessment("pedagogy", "PEDAGOGY"),
    ]);
    logAuditWithId.mockResolvedValue("audit-ai-assist");
  });

  it("records a consensus AI approval recommendation as advisory evidence only", async () => {
    await expect(finalizeAIReviewTask({
      taskId: "task-1",
      correlationId: "correlation-1",
      assessmentIds: ["subject", "pedagogy"],
    })).resolves.toMatchObject({
      status: "AI_ASSIST_COMPLETE",
      authority: "ADVISORY_ONLY",
      recommendation: "APPROVE",
      auditLogId: "audit-ai-assist",
    });
    expect(tx.curriculumReviewDecision.create).not.toHaveBeenCalled();
    expect(tx.curriculumReviewDecision.update).not.toHaveBeenCalled();
    expect(tx.curriculumReviewTask.update).not.toHaveBeenCalled();
    expect(logAuditWithId).toHaveBeenCalledWith(expect.objectContaining({
      action: "curriculum.review.ai.assist.completed",
      details: expect.objectContaining({ authority: "ADVISORY_ONLY" }),
    }), tx);
  });

  it("escalates invalid AI evidence without manufacturing a decision or governance authority", async () => {
    tx.curriculumAIReviewAssessment.findMany.mockResolvedValue([
      aiAssessment("subject", "SUBJECT_MATTER", false),
      aiAssessment("pedagogy", "PEDAGOGY"),
    ]);
    await expect(finalizeAIReviewTask({
      taskId: "task-1",
      correlationId: "correlation-2",
      assessmentIds: ["subject", "pedagogy"],
    })).resolves.toMatchObject({ status: "AI_ASSIST_ESCALATED", authority: "ADVISORY_ONLY" });
    expect(tx.curriculumReviewDecision.create).not.toHaveBeenCalled();
    expect(tx.curriculumReviewTask.update).not.toHaveBeenCalled();
  });
});
