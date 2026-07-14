import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockCreateInboxNotification, mockSendPushToUser } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findMany: vi.fn() },
    school: { findUnique: vi.fn() },
  },
  mockCreateInboxNotification: vi.fn(),
  mockSendPushToUser: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/notifications/inboxService", () => ({ createInboxNotification: mockCreateInboxNotification }));
vi.mock("@/lib/push/sendPush", () => ({ sendPushToUser: mockSendPushToUser }));

import { notifySchoolSafeguarding } from "@/lib/agents/safeguarding/notify";

describe("notifySchoolSafeguarding", () => {
  beforeEach(() => {
    mockPrisma.user.findMany.mockReset();
    mockPrisma.school.findUnique.mockReset();
    mockCreateInboxNotification.mockReset();
    mockSendPushToUser.mockReset();
    mockSendPushToUser.mockResolvedValue(undefined);
  });

  it("notifies ADMIN-role users at the school", async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: "admin-1" }, { id: "admin-2" }]);
    mockPrisma.school.findUnique.mockResolvedValue({ designatedSafetyStaffUserId: null });

    const result = await notifySchoolSafeguarding("school-1", "concern raised");

    expect(result.notifiedUserIds.sort()).toEqual(["admin-1", "admin-2"]);
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
    expect(mockCreateInboxNotification).toHaveBeenCalledTimes(1);
  });

  it("still records the inbox notification even when push fails", async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: "admin-1" }]);
    mockPrisma.school.findUnique.mockResolvedValue({ designatedSafetyStaffUserId: null });
    mockSendPushToUser.mockRejectedValue(new Error("push down"));

    const result = await notifySchoolSafeguarding("school-1", "concern raised");

    expect(result.notifiedUserIds).toEqual(["admin-1"]);
    expect(mockCreateInboxNotification).toHaveBeenCalledTimes(1);
  });

  it("returns an empty notifiedUserIds list when the school has no admins or safety staff", async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.school.findUnique.mockResolvedValue({ designatedSafetyStaffUserId: null });

    const result = await notifySchoolSafeguarding("school-1", "concern raised");

    expect(result.notifiedUserIds).toEqual([]);
    expect(mockCreateInboxNotification).not.toHaveBeenCalled();
  });
});
