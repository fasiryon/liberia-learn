import { describe, it, expect, vi, beforeEach } from "vitest";

// ===== Hoisted mocks =====
const {
  mockPrisma,
  mockLogAudit,
  mockSendPushToUser,
  mockRequireRole,
  mockRequireUser,
  mockUpsertAttendanceForTeacher,
  mockHandleApiError,
  mockValidateAttendanceCompliance,
  mockListTeacherAttendanceContext,
  mockLogProductSignal,
  mockIsGuardianDashboardEnabled,
} = vi.hoisted(() => {
  const mockPrisma = {
    studentGuardian: { findFirst: vi.fn(), findMany: vi.fn() },
    attendance: { findMany: vi.fn() },
    assignmentSubmission: { findMany: vi.fn() },
    assignment: { findMany: vi.fn() },
    guardianMessage: { findMany: vi.fn(), create: vi.fn() },
    enrollment: { findFirst: vi.fn(), findMany: vi.fn() },
    school: { findUnique: vi.fn() },
    teacherAlertPreference: { findUnique: vi.fn().mockResolvedValue(null) },
    $transaction: vi.fn(),
  };
  const mockLogAudit = vi.fn().mockResolvedValue(undefined);
  const mockSendPushToUser = vi.fn().mockResolvedValue(undefined);
  const mockRequireRole = vi.fn();
  const mockRequireUser = vi.fn();
  const mockUpsertAttendanceForTeacher = vi.fn();
  const mockHandleApiError = vi.fn().mockImplementation((err: any) => {
    const status = err?.status ?? 500;
    return new Response(JSON.stringify({ error: err?.message ?? "error" }), { status });
  });
  const mockValidateAttendanceCompliance = vi.fn().mockResolvedValue(undefined);
  const mockListTeacherAttendanceContext = vi.fn();
  const mockLogProductSignal = vi.fn().mockResolvedValue(undefined);
  const mockIsGuardianDashboardEnabled = vi.fn().mockReturnValue(true);
  return {
    mockPrisma,
    mockLogAudit,
    mockSendPushToUser,
    mockRequireRole,
    mockRequireUser,
    mockUpsertAttendanceForTeacher,
    mockHandleApiError,
    mockValidateAttendanceCompliance,
    mockListTeacherAttendanceContext,
    mockLogProductSignal,
    mockIsGuardianDashboardEnabled,
  };
});

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/push/sendPush", () => ({
  sendPushToUser: mockSendPushToUser,
  sendPushToClass: vi.fn(),
  sendPushToMany: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
  requireUser: mockRequireUser,
  authOptions: {},
}));
vi.mock("@/lib/records/schoolOperations", () => ({
  upsertAttendanceForTeacher: mockUpsertAttendanceForTeacher,
  upsertAttendanceSchema: {
    parse: vi.fn().mockImplementation((v: unknown) => v),
  },
  listTeacherAttendanceContext: mockListTeacherAttendanceContext,
}));
vi.mock("@/lib/errors/apiErrorHandler", () => ({
  handleApiError: mockHandleApiError,
}));
vi.mock("@/lib/policy/policyEngine", () => ({
  validateAttendanceCompliance: mockValidateAttendanceCompliance,
}));
vi.mock("@/lib/autonomous/signals/productSignalService", () => ({
  logProductSignal: mockLogProductSignal,
}));
vi.mock("@/lib/serverFlags", () => ({
  isGuardianDashboardEnabled: mockIsGuardianDashboardEnabled,
  isLiveSesssionsEnabled: vi.fn().mockReturnValue(true),
  isDiscussionEnabled: vi.fn().mockReturnValue(true),
  isMoePortalEnabled: vi.fn().mockReturnValue(false),
  isCurriculumFeedbackEnabled: vi.fn().mockReturnValue(false),
}));

import { NextRequest } from "next/server";

// ===== Helpers =====
const GUARDIAN_USER = { id: "guardian-1", role: "GUARDIAN", schoolId: "school-1", name: "Jane Doe" };
const TEACHER_USER = { id: "teacher-1", role: "TEACHER", schoolId: "school-1", name: "Mr. Smith" };
const STUDENT_ID = "student-1";

function makeRequest(url: string, method = "GET", body?: unknown): NextRequest {
  const opts: RequestInit = { method };
  if (body) {
    opts.body = JSON.stringify(body);
    opts.headers = { "content-type": "application/json" };
  }
  return new NextRequest(url, opts);
}

