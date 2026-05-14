import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    message: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    messageReadReceipt: {
      upsert: vi.fn(),
    },
    guardianMessage: {
      count: vi.fn(),
    },
    student: {
      findFirst: vi.fn(),
    },
    enrollment: {
      findFirst: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));

vi.mock("@/lib/push/sendPush", () => ({ sendPushToUser: vi.fn() }));

vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: vi.fn(),
  rateLimitExceededResponse: vi.fn(() => new Response(JSON.stringify({ error: "rate limited" }), { status: 429 })),
}));

const { requireUser } = await import("@/lib/auth");
const { prisma } = await import("@/lib/db");
const { checkRateLimit } = await import("@/lib/rateLimit");
const { sendPushToUser } = await import("@/lib/push/sendPush");

const mockRequireUser = vi.mocked(requireUser);
const mockPrisma = prisma as any;
const mockRateLimit = vi.mocked(checkRateLimit);
const mockPush = vi.mocked(sendPushToUser);

function mockRequest(body?: unknown, searchParams?: Record<string, string>) {
  const url = new URL("http://localhost/api/student/messages");
  if (searchParams) {
    Object.entries(searchParams).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  return {
    json: async () => body,
    nextUrl: url,
  } as any;
}

// ── 1. threadKey determinism ───────────────────────────────────────────────────

describe("threadKey", () => {
  it("is deterministic regardless of sender/recipient order", () => {
    function buildThreadKey(a: string, b: string) {
      return [a, b].sort().join(":");
    }
    const k1 = buildThreadKey("user-aaa", "user-bbb");
    const k2 = buildThreadKey("user-bbb", "user-aaa");
    expect(k1).toBe(k2);
    expect(k1).toBe("user-aaa:user-bbb");
  });

  it("contains exactly two segments separated by colon", () => {
    function buildThreadKey(a: string, b: string) {
      return [a, b].sort().join(":");
    }
    const key = buildThreadKey("abc", "xyz");
    const parts = key.split(":");
    expect(parts).toHaveLength(2);
  });
});

// ── 2. Student messages POST ──────────────────────────────────────────────────

describe("POST /api/student/messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimit.mockResolvedValue({ allowed: true, remaining: 9, resetAt: Date.now() + 86400000, limit: 10, retryAfter: 0, backend: "memory", scope: "instance", namespace: "student_message" });
    mockPrisma.student.findFirst.mockResolvedValue({ id: "student-1" });
    mockPrisma.enrollment.findFirst.mockResolvedValue({ Class: { schoolId: "school-1", teacherId: "teacher-1" } });
    mockPrisma.message.create.mockResolvedValue({ id: "msg-1", threadKey: "student-1:teacher-1" });
    mockPrisma.user.findUnique.mockResolvedValue({ name: "Mr. Smith" });
    mockPush.mockResolvedValue(undefined);
  });

  it("allows student to message their own class teacher", async () => {
    mockRequireUser.mockResolvedValue({ id: "student-user-1", role: "STUDENT", schoolId: "school-1", name: "Test Student", isPlatformAdmin: false } as any);
    const { POST } = await import("@/app/api/student/messages/route");
    const res = await POST(mockRequest({ teacherId: "teacher-1", body: "Hello teacher" }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.messageId).toBe("msg-1");
  });

  it("returns 403 when teacher is not in student's classes", async () => {
    mockRequireUser.mockResolvedValue({ id: "student-user-1", role: "STUDENT", schoolId: "school-1", name: "Test", isPlatformAdmin: false } as any);
    mockPrisma.enrollment.findFirst.mockResolvedValue(null);
    const { POST } = await import("@/app/api/student/messages/route");
    const res = await POST(mockRequest({ teacherId: "teacher-unrelated", body: "Hello" }));
    expect(res.status).toBe(403);
  });

  it("returns 429 on the 11th message (rate limit exceeded)", async () => {
    mockRequireUser.mockResolvedValue({ id: "student-user-1", role: "STUDENT", schoolId: "school-1", name: "Test", isPlatformAdmin: false } as any);
    mockRateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: Date.now() + 86400000, limit: 10, retryAfter: 3600, backend: "memory", scope: "instance", namespace: "student_message" });
    const { POST } = await import("@/app/api/student/messages/route");
    const res = await POST(mockRequest({ teacherId: "teacher-1", body: "11th message" }));
    expect(res.status).toBe(429);
  });

  it("fires push notification to teacher on student message", async () => {
    mockRequireUser.mockResolvedValue({ id: "student-user-1", role: "STUDENT", schoolId: "school-1", name: "Alice", isPlatformAdmin: false } as any);
    const { POST } = await import("@/app/api/student/messages/route");
    await POST(mockRequest({ teacherId: "teacher-1", body: "Hi teacher!" }));
    expect(mockPush).toHaveBeenCalledWith(
      "teacher-1",
      expect.objectContaining({ title: "Message from Student", url: "/teacher/messages" })
    );
  });

  it("returns 403 for non-student roles", async () => {
    mockRequireUser.mockResolvedValue({ id: "teacher-1", role: "TEACHER", schoolId: "school-1", isPlatformAdmin: false } as any);
    const { POST } = await import("@/app/api/student/messages/route");
    const res = await POST(mockRequest({ teacherId: "teacher-1", body: "Hello" }));
    expect(res.status).toBe(403);
  });
});

