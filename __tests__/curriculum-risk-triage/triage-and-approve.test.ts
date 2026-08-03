import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCount = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn(async (args: any) => ({ ...args })));
const mockLogAudit = vi.hoisted(() => vi.fn(async () => {}));
const mockNotify = vi.hoisted(() => vi.fn(async () => {}));
const mockWarn = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    curriculumContent: {
      count: mockCount,
      update: mockUpdate,
    },
  },
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
  wordCount: 2000,
  minWordCount: 800,
};

const HIGH_RISK_CANDIDATE = {
  contentId: "content-high",
  grade: 2,
  subject: "SOCIAL_STUDIES",
  payload: { existing: "field" },
  wordCount: 410,
  minWordCount: 400,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("triageAndApprove", () => {
  it("auto-approves a low-risk candidate, stamping riskScore/riskReasons and audit-logging autoapproved", async () => {
    mockCount.mockResolvedValueOnce(1); // isFirstOfKindCell -> not first-of-kind path irrelevant here (low risk regardless)

    const result = await triageAndApprove(LOW_RISK_CANDIDATE, "system:bulk-approve-published", "published");

    expect(result.action).toBe("approved");
    expect(result.budgetExceeded).toBe(false);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { contentId: "content-low" },
      data: {
        status: "published",
        payload: expect.objectContaining({ existing: "field", riskScore: 0, riskReasons: [] }),
      },
    });
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "curriculum.risk.autoapproved", resourceId: "content-low" })
    );
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("flags a high-risk candidate under budget: NEEDS_REVIEW, audit-logged, notified", async () => {
    mockCount
      .mockResolvedValueOnce(0) // isFirstOfKindCell: zero approved rows -> first-of-kind true
      .mockResolvedValueOnce(WEEKLY_REVIEW_BUDGET - 1); // getFlaggedCountInWindow: under budget

    const result = await triageAndApprove(HIGH_RISK_CANDIDATE, "system:bulk-approve-published", "published");

    expect(result.action).toBe("flagged");
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { contentId: "content-high" },
      data: {
        status: "NEEDS_REVIEW",
        payload: expect.objectContaining({
          existing: "field",
          riskFlagged: true,
          riskScore: expect.any(Number),
          riskReasons: expect.arrayContaining(["grade_band_g1_3", "first_of_kind_cell"]),
        }),
      },
    });
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "curriculum.risk.flagged", resourceId: "content-high" })
    );
    expect(mockNotify).toHaveBeenCalledWith("content-high", expect.any(Number), expect.any(Array));
  });

  it("auto-approves a high-risk candidate when the weekly budget is exhausted, but still stamps risk data and marks budgetExceeded", async () => {
    mockCount
      .mockResolvedValueOnce(0) // first-of-kind
      .mockResolvedValueOnce(WEEKLY_REVIEW_BUDGET); // at/over budget

    const result = await triageAndApprove(HIGH_RISK_CANDIDATE, "system:bulk-approve-published", "published");

    expect(result.action).toBe("approved");
    expect(result.budgetExceeded).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { contentId: "content-high" },
      data: {
        status: "published",
        payload: expect.objectContaining({ riskScore: expect.any(Number) }),
      },
    });
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "curriculum.risk.autoapproved",
        details: expect.objectContaining({ budgetExceeded: true }),
      })
    );
    expect(mockNotify).not.toHaveBeenCalled();
    expect(mockWarn).toHaveBeenCalledWith(
      "[riskTriage] weekly review budget exhausted, auto-approving a high-risk candidate",
      expect.objectContaining({ contentId: "content-high" })
    );
  });

  it("fails closed to flagging when the budget check throws", async () => {
    mockCount
      .mockResolvedValueOnce(0) // first-of-kind
      .mockRejectedValueOnce(new Error("db down")); // getFlaggedCountInWindow throws

    const result = await triageAndApprove(HIGH_RISK_CANDIDATE, "system:bulk-approve-published", "published");

    expect(result.action).toBe("flagged");
    expect(mockWarn).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "NEEDS_REVIEW" }) })
    );
  });

  it("supports approvedStatus='APPROVED' for the promotion-pass-2b convention", async () => {
    mockCount.mockResolvedValueOnce(0);
    const result = await triageAndApprove(LOW_RISK_CANDIDATE, "system:promotion-pass-2b", "APPROVED");
    expect(result.action).toBe("approved");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "APPROVED" }) })
    );
  });
});