// ===== Test 1: Guardian can view own child's attendance =====
describe("GET /api/guardian/attendance", () => {
  it("1. returns attendance records for a linked student", async () => {
    mockRequireRole.mockResolvedValue(GUARDIAN_USER);
    mockPrisma.studentGuardian.findFirst.mockResolvedValueOnce({ guardianId: "guardian-1", studentId: STUDENT_ID });
    mockPrisma.attendance.findMany.mockResolvedValueOnce([
      { id: "att-1", date: new Date("2026-05-01"), status: "PRESENT", classId: "class-1", notes: null },
      { id: "att-2", date: new Date("2026-05-02"), status: "ABSENT", classId: "class-1", notes: null },
    ]);

    const { GET } = await import("@/app/api/guardian/attendance/route");
    const req = makeRequest(`http://localhost/api/guardian/attendance?studentId=${STUDENT_ID}&month=2026-05`);
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(2);
    expect(data[0].status).toBe("PRESENT");
    expect(data[1].status).toBe("ABSENT");
  });

  // ===== Test 2: Guardian cannot view another child's attendance =====
  it("2. returns 403 when guardian is not linked to the student", async () => {
    mockRequireRole.mockResolvedValue(GUARDIAN_USER);
    mockPrisma.studentGuardian.findFirst.mockResolvedValueOnce(null); // no link

    const { GET } = await import("@/app/api/guardian/attendance/route");
    const req = makeRequest(`http://localhost/api/guardian/attendance?studentId=other-student&month=2026-05`);
    const res = await GET(req);

    expect(res.status).toBe(403);
  });
});

// ===== Test 3: Absent streak warning =====
describe("calcAbsentStreak", () => {
  it("3. returns correct consecutive absent streak count", async () => {
    // Import the exported function from the page (logic module)
    const { calcAbsentStreak } = await import("@/app/guardian/attendance/page");

    const records = [
      { id: "a1", date: "2026-05-05T00:00:00.000Z", status: "ABSENT", classId: "c1" },
      { id: "a2", date: "2026-05-06T00:00:00.000Z", status: "ABSENT", classId: "c1" },
      { id: "a3", date: "2026-05-07T00:00:00.000Z", status: "ABSENT", classId: "c1" },
      { id: "a4", date: "2026-05-08T00:00:00.000Z", status: "PRESENT", classId: "c1" },
    ];

    const streak = calcAbsentStreak(records, 2026, 5);
    expect(streak).toBe(3);
  });
});

// ===== Test 4: Guardian can view own child's grades =====
describe("GET /api/guardian/grades", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsGuardianDashboardEnabled.mockReturnValue(true);
  });

  it("4. returns graded assignment submissions grouped by subject", async () => {
    mockRequireRole.mockResolvedValue(GUARDIAN_USER);
    mockPrisma.studentGuardian.findFirst.mockResolvedValueOnce({ guardianId: "guardian-1", studentId: STUDENT_ID });
    mockPrisma.assignmentSubmission.findMany.mockResolvedValueOnce([
      {
        id: "sub-1",
        studentId: STUDENT_ID,
        score: 85,
        feedback: "Good work",
        gradedAt: new Date("2026-05-01"),
        Assignment: {
          title: "Math Quiz 1",
          dueAt: new Date("2026-04-30"),
          points: 100,
          classId: "class-1",
          Class: { subject: "MATHEMATICS", name: "Grade 5 Math" },
        },
      },
    ]);

    const { GET } = await import("@/app/api/guardian/grades/route");
    const req = makeRequest(`http://localhost/api/guardian/grades?studentId=${STUDENT_ID}`);
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.subjects).toBeDefined();
    expect(data.subjects).toHaveLength(1);
    expect(data.subjects[0].subject).toBe("MATHEMATICS");
    expect(data.subjects[0].average).toBe(85);
    expect(data.subjects[0].grades[0].score).toBe(85);
  });

  // ===== Test 5: Trend improving =====
  it("5. calculates 'improving' trend when recent 3 avg is 5+ points above previous 3", async () => {
    mockRequireRole.mockResolvedValue(GUARDIAN_USER);
    mockPrisma.studentGuardian.findFirst.mockResolvedValueOnce({ guardianId: "guardian-1", studentId: STUDENT_ID });

    // 6 submissions ordered from most recent (index 0) to oldest (index 5)
    // Recent 3: 90, 88, 87 → avg ~88.3
    // Previous 3: 70, 72, 68 → avg ~70
    const makeSubmission = (score: number, title: string) => ({
      id: `sub-${title}`,
      studentId: STUDENT_ID,
      score,
      feedback: null,
      gradedAt: new Date("2026-05-01"),
      Assignment: {
        title,
        dueAt: null,
        points: 100,
        classId: "class-1",
        Class: { subject: "SCIENCE", name: "Grade 5 Science" },
      },
    });

    mockPrisma.assignmentSubmission.findMany.mockResolvedValueOnce([
      makeSubmission(90, "Test 6"),
      makeSubmission(88, "Test 5"),
      makeSubmission(87, "Test 4"),
      makeSubmission(70, "Test 3"),
      makeSubmission(72, "Test 2"),
      makeSubmission(68, "Test 1"),
    ]);

    const { GET } = await import("@/app/api/guardian/grades/route");
    const req = makeRequest(`http://localhost/api/guardian/grades?studentId=${STUDENT_ID}`);
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.subjects[0].trend).toBe("improving");
  });

  // ===== Test 6: Trend declining =====
  it("6. calculates 'declining' trend when previous 3 avg is 5+ points above recent 3", async () => {
    mockRequireRole.mockResolvedValue(GUARDIAN_USER);
    mockPrisma.studentGuardian.findFirst.mockResolvedValueOnce({ guardianId: "guardian-1", studentId: STUDENT_ID });

    const makeSubmission = (score: number, title: string) => ({
      id: `sub-${title}`,
      studentId: STUDENT_ID,
      score,
      feedback: null,
      gradedAt: new Date("2026-05-01"),
      Assignment: {
        title,
        dueAt: null,
        points: 100,
        classId: "class-1",
        Class: { subject: "ENGLISH", name: "Grade 5 English" },
      },
    });

    // Recent 3: 60, 62, 58 → avg ~60
    // Previous 3: 90, 88, 92 → avg ~90 → diff = 30 > 5 → declining
    mockPrisma.assignmentSubmission.findMany.mockResolvedValueOnce([
      makeSubmission(60, "Test 6"),
      makeSubmission(62, "Test 5"),
      makeSubmission(58, "Test 4"),
      makeSubmission(90, "Test 3"),
      makeSubmission(88, "Test 2"),
      makeSubmission(92, "Test 1"),
    ]);

    const { GET } = await import("@/app/api/guardian/grades/route");
    const req = makeRequest(`http://localhost/api/guardian/grades?studentId=${STUDENT_ID}`);
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.subjects[0].trend).toBe("declining");
  });
});

