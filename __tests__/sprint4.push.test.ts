import { describe, it, expect, vi, beforeEach } from "vitest";

// ===== Hoisted mocks =====
const { mockPrisma, mockWebPush, mockGetServerSession } = vi.hoisted(() => {
  const mockPrisma = {
    pushSubscription: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      update: vi.fn(),
    },
    notificationLog: {
      create: vi.fn(),
    },
    student: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ schoolId: null, role: "STUDENT", guardianPhoneE164: null }),
      findMany: vi.fn(),
    },
  };
  const mockWebPush = {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(),
  };
  const mockGetServerSession = vi.fn();
  return { mockPrisma, mockWebPush, mockGetServerSession };
});

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("web-push", () => ({ default: mockWebPush }));
vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(),
  getServerSession: vi.fn(),
  authOptions: {},
}));
vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/autonomous/signals/productSignalService", () => ({ logProductSignal: vi.fn() }));

// ===== Tests =====

describe("sendPush — lib/push/sendPush", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.VAPID_PUBLIC_KEY = "test-public-key";
    process.env.VAPID_PRIVATE_KEY = "test-private-key";
    process.env.VAPID_SUBJECT = "mailto:test@test.com";
  });

  it("returns early when user has no subscriptions", async () => {
    mockPrisma.pushSubscription.findMany.mockResolvedValueOnce([]);
    const { sendPushToUser } = await import("@/lib/push/sendPush");
    await sendPushToUser("user-1", { title: "Test", body: "Hello" });
    expect(mockWebPush.sendNotification).not.toHaveBeenCalled();
  });

  it("returns early when VAPID keys are not configured", async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    mockPrisma.pushSubscription.findMany.mockResolvedValueOnce([
      { id: "sub-1", endpoint: "https://push.example.com/1", p256dh: "key1", auth: "auth1" },
    ]);
    const { sendPushToUser } = await import("@/lib/push/sendPush");
    await sendPushToUser("user-1", { title: "Test", body: "Hello" });
    expect(mockWebPush.sendNotification).not.toHaveBeenCalled();
  });

  it("sends push and logs NotificationLog on success", async () => {
    process.env.VAPID_PUBLIC_KEY = "pub";
    process.env.VAPID_PRIVATE_KEY = "priv";
    mockPrisma.pushSubscription.findMany.mockResolvedValueOnce([
      { id: "sub-1", endpoint: "https://push.example.com/1", p256dh: "key1", auth: "auth1" },
    ]);
    mockWebPush.sendNotification.mockResolvedValueOnce({});
    mockPrisma.pushSubscription.update.mockResolvedValueOnce({});
    mockPrisma.notificationLog.create.mockResolvedValueOnce({});

    const { sendPushToUser } = await import("@/lib/push/sendPush");
    await sendPushToUser("user-1", { title: "Hello", body: "World" });

    expect(mockWebPush.sendNotification).toHaveBeenCalledOnce();
    expect(mockPrisma.notificationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ channel: "push", status: "sent" }),
      })
    );
  });

  it("deletes expired subscription (410 status)", async () => {
    process.env.VAPID_PUBLIC_KEY = "pub";
    process.env.VAPID_PRIVATE_KEY = "priv";
    mockPrisma.pushSubscription.findMany.mockResolvedValueOnce([
      { id: "sub-expired", endpoint: "https://expired.example.com", p256dh: "k", auth: "a" },
    ]);
    const err: any = new Error("Gone");
    err.statusCode = 410;
    mockWebPush.sendNotification.mockRejectedValueOnce(err);
    mockPrisma.pushSubscription.deleteMany.mockResolvedValueOnce({ count: 1 });

    const { sendPushToUser } = await import("@/lib/push/sendPush");
    await sendPushToUser("user-1", { title: "Test", body: "Gone" });

    expect(mockPrisma.pushSubscription.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["sub-expired"] } } })
    );
  });

  it("sendPushToMany calls sendPushToUser for each userId", async () => {
    mockPrisma.pushSubscription.findMany.mockResolvedValue([]);
    const { sendPushToMany } = await import("@/lib/push/sendPush");
    await sendPushToMany(["u1", "u2", "u3"], { title: "Batch", body: "Hi" });
    expect(mockPrisma.pushSubscription.findMany).toHaveBeenCalledTimes(3);
  });
});

describe("GET /api/notifications/vapid-public-key", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 503 when VAPID_PUBLIC_KEY is not set", async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    const { GET } = await import("@/app/api/notifications/vapid-public-key/route");
    const res = await GET();
    expect(res.status).toBe(503);
  });

  it("returns publicKey when VAPID_PUBLIC_KEY is configured", async () => {
    process.env.VAPID_PUBLIC_KEY = "my-vapid-key";
    const { GET } = await import("@/app/api/notifications/vapid-public-key/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.publicKey).toBe("my-vapid-key");
  });
});

describe("POST /api/notifications/subscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const { POST } = await import("@/app/api/notifications/subscribe/route");
    const req = new Request("http://localhost/api/notifications/subscribe", {
      method: "POST",
      body: JSON.stringify({ endpoint: "https://x.com", keys: { p256dh: "k", auth: "a" } }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it("upserts subscription for authenticated user", async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { id: "user-1" } });
    mockPrisma.pushSubscription.upsert.mockResolvedValueOnce({});

    const { POST } = await import("@/app/api/notifications/subscribe/route");
    const req = new Request("http://localhost/api/notifications/subscribe", {
      method: "POST",
      body: JSON.stringify({
        endpoint: "https://push.example.com/endpoint",
        keys: { p256dh: "pubkey", auth: "authkey" },
        deviceName: "Chrome on Windows",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(201);
    expect(mockPrisma.pushSubscription.upsert).toHaveBeenCalledOnce();
  });
});

describe("DELETE /api/notifications/unsubscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes subscription scoped to user", async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { id: "user-1" } });
    mockPrisma.pushSubscription.deleteMany.mockResolvedValueOnce({ count: 1 });

    const { DELETE } = await import("@/app/api/notifications/unsubscribe/route");
    const req = new Request("http://localhost/api/notifications/unsubscribe", {
      method: "DELETE",
      body: JSON.stringify({ endpoint: "https://push.example.com/endpoint" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await DELETE(req as any);
    expect(res.status).toBe(200);
    expect(mockPrisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { endpoint: "https://push.example.com/endpoint", userId: "user-1" },
    });
  });
});
