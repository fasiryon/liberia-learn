// __tests__/notifications.route.test.ts
// Verifies that notification log and send routes scope to the requesting user's school.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockLogFindMany = vi.hoisted(() => vi.fn());
const mockUserFindFirst = vi.hoisted(() => vi.fn());
const mockNotifCreate = vi.hoisted(() => vi.fn());
const mockSendHomeworkGraded = vi.hoisted(() => vi.fn());
const mockSendWeeklyProgress = vi.hoisted(() => vi.fn());
const mockSendSMS = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/db", () => ({
  prisma: {
    notificationLog: { findMany: mockLogFindMany, create: mockNotifCreate },
    user: { findFirst: mockUserFindFirst },
  },
}));
vi.mock("@/lib/email", () => ({
  sendHomeworkGraded: mockSendHomeworkGraded,
  sendWeeklyProgressToGuardian: mockSendWeeklyProgress,
}));
vi.mock("@/lib/sms", () => ({ sendSMS: mockSendSMS }));

import { GET } from "@/app/api/notifications/log/route";
import { POST } from "@/app/api/notifications/send/route";

function makePostReq(body: unknown) {
  return new Request("http://localhost/api/notifications/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireRole.mockResolvedValue({ id: "actor-1", role: "TEACHER", schoolId: "school-1" });
  mockLogFindMany.mockResolvedValue([]);
  mockUserFindFirst.mockResolvedValue(null);
  mockNotifCreate.mockResolvedValue({ id: "notif-1" });
  mockSendHomeworkGraded.mockResolvedValue({ ok: true });
  mockSendSMS.mockResolvedValue({ ok: true });
});

describe("GET /api/notifications/log — school isolation", () => {
  it("scopes findMany to user's schoolId", async () => {
    await GET();
    expect(mockLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user: { schoolId: "school-1" } },
      })
    );
  });

  it("returns logs array in response", async () => {
    const log = { id: "log-1", createdAt: new Date(), user: { email: "t@school.edu", name: "T" } };
    mockLogFindMany.mockResolvedValueOnce([log]);
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.logs).toHaveLength(1);
  });

  it("returns 403 when unauthenticated", async () => {
    const err = Object.assign(new Error("Forbidden"), { status: 403 });
    mockRequireRole.mockRejectedValueOnce(err);
    const res = await GET();
    expect(res.status).toBe(403);
  });
});

describe("POST /api/notifications/send — school isolation", () => {
  it("returns 403 if target user is not in same school", async () => {
    mockUserFindFirst.mockResolvedValueOnce(null);
    const res = await POST(makePostReq({ type: "custom", userId: "other-user" }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/outside your school|not found/i);
  });

  it("uses schoolId filter when looking up target user", async () => {
    mockUserFindFirst.mockResolvedValueOnce({ id: "target-1", email: "t@school.edu", name: "T" });
    mockNotifCreate.mockResolvedValue({ id: "n-1" });
    await POST(makePostReq({ type: "custom", userId: "target-1", channel: "email" }));
    expect(mockUserFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "target-1", schoolId: "school-1" }),
      })
    );
  });
});
