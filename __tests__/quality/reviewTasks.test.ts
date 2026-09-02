import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn(),
    qualityReviewTask: { findUnique: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
    qualityReviewAssessment: { findUnique: vi.fn(), create: vi.fn() },
    reviewerRestriction: { findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/audit", () => ({ logAuditRequiredWithId: vi.fn().mockResolvedValue("audit-1") }));

import { prisma } from "@/lib/db";
import { claimQualityReviewTask, decideQualityReviewTask, recordHelpfulnessDecision } from "@/lib/quality/reviewTasks";
import { ReviewOperationError } from "@/lib/quality/errors";

describe("quality review task claim", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a claim from a reviewer with an active matching restriction", async () => {
    (prisma.$transaction as any).mockImplementation(async (fn: any) => fn(prisma));
    (prisma.qualityReviewTask.findUnique as any).mockResolvedValue({ id: "t1", domain: "TUTOR_HELPFULNESS", schoolId: "school-1", status: "QUEUED", version: 1 });
    (prisma.reviewerRestriction.findFirst as any).mockResolvedValue({ id: "r1", schoolId: "school-1", effectiveUntil: null });
    await expect(
      claimQualityReviewTask({ operator: { id: "op-1", role: "ADMIN" }, taskId: "t1", reviewerProfileId: "rp-1", idempotencyKey: "claim-1" }),
    ).rejects.toThrow(ReviewOperationError);
  });

  it("rejects a claim from a reviewer with a restriction that is active now but has a future effectiveUntil (fail-open case)", async () => {
    // Simulates real Prisma findFirst semantics against a single restriction row,
    // so this test actually exercises the where-clause predicate rather than just
    // a hardcoded mock return value. The restriction here is currently active
    // (effectiveFrom in the past, liftedAt null) but has an effectiveUntil far in
    // the future -- a naive `effectiveUntil: null` filter would miss it entirely
    // (fail-open), which is exactly the bug this test guards against.
    const restriction = {
      id: "r1",
      reviewerProfileId: "rp-1",
      schoolId: "school-1",
      effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
      effectiveUntil: new Date("2099-01-01T00:00:00.000Z"),
      liftedAt: null,
    };

    function matchesClause(record: any, where: any): boolean {
      return Object.entries(where as Record<string, any>).every(([key, condition]: [string, any]) => {
        if (key === "AND") return (condition as any[]).every((sub) => matchesClause(record, sub));
        if (key === "OR") return (condition as any[]).some((sub) => matchesClause(record, sub));
        const value = record[key];
        if (condition === null) return value === null || value === undefined;
        if (condition instanceof Date) return value instanceof Date && value.getTime() === condition.getTime();
        if (typeof condition === "object") {
          if ("lte" in condition) return value != null && value.getTime() <= condition.lte.getTime();
          if ("gt" in condition) return value != null && value.getTime() > condition.gt.getTime();
          return false;
        }
        return value === condition;
      });
    }

    (prisma.$transaction as any).mockImplementation(async (fn: any) => fn(prisma));
    (prisma.qualityReviewTask.findUnique as any).mockResolvedValue({ id: "t1", domain: "TUTOR_HELPFULNESS", schoolId: "school-1", status: "QUEUED", version: 1 });
    (prisma.reviewerRestriction.findFirst as any).mockImplementation(async ({ where }: any) => (matchesClause(restriction, where) ? restriction : null));

    await expect(
      claimQualityReviewTask({ operator: { id: "op-1", role: "ADMIN" }, taskId: "t1", reviewerProfileId: "rp-1", idempotencyKey: "claim-future-until" }),
    ).rejects.toThrow(ReviewOperationError);
  });

  it("rejects a claim on a version conflict (already claimed)", async () => {
    (prisma.$transaction as any).mockImplementation(async (fn: any) => fn(prisma));
    (prisma.qualityReviewTask.findUnique as any).mockResolvedValue({ id: "t1", domain: "TUTOR_HELPFULNESS", schoolId: null, status: "QUEUED", version: 1 });
    (prisma.reviewerRestriction.findFirst as any).mockResolvedValue(null);
    (prisma.qualityReviewTask.updateMany as any).mockResolvedValue({ count: 0 });
    await expect(
      claimQualityReviewTask({ operator: { id: "op-1", role: "ADMIN" }, taskId: "t1", reviewerProfileId: "rp-1", idempotencyKey: "claim-2" }),
    ).rejects.toThrow(/version/i);
  });
});

