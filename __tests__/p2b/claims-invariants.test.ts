import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  curriculumReviewTask: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
  curriculumReviewAssignment: {
    updateMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    findUniqueOrThrow: vi.fn(),
  },
}));
const reviewEligibility = vi.hoisted(() => vi.fn());
const logAuditRequired = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: { $transaction: (fn: (client: unknown) => unknown) => fn(tx) },
}));

vi.mock("@/lib/audit", () => ({ logAuditRequired }));
vi.mock("@/lib/curriculum/review/eligibility", () => ({ reviewEligibility }));

import {
  claimReviewTask,
  heartbeatReviewClaim,
  overrideReviewClaim,
  releaseReviewClaim,
} from "@/lib/curriculum/review/claims";

describe("P2-B claim and override invariants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.$queryRaw.mockResolvedValue([]);
    tx.curriculumReviewAssignment.updateMany.mockResolvedValue({ count: 0 });
    tx.curriculumReviewAssignment.findUnique.mockResolvedValue(null);
    tx.curriculumReviewAssignment.findFirst.mockResolvedValue(null);
    logAuditRequired.mockResolvedValue(undefined);
    reviewEligibility.mockResolvedValue({
      eligible: true,
      reviewerProfileId: "profile-b",
      credentialId: "credential-b",
      credentialScopeId: "scope-b",
      reasons: ["ELIGIBLE"],
    });
  });

  it("returns a deterministic conflict after a serialized racer already owns the active slot", async () => {
    tx.curriculumReviewTask.findUniqueOrThrow.mockResolvedValue({
      status: "IN_REVIEW",
      requiredReviewCount: 1,
      assessments: [],
    });
    tx.curriculumReviewAssignment.findFirst.mockResolvedValue({ slot: "FIRST" });
    await expect(claimReviewTask({
      taskId: "task-1",
      user: { id: "reviewer-b", role: "TEACHER", schoolId: "school-a" },
      idempotencyKey: "claim-b",
    })).rejects.toMatchObject({ code: "CLAIM_SLOT_CONFLICT", status: 409 });
  });

  it("rejects a school administrator overriding another school's assignment", async () => {
    tx.curriculumReviewAssignment.findUnique.mockResolvedValue({
      id: "assignment-b",
      task: { schoolId: "school-b" },
    });
    await expect(overrideReviewClaim({
      assignmentId: "assignment-b",
      actor: { id: "admin-a", role: "ADMIN", schoolId: "school-a" },
      reason: "operational override",
      expectedVersion: 1,
      idempotencyKey: "override-1",
    })).rejects.toMatchObject({ code: "REVIEW_ADMIN_FORBIDDEN", status: 403 });
    expect(tx.curriculumReviewAssignment.updateMany).not.toHaveBeenCalled();
  });

  it("expires the abandoned lease and allows an eligible reviewer to reclaim the same slot", async () => {
    const now = new Date("2026-08-22T12:00:00Z");
    tx.curriculumReviewTask.findUniqueOrThrow.mockResolvedValue({
      status: "IN_REVIEW",
      requiredReviewCount: 1,
      assessments: [],
    });
    tx.curriculumReviewAssignment.create.mockResolvedValue({ id: "assignment-b", slot: "FIRST" });
    await expect(claimReviewTask({
      taskId: "task-1",
      user: { id: "reviewer-b", role: "TEACHER", schoolId: "school-a" },
      idempotencyKey: "reclaim-b",
      now,
    })).resolves.toMatchObject({ id: "assignment-b", slot: "FIRST" });
    expect(tx.curriculumReviewAssignment.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ taskId: "task-1", status: "ACTIVE", leaseExpiresAt: { lte: now } }),
      data: expect.objectContaining({ status: "EXPIRED", releaseReason: "LEASE_EXPIRED" }),
    }));
  });

  it("renews a current lease with optimistic versioning and rejects a stale writer", async () => {
    const now = new Date("2026-08-22T12:00:00Z");
    tx.curriculumReviewAssignment.findUnique.mockResolvedValue({
      id: "assignment-a",
      reviewerProfileId: "profile-a",
      leaseToken: "lease-a",
      status: "ACTIVE",
      version: 2,
      leaseExpiresAt: new Date("2026-08-22T12:05:00Z"),
      maxContinuousUntil: new Date("2026-08-22T13:00:00Z"),
    });
    tx.curriculumReviewAssignment.updateMany.mockResolvedValueOnce({ count: 1 });
    tx.curriculumReviewAssignment.findUniqueOrThrow.mockResolvedValue({ id: "assignment-a", version: 3 });
    await expect(heartbeatReviewClaim({
      assignmentId: "assignment-a",
      reviewerProfileId: "profile-a",
      leaseToken: "lease-a",
      version: 2,
      now,
    })).resolves.toMatchObject({ version: 3 });
    expect(tx.curriculumReviewAssignment.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ version: 2, leaseToken: "lease-a", status: "ACTIVE" }),
      data: expect.objectContaining({ lastHeartbeatAt: now, version: { increment: 1 } }),
    }));
    await expect(heartbeatReviewClaim({
      assignmentId: "assignment-a",
      reviewerProfileId: "profile-a",
      leaseToken: "lease-a",
      version: 1,
      now,
    })).rejects.toMatchObject({ code: "CLAIM_LOST", status: 409 });
  });

  it("records recusal, releases the claim, and does not complete the task", async () => {
    tx.curriculumReviewAssignment.updateMany.mockResolvedValueOnce({ count: 1 });
    await releaseReviewClaim({
      assignmentId: "assignment-a",
      reviewerProfileId: "profile-a",
      leaseToken: "lease-a",
      version: 2,
      reason: "authorship conflict discovered",
      recusal: true,
      actorUserId: "reviewer-a",
      schoolId: "school-a",
      idempotencyKey: "recusal-a",
    });
    expect(tx.curriculumReviewAssignment.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "RECUSED", releaseReason: "authorship conflict discovered" }),
    }));
    expect(logAuditRequired).toHaveBeenCalledWith(expect.objectContaining({
      action: "curriculum.review.recused",
    }), tx);
    expect(tx.curriculumReviewTask.update).not.toHaveBeenCalled();
  });
});