// ===== Tests 7-10: Guardian messages =====
describe("Guardian messages — two-way messaging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsGuardianDashboardEnabled.mockReturnValue(true);
    mockSendPushToUser.mockResolvedValue(undefined);
  });

  it("7. guardian can send a message to their child's teacher", async () => {
    mockRequireRole.mockResolvedValue(GUARDIAN_USER);
    mockPrisma.studentGuardian.findFirst.mockResolvedValueOnce({ guardianId: "guardian-1", studentId: STUDENT_ID });
    mockPrisma.enrollment.findFirst.mockResolvedValueOnce({
      Class: { schoolId: "school-1" },
    });
    mockPrisma.guardianMessage.create.mockResolvedValueOnce({ id: "msg-1" });

    const { POST } = await import("@/app/api/guardian/messages/route");
    const req = makeRequest("http://localhost/api/guardian/messages", "POST", {
      teacherId: "teacher-1",
      studentId: STUDENT_ID,
      body: "Hello teacher",
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.messageId).toBe("msg-1");
  });

  it("8. guardian cannot message a teacher not linked to their child's classes", async () => {
    mockRequireRole.mockResolvedValue(GUARDIAN_USER);
    mockPrisma.studentGuardian.findFirst.mockResolvedValueOnce({ guardianId: "guardian-1", studentId: STUDENT_ID });
    mockPrisma.enrollment.findFirst.mockResolvedValueOnce(null); // no enrollment linking teacher to student

    const { POST } = await import("@/app/api/guardian/messages/route");
    const req = makeRequest("http://localhost/api/guardian/messages", "POST", {
      teacherId: "unrelated-teacher",
      studentId: STUDENT_ID,
      body: "Hello unrelated teacher",
    });
    const res = await POST(req);

    expect(res.status).toBe(403);
  });

  it("9. teacher receives push notification when guardian sends a message", async () => {
    mockRequireRole.mockResolvedValue(GUARDIAN_USER);
    mockPrisma.studentGuardian.findFirst.mockResolvedValueOnce({ guardianId: "guardian-1", studentId: STUDENT_ID });
    mockPrisma.enrollment.findFirst.mockResolvedValueOnce({
      Class: { schoolId: "school-1" },
    });
    mockPrisma.guardianMessage.create.mockResolvedValueOnce({ id: "msg-2" });
    mockPrisma.teacherAlertPreference.findUnique.mockResolvedValueOnce(null); // defaults → alertGuardianMessage: true

    const { POST } = await import("@/app/api/guardian/messages/route");
    const req = makeRequest("http://localhost/api/guardian/messages", "POST", {
      teacherId: "teacher-1",
      studentId: STUDENT_ID,
      body: "Check on my child please",
    });
    await POST(req);

    // sendPushToUser runs in a fire-and-forget IIFE; wait for it to settle
    await vi.waitFor(() => {
      expect(mockSendPushToUser).toHaveBeenCalledWith(
        "teacher-1",
        expect.objectContaining({ title: "New message" })
      );
    });
  });

  it("10. guardian receives push notification when teacher sends a reply", async () => {
    mockRequireRole.mockResolvedValue(TEACHER_USER);
    mockPrisma.enrollment.findFirst.mockResolvedValueOnce({
      Class: { schoolId: "school-1" },
    });
    mockPrisma.studentGuardian.findFirst.mockResolvedValueOnce({ guardianId: "guardian-1", studentId: STUDENT_ID });
    mockPrisma.guardianMessage.create.mockResolvedValueOnce({ id: "msg-3" });

    const { POST } = await import("@/app/api/guardian/messages/route");
    const req = makeRequest("http://localhost/api/guardian/messages", "POST", {
      guardianId: "guardian-1",
      studentId: STUDENT_ID,
      body: "Your child is doing great",
    });
    await POST(req);

    // sendPushToUser should be called with the GUARDIAN's userId
    expect(mockSendPushToUser).toHaveBeenCalledWith(
      "guardian-1",
      expect.objectContaining({ title: "New message" })
    );
  });
});

