import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockPrisma,
  mockComposeGuardianDigest,
  mockMostRecentWeekWindow,
  mockSendGuardianSMS,
  mockSendPushToUser,
  mockGetTeacherAlertPref,
  mockLogAudit,
  mockEnqueueEscalation,
  mockCreateInboxNotification,
} = vi.hoisted(() => {
  const mockPrisma = {
    studentGuardian: { findUnique: vi.fn() },
    student: { findUnique: vi.fn() },
    studentMasteryProfile: { findMany: vi.fn() },
    studentProgress: { findMany: vi.fn() },
    attendance: { findMany: vi.fn() },
    enrollment: { findMany: vi.fn(), findFirst: vi.fn() },
    assignment: { findMany: vi.fn() },
    homework: { findMany: vi.fn() },
    assignmentSubmission: { findMany: vi.fn() },
    homeworkSubmission: { findMany: vi.fn() },
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    guardianMessage: { create: vi.fn() },
  };
  return {
    mockPrisma,
    mockComposeGuardianDigest: vi.fn(),
    mockMostRecentWeekWindow: vi.fn(),
    mockSendGuardianSMS: vi.fn(),
    mockSendPushToUser: vi.fn(),
    mockGetTeacherAlertPref: vi.fn(),
    mockLogAudit: vi.fn(),
    mockEnqueueEscalation: vi.fn(),
    mockCreateInboxNotification: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/notifications/guardianDigest", () => ({
  composeGuardianDigest: mockComposeGuardianDigest,
  mostRecentWeekWindow: mockMostRecentWeekWindow,
}));
vi.mock("@/lib/guardian/sms-service", () => ({ sendGuardianSMS: mockSendGuardianSMS }));
vi.mock("@/lib/push/sendPush", () => ({ sendPushToUser: mockSendPushToUser }));
vi.mock("@/lib/alert-prefs", () => ({ getTeacherAlertPref: mockGetTeacherAlertPref }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/agents/escalation", () => ({ enqueueEscalation: mockEnqueueEscalation }));
vi.mock("@/lib/notifications/inboxService", () => ({ createInboxNotification: mockCreateInboxNotification }));

import {
  getStudentProgressTool,
  getRecentActivityTool,
  getUpcomingWorkTool,
  getTeacherContactTool,
  triggerDigestNowTool,
  flagForTeacherTool,
  requestPhoneUpdateTool,
} from "@/lib/agents/tools/guardian.tools";

const GUARDIAN_CTX = { agentName: "liberialearn-family", userId: "guardian-1", userRole: "system" as const };

function resetAll() {
  Object.values(mockPrisma).forEach((delegate) =>
    Object.values(delegate).forEach((fn) => (fn as ReturnType<typeof vi.fn>).mockReset())
  );
  mockComposeGuardianDigest.mockReset();
  mockMostRecentWeekWindow.mockReset();
  mockSendGuardianSMS.mockReset();
  mockSendPushToUser.mockReset();
  mockGetTeacherAlertPref.mockReset();
  mockLogAudit.mockReset();
  mockEnqueueEscalation.mockReset();
  mockCreateInboxNotification.mockReset();
}

describe("guardian.getStudentProgress", () => {
  beforeEach(() => {
    resetAll();
    mockPrisma.studentGuardian.findUnique.mockResolvedValue({ id: "link-1" });
    mockPrisma.enrollment.findMany.mockResolvedValue([]);
    mockPrisma.assignment.findMany.mockResolvedValue([]);
    mockPrisma.homework.findMany.mockResolvedValue([]);
  });

  it("rejects a caller who is not a verified guardian of the student", async () => {
    mockPrisma.studentGuardian.findUnique.mockResolvedValue(null);
    await expect(
      getStudentProgressTool.handler({ studentId: "student-1" }, GUARDIAN_CTX)
    ).rejects.toMatchObject({ status: 403 });
  });

  it("returns mastery, recent completions, attendance rate, and grade for a verified guardian", async () => {
    mockPrisma.student.findUnique.mockResolvedValue({ userId: "user-1", currentGrade: 7 });
    mockPrisma.studentMasteryProfile.findMany.mockResolvedValue([
      { subject: "MATH", strandKey: "algebra", currentScore: 0.8, masteryState: "PROFICIENT" },
    ]);
    mockPrisma.studentProgress.findMany.mockResolvedValue([
      {
        completedAt: new Date("2026-07-01T00:00:00Z"),
        scheduledWork: { content: { title: "Fractions", subject: "MATH" } },
      },
    ]);
    mockPrisma.attendance.findMany.mockResolvedValue([{ status: "PRESENT" }, { status: "ABSENT" }]);

    const result = await getStudentProgressTool.handler({ studentId: "student-1" }, GUARDIAN_CTX);

    expect(result.currentGrade).toBe(7);
    expect(result.mastery[0]).toMatchObject({ subject: "MATH", currentScore: 0.8 });
    expect(result.recentCompletions[0]).toMatchObject({ title: "Fractions" });
    expect(result.attendanceRate).toBe(0.5);
  });

  it("returns null attendanceRate when there are no attendance records", async () => {
    mockPrisma.student.findUnique.mockResolvedValue({ userId: "user-1", currentGrade: null });
    mockPrisma.studentMasteryProfile.findMany.mockResolvedValue([]);
    mockPrisma.studentProgress.findMany.mockResolvedValue([]);
    mockPrisma.attendance.findMany.mockResolvedValue([]);

    const result = await getStudentProgressTool.handler({ studentId: "student-1" }, GUARDIAN_CTX);
    expect(result.attendanceRate).toBeNull();
  });

  it("404s when the student does not exist", async () => {
    mockPrisma.student.findUnique.mockResolvedValue(null);
    await expect(
      getStudentProgressTool.handler({ studentId: "ghost" }, GUARDIAN_CTX)
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("guardian.getRecentActivity", () => {
  beforeEach(() => {
    resetAll();
    mockPrisma.studentGuardian.findUnique.mockResolvedValue({ id: "link-1" });
  });

  it("rejects an unverified caller", async () => {
    mockPrisma.studentGuardian.findUnique.mockResolvedValue(null);
    await expect(
      getRecentActivityTool.handler({ studentId: "student-1", days: 7 }, GUARDIAN_CTX)
    ).rejects.toMatchObject({ status: 403 });
  });

  it("returns lessons, assignments, and completions for a verified guardian", async () => {
    mockPrisma.student.findUnique.mockResolvedValue({ userId: "user-1" });
    mockPrisma.studentProgress.findMany.mockResolvedValue([
      { completedAt: new Date(), scheduledWork: { content: { title: "L1", subject: "MATH" } } },
    ]);
    mockPrisma.assignmentSubmission.findMany.mockResolvedValue([
      { turnedInAt: new Date(), score: 90, Assignment: { title: "A1" } },
    ]);
    mockPrisma.homeworkSubmission.findMany.mockResolvedValue([
      { submittedAt: new Date(), aiScore: 0.7, teacherScore: null, Homework: { title: "H1" } },
    ]);

    const result = await getRecentActivityTool.handler({ studentId: "student-1", days: 7 }, GUARDIAN_CTX);
    expect(result.lessons[0]).toMatchObject({ title: "L1" });
    expect(result.assignments[0]).toMatchObject({ title: "A1", score: 90 });
    expect(result.completions[0]).toMatchObject({ title: "H1", score: 0.7 });
  });
});

describe("guardian.getUpcomingWork", () => {
  beforeEach(() => {
    resetAll();
    mockPrisma.studentGuardian.findUnique.mockResolvedValue({ id: "link-1" });
  });

  it("rejects an unverified caller", async () => {
    mockPrisma.studentGuardian.findUnique.mockResolvedValue(null);
    await expect(getUpcomingWorkTool.handler({ studentId: "student-1" }, GUARDIAN_CTX)).rejects.toMatchObject({
      status: 403,
    });
  });

  it("marks an assignment as submitted when a submission with turnedInAt exists", async () => {
    mockPrisma.enrollment.findMany.mockResolvedValue([{ classId: "class-1", Class: { subject: "MATH" } }]);
    mockPrisma.assignment.findMany.mockResolvedValue([
      {
        title: "Fractions HW",
        classId: "class-1",
        dueAt: new Date("2026-08-01T00:00:00Z"),
        submissions: [{ turnedInAt: new Date() }],
      },
    ]);
    mockPrisma.homework.findMany.mockResolvedValue([]);

    const result = await getUpcomingWorkTool.handler({ studentId: "student-1" }, GUARDIAN_CTX);
    expect(result.assignments[0]).toMatchObject({ title: "Fractions HW", subject: "MATH", status: "submitted" });
  });

  it("marks work as pending when no submission exists", async () => {
    mockPrisma.enrollment.findMany.mockResolvedValue([{ classId: "class-1", Class: { subject: "SCIENCE" } }]);
    mockPrisma.assignment.findMany.mockResolvedValue([]);
    mockPrisma.homework.findMany.mockResolvedValue([
      { title: "Lab report", classId: "class-1", dueAt: new Date("2026-08-05T00:00:00Z"), submissions: [] },
    ]);

    const result = await getUpcomingWorkTool.handler({ studentId: "student-1" }, GUARDIAN_CTX);
    expect(result.assignments[0]).toMatchObject({ title: "Lab report", subject: "SCIENCE", status: "pending" });
  });

  it("returns an empty list when the student has no enrollments", async () => {
    mockPrisma.enrollment.findMany.mockResolvedValue([]);
    const result = await getUpcomingWorkTool.handler({ studentId: "student-1" }, GUARDIAN_CTX);
    expect(result.assignments).toEqual([]);
    expect(mockPrisma.assignment.findMany).not.toHaveBeenCalled();
  });
});

describe("guardian.getTeacherContact", () => {
  beforeEach(() => {
    resetAll();
    mockPrisma.studentGuardian.findUnique.mockResolvedValue({ id: "link-1" });
  });

  it("rejects an unverified caller", async () => {
    mockPrisma.studentGuardian.findUnique.mockResolvedValue(null);
    await expect(getTeacherContactTool.handler({ studentId: "student-1" }, GUARDIAN_CTX)).rejects.toMatchObject({
      status: 403,
    });
  });

  it("returns one entry per distinct teacher+subject", async () => {
    mockPrisma.enrollment.findMany.mockResolvedValue([
      {
        Class: {
          subject: "MATH",
          teacherId: "teacher-1",
          Teacher: { name: "Mr. Kollie", email: "kollie@school.lr" },
        },
      },
      {
        Class: {
          subject: "SCIENCE",
          teacherId: "teacher-2",
          Teacher: { name: "Ms. Doe", email: "doe@school.lr" },
        },
      },
    ]);

    const result = await getTeacherContactTool.handler({ studentId: "student-1" }, GUARDIAN_CTX);
    expect(result.teachers).toHaveLength(2);
    expect(result.teachers).toContainEqual(
      expect.objectContaining({ name: "Mr. Kollie", subject: "MATH", email: "kollie@school.lr" })
    );
  });

  it("filters by subject when provided", async () => {
    mockPrisma.enrollment.findMany.mockResolvedValue([
      { Class: { subject: "MATH", teacherId: "teacher-1", Teacher: { name: "Mr. Kollie", email: null } } },
    ]);
    await getTeacherContactTool.handler({ studentId: "student-1", subject: "math" }, GUARDIAN_CTX);
    expect(mockPrisma.enrollment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ Class: { subject: "MATH" } }) })
    );
  });
});

describe("guardian.triggerDigestNow", () => {
  beforeEach(() => resetAll());

  it("rejects a caller triggering someone else's digest", async () => {
    await expect(
      triggerDigestNowTool.handler({ guardianId: "someone-else" }, GUARDIAN_CTX)
    ).rejects.toMatchObject({ status: 403 });
  });

  it("composes and sends the digest for the caller's own guardianId", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ guardianOf: [{ studentId: "student-1" }] });
    mockMostRecentWeekWindow.mockReturnValue({ weekStart: new Date(), weekEnd: new Date() });
    mockComposeGuardianDigest.mockResolvedValue({
      schoolId: "school-1",
      primaryStudentId: "student-1",
      studentFirstName: "Pewu",
      smsText: "digest text",
      metrics: { lessonsCompleted: 3, avgScore: 80, strongestSubject: "MATH", stuckLessonTitle: null, actionTip: null },
    });
    mockSendGuardianSMS.mockResolvedValue({ status: "sent", deliveryLogId: "log-1" });

    const result = await triggerDigestNowTool.handler({ guardianId: "guardian-1" }, GUARDIAN_CTX);
    expect(result).toEqual({ messageId: "log-1", deliveryStatus: "sent" });
    expect(mockSendGuardianSMS).toHaveBeenCalled();
  });

  it("returns skipped when there is nothing to compose (opted out / no activity)", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ guardianOf: [{ studentId: "student-1" }] });
    mockMostRecentWeekWindow.mockReturnValue({ weekStart: new Date(), weekEnd: new Date() });
    mockComposeGuardianDigest.mockResolvedValue(null);

    const result = await triggerDigestNowTool.handler({ guardianId: "guardian-1" }, GUARDIAN_CTX);
    expect(result).toEqual({ messageId: null, deliveryStatus: "skipped" });
    expect(mockSendGuardianSMS).not.toHaveBeenCalled();
  });
});

