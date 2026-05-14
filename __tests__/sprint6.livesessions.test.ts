import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateJitsiRoomId, buildJoinUrl } from "@/lib/meetings/jitsiService";

// ===== Jitsi service unit tests =====

describe("generateJitsiRoomId", () => {
  it("is deterministic — same inputs produce same output", () => {
    const a = generateJitsiRoomId("class-abc123", "2026-05-12", "Period 1");
    const b = generateJitsiRoomId("class-abc123", "2026-05-12", "Period 1");
    expect(a).toBe(b);
  });

  it("output is URL-safe (alphanumeric + hyphens only)", () => {
    const id = generateJitsiRoomId("class abc!@#", "2026/05/12", "Period 1: Math");
    expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it("output is at most 64 characters", () => {
    const id = generateJitsiRoomId("a".repeat(60), "2026-05-12", "b".repeat(60));
    expect(id.length).toBeLessThanOrEqual(64);
  });

  it("starts with ll- prefix", () => {
    const id = generateJitsiRoomId("classX", "2026-05-12", "P1");
    expect(id.startsWith("ll-")).toBe(true);
  });

  it("different periods produce different room IDs", () => {
    const a = generateJitsiRoomId("classX", "2026-05-12", "P1");
    const b = generateJitsiRoomId("classX", "2026-05-12", "P2");
    expect(a).not.toBe(b);
  });
});

describe("buildJoinUrl", () => {
  it("returns a meet.jit.si URL", () => {
    const url = buildJoinUrl("ll-class-2026-05-12-p1");
    expect(url).toContain("https://meet.jit.si/");
    expect(url).toContain("ll-class-2026-05-12-p1");
  });

  it("includes config params", () => {
    const url = buildJoinUrl("room-123");
    expect(url).toContain("config.startWithAudioMuted=false");
    expect(url).toContain("config.prejoinPageEnabled=false");
  });
});

// ===== API route tests =====

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(),
  requireUser: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    meeting: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    meetingAttendee: {
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
    attendanceRecord: {
      upsert: vi.fn(),
    },
    student: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    class: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    enrollment: {
      findMany: vi.fn(),
    },
    pushSubscription: {
      findMany: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    notificationLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/push/sendPush", () => ({ sendPushToClass: vi.fn(), sendPushToMany: vi.fn().mockResolvedValue(undefined) }));

import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendPushToClass } from "@/lib/push/sendPush";

const mockRequireRole = vi.mocked(requireRole);
const mockPrisma = prisma as any;
const mockSendPushToClass = vi.mocked(sendPushToClass);

const TEACHER_USER = { id: "teacher-1", role: "TEACHER", schoolId: "school-1" };
const STUDENT_USER = { id: "student-user-1", role: "STUDENT", schoolId: "school-1" };

function makeReq(body?: unknown, method = "POST"): NextRequest {
  return new NextRequest("http://localhost/api/test", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("POST /api/teacher/meetings/[meetingId]/start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue(TEACHER_USER as any);
    mockSendPushToClass.mockResolvedValue(undefined);
  });

  it("sets liveStatus LIVE and returns joinUrl", async () => {
    const { POST } = await import("@/app/api/teacher/meetings/[meetingId]/start/route");

    const meeting = {
      id: "m1",
      classId: "c1",
      startsAt: new Date("2026-05-12T08:00:00Z"),
      periodName: "P1",
      subject: "MATH",
      liveStatus: "SCHEDULED",
      startedAt: null,
      Class: { teacherId: "teacher-1", subject: "MATH" },
    };
    mockPrisma.meeting.findUnique.mockResolvedValue(meeting);
    mockPrisma.meeting.update.mockResolvedValue({ ...meeting, liveStatus: "LIVE", joinUrl: "https://meet.jit.si/ll-c1-2026-05-12-p1?config.startWithAudioMuted=false&config.prejoinPageEnabled=false" });

    const res = await POST(makeReq(), { params: { meetingId: "m1" } } as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.joinUrl).toContain("meet.jit.si");
    expect(mockPrisma.meeting.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ liveStatus: "LIVE" }) })
    );
  });

  it("fires push notification to class students on start", async () => {
    const { POST } = await import("@/app/api/teacher/meetings/[meetingId]/start/route");

    const meeting = {
      id: "m1",
      classId: "c1",
      startsAt: new Date("2026-05-12T08:00:00Z"),
      periodName: "P1",
      subject: "MATH",
      liveStatus: "SCHEDULED",
      startedAt: null,
      Class: { teacherId: "teacher-1", subject: "MATH" },
    };
    mockPrisma.meeting.findUnique.mockResolvedValue(meeting);
    mockPrisma.meeting.update.mockResolvedValue({ ...meeting, liveStatus: "LIVE", joinUrl: "https://meet.jit.si/ll-c1" });

    await POST(makeReq(), { params: { meetingId: "m1" } } as any);

    expect(mockSendPushToClass).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({ title: "Class is Live Now 🔴" })
    );
  });

  it("returns 403 when non-teacher tries to start session", async () => {
    const { POST } = await import("@/app/api/teacher/meetings/[meetingId]/start/route");

    mockRequireRole.mockRejectedValue(Object.assign(new Error("Forbidden"), { status: 403 }));

    const res = await POST(makeReq(), { params: { meetingId: "m1" } } as any);
    expect(res.status).toBe(403);
  });
});