// ── 3. Student messages GET / unread count ────────────────────────────────────

describe("GET /api/student/messages/unread-count", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 0 unread count after reading messages", async () => {
    mockRequireUser.mockResolvedValue({ id: "student-1", role: "STUDENT", isPlatformAdmin: false } as any);
    mockPrisma.message.count.mockResolvedValue(0);
    const { GET } = await import("@/app/api/student/messages/unread-count/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBe(0);
  });

  it("returns correct unread count when messages exist", async () => {
    mockRequireUser.mockResolvedValue({ id: "student-1", role: "STUDENT", isPlatformAdmin: false } as any);
    mockPrisma.message.count.mockResolvedValue(3);
    const { GET } = await import("@/app/api/student/messages/unread-count/route");
    const res = await GET();
    const data = await res.json();
    expect(data.count).toBe(3);
  });

  it("returns 403 for non-student roles", async () => {
    mockRequireUser.mockResolvedValue({ id: "teacher-1", role: "TEACHER", isPlatformAdmin: false } as any);
    const { GET } = await import("@/app/api/student/messages/unread-count/route");
    const res = await GET();
    expect(res.status).toBe(403);
  });
});

describe("GET /api/student/messages (threads)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns grouped threads with correct unread counts", async () => {
    mockRequireUser.mockResolvedValue({ id: "student-1", role: "STUDENT", isPlatformAdmin: false } as any);
    mockPrisma.message.findMany.mockResolvedValue([
      {
        id: "m1",
        fromUserId: "student-1",
        toUserId: "teacher-1",
        body: "Hello",
        senderRole: "STUDENT",
        recipientRole: "TEACHER",
        threadKey: "student-1:teacher-1",
        createdAt: new Date("2026-05-13T10:00:00Z"),
        fromUser: { id: "student-1", name: "Alice", role: "STUDENT" },
        toUser: { id: "teacher-1", name: "Mr Smith", role: "TEACHER" },
        readReceipts: [],
      },
    ]);
    mockPrisma.messageReadReceipt.upsert.mockResolvedValue({});
    const { GET } = await import("@/app/api/student/messages/route");
    const res = await GET();
    const data = await res.json();
    expect(data.threads).toHaveLength(1);
    expect(data.threads[0].otherName).toBe("Mr Smith");
  });

  it("creates MessageReadReceipt on fetch for unread messages", async () => {
    mockRequireUser.mockResolvedValue({ id: "student-1", role: "STUDENT", isPlatformAdmin: false } as any);
    mockPrisma.message.findMany.mockResolvedValue([
      {
        id: "m1",
        fromUserId: "teacher-1",
        toUserId: "student-1",
        body: "Hi",
        senderRole: "TEACHER",
        recipientRole: "STUDENT",
        threadKey: "student-1:teacher-1",
        createdAt: new Date(),
        fromUser: { id: "teacher-1", name: "Mr Smith", role: "TEACHER" },
        toUser: { id: "student-1", name: "Alice", role: "STUDENT" },
        readReceipts: [],
      },
    ]);
    mockPrisma.messageReadReceipt.upsert.mockResolvedValue({});
    const { GET } = await import("@/app/api/student/messages/route");
    await GET();
    expect(mockPrisma.messageReadReceipt.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { messageId_userId: { messageId: "m1", userId: "student-1" } } })
    );
  });
});

// ── 4. Teacher reply ──────────────────────────────────────────────────────────

