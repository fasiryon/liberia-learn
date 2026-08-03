import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockPrisma, mockCreateInboxNotification, mockSendPushToUser, mockSendEmail } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findMany: vi.fn() },
    school: { findUnique: vi.fn() },
  },
  mockCreateInboxNotification: vi.fn(),
  mockSendPushToUser: vi.fn(),
  mockSendEmail: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/notifications/inboxService", () => ({ createInboxNotification: mockCreateInboxNotification }));
vi.mock("@/lib/push/sendPush", () => ({ sendPushToUser: mockSendPushToUser }));
vi.mock("@/lib/email", () => ({ sendEmail: mockSendEmail }));

import { notifySchoolSafeguarding, notifyPlatformSafeguardingFallback } from "@/lib/agents/safeguarding/notify";

describe("notifySchoolSafeguarding", () => {
  const originalFallbackEmail = process.env.PLATFORM_SAFEGUARDING_ESCALATION_EMAIL;

  beforeEach(() => {
    mockPrisma.user.findMany.mockReset();
    mockPrisma.school.findUnique.mockReset();
    mockCreateInboxNotification.mockReset();
    mockSendPushToUser.mockReset();
    mockSendPushToUser.mockResolvedValue(undefined);
    mockSendEmail.mockReset();
    mockSendEmail.mockResolvedValue({ ok: true, id: "email-1" });
  });

  afterEach(() => {
    if (originalFallbackEmail === undefined) {
      delete process.env.PLATFORM_SAFEGUARDING_ESCALATION_EMAIL;
    } else {
      process.env.PLATFORM_SAFEGUARDING_ESCALATION_EMAIL = originalFallbackEmail;
    }
  });

  it("notifies ADMIN-role users at the school", async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: "admin-1" }, { id: "admin-2" }]);
    mockPrisma.school.findUnique.mockResolvedValue({ designatedSafetyStaffUserId: null });

    const result = await notifySchoolSafeguarding("school-1", "concern raised");

    expect(result.notifiedUserIds.sort()).toEqual(["admin-1", "admin-2"]);
    expect(result.delivered).toBe(true);
    expect(mockCreateInboxNotification).toHaveBeenCalledTimes(2);
    expect(mockSendPushToUser).toHaveBeenCalledTimes(2);
  });

  it("also notifies the designated safety staff user", async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: "admin-1" }]);
    mockPrisma.school.findUnique.mockResolvedValue({ designatedSafetyStaffUserId: "safety-staff-1" });

    const result = await notifySchoolSafeguarding("school-1", "concern raised");

    expect(result.notifiedUserIds.sort()).toEqual(["admin-1", "safety-staff-1"]);
  });

  it("deduplicates when the designated safety staff is also an ADMIN", async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: "admin-1" }]);
    mockPrisma.school.findUnique.mockResolvedValue({ designatedSafetyStaffUserId: "admin-1" });

    const result = await notifySchoolSafeguarding("school-1", "concern raised");

    expect(result.notifiedUserIds).toEqual(["admin-1"]);
    expect(result.delivered).toBe(true);
    expect(result.failures).toEqual([]);
    expect(mockCreateInboxNotification).toHaveBeenCalledTimes(1);
  });

  it("reports a failed delivery when the durable inbox write fails", async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: "admin-1" }]);
    mockPrisma.school.findUnique.mockResolvedValue({ designatedSafetyStaffUserId: null });
    mockCreateInboxNotification.mockRejectedValue(new Error("database down"));

    const result = await notifySchoolSafeguarding("school-1", "concern raised");

    expect(result.notifiedUserIds).toEqual([]);
    expect(result.delivered).toBe(false);
    expect(result.failures).toEqual([
      expect.objectContaining({ channel: "inbox", userId: "admin-1" }),
    ]);
    expect(mockSendPushToUser).not.toHaveBeenCalled();
  });

  it("still records the inbox notification even when push fails", async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: "admin-1" }]);
    mockPrisma.school.findUnique.mockResolvedValue({ designatedSafetyStaffUserId: null });
    mockSendPushToUser.mockRejectedValue(new Error("push down"));

    const result = await notifySchoolSafeguarding("school-1", "concern raised");

    expect(result.notifiedUserIds).toEqual(["admin-1"]);
    expect(result.delivered).toBe(true);
    expect(result.failures).toEqual([
      expect.objectContaining({ channel: "push", userId: "admin-1" }),
    ]);
    expect(mockCreateInboxNotification).toHaveBeenCalledTimes(1);
  });

  it("returns an empty notifiedUserIds list when the school has no admins or safety staff", async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.school.findUnique.mockResolvedValue({ designatedSafetyStaffUserId: null });

    const result = await notifySchoolSafeguarding("school-1", "concern raised");

    expect(result.notifiedUserIds).toEqual([]);
    expect(result.delivered).toBe(false);
    expect(mockCreateInboxNotification).not.toHaveBeenCalled();
  });

  it("NR-9.5: alerts the platform fallback when a school has nobody to notify", async () => {
    process.env.PLATFORM_SAFEGUARDING_ESCALATION_EMAIL = "ops@example.com";
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.school.findUnique.mockResolvedValue({ designatedSafetyStaffUserId: null });

    await notifySchoolSafeguarding("school-1", "concern raised");

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "ops@example.com", type: "safeguarding_platform_fallback" })
    );
  });

  it("NR-9.5: does not attempt the platform fallback email when the school has real recipients", async () => {
    process.env.PLATFORM_SAFEGUARDING_ESCALATION_EMAIL = "ops@example.com";
    mockPrisma.user.findMany.mockResolvedValue([{ id: "admin-1" }]);
    mockPrisma.school.findUnique.mockResolvedValue({ designatedSafetyStaffUserId: null });

    await notifySchoolSafeguarding("school-1", "concern raised");

    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});

describe("notifyPlatformSafeguardingFallback", () => {
  const originalFallbackEmail = process.env.PLATFORM_SAFEGUARDING_ESCALATION_EMAIL;

  beforeEach(() => {
    mockSendEmail.mockReset();
    mockSendEmail.mockResolvedValue({ ok: true, id: "email-1" });
  });

  afterEach(() => {
    if (originalFallbackEmail === undefined) {
      delete process.env.PLATFORM_SAFEGUARDING_ESCALATION_EMAIL;
    } else {
      process.env.PLATFORM_SAFEGUARDING_ESCALATION_EMAIL = originalFallbackEmail;
    }
  });

  it("sends to the configured address and reports ok", async () => {
    process.env.PLATFORM_SAFEGUARDING_ESCALATION_EMAIL = "ops@example.com";

    const result = await notifyPlatformSafeguardingFallback("test reason");

    expect(result).toEqual({ ok: true });
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "ops@example.com", recipientRole: "platform_admin" })
    );
  });

  it("reports a skipped failed delivery when the env var is unset", async () => {
    delete process.env.PLATFORM_SAFEGUARDING_ESCALATION_EMAIL;

    const result = await notifyPlatformSafeguardingFallback("test reason");

    expect(result).toEqual({
      ok: false,
      skipped: true,
      error: "fallback_email_not_configured",
    });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("reports ok:false without throwing when the email provider fails", async () => {
    process.env.PLATFORM_SAFEGUARDING_ESCALATION_EMAIL = "ops@example.com";
    mockSendEmail.mockResolvedValue({ ok: false, error: "domain not verified" });

    const result = await notifyPlatformSafeguardingFallback("test reason");

    expect(result).toEqual({ ok: false, error: "domain not verified" });
  });
});
