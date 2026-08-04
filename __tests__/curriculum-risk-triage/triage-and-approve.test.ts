import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCount = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn(async (args: any) => args));
const mockLogAudit = vi.hoisted(() => vi.fn(async () => {}));
const mockNotify = vi.hoisted(() => vi.fn(async () => {}));
const mockWarn = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: { curriculumContent: { count: mockCount, update: mockUpdate } },
}));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/logger", () => ({ logger: { warn: mockWarn, error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/curriculum/riskTriageNotify", () => ({ notifyRiskReviewers: mockNotify }));

import { triageAndApprove, WEEKLY_REVIEW_BUDGET } from "@/lib/curriculum/riskTriage";

const LOW_RISK_CANDIDATE = {
  contentId: "content-low",
  grade: 9,
  subject: "MATH",
  payload: { existing: "field" },
  approvalMetadata: { approvalStatus: "APPROVED", bulkApproved: true },
  wordCount: 5000,
  minWordCount: 3500,
};

const HIGH_RISK_CANDIDATE = {
  contentId: "content-high",
  grade: 2,
  subject: "SOCIAL_STUDIES",
  payload: { existing: "field" },
  wordCount: 3550,
  minWordCount: 3500,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("triageAndApprove", () => {
  it("auto-approves low-risk content and records its risk decision", async () => {
    mockCount.mockResolvedValueOnce(1);
    const result = await triageAndApprove(LOW_RISK_CANDIDATE, "system:bulk", "published");

    expect(result).toEqual({
      action: "approved",
      contentId: "content-low",
      riskScore: 0,
      riskReasons: [],
      budgetExceeded: false,
    });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { contentId: "content-low" },
      data: {
        status: "published",
        payload: {
          existing: "field",
          approvalStatus: "APPROVED",
          bulkApproved: true,
          riskScore: 0,
          riskReasons: [],
        },
      },
    });
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "curriculum.risk.autoapproved", resourceId: "content-low" })
    );
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("flags high-risk content when review budget is available", async () => {
    mockCount.mockResolvedValueOnce(0).mockResolvedValueOnce(WEEKLY_REVIEW_BUDGET - 1);
    const result = await triageAndApprove(HIGH_RISK_CANDIDATE, "system:bulk", "published");

    expect(result.action).toBe("flagged");
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { contentId: "content-high" },
      data: {
        status: "NEEDS_REVIEW",
        payload: expect.objectContaining({
          existing: "field",
          riskFlagged: true,
          riskReasons: expect.arrayContaining(["grade_band_g1_3", "first_of_kind_cell"]),
        }),
      },
    });
    const flaggedPayload = mockUpdate.mock.calls[0]![0].data.payload;
    expect(flaggedPayload).not.toHaveProperty("approvalStatus");
    expect(flaggedPayload).not.toHaveProperty("bulkApproved");
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "curriculum.risk.flagged", resourceId: "content-high" })
    );
    expect(mockNotify).toHaveBeenCalledWith("content-high", expect.any(Number), expect.any(Array));
  });

  it("auto-approves high-risk content only after the review budget is exhausted", async () => {
    mockCount.mockResolvedValueOnce(0).mockResolvedValueOnce(WEEKLY_REVIEW_BUDGET);
    const result = await triageAndApprove(HIGH_RISK_CANDIDATE, "system:bulk", "published");

    expect(result.action).toBe("approved");
    if (result.action === "approved") expect(result.budgetExceeded).toBe(true);
    expect(mockNotify).not.toHaveBeenCalled();
    expect(mockWarn).toHaveBeenCalledWith(
      "[riskTriage] weekly review budget exhausted, auto-approving a high-risk candidate",
      expect.objectContaining({ contentId: "content-high" })
    );
  });

  it("fails closed to review when the budget lookup fails", async () => {
    mockCount.mockResolvedValueOnce(0).mockRejectedValueOnce(new Error("db down"));
    await expect(triageAndApprove(HIGH_RISK_CANDIDATE, "system:bulk", "published")).resolves.toEqual(
      expect.objectContaining({ action: "flagged" })
    );
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "NEEDS_REVIEW" }) })
    );
  });

  it("preserves the promotion pipeline's APPROVED status convention", async () => {
    mockCount.mockResolvedValueOnce(1);
    await triageAndApprove(LOW_RISK_CANDIDATE, "system:promotion", "APPROVED");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "APPROVED" }) })
    );
  });

  it("keeps the status write when reviewer notification fails", async () => {
    mockCount.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    mockNotify.mockRejectedValueOnce(new Error("email unavailable"));
    await expect(triageAndApprove(HIGH_RISK_CANDIDATE, "system:bulk", "published")).resolves.toEqual(
      expect.objectContaining({ action: "flagged" })
    );
    expect(mockWarn).toHaveBeenCalledWith(
      "[riskTriage] reviewer notification failed",
      expect.objectContaining({ contentId: "content-high" })
    );
  });
});
