import { describe, expect, it, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ prisma: { $transaction: vi.fn(), qualityReviewCalibrationSession: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), updateMany: vi.fn() } } }));
vi.mock("@/lib/audit", () => ({ logAuditRequired: vi.fn().mockResolvedValue(undefined) }));
import { prisma } from "@/lib/db";
import { computeDisagreement, openCalibrationSession } from "@/lib/quality/calibration";

describe("calibration disagreement", () => {
  beforeEach(() => vi.clearAllMocks());
  it("reports 100% agreement when all reviewers pick the same outcome", () => {
    const result = computeDisagreement([{ reviewerProfileId: "r1", outcome: "PASS" }, { reviewerProfileId: "r2", outcome: "PASS" }]);
    expect(result.agreementRate).toBe(1);
    expect(result.disagreements).toEqual([]);
  });

  it("surfaces every pairwise disagreement rather than hiding it", () => {
    const result = computeDisagreement([{ reviewerProfileId: "r1", outcome: "PASS" }, { reviewerProfileId: "r2", outcome: "FAIL" }]);
    expect(result.agreementRate).toBe(0);
    expect(result.disagreements).toEqual([{ a: "r1", b: "r2" }]);
  });

  it("lets only a review operations administrator open a draft calibration session", async () => {
    (prisma.$transaction as any).mockImplementation(async (fn: any) => fn(prisma));
    (prisma.qualityReviewCalibrationSession.findUnique as any).mockResolvedValue({ id: "session-1", status: "DRAFT", opensAt: null, domain: "TUTOR_HELPFULNESS" });
    (prisma.qualityReviewCalibrationSession.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.qualityReviewCalibrationSession.findUniqueOrThrow as any).mockResolvedValue({ id: "session-1", status: "OPEN" });
    await expect(openCalibrationSession({ operator: { id: "op-1", role: "ADMIN", isPlatformAdmin: true }, sessionId: "session-1" })).resolves.toMatchObject({ status: "OPEN" });
    await expect(openCalibrationSession({ operator: { id: "op-2", role: "TEACHER" }, sessionId: "session-1" })).rejects.toMatchObject({ code: "REVIEW_ADMIN_FORBIDDEN" });
  });
});