describe("quality review task decide", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the existing assessment on an idempotent replay, even after the task is DECIDED", async () => {
    (prisma.$transaction as any).mockImplementation(async (fn: any) => fn(prisma));
    (prisma.qualityReviewTask.findUnique as any).mockResolvedValue({
      id: "t1",
      domain: "TUTOR_HELPFULNESS",
      schoolId: null,
      status: "DECIDED",
      claimedByProfileId: "rp-1",
      version: 2,
    });
    const existingAssessment = {
      id: "a1",
      taskId: "t1",
      reviewerProfileId: "rp-1",
      outcome: "PASS",
      severity: "LOW",
      notes: null,
      auditLogId: "audit-1",
      idempotencyKey: "decide-1",
    };
    (prisma.qualityReviewAssessment.findUnique as any).mockResolvedValue(existingAssessment);

    const result = await decideQualityReviewTask({
      operator: { id: "op-1", role: "ADMIN" },
      taskId: "t1",
      outcome: "PASS",
      severity: "LOW",
      notes: null,
      idempotencyKey: "decide-1",
    });

    expect(result).toEqual(existingAssessment);
    expect(prisma.qualityReviewTask.updateMany).not.toHaveBeenCalled();
    expect(prisma.qualityReviewAssessment.create).not.toHaveBeenCalled();
  });

  it("rejects deciding a task that is not CLAIMED when there is no prior assessment", async () => {
    (prisma.$transaction as any).mockImplementation(async (fn: any) => fn(prisma));
    (prisma.qualityReviewTask.findUnique as any).mockResolvedValue({
      id: "t1",
      domain: "TUTOR_HELPFULNESS",
      schoolId: null,
      status: "QUEUED",
      claimedByProfileId: null,
      version: 1,
    });
    (prisma.qualityReviewAssessment.findUnique as any).mockResolvedValue(null);

    await expect(
      decideQualityReviewTask({
        operator: { id: "op-1", role: "ADMIN" },
        taskId: "t1",
        outcome: "PASS",
        severity: "LOW",
        notes: null,
        idempotencyKey: "decide-2",
      }),
    ).rejects.toMatchObject({ code: "TASK_NOT_DECIDABLE" });
  });
});

describe("quality review domain helpers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps an unsafe helpfulness rubric outcome to a CRITICAL FAIL decision with rubric detail preserved in notes", async () => {
    (prisma.$transaction as any).mockImplementation(async (fn: any) => fn(prisma));
    (prisma.qualityReviewTask.findUnique as any).mockResolvedValue({
      id: "t1", domain: "TUTOR_HELPFULNESS", schoolId: null, status: "CLAIMED", claimedByProfileId: "rp-1", version: 1,
    });
    (prisma.qualityReviewAssessment.findUnique as any).mockResolvedValue(null);
    (prisma.qualityReviewTask.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.qualityReviewAssessment.create as any).mockImplementation(async ({ data }: any) => ({ id: "a1", ...data }));

    const result = await recordHelpfulnessDecision({
      operator: { id: "op-1", role: "ADMIN" }, taskId: "t1", outcome: "unsafe", idempotencyKey: "decide-unsafe-1",
    });

    expect(result.outcome).toBe("FAIL");
    expect(result.severity).toBe("CRITICAL");
    expect(JSON.parse(result.notes)).toMatchObject({ rubric: "helpfulness", outcome: "unsafe" });
  });

  it("maps a helpful outcome to a PASS decision", async () => {
    (prisma.$transaction as any).mockImplementation(async (fn: any) => fn(prisma));
    (prisma.qualityReviewTask.findUnique as any).mockResolvedValue({
      id: "t2", domain: "TUTOR_HELPFULNESS", schoolId: null, status: "CLAIMED", claimedByProfileId: "rp-1", version: 1,
    });
    (prisma.qualityReviewAssessment.findUnique as any).mockResolvedValue(null);
    (prisma.qualityReviewTask.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.qualityReviewAssessment.create as any).mockImplementation(async ({ data }: any) => ({ id: "a2", ...data }));

    const result = await recordHelpfulnessDecision({
      operator: { id: "op-1", role: "ADMIN" }, taskId: "t2", outcome: "helpful", idempotencyKey: "decide-helpful-1",
    });

    expect(result.outcome).toBe("PASS");
    expect(result.severity).toBe("MEDIUM");
  });
});