describe("guardian.flagForTeacher", () => {
  beforeEach(() => {
    resetAll();
    mockPrisma.studentGuardian.findUnique.mockResolvedValue({ id: "link-1" });
    mockGetTeacherAlertPref.mockResolvedValue({ alertGuardianMessage: true });
  });

  it("rejects an unverified caller", async () => {
    mockPrisma.studentGuardian.findUnique.mockResolvedValue(null);
    await expect(
      flagForTeacherTool.handler({ studentId: "student-1", message: "hi" }, GUARDIAN_CTX)
    ).rejects.toMatchObject({ status: 403 });
  });

  it("persists a GuardianMessage and notifies the teacher", async () => {
    mockPrisma.enrollment.findFirst.mockResolvedValue({
      Class: { schoolId: "school-1", teacherId: "teacher-1" },
    });
    mockPrisma.guardianMessage.create.mockResolvedValue({ id: "msg-1" });

    const result = await flagForTeacherTool.handler(
      { studentId: "student-1", message: "My son was sick" },
      GUARDIAN_CTX
    );

    expect(result).toEqual({ messageId: "msg-1", deliveryStatus: "delivered" });
    expect(mockPrisma.guardianMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ guardianId: "guardian-1", teacherId: "teacher-1", fromRole: "guardian" }),
      })
    );
    expect(mockSendPushToUser).toHaveBeenCalled();
  });

  it("404s when the student has no teacher on record", async () => {
    mockPrisma.enrollment.findFirst.mockResolvedValue(null);
    await expect(
      flagForTeacherTool.handler({ studentId: "student-1", message: "hi" }, GUARDIAN_CTX)
    ).rejects.toMatchObject({ status: 404 });
  });

  it("still succeeds if the push notification fails (best-effort)", async () => {
    mockPrisma.enrollment.findFirst.mockResolvedValue({
      Class: { schoolId: "school-1", teacherId: "teacher-1" },
    });
    mockPrisma.guardianMessage.create.mockResolvedValue({ id: "msg-1" });
    mockGetTeacherAlertPref.mockRejectedValue(new Error("boom"));

    const result = await flagForTeacherTool.handler({ studentId: "student-1", message: "hi" }, GUARDIAN_CTX);
    expect(result).toEqual({ messageId: "msg-1", deliveryStatus: "delivered" });
  });
});

