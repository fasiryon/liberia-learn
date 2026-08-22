import { beforeEach, describe, expect, it, vi } from "vitest";

const reviewEligibility = vi.hoisted(() => vi.fn());
const appendGovernance = vi.hoisted(() => vi.fn());
const logAuditWithId = vi.hoisted(() => vi.fn());
const tx = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  curriculumReviewDecision: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  curriculumReviewTask: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: { $transaction: (fn: (client: unknown) => unknown) => fn(tx) },
}));
vi.mock("@/lib/curriculum/review/eligibility", () => ({ reviewEligibility }));
vi.mock("@/lib/audit", () => ({ logAuditRequiredWithId: logAuditWithId }));
vi.mock("@/lib/curriculum/mutations/governanceWriter", () => ({
  appendCurriculumGovernanceEventInTransaction: appendGovernance,
}));

import { finalizeReviewTaskIfReady } from "@/lib/curriculum/review/decisions";

const assessment = {
  id: "assessment-1",
  taskId: "task-1",
  reviewerProfileId: "profile-1",
  credentialId: "credential-1",
  credentialScopeId: "scope-1",
  recommendation: "APPROVE",
  rationale: "Meets the governed rubric.",
  evidenceRefs: [],
  qualificationSnapshot: { credentialId: "credential-1", scope: { id: "scope-1" } },
  submittedAt: new Date("2026-08-22T12:00:00Z"),
  assignment: { id: "assignment-1", slot: "FIRST" },
  reviewerProfile: {
    userId: "reviewer-1",
    user: { id: "reviewer-1", role: "TEACHER", schoolId: "school-a", isPlatformAdmin: false },
  },
  credential: { id: "credential-1" },
  credentialScope: { id: "scope-1" },
};

const task = {
  id: "task-1",
  status: "IN_REVIEW",
  provenanceId: "provenance-1",
  revisionId: "revision-1",
  requiredAuthority: "SCHOOL",
  requiredReviewCount: 1,
  specialistRequirements: null,
  evidenceRequirements: null,
  policyKey: "policy",
  policyVersion: 1,
  rubricKey: "rubric",
  rubricVersion: 1,
  riskScore: null,
  riskReasons: [],
  schoolId: "school-a",
  provenance: {
    currentRevisionId: "revision-1",
    lifecycleState: "PENDING_REVIEW",
    curriculumContent: { contentId: "content-1" },
  },
  assessments: [assessment],
};

describe("P2-B final-decision transaction composition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.$queryRaw.mockResolvedValue([]);
    tx.curriculumReviewDecision.findUnique.mockResolvedValue(null);
    tx.curriculumReviewTask.findUnique.mockResolvedValue(task);
    reviewEligibility.mockResolvedValue({
      eligible: true,
      reasons: ["ELIGIBLE"],
      credentialId: "credential-1",
      credentialScopeId: "scope-1",
    });
    logAuditWithId.mockResolvedValue("audit-1");
    tx.curriculumReviewDecision.create.mockResolvedValue({
      id: "decision-1",
      auditLogId: "audit-1",
      status: "PENDING",
    });
  });

  it("rejects final authority when the currently matching scope is not the submitted scope", async () => {
    reviewEligibility.mockResolvedValue({
      eligible: true,
      reasons: ["ELIGIBLE"],
      credentialId: "credential-1",
      credentialScopeId: "scope-other",
    });
    await expect(finalizeReviewTaskIfReady({ taskId: task.id, idempotencyKey: "decision-key" }))
      .rejects.toMatchObject({ code: "REVIEWER_INELIGIBLE_AT_DECISION", status: 409 });
    expect(logAuditWithId).not.toHaveBeenCalled();
    expect(tx.curriculumReviewDecision.create).not.toHaveBeenCalled();
  });

  it("uses one transaction client and never finalizes the decision or task when governance creation fails", async () => {
    appendGovernance.mockRejectedValue(new Error("controlled governance failure"));
    await expect(finalizeReviewTaskIfReady({ taskId: task.id, idempotencyKey: "decision-key" }))
      .rejects.toThrow("controlled governance failure");
    expect(logAuditWithId).toHaveBeenCalledWith(expect.any(Object), tx);
    expect(tx.curriculumReviewDecision.create).toHaveBeenCalledTimes(1);
    expect(appendGovernance).toHaveBeenCalledWith(tx, expect.objectContaining({
      contentId: "content-1",
      revisionId: "revision-1",
      approvalBasis: "HUMAN_REVIEW",
    }), { auditLogId: "audit-1" });
    expect(tx.curriculumReviewDecision.update).not.toHaveBeenCalled();
    expect(tx.curriculumReviewTask.update).not.toHaveBeenCalled();
  });

  it("never auto-approves when a two-person policy has only one submitted assessment", async () => {
    tx.curriculumReviewTask.findUnique.mockResolvedValue({ ...task, requiredReviewCount: 2 });
    await expect(finalizeReviewTaskIfReady({ taskId: task.id, idempotencyKey: "decision-key" }))
      .resolves.toEqual({ status: "AWAITING_ASSESSMENTS" });
    expect(logAuditWithId).not.toHaveBeenCalled();
    expect(tx.curriculumReviewDecision.create).not.toHaveBeenCalled();
  });

  it("rejects two-person review when both slots resolve to the same user identity", async () => {
    const second = { ...assessment, id: "assessment-2", assignment: { id: "assignment-2", slot: "SECOND" } };
    tx.curriculumReviewTask.findUnique.mockResolvedValue({
      ...task,
      requiredReviewCount: 2,
      assessments: [assessment, second],
    });
    await expect(finalizeReviewTaskIfReady({ taskId: task.id, idempotencyKey: "decision-key" }))
      .rejects.toMatchObject({ code: "TWO_PERSON_INDEPENDENCE_FAILED", status: 409 });
  });

  it("preserves both submitted assessments and routes disagreement to a resolver", async () => {
    const second = {
      ...assessment,
      id: "assessment-2",
      recommendation: "REJECT",
      reviewerProfileId: "profile-2",
      reviewerProfile: {
        userId: "reviewer-2",
        user: { id: "reviewer-2", role: "TEACHER", schoolId: "school-a", isPlatformAdmin: false },
      },
      assignment: { id: "assignment-2", slot: "SECOND" },
    };
    tx.curriculumReviewTask.findUnique.mockResolvedValue({
      ...task,
      requiredReviewCount: 2,
      assessments: [assessment, second],
    });
    await expect(finalizeReviewTaskIfReady({ taskId: task.id, idempotencyKey: "decision-key" }))
      .resolves.toEqual({ status: "DISAGREEMENT" });
    expect(tx.curriculumReviewTask.update).toHaveBeenCalledWith({
      where: { id: task.id },
      data: { status: "DISAGREEMENT", version: { increment: 1 } },
    });
    expect(tx.curriculumReviewDecision.create).not.toHaveBeenCalled();
  });
});