describe("POST /api/teacher/messages/reply", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.message.findFirst.mockResolvedValue({ senderRole: "STUDENT", recipientRole: "TEACHER", fromUserId: "student-1", toUserId: "teacher-1" });
    mockPrisma.message.create.mockResolvedValue({ id: "reply-1" });
    mockPush.mockResolvedValue(undefined);
  });

  it("fires push to student on teacher reply", async () => {
    mockRequireUser.mockResolvedValue({ id: "teacher-1", role: "TEACHER", schoolId: "school-1", name: "Mr Smith", isPlatformAdmin: false } as any);
    const { POST } = await import("@/app/api/teacher/messages/reply/route");
    const res = await POST(mockRequest({ threadKey: "student-1:teacher-1", body: "Hello student", recipientId: "student-1" }));
    expect(res.status).toBe(201);
    expect(mockPush).toHaveBeenCalledWith(
      "student-1",
      expect.objectContaining({ title: "Reply from your teacher", url: "/student/messages" })
    );
  });

  it("returns 403 when teacher is not in the threadKey", async () => {
    mockRequireUser.mockResolvedValue({ id: "teacher-other", role: "TEACHER", schoolId: "school-1", isPlatformAdmin: false } as any);
    const { POST } = await import("@/app/api/teacher/messages/reply/route");
    const res = await POST(mockRequest({ threadKey: "student-1:teacher-1", body: "Hello", recipientId: "student-1" }));
    expect(res.status).toBe(403);
  });

  it("returns 403 for non-teacher roles", async () => {
    mockRequireUser.mockResolvedValue({ id: "student-1", role: "STUDENT", isPlatformAdmin: false } as any);
    const { POST } = await import("@/app/api/teacher/messages/reply/route");
    const res = await POST(mockRequest({ threadKey: "student-1:teacher-1", body: "Hello", recipientId: "teacher-1" }));
    expect(res.status).toBe(403);
  });
});

// ── 5. Admin message stats ────────────────────────────────────────────────────

describe("GET /api/admin/messages/stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.message.count.mockResolvedValue(5);
    mockPrisma.guardianMessage.count.mockResolvedValue(3);
  });

  it("returns aggregate counts without message content", async () => {
    mockRequireUser.mockResolvedValue({ id: "admin-1", role: "ADMIN", schoolId: "school-1", isPlatformAdmin: false } as any);
    const { GET } = await import("@/app/api/admin/messages/stats/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("totalToday");
    expect(data).toHaveProperty("studentToTeacher");
    expect(data).toHaveProperty("guardianToTeacher");
    expect(data).not.toHaveProperty("messages");
    expect(data).not.toHaveProperty("body");
    expect(data).not.toHaveProperty("content");
  });

  it("returns 403 for student role", async () => {
    mockRequireUser.mockResolvedValue({ id: "student-1", role: "STUDENT", isPlatformAdmin: false } as any);
    const { GET } = await import("@/app/api/admin/messages/stats/route");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("admin cannot read message bodies (response has no body field)", async () => {
    mockRequireUser.mockResolvedValue({ id: "admin-1", role: "ADMIN", schoolId: "school-1", isPlatformAdmin: false } as any);
    const { GET } = await import("@/app/api/admin/messages/stats/route");
    const res = await GET();
    const data = await res.json();
    const keys = Object.keys(data);
    const sensitiveKeys = keys.filter((k) => ["body", "content", "text", "message_body"].includes(k));
    expect(sensitiveKeys).toHaveLength(0);
  });
});

// ── 6. Guardian messages regression ──────────────────────────────────────────

describe("Guardian messages regression (Sprint 8)", () => {
  it("MessagingCenter buildThreads groups messages by teacher:guardian:student key", async () => {
    const { buildThreads } = await import("@/components/messaging/MessagingCenter");
    const messages = [
      { messageId: "1", guardianId: "g1", teacherId: "t1", studentId: "s1", guardianName: "Jane", teacherName: "Mr A", studentName: "Bob", subject: "MATH", fromRole: "guardian" as const, fromName: "Jane", body: "Hello", sentAt: "2026-05-13T10:00:00Z", read: false },
      { messageId: "2", guardianId: "g1", teacherId: "t1", studentId: "s1", guardianName: "Jane", teacherName: "Mr A", studentName: "Bob", subject: "MATH", fromRole: "teacher" as const, fromName: "Mr A", body: "Hi there", sentAt: "2026-05-13T10:05:00Z", read: false },
    ];
    const threads = buildThreads(messages);
    expect(threads).toHaveLength(1);
    expect(threads[0].messages).toHaveLength(2);
  });

  it("guardian messages thread key uses teacher:guardian:student", async () => {
    const { buildThreads } = await import("@/components/messaging/MessagingCenter");
    const messages = [
      { messageId: "1", guardianId: "g1", teacherId: "t1", studentId: "s1", guardianName: "Jane", teacherName: "Mr A", studentName: "Bob", subject: null, fromRole: "guardian" as const, fromName: "Jane", body: "Hello", sentAt: "2026-05-13T10:00:00Z", read: false },
      { messageId: "2", guardianId: "g2", teacherId: "t1", studentId: "s2", guardianName: "Alice", teacherName: "Mr A", studentName: "Eve", subject: null, fromRole: "guardian" as const, fromName: "Alice", body: "Hi", sentAt: "2026-05-13T11:00:00Z", read: false },
    ];
    const threads = buildThreads(messages);
    expect(threads).toHaveLength(2);
  });
});
