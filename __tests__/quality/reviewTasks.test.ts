import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: { $transaction: vi.fn(), qualityReviewTask: { findUnique: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), create: vi.fn() }, reviewerRestriction: { findFirst: vi.fn() } } }));
vi.mock("@/lib/audit", () => ({ logAuditRequiredWithId: vi.fn().mockResolvedValue("audit-1") }));

import { prisma } from "@/lib/db";
import { claimQualityReviewTask } from "@/lib/quality/reviewTasks";
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
