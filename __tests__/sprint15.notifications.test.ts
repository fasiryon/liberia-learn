import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const mockRequireUser = vi.hoisted(() => vi.fn());
const mockRequireRole = vi.hoisted(() => vi.fn());

const mockPrisma = vi.hoisted(() => ({
  announcement: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  notificationInboxItem: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
  },
  attendance: {
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
  student: {
    findUnique: vi.fn(),
  },
  class: {
    findMany: vi.fn(),
  },
  enrollment: {
    findMany: vi.fn(),
  },
  learningEvent: {
    findMany: vi.fn(),
  },
  assessmentAttempt: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  requireUser: mockRequireUser,
  requireRole: mockRequireRole,
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/push/sendPush", () => ({
  sendPushToSchool: vi.fn(),
  sendPushToUser: vi.fn(),
}));
vi.mock("@/lib/errors/apiErrorHandler", () => ({
  handleApiError: vi.fn((_err: unknown, _ctx: unknown) =>
    new Response(JSON.stringify({ error: "internal" }), { status: 500 })
  ),
}));
vi.mock("@/lib/autonomous/signals/productSignalService", () => ({ logProductSignal: vi.fn() }));
vi.mock("@/lib/records/schoolOperations", () => ({
  listTeacherAttendanceContext: vi.fn(),
  upsertAttendanceForTeacher: vi.fn(),
  upsertAttendanceSchema: {
    parse: vi.fn((v: unknown) => v),
  },
}));
vi.mock("@/lib/policy/policyEngine", () => ({ validateAttendanceCompliance: vi.fn() }));

// ── Helper ───────────────────────────────────────────────────────────────────

function mockAdmin(extra: Record<string, unknown> = {}) {
  return { id: "user-admin", role: "ADMIN", schoolId: "school-1", ...extra };
}

function mockStudent(extra: Record<string, unknown> = {}) {
  return { id: "user-student", role: "STUDENT", schoolId: "school-1", ...extra };
}

function fakeAnnouncement(overrides: Record<string, unknown> = {}) {
  return {
    id: "ann-1",
    schoolId: "school-1",
    title: "School announcement",
    body: "Some details here",
    audience: "ALL",
    isPinned: false,
    publishedAt: new Date().toISOString(),
    expiresAt: null,
    createdAt: new Date().toISOString(),
    author: { name: "Admin User" },
    ...overrides,
  };
}

function fakeInboxItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "inbox-1",
    userId: "user-student",
    title: "Assignment Graded",
    body: "Your submission received 85/100",
    url: "/assignments",
    type: "grade",
    isRead: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ── Test suites ───────────────────────────────────────────────────────────────

describe("POST /api/admin/announcements", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates and publishes an announcement", async () => {
    mockRequireRole.mockResolvedValue(mockAdmin());
    mockPrisma.announcement.create.mockResolvedValue(fakeAnnouncement());

    const { POST } = await import("@/app/api/admin/announcements/route");
    const req = new Request("http://localhost/api/admin/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "School announcement",
        body: "Some details here",
        audience: "ALL",
        isPinned: false,
      }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.announcement.id).toBe("ann-1");
    expect(mockPrisma.announcement.create).toHaveBeenCalledTimes(1);
  });
});

describe("GET /api/announcements", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns only the school's published non-expired announcements", async () => {
    mockRequireUser.mockResolvedValue(mockStudent());
    mockPrisma.announcement.findMany.mockResolvedValue([fakeAnnouncement()]);

    const { GET } = await import("@/app/api/announcements/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.announcements).toHaveLength(1);
    expect(data.announcements[0].schoolId).toBeUndefined(); // only selected fields returned
    // Verify DB was scoped to schoolId
    expect(mockPrisma.announcement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ schoolId: "school-1" }),
      })
    );
  });

  it("excludes expired announcements via DB query filter", async () => {
    mockRequireUser.mockResolvedValue(mockStudent());
    // DB layer handles expiry — verify the query includes OR expiresAt filter
    mockPrisma.announcement.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/announcements/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.announcements).toHaveLength(0);
    const callArgs = mockPrisma.announcement.findMany.mock.calls[0][0];
    // Should include expiresAt check
    expect(JSON.stringify(callArgs)).toContain("expiresAt");
  });

  it("filters announcements by audience for students", async () => {
    mockRequireUser.mockResolvedValue(mockStudent());
    mockPrisma.announcement.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/announcements/route");
    await GET();

    const callArgs = mockPrisma.announcement.findMany.mock.calls[0][0];
    // STUDENTS should only see ALL + STUDENTS
    expect(callArgs.where.audience.in).toContain("ALL");
    expect(callArgs.where.audience.in).toContain("STUDENTS");
    expect(callArgs.where.audience.in).not.toContain("TEACHERS");
  });
});

describe("createInboxNotification helper", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a DB record via prisma", async () => {
    mockPrisma.notificationInboxItem.create.mockResolvedValue(fakeInboxItem());

    const { createInboxNotification } = await import("@/lib/notifications/inboxService");
    await createInboxNotification("user-student", {
      title: "Assignment Graded",
      body: "Your submission received 85/100",
      url: "/assignments",
      type: "grade",
    });

    expect(mockPrisma.notificationInboxItem.create).toHaveBeenCalledWith({
      data: {
        userId: "user-student",
        title: "Assignment Graded",
        body: "Your submission received 85/100",
        url: "/assignments",
        type: "grade",
      },
    });
  });
});