describe("guardian.requestPhoneUpdate", () => {
  beforeEach(() => resetAll());

  it("rejects a caller with no resolved guardian identity (challenge-only grant)", async () => {
    await expect(
      requestPhoneUpdateTool.handler({ reason: "new SIM" }, { agentName: "x", userId: null })
    ).rejects.toMatchObject({ status: 401 });
    expect(mockEnqueueEscalation).not.toHaveBeenCalled();
  });

  it("never writes User.guardianPhoneE164 - only flags the request", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      guardianOf: [{ student: { user: { schoolId: "school-1" } } }],
    });
    mockPrisma.user.findMany.mockResolvedValue([{ id: "admin-1" }]);
    mockEnqueueEscalation.mockResolvedValue({ id: "esc-1" });

    const result = await requestPhoneUpdateTool.handler({ reason: "my number changed" }, GUARDIAN_CTX);

    expect(result).toEqual({ escalationId: "esc-1" });
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.anything() })
    );
    expect(mockEnqueueEscalation).toHaveBeenCalledWith(
      expect.objectContaining({ priority: "LOW", userId: "guardian-1", schoolId: "school-1" })
    );
  });

  it("notifies ADMIN-role users at the guardian's school", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      guardianOf: [{ student: { user: { schoolId: "school-1" } } }],
    });
    mockPrisma.user.findMany.mockResolvedValue([{ id: "admin-1" }, { id: "admin-2" }]);
    mockEnqueueEscalation.mockResolvedValue({ id: "esc-1" });

    await requestPhoneUpdateTool.handler({ reason: "new SIM" }, GUARDIAN_CTX);

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { role: "ADMIN", schoolId: "school-1" } })
    );
    expect(mockCreateInboxNotification).toHaveBeenCalledTimes(2);
  });

  it("still succeeds without a resolvable schoolId (no admins to notify)", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ guardianOf: [] });
    mockEnqueueEscalation.mockResolvedValue({ id: "esc-1" });

    const result = await requestPhoneUpdateTool.handler({ reason: "new SIM" }, GUARDIAN_CTX);

    expect(result).toEqual({ escalationId: "esc-1" });
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
  });
});
