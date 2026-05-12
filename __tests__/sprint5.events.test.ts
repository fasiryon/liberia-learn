import { describe, it, expect, vi, beforeEach } from "vitest";

// ===== Hoisted mocks =====
const { mockPrisma, mockLogAudit, mockSendPushToSchool, mockSendReliableSms, mockRequireRole, mockRequireUser } = vi.hoisted(() => {
  const mockPrisma = {
    schoolEvent: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    school: { findUnique: vi.fn() },
    user: { findMany: vi.fn() },
  };
  const mockLogAudit = vi.fn();
  const mockSendPushToSchool = vi.fn();
  const mockSendReliableSms = vi.fn();
  const mockRequireRole = vi.fn();
  const mockRequireUser = vi.fn();
  return { mockPrisma, mockLogAudit, mockSendPushToSchool, mockSendReliableSms, mockRequireRole, mockRequireUser };
});

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/push/sendPush", () => ({
  sendPushToSchool: mockSendPushToSchool,
  sendPushToUser: vi.fn(),
  sendPushToMany: vi.fn(),
}));
vi.mock("@/lib/sms/reliableSend", () => ({ sendReliableSms: mockSendReliableSms }));
vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
  requireUser: mockRequireUser,
  authOptions: {},
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ===== Tests =====

describe("Admin can create an event (schoolId scoped)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("POST /api/admin/events creates an event for the admin's school", async () => {
    mockRequireRole.mockResolvedValueOnce({ id: "admin-1", schoolId: "school-1", role: "ADMIN" });
    const event = {
      id: "evt-1",
      schoolId: "school-1",
      title: "Mid-Term Exam",
      type: "EXAM",
      eventDate: new Date("2026-06-01"),
      published: false,
      sendPush: true,
      sendSms: false,
    };
    mockPrisma.schoolEvent.create.mockResolvedValueOnce(event);
    mockLogAudit.mockResolvedValueOnce(undefined);

    const { POST } = await import("@/app/api/admin/events/route");
    const req = new Request("http://localhost/api/admin/events", {
      method: "POST",
      body: JSON.stringify({ title: "Mid-Term Exam", type: "EXAM", eventDate: "2026-06-01" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.event.schoolId).toBe("school-1");
    expect(data.event.title).toBe("Mid-Term Exam");
    expect(mockPrisma.schoolEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ schoolId: "school-1", title: "Mid-Term Exam" }) })
    );
  });
});

describe("Non-admin cannot create events (403)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 when user is not ADMIN", async () => {
    mockRequireRole.mockRejectedValueOnce(Object.assign(new Error("Forbidden"), { status: 403 }));

    const { POST } = await import("@/app/api/admin/events/route");
    const req = new Request("http://localhost/api/admin/events", {
      method: "POST",
      body: JSON.stringify({ title: "Test", type: "EXAM", eventDate: "2026-06-01" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });
});

describe("Published event with sendPush fires sendPushToSchool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fires sendPushToSchool when event is published and sendPush=true", async () => {
    mockRequireRole.mockResolvedValueOnce({ id: "admin-1", schoolId: "school-1", role: "ADMIN" });
    const existing = {
      id: "evt-1",
      schoolId: "school-1",
      title: "Annual Sports Day",
      type: "TRIP",
      published: false,
      sendPush: true,
      sendSms: false,
      eventDate: new Date("2026-07-15"),
      description: null,
    };
    const updated = { ...existing, published: true };
    mockPrisma.schoolEvent.findFirst.mockResolvedValueOnce(existing);
    mockPrisma.schoolEvent.update.mockResolvedValueOnce(updated);
    mockLogAudit.mockResolvedValueOnce(undefined);
    mockSendPushToSchool.mockResolvedValueOnce(undefined);

    const { PATCH } = await import("@/app/api/admin/events/[id]/publish/route");
    const res = await PATCH(new Request("http://localhost"), { params: { id: "evt-1" } });
    expect(res.status).toBe(200);
    // sendPushToSchool called fire-and-forget; give it a tick
    await Promise.resolve();
    expect(mockSendPushToSchool).toHaveBeenCalledWith("school-1", expect.objectContaining({ title: expect.stringContaining("Annual Sports Day") }));
  });
});