describe("POST /api/student/meetings/[meetingId]/join", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue(STUDENT_USER as any);
  });

  it("records MeetingAttendee and returns joinUrl", async () => {
    const { POST } = await import("@/app/api/student/meetings/[meetingId]/join/route");

    mockPrisma.meeting.findUnique.mockResolvedValue({
      id: "m1",
      liveStatus: "LIVE",
      joinUrl: "https://meet.jit.si/ll-c1",
    });
    mockPrisma.meetingAttendee.upsert.mockResolvedValue({ id: "att-1" });

    const res = await POST(makeReq(), { params: { meetingId: "m1" } } as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.joinUrl).toBe("https://meet.jit.si/ll-c1");
    expect(mockPrisma.meetingAttendee.upsert).toHaveBeenCalled();
  });

  it("returns 400 when meeting is not LIVE", async () => {
    const { POST } = await import("@/app/api/student/meetings/[meetingId]/join/route");

    mockPrisma.meeting.findUnique.mockResolvedValue({
      id: "m1",
      liveStatus: "SCHEDULED",
      joinUrl: null,
    });

    const res = await POST(makeReq(), { params: { meetingId: "m1" } } as any);
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/teacher/meetings/[meetingId]/end", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue(TEACHER_USER as any);
  });

  it("sets liveStatus ENDED and returns duration + attendeeCount", async () => {
    const { PATCH } = await import("@/app/api/teacher/meetings/[meetingId]/end/route");

    const startedAt = new Date(Date.now() - 30 * 60 * 1000);
    mockPrisma.meeting.findUnique.mockResolvedValue({
      id: "m1",
      classId: "c1",
      liveStatus: "LIVE",
      startedAt,
      Class: { teacherId: "teacher-1" },
      attendees: [{ userId: "u1" }, { userId: "u2" }],
    });
    mockPrisma.meeting.update.mockResolvedValue({});
    mockPrisma.student.findMany.mockResolvedValue([{ id: "s1" }, { id: "s2" }]);
    mockPrisma.attendanceRecord.upsert.mockResolvedValue({});

    const res = await PATCH(makeReq(undefined, "PATCH"), { params: { meetingId: "m1" } } as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.attendeeCount).toBe(2);
    expect(data.duration).toBeGreaterThan(0);
  });

  it("auto-marks attendance PRESENT for each attendee who joined", async () => {
    const { PATCH } = await import("@/app/api/teacher/meetings/[meetingId]/end/route");

    mockPrisma.meeting.findUnique.mockResolvedValue({
      id: "m1",
      classId: "c1",
      liveStatus: "LIVE",
      startedAt: new Date(),
      Class: { teacherId: "teacher-1" },
      attendees: [{ userId: "u1" }],
    });
    mockPrisma.meeting.update.mockResolvedValue({});
    mockPrisma.student.findMany.mockResolvedValue([{ id: "s1" }]);
    mockPrisma.attendanceRecord.upsert.mockResolvedValue({});

    await PATCH(makeReq(undefined, "PATCH"), { params: { meetingId: "m1" } } as any);

    expect(mockPrisma.attendanceRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ status: "PRESENT" }),
      })
    );
  });
});

describe("GET /api/student/live-sessions/active", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue(STUDENT_USER as any);
  });

  it("returns only LIVE meetings for enrolled classes", async () => {
    const { GET } = await import("@/app/api/student/live-sessions/active/route");

    mockPrisma.student.findUnique.mockResolvedValue({
      enrollments: [{ classId: "c1" }, { classId: "c2" }],
    });
    mockPrisma.meeting.findMany.mockResolvedValue([
      { id: "m1", classId: "c1", liveStatus: "LIVE", subject: "MATH", periodName: "P1", joinUrl: "https://meet.jit.si/ll-c1", startedAt: new Date(), Class: { name: "9A", subject: "MATH" } },
    ]);

    const req = new NextRequest("http://localhost/api/student/live-sessions/active");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0].liveStatus).toBe("LIVE");
  });
});
