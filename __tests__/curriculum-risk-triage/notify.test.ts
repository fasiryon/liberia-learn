import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindMany = vi.hoisted(() => vi.fn());
const mockFindUnique = vi.hoisted(() => vi.fn());
const mockSendEmail = vi.hoisted(() =>
  vi.fn(
    async (_input: Record<string, unknown>): Promise<{ ok: boolean; id?: string }> => ({
      ok: true,
      id: "email-1",
    })
  )
);
const mockWarn = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ prisma: { user: { findMany: mockFindMany }, curriculumContent: { findUnique: mockFindUnique } } }));
vi.mock("@/lib/email", () => ({ sendEmail: mockSendEmail }));
vi.mock("@/lib/logger", () => ({ logger: { warn: mockWarn, error: vi.fn(), info: vi.fn() } }));

import { notifyRiskReviewers } from "@/lib/curriculum/riskTriageNotify";

beforeEach(() => {
  vi.clearAllMocks();
  mockFindUnique.mockResolvedValue({ schoolId: "school-1", editedBy: null });
});

describe("notifyRiskReviewers", () => {
  it("emails explicit higher-authority and same-school recipients", async () => {
    mockFindMany.mockResolvedValue([{ email: "moe@example.com" }, { email: "admin@example.com" }]);

    await notifyRiskReviewers("content-42", 6, ["grade_band_g1_3", "first_of_kind_cell"]);

    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.where.OR).toEqual(expect.arrayContaining([
      { isPlatformAdmin: true },
      { role: { in: ["MOE_OFFICIAL", "MOE_SUPER_ADMIN"] } },
      { role: "ADMIN", schoolId: "school-1" },
    ]));
    expect(mockSendEmail).toHaveBeenCalledTimes(2);
    expect(mockSendEmail.mock.calls[0]![0]).toEqual(
      expect.objectContaining({
        to: "moe@example.com",
        subject: expect.stringContaining("flagged for review"),
        text: expect.stringContaining("content-42"),
        type: "curriculum_risk_flagged",
        transactional: true,
      })
    );
    expect(mockSendEmail.mock.calls[0]![0].text).toContain("grade_band_g1_3");
  });

  it("warns without throwing when no reviewers are configured", async () => {
    mockFindMany.mockResolvedValue([]);
    await expect(notifyRiskReviewers("content-1", 4, ["first_of_kind_cell"])).resolves.toBeUndefined();
    expect(mockWarn).toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("isolates a failed email from the other recipients", async () => {
    mockFindMany.mockResolvedValue([{ email: "a@example.com" }, { email: "b@example.com" }]);
    mockSendEmail.mockRejectedValueOnce(new Error("resend down")).mockResolvedValueOnce({ ok: true });
    await expect(notifyRiskReviewers("content-1", 4, ["first_of_kind_cell"])).resolves.toBeUndefined();
    expect(mockSendEmail).toHaveBeenCalledTimes(2);
    expect(mockWarn).toHaveBeenCalled();
  });
});