describe("Unpublished event does not trigger push", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not fire sendPushToSchool when toggling to unpublished", async () => {
    mockRequireRole.mockResolvedValueOnce({ id: "admin-1", schoolId: "school-1", role: "ADMIN" });
    const existing = {
      id: "evt-2",
      schoolId: "school-1",
      title: "Staff Meeting",
      type: "MEETING",
      published: true,
      sendPush: true,
      sendSms: false,
      eventDate: new Date("2026-07-10"),
      description: null,
    };
    const updated = { ...existing, published: false };
    mockPrisma.schoolEvent.findFirst.mockResolvedValueOnce(existing);
    mockPrisma.schoolEvent.update.mockResolvedValueOnce(updated);
    mockLogAudit.mockResolvedValueOnce(undefined);

    const { PATCH } = await import("@/app/api/admin/events/[id]/publish/route");
    await PATCH(new Request("http://localhost"), { params: { id: "evt-2" } });
    await Promise.resolve();
    expect(mockSendPushToSchool).not.toHaveBeenCalled();
  });
});

describe("GET /api/events returns only events visible to the user's role", () => {
  beforeEach(() => vi.clearAllMocks());

  it("student sees ALL and STUDENTS events only", async () => {
    mockRequireUser.mockResolvedValueOnce({ id: "student-1", schoolId: "school-1", role: "STUDENT" });
    mockPrisma.schoolEvent.findMany.mockResolvedValueOnce([
      { id: "e1", title: "Exam", type: "EXAM", visibility: "ALL", eventDate: new Date(), endDate: null, description: null },
    ]);

    const { GET } = await import("@/app/api/events/route");
    const req = new Request("http://localhost/api/events");
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.events)).toBe(true);
    expect(mockPrisma.schoolEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          visibility: { in: expect.arrayContaining(["ALL", "STUDENTS"]) },
        }),
      })
    );
  });
});

describe("SMS scheduler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("scheduleEventSmsReminders skips past events", async () => {
    const { scheduleEventSmsReminders } = await import("@/lib/events/eventSmsScheduler");
    const pastEvent = {
      id: "evt-past",
      schoolId: "school-1",
      title: "Old Exam",
      eventDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      type: "EXAM",
      sendSms: true,
    };
    await scheduleEventSmsReminders(pastEvent);
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
    expect(mockSendReliableSms).not.toHaveBeenCalled();
  });

  it("EXAM type event with sendSms schedules SMS job", async () => {
    const { scheduleEventSmsReminders } = await import("@/lib/events/eventSmsScheduler");
    const futureEvent = {
      id: "evt-future",
      schoolId: "school-1",
      title: "Final Exam",
      eventDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      type: "EXAM",
      sendSms: true,
    };
    mockPrisma.school.findUnique.mockResolvedValueOnce({ name: "CHA School" });
    mockPrisma.user.findMany.mockResolvedValueOnce([
      { id: "g-1", guardianPhoneE164: "+231770000001" },
    ]);
    mockPrisma.schoolEvent.update.mockResolvedValueOnce({ ...futureEvent, smsScheduledAt: new Date() });
    mockLogAudit.mockResolvedValueOnce(undefined);
    mockSendReliableSms.mockResolvedValueOnce({ ok: true, attempts: 1 });

    await scheduleEventSmsReminders(futureEvent);
    expect(mockPrisma.user.findMany).toHaveBeenCalled();
    expect(mockPrisma.schoolEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "evt-future" }, data: expect.objectContaining({ smsScheduledAt: expect.any(Date) }) })
    );
  });

  it("ANNOUNCEMENT type does not schedule SMS", async () => {
    const { scheduleEventSmsReminders } = await import("@/lib/events/eventSmsScheduler");
    await scheduleEventSmsReminders({
      id: "evt-ann",
      schoolId: "school-1",
      title: "School Announcement",
      eventDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      type: "ANNOUNCEMENT",
      sendSms: true,
    });
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
    expect(mockSendReliableSms).not.toHaveBeenCalled();
  });

  it("skips when sendSms is false", async () => {
    const { scheduleEventSmsReminders } = await import("@/lib/events/eventSmsScheduler");
    await scheduleEventSmsReminders({
      id: "evt-nosms",
      schoolId: "school-1",
      title: "No SMS Exam",
      eventDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      type: "EXAM",
      sendSms: false,
    });
    expect(mockSendReliableSms).not.toHaveBeenCalled();
  });
});

describe("DELETE removes event", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes event and returns ok", async () => {
    mockRequireRole.mockResolvedValueOnce({ id: "admin-1", schoolId: "school-1", role: "ADMIN" });
    mockPrisma.schoolEvent.findFirst.mockResolvedValueOnce({
      id: "evt-del",
      schoolId: "school-1",
      title: "Test Trip",
    });
    mockPrisma.schoolEvent.delete.mockResolvedValueOnce({ id: "evt-del" });
    mockLogAudit.mockResolvedValueOnce(undefined);

    const { DELETE } = await import("@/app/api/admin/events/[id]/route");
    const res = await DELETE(new Request("http://localhost"), { params: { id: "evt-del" } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(mockPrisma.schoolEvent.delete).toHaveBeenCalledWith({ where: { id: "evt-del" } });
  });
});