describe("GET /api/notifications/inbox", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns only the current user's inbox items", async () => {
    mockRequireUser.mockResolvedValue(mockStudent());
    mockPrisma.notificationInboxItem.findMany.mockResolvedValue([fakeInboxItem()]);
    mockPrisma.notificationInboxItem.count.mockResolvedValue(1);

    const { GET } = await import("@/app/api/notifications/inbox/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.items).toHaveLength(1);
    expect(data.unreadCount).toBe(1);
    // Verify scoped to current user
    expect(mockPrisma.notificationInboxItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-student" }),
      })
    );
  });
});

describe("PATCH /api/notifications/inbox/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks a single inbox item as read", async () => {
    mockRequireUser.mockResolvedValue(mockStudent());
    mockPrisma.notificationInboxItem.findUnique.mockResolvedValue(fakeInboxItem());
    mockPrisma.notificationInboxItem.update.mockResolvedValue({ ...fakeInboxItem(), isRead: true });

    const { PATCH } = await import("@/app/api/notifications/inbox/[id]/route");
    const req = new Request("http://localhost/api/notifications/inbox/inbox-1", { method: "PATCH" });
    const res = await PATCH(req as any, { params: { id: "inbox-1" } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(mockPrisma.notificationInboxItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isRead: true } })
    );
  });
});

describe("POST /api/notifications/inbox/read-all", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks all items as read for the current user", async () => {
    mockRequireUser.mockResolvedValue(mockStudent());
    mockPrisma.notificationInboxItem.updateMany.mockResolvedValue({ count: 3 });

    const { POST } = await import("@/app/api/notifications/inbox/read-all/route");
    const res = await POST();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(mockPrisma.notificationInboxItem.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-student", isRead: false },
      data: { isRead: true },
    });
  });
});

describe("Announcement audience ALL", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns announcements with audience ALL for any role including ADMIN", async () => {
    mockRequireUser.mockResolvedValue(mockAdmin());
    mockPrisma.announcement.findMany.mockResolvedValue([fakeAnnouncement({ audience: "ALL" })]);

    const { GET } = await import("@/app/api/announcements/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.announcements[0].audience).toBe("ALL");
  });
});

describe("GET /api/teacher/attendance", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns attendance records for the given class and date", async () => {
    const { listTeacherAttendanceContext } = await import("@/lib/records/schoolOperations");
    (listTeacherAttendanceContext as any).mockResolvedValue({
      classes: [{ id: "class-1", name: "Math 9A", subject: "MATH" }],
      roster: [{ studentId: "student-1", name: "Fatu", currentGrade: 9 }],
      attendance: [{ studentId: "student-1", status: "PRESENT", notes: null }],
      selectedDate: new Date().toISOString(),
    });
    mockRequireUser.mockResolvedValue({ id: "user-teacher", role: "TEACHER", schoolId: "school-1" });

    const { GET } = await import("@/app/api/teacher/attendance/route");
    const url = new URL("http://localhost/api/teacher/attendance?classId=class-1&date=2026-05-14");
    const req = new Request(url.toString());
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.roster).toHaveLength(1);
    expect(data.attendance).toHaveLength(1);
  });
});

describe("POST /api/teacher/attendance", () => {
  beforeEach(() => vi.clearAllMocks());

  it("saves attendance records for a class", async () => {
    const { upsertAttendanceForTeacher, upsertAttendanceSchema } = await import(
      "@/lib/records/schoolOperations"
    );
    const { validateAttendanceCompliance } = await import("@/lib/policy/policyEngine");
    (upsertAttendanceSchema as any).parse.mockReturnValue({
      classId: "class-1",
      date: new Date("2026-05-14"),
      records: [{ studentId: "student-1", status: "PRESENT", notes: null }],
    });
    (upsertAttendanceForTeacher as any).mockResolvedValue([
      { studentId: "student-1", status: "PRESENT" },
    ]);
    (validateAttendanceCompliance as any).mockResolvedValue(undefined);
    mockRequireUser.mockResolvedValue({ id: "user-teacher", role: "TEACHER", schoolId: "school-1" });
    mockPrisma.student.findUnique = vi.fn();
    (mockPrisma as any).studentGuardian = { findMany: vi.fn().mockResolvedValue([]) };

    const { POST } = await import("@/app/api/teacher/attendance/route");
    const req = new Request("http://localhost/api/teacher/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        classId: "class-1",
        date: "2026-05-14",
        records: [{ studentId: "student-1", status: "PRESENT" }],
      }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.attendance).toHaveLength(1);
    expect(data.attendance[0].status).toBe("PRESENT");
  });
});

describe("GET /api/student/progress/weekly", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 8-week data array for a student", async () => {
    mockRequireRole.mockResolvedValue(mockStudent());
    mockPrisma.student.findUnique.mockResolvedValue({ id: "student-db-1" });
    mockPrisma.learningEvent.findMany.mockResolvedValue([
      { occurredAt: new Date() },
      { occurredAt: new Date() },
    ]);
    mockPrisma.assessmentAttempt.findMany.mockResolvedValue([
      { attemptedAt: new Date(), score: 0.8, maxScore: 1.0 },
    ]);

    const { GET } = await import("@/app/api/student/progress/weekly/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.weeks).toHaveLength(8);
    // Check shape of first entry
    const week = data.weeks[0];
    expect(week).toHaveProperty("weekLabel");
    expect(week).toHaveProperty("lessonsCompleted");
    expect(week).toHaveProperty("quizAvg");
    expect(week).toHaveProperty("streakDays");
  });
});