// ===== Test 11: ABSENT attendance fires push to linked guardian =====
describe("POST /api/teacher/attendance — absent push", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendPushToUser.mockResolvedValue(undefined);
  });

  it("11. fires push to guardian of absent student when attendance is marked ABSENT", async () => {
    mockRequireUser.mockResolvedValue(TEACHER_USER);
    mockPrisma.school.findUnique.mockResolvedValueOnce({ districtId: "dist-1" });
    mockUpsertAttendanceForTeacher.mockResolvedValueOnce([
      { id: "att-1", studentId: STUDENT_ID, classId: "class-1", schoolId: "school-1", status: "ABSENT", date: new Date(), notes: null, markedById: "teacher-1" },
    ]);
    mockPrisma.studentGuardian.findMany.mockResolvedValueOnce([
      {
        guardianId: "guardian-1",
        student: {
          id: STUDENT_ID,
          user: { name: "Alice" },
        },
      },
    ]);

    const { POST } = await import("@/app/api/teacher/attendance/route");
    const req = makeRequest("http://localhost/api/teacher/attendance", "POST", {
      classId: "class-1",
      date: new Date().toISOString(),
      records: [{ studentId: STUDENT_ID, status: "ABSENT" }],
    });
    await POST(req);

    expect(mockSendPushToUser).toHaveBeenCalledWith(
      "guardian-1",
      expect.objectContaining({
        title: "Attendance Alert",
        body: "Alice was marked absent today",
        url: "/guardian/attendance",
      })
    );
  });
});

// ===== Test 12: Assignment due reminder notifier =====
describe("notifyAssignmentsDueTomorrow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendPushToUser.mockResolvedValue(undefined);
  });

  it("12. calls sendPushToUser for both student and guardian for due-tomorrow assignments", async () => {
    mockPrisma.assignment.findMany.mockResolvedValueOnce([
      {
        id: "assignment-1",
        title: "Algebra Homework",
        dueAt: new Date(Date.now() + 86400000),
        Class: {
          enrollments: [
            {
              Student: {
                id: STUDENT_ID,
                user: { id: "student-user-1" },
                guardians: [
                  { guardian: { id: "guardian-user-1" } },
                ],
              },
            },
          ],
        },
      },
    ]);

    const { notifyAssignmentsDueTomorrow } = await import("@/lib/assignments/dueTomorrowNotifier");
    const result = await notifyAssignmentsDueTomorrow();

    expect(result.assignments).toBe(1);
    expect(result.notified).toBe(2); // student + guardian

    // Student notified
    expect(mockSendPushToUser).toHaveBeenCalledWith(
      "student-user-1",
      expect.objectContaining({ title: "Assignment Due Tomorrow", body: "Algebra Homework is due tomorrow" })
    );

    // Guardian notified
    expect(mockSendPushToUser).toHaveBeenCalledWith(
      "guardian-user-1",
      expect.objectContaining({ title: "Assignment Due Tomorrow", body: "Algebra Homework is due tomorrow" })
    );
  });
});

// ===== Test 13: Cron route rejects missing CRON_SECRET =====
describe("POST /api/cron/assignment-due-reminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("13. returns 401 when CRON_SECRET is missing or wrong", async () => {
    const originalSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "my-secret";

    const { POST } = await import("@/app/api/cron/assignment-due-reminders/route");

    // No authorization header
    const req = new Request("http://localhost/api/cron/assignment-due-reminders", { method: "POST" });
    const res = await POST(req);

    expect(res.status).toBe(401);

    // Restore
    if (originalSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalSecret;
    }
  });
});
