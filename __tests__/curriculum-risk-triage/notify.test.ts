import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindMany = vi.hoisted(() => vi.fn());
const mockSendEmail = vi.hoisted(() => vi.fn(async () => ({ ok: true, id: "email-1" })));
const mockWarn = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: { user: { findMany: mockFindMany } },
}));
vi.mock("@/lib/email", () => ({ sendEmail: mockSendEmail }));
vi.mock("@/lib/logger", () => ({ logger: { warn: mockWarn, error: vi.fn(), info: vi.fn() } }));

import { notifyRiskReviewers } from "@/lib/curriculum/riskTriageNotify";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("notifyRiskReviewers", () => {
  it("queries users by role-holds-CURRICULUM_APPROVE OR isPlatformAdmin, and emails each", async () => {
    mockFindMany.mockResolvedValue([{ email: "moe@example.com" }, { email: "admin@example.com" }]);

    await notifyRiskReviewers("content-42", 6, ["grade_band_g1_3", "first_of_kind_cell"]);

    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.where.OR[0].role.in).toEqual(
      expect.arrayContaining(["ADMIN", "MOE_OFFICIAL", "MOE_SUPER_ADMIN"])
    );
    expect(callArgs.where.OR[0].role.in).not.toEqual(expect.arrayContaining(["TEACHER", "STUDENT", "GUARDIAN"]));
    expect(callArgs.where.OR[1]).toEqual({ isPlatformAdmin: true });

    expect(mockSendEmail).toHaveBeenCalledTimes(2);
    const firstEmail = mockSendEmail.mock.calls[0][0];
    expect(firstEmail.to).toBe("moe@example.com");
    expect(firstEmail.subject).toContain("flagged for review");
    expect(firstEmail.text).toContain("content-42");
    expect(firstEmail.text).toContain("grade_band_g1_3");
    expect(firstEmail.type).toBe("curriculum_risk_flagged");
    expect(firstEmail.transactional).toBe(true);
  });

  it("logs a warning and does not throw when there are zero recipients", async () => {
    mockFindMany.mockResolvedValue([]);
    await expect(notifyRiskReviewers("content-1", 4, ["first_of_kind_cell"])).resolves.toBeUndefined();
    expect(mockWarn).toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("does not throw when one recipient's email send fails", async () => {
    mockFindMany.mockResolvedValue([{ email: "a@example.com" }, { email: "b@example.com" }]);
    mockSendEmail.mockRejectedValueOnce(new Error("resend down")).mockResolvedValueOnce({ ok: true });
    await expect(notifyRiskReviewers("content-1", 4, ["first_of_kind_cell"])).resolves.toBeUndefined();
    expect(mockWarn).toHaveBeenCalled();
  });
});
