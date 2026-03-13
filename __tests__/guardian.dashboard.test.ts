/**
 * __tests__/guardian.dashboard.test.ts
 *
 * Tests for Guardian Dashboard + Messaging routes:
 *   GET  /api/guardian/dashboard
 *   GET  /api/guardian/messages
 *   POST /api/guardian/messages
 *   PATCH /api/guardian/messages/[id]/read
 *
 * Coverage:
 *   - Guardian sees only their linked child's data
 *   - Guardian cannot see another student's data (403)
 *   - Guardian can send message to teacher who teaches their child
 *   - Guardian cannot send message to teacher unrelated to their child
 *   - Message marked read only by recipient guardian
 *   - Dashboard returns masteryProfile and interventionAlerts
 *   - Flag off returns 404 on all guardian routes
 *   - No student PII leaked beyond guardian's own children
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockIsGuardianDashboardEnabled = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());

// Prisma
const mockStudentGuardianFindMany = vi.hoisted(() => vi.fn());
const mockStudentFindUnique = vi.hoisted(() => vi.fn());
const mockHomeworkSubmissionFindMany = vi.hoisted(() => vi.fn());
const mockAssignmentSubmissionFindMany = vi.hoisted(() => vi.fn());
const mockHomeworkFindMany = vi.hoisted(() => vi.fn());
const mockAssignmentFindMany = vi.hoisted(() => vi.fn());
const mockAttendanceRecordFindMany = vi.hoisted(() => vi.fn());
const mockStudentMasteryProfileFindMany = vi.hoisted(() => vi.fn());
const mockGuardianMessageCount = vi.hoisted(() => vi.fn());
const mockGuardianMessageFindMany = vi.hoisted(() => vi.fn());
const mockGuardianMessageFindFirst = vi.hoisted(() => vi.fn());
const mockGuardianMessageCreate = vi.hoisted(() => vi.fn());
const mockGuardianMessageUpdate = vi.hoisted(() => vi.fn());
const mockStudentGuardianFindFirst = vi.hoisted(() => vi.fn());
const mockEnrollmentFindFirst = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/serverFlags", () => ({
  isGuardianDashboardEnabled: mockIsGuardianDashboardEnabled,
}));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/db", () => ({
  prisma: {
    studentGuardian: {
      findMany: mockStudentGuardianFindMany,
      findFirst: mockStudentGuardianFindFirst,
    },
    student: { findUnique: mockStudentFindUnique },
    homeworkSubmission: { findMany: mockHomeworkSubmissionFindMany },
    assignmentSubmission: { findMany: mockAssignmentSubmissionFindMany },
    homework: { findMany: mockHomeworkFindMany },
    assignment: { findMany: mockAssignmentFindMany },
    attendanceRecord: { findMany: mockAttendanceRecordFindMany },
    studentMasteryProfile: { findMany: mockStudentMasteryProfileFindMany },
    guardianMessage: {
      count: mockGuardianMessageCount,
      findMany: mockGuardianMessageFindMany,
      findFirst: mockGuardianMessageFindFirst,
      create: mockGuardianMessageCreate,
      update: mockGuardianMessageUpdate,
    },
    enrollment: { findFirst: mockEnrollmentFindFirst },
  },
}));

import { GET as dashboardGET } from "@/app/api/guardian/dashboard/route";
import {
  GET as messagesGET,
  POST as messagesPOST,
} from "@/app/api/guardian/messages/route";
import { PATCH as messageReadPATCH } from "@/app/api/guardian/messages/[id]/read/route";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GUARDIAN_USER = {
  id: "guardian-1",
  role: "GUARDIAN",
  schoolId: "school-1",
  isPlatformAdmin: false,
};

const TEACHER_USER = {
  id: "teacher-1",
  role: "TEACHER",
  schoolId: "school-1",
  isPlatformAdmin: false,
};

const STUDENT_RECORD = {
  id: "student-1",
  userId: "user-1",
  currentGrade: 6,
  user: { name: "Alice Smith" },
  placementTests: [],
  enrollments: [
    {
      classId: "class-1",
      Class: {
        id: "class-1",
        name: "Grade 6 Math",
        subject: "MATH",
        School: { name: "Roosevelt Elementary" },
      },
    },
  ],
};

function makeReq(path: string, opts?: { method?: string; body?: unknown }) {
  return new Request(`http://localhost${path}`, {
    method: opts?.method ?? "GET",
    headers: opts?.body ? { "Content-Type": "application/json" } : undefined,
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  }) as any;
}

// ─── beforeEach: reset mocks to "happy path" defaults ────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  mockIsGuardianDashboardEnabled.mockReturnValue(true);
  mockRequireRole.mockResolvedValue(GUARDIAN_USER);
  mockLogAudit.mockResolvedValue(undefined);

  // Guardian has one linked student
  mockStudentGuardianFindMany.mockResolvedValue([{ studentId: "student-1" }]);
  mockStudentGuardianFindFirst.mockResolvedValue({
    id: "link-1",
    guardianId: "guardian-1",
    studentId: "student-1",
  });

  mockStudentFindUnique.mockResolvedValue(STUDENT_RECORD);

  mockHomeworkSubmissionFindMany.mockResolvedValue([]);
  mockAssignmentSubmissionFindMany.mockResolvedValue([]);
  mockHomeworkFindMany.mockResolvedValue([]);
  mockAssignmentFindMany.mockResolvedValue([]);
  mockAttendanceRecordFindMany.mockResolvedValue([]);
  mockStudentMasteryProfileFindMany.mockResolvedValue([]);
  mockGuardianMessageCount.mockResolvedValue(0);
  mockGuardianMessageFindMany.mockResolvedValue([]);
});

// ─── DASHBOARD TESTS ─────────────────────────────────────────────────────────

describe("GET /api/guardian/dashboard", () => {
  it("returns 404 when ENABLE_GUARDIAN_DASHBOARD is off", async () => {
    mockIsGuardianDashboardEnabled.mockReturnValue(false);
    const res = await dashboardGET();
    expect(res.status).toBe(404);
  });

  it("returns 403 when guardian has no linked students", async () => {
    mockStudentGuardianFindMany.mockResolvedValue([]);
    const res = await dashboardGET();
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toMatch(/no linked students/i);
  });

  it("returns dashboard with child data for linked student", async () => {
    const res = await dashboardGET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.children).toHaveLength(1);
    expect(data.children[0].studentName).toBe("Alice Smith");
    expect(data.children[0].grade).toBe(6);
    expect(data.children[0].school).toBe("Roosevelt Elementary");
    expect(data.children[0].className).toBe("Grade 6 Math");
    expect(data.lastUpdated).toBeDefined();
  });

  it("includes attendance summary in dashboard response", async () => {
    mockAttendanceRecordFindMany.mockResolvedValue([
      { status: "PRESENT" },
      { status: "PRESENT" },
      { status: "ABSENT" },
    ]);
    const res = await dashboardGET();
    expect(res.status).toBe(200);
    const data = await res.json();
    const att = data.children[0].attendance;
    expect(att.presentDays).toBe(2);
    expect(att.absentDays).toBe(1);
    expect(att.attendanceRate).toBeCloseTo(2 / 3, 2);
  });

  it("includes masteryProfile with trend in dashboard response", async () => {
    // findMany called twice: once for masteryProfile, once for interventionAlerts
    mockStudentMasteryProfileFindMany
      .mockResolvedValueOnce([
        {
          subject: "MATH",
          strandKey: "number_sense",
          currentScore: 0.75,
          baselineScore: 0.5,
        },
      ])
      .mockResolvedValueOnce([]); // no alerts

    const res = await dashboardGET();
    expect(res.status).toBe(200);
    const data = await res.json();
    const profile = data.children[0].masteryProfile;
    expect(profile).toHaveLength(1);
    expect(profile[0].subject).toBe("MATH");
    expect(profile[0].strandKey).toBe("number_sense");
    expect(profile[0].masteryLevel).toBe(0.75);
    expect(profile[0].trend).toBe("up");
  });

  it("includes interventionAlerts for DECAYING mastery in dashboard response", async () => {
    mockStudentMasteryProfileFindMany
      .mockResolvedValueOnce([]) // masteryProfile call
      .mockResolvedValueOnce([
        {
          subject: "SCIENCE",
          strandKey: "forces_motion",
          masteryState: "DECAYING",
          proficiencyState: "APPROACHING",
          updatedAt: new Date("2026-03-01T00:00:00.000Z"),
        },
      ]); // interventionAlerts call

    const res = await dashboardGET();
    expect(res.status).toBe(200);
    const data = await res.json();
    const alerts = data.children[0].interventionAlerts;
    expect(alerts).toHaveLength(1);
    expect(alerts[0].subject).toBe("SCIENCE");
    expect(alerts[0].alertType).toBe("declining_mastery");
    expect(alerts[0].createdAt).toBe("2026-03-01T00:00:00.000Z");
  });

  it("returns interventionAlerts for BELOW_PROFICIENT proficiency", async () => {
    mockStudentMasteryProfileFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          subject: "LITERACY",
          strandKey: "reading_comprehension",
          masteryState: "DEVELOPING",
          proficiencyState: "BELOW_PROFICIENT",
          updatedAt: new Date("2026-03-01T00:00:00.000Z"),
        },
      ]);

    const res = await dashboardGET();
    const data = await res.json();
    const alerts = data.children[0].interventionAlerts;
    expect(alerts[0].alertType).toBe("below_proficient");
  });

  it("guardian cannot see data for an unlinked student", async () => {
    // Guardian linked to student-1 only; student-2 should never appear
    mockStudentGuardianFindMany.mockResolvedValue([{ studentId: "student-1" }]);
    const res = await dashboardGET();
    const data = await res.json();
    // Only student-1's data returned
    expect(data.children).toHaveLength(1);
    expect(data.children[0].studentName).toBe("Alice Smith");
    // Confirm student-2 data was never fetched
    expect(mockStudentFindUnique).toHaveBeenCalledTimes(1);
    expect(mockStudentFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "student-1" } })
    );
  });

  it("includes unreadMessages count in dashboard response", async () => {
    mockGuardianMessageCount.mockResolvedValue(3);
    const res = await dashboardGET();
    const data = await res.json();
    expect(data.unreadMessages).toBe(3);
  });

  it("includes placement history with teacher review status", async () => {
    mockStudentFindUnique.mockResolvedValue({
      ...STUDENT_RECORD,
      placementTests: [
        {
          id: "placement-1",
          estimatedGrade: 6,
          teacherDecision: "overridden",
          teacherGrade: 7,
          levelLabel: "Developing",
          createdAt: new Date("2026-03-10T00:00:00.000Z"),
        },
      ],
    });

    const res = await dashboardGET();
    const data = await res.json();

    expect(data.children[0].placementHistory).toEqual([
      expect.objectContaining({
        id: "placement-1",
        estimatedGrade: 6,
        teacherGrade: 7,
        status: "overridden",
        summary: "AI recommended Grade 6, teacher adjusted to Grade 7",
      }),
    ]);
  });
});

// ─── MESSAGES GET TESTS ───────────────────────────────────────────────────────

describe("GET /api/guardian/messages", () => {
  it("returns 404 when flag is off", async () => {
    mockIsGuardianDashboardEnabled.mockReturnValue(false);
    const res = await messagesGET();
    expect(res.status).toBe(404);
  });

  it("returns empty array when no messages", async () => {
    const res = await messagesGET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual([]);
  });

  it("returns formatted message thread scoped to this guardian", async () => {
    mockGuardianMessageFindMany.mockResolvedValue([
      {
        id: "msg-1",
        fromRole: "guardian",
        body: "Hello teacher",
        sentAt: new Date("2026-03-01T09:00:00.000Z"),
        read: false,
        guardian: { name: "Parent One" },
        teacher: { name: "Mr. Johnson" },
      },
      {
        id: "msg-2",
        fromRole: "teacher",
        body: "Hello guardian",
        sentAt: new Date("2026-03-01T10:00:00.000Z"),
        read: true,
        guardian: { name: "Parent One" },
        teacher: { name: "Mr. Johnson" },
      },
    ]);

    const res = await messagesGET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(2);
    expect(data[0].messageId).toBe("msg-1");
    expect(data[0].fromRole).toBe("guardian");
    expect(data[0].fromName).toBe("Parent One");
    expect(data[0].body).toBe("Hello teacher");
    expect(data[0].read).toBe(false);
    expect(data[1].fromName).toBe("Mr. Johnson");
    expect(data[1].read).toBe(true);
  });

  it("scopes message query to the requesting guardian's id", async () => {
    await messagesGET();
    expect(mockGuardianMessageFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { guardianId: "guardian-1" },
      })
    );
  });

  it("supports teacher-scoped message listing", async () => {
    mockRequireRole.mockResolvedValue(TEACHER_USER);
    mockGuardianMessageFindMany.mockResolvedValue([
      {
        id: "msg-1",
        guardianId: "guardian-1",
        teacherId: "teacher-1",
        studentId: "student-1",
        fromRole: "guardian",
        body: "Need help with homework",
        sentAt: new Date("2026-03-01T09:00:00.000Z"),
        read: false,
        guardian: { name: "Parent One" },
        teacher: { name: "Mr. Johnson" },
        student: {
          user: { name: "Alice Smith" },
          enrollments: [{ Class: { name: "Grade 6 Math", subject: "MATH" } }],
        },
      },
    ]);

    const res = await messagesGET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data[0].studentName).toBe("Alice Smith");
    expect(data[0].subject).toBe("MATH");
    expect(mockGuardianMessageFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { teacherId: "teacher-1" },
      })
    );
  });
});

// ─── MESSAGES POST TESTS ─────────────────────────────────────────────────────

describe("POST /api/guardian/messages", () => {
  beforeEach(() => {
    mockEnrollmentFindFirst.mockResolvedValue({
      classId: "class-1",
      Class: { schoolId: "school-1", teacherId: "teacher-1" },
    });
    mockGuardianMessageCreate.mockResolvedValue({
      id: "msg-new",
      guardianId: "guardian-1",
      teacherId: "teacher-1",
      studentId: "student-1",
      schoolId: "school-1",
      fromRole: "guardian",
      body: "Test message",
    });
  });

  it("returns 404 when flag is off", async () => {
    mockIsGuardianDashboardEnabled.mockReturnValue(false);
    const req = makeReq("/api/guardian/messages", {
      method: "POST",
      body: { teacherId: "t1", studentId: "s1", body: "hi" },
    });
    const res = await messagesPOST(req);
    expect(res.status).toBe(404);
  });

  it("creates a message to a teacher who teaches guardian's child", async () => {
    const req = makeReq("/api/guardian/messages", {
      method: "POST",
      body: {
        teacherId: "teacher-1",
        studentId: "student-1",
        body: "How is Alice doing?",
      },
    });
    const res = await messagesPOST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.messageId).toBe("msg-new");
  });

  it("returns 403 if studentId is not linked to this guardian", async () => {
    mockStudentGuardianFindFirst.mockResolvedValue(null);
    const req = makeReq("/api/guardian/messages", {
      method: "POST",
      body: {
        teacherId: "teacher-1",
        studentId: "student-other",
        body: "Unauthorized access attempt",
      },
    });
    const res = await messagesPOST(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toMatch(/access/i);
  });

  it("returns 403 if teacher is unrelated to guardian's child's classes", async () => {
    mockEnrollmentFindFirst.mockResolvedValue(null);
    const req = makeReq("/api/guardian/messages", {
      method: "POST",
      body: {
        teacherId: "unrelated-teacher",
        studentId: "student-1",
        body: "Should not work",
      },
    });
    const res = await messagesPOST(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toMatch(/not associated/i);
  });

  it("returns 400 for empty body", async () => {
    const req = makeReq("/api/guardian/messages", {
      method: "POST",
      body: { teacherId: "teacher-1", studentId: "student-1", body: "   " },
    });
    const res = await messagesPOST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/empty/i);
  });

  it("returns 400 if body exceeds 1000 characters", async () => {
    const req = makeReq("/api/guardian/messages", {
      method: "POST",
      body: {
        teacherId: "teacher-1",
        studentId: "student-1",
        body: "a".repeat(1001),
      },
    });
    const res = await messagesPOST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/1000 characters/i);
  });

  it("returns 400 if teacherId is missing", async () => {
    const req = makeReq("/api/guardian/messages", {
      method: "POST",
      body: { studentId: "student-1", body: "hello" },
    });
    const res = await messagesPOST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/teacherId/i);
  });

  it("returns 400 if studentId is missing", async () => {
    const req = makeReq("/api/guardian/messages", {
      method: "POST",
      body: { teacherId: "teacher-1", body: "hello" },
    });
    const res = await messagesPOST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/studentId/i);
  });

  it("allows a teacher to reply to a linked guardian", async () => {
    mockRequireRole.mockResolvedValue(TEACHER_USER);
    const req = makeReq("/api/guardian/messages", {
      method: "POST",
      body: {
        guardianId: "guardian-1",
        studentId: "student-1",
        body: "Alice is improving this week.",
      },
    });

    const res = await messagesPOST(req);
    expect(res.status).toBe(201);
    expect(mockGuardianMessageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          guardianId: "guardian-1",
          teacherId: "teacher-1",
          fromRole: "teacher",
        }),
      })
    );
  });
});

// ─── MESSAGES READ PATCH TESTS ────────────────────────────────────────────────

describe("PATCH /api/guardian/messages/[id]/read", () => {
  beforeEach(() => {
    mockGuardianMessageFindFirst.mockResolvedValue({
      id: "msg-1",
      guardianId: "guardian-1",
      schoolId: "school-1",
      read: false,
    });
    mockGuardianMessageUpdate.mockResolvedValue({
      id: "msg-1",
      read: true,
    });
  });

  it("returns 404 when flag is off", async () => {
    mockIsGuardianDashboardEnabled.mockReturnValue(false);
    const res = await messageReadPATCH(makeReq("/"), {
      params: { id: "msg-1" },
    });
    expect(res.status).toBe(404);
  });

  it("marks own message as read", async () => {
    const res = await messageReadPATCH(makeReq("/"), {
      params: { id: "msg-1" },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.read).toBe(true);
    expect(data.messageId).toBe("msg-1");
    expect(mockGuardianMessageUpdate).toHaveBeenCalledWith({
      where: { id: "msg-1" },
      data: { read: true },
    });
  });

  it("returns 404 if message belongs to a different guardian", async () => {
    mockGuardianMessageFindFirst.mockResolvedValue(null);
    const res = await messageReadPATCH(makeReq("/"), {
      params: { id: "msg-other-guardian" },
    });
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toMatch(/not found|access denied/i);
  });

  it("is idempotent — already-read message returns 200 without DB write", async () => {
    mockGuardianMessageFindFirst.mockResolvedValue({
      id: "msg-1",
      guardianId: "guardian-1",
      schoolId: "school-1",
      read: true, // already read
    });
    const res = await messageReadPATCH(makeReq("/"), {
      params: { id: "msg-1" },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.read).toBe(true);
    // No DB update issued
    expect(mockGuardianMessageUpdate).not.toHaveBeenCalled();
  });

  it("query is scoped to requesting guardian id — no cross-guardian access", async () => {
    await messageReadPATCH(makeReq("/"), { params: { id: "msg-1" } });
    expect(mockGuardianMessageFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "msg-1", guardianId: "guardian-1" },
      })
    );
  });

  it("allows a teacher to mark guardian messages as read", async () => {
    mockRequireRole.mockResolvedValue(TEACHER_USER);
    mockGuardianMessageFindFirst.mockResolvedValue({
      id: "msg-1",
      teacherId: "teacher-1",
      schoolId: "school-1",
      read: false,
    });

    const res = await messageReadPATCH(makeReq("/"), { params: { id: "msg-1" } });
    expect(res.status).toBe(200);
    expect(mockGuardianMessageFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "msg-1", teacherId: "teacher-1" },
      })
    );
  });
});
