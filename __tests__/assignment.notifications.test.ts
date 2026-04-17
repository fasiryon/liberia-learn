import { beforeEach, describe, expect, it, vi } from "vitest";

const mockStudentFindUnique = vi.hoisted(() => vi.fn());
const mockNotificationLogCreate = vi.hoisted(() => vi.fn());
const mockSendGuardianSMS = vi.hoisted(() => vi.fn());
const mockSendAssignmentDue = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    student: {
      findUnique: mockStudentFindUnique,
    },
    notificationLog: {
      create: mockNotificationLogCreate,
    },
  },
}));

vi.mock("@/lib/guardian/sms-service", () => ({
  sendGuardianSMS: mockSendGuardianSMS,
}));

vi.mock("@/lib/email", () => ({
  sendAssignmentDue: mockSendAssignmentDue,
}));

describe("assignment notification helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotificationLogCreate.mockResolvedValue(undefined);
    mockSendGuardianSMS.mockResolvedValue({ status: "sent" });
    mockSendAssignmentDue.mockResolvedValue({ ok: true });
  });

  it("returns cleanly when guardians are missing from the student payload", async () => {
    mockStudentFindUnique.mockResolvedValue({ id: "student-1" });
    const { notifyAssignmentSubmitted } = await import("@/lib/assignment-notifications");

    await expect(
      notifyAssignmentSubmitted({
        actorUserId: "teacher-1",
        schoolId: "school-1",
        schoolName: "Capitol Hill Academy",
        studentId: "student-1",
        studentName: "Student One",
        assignmentTitle: "Essay",
      })
    ).resolves.toBeUndefined();

    expect(mockSendGuardianSMS).not.toHaveBeenCalled();
    expect(mockNotificationLogCreate).not.toHaveBeenCalled();
  });

  it("skips blank guardian ids instead of throwing", async () => {
    mockStudentFindUnique.mockResolvedValue({
      id: "student-1",
      guardians: [{ guardianId: "" }, { guardianId: null }, { guardianId: "guardian-1" }],
    });
    const { notifyAssignmentGraded } = await import("@/lib/assignment-notifications");

    await expect(
      notifyAssignmentGraded({
        actorUserId: "teacher-1",
        schoolId: "school-1",
        schoolName: "Capitol Hill Academy",
        studentId: "student-1",
        studentName: "Student One",
        assignmentTitle: "Essay",
        score: 91,
      })
    ).resolves.toBeUndefined();

    expect(mockSendGuardianSMS).toHaveBeenCalledOnce();
    expect(mockNotificationLogCreate).toHaveBeenCalledOnce();
  });

  it("sends assignment due email without crashing the parent notification flow", async () => {
    const mockEnrollmentFindMany = vi.fn().mockResolvedValue([
      {
        Student: {
          user: {
            id: "student-user-1",
            email: "student@example.lr",
            name: "Student One",
          },
        },
      },
    ]);
    const db = await import("@/lib/db");
    (db.prisma as any).enrollment = { findMany: mockEnrollmentFindMany };

    const { notifyAssignmentCreated } = await import("@/lib/assignment-notifications");

    await expect(
      notifyAssignmentCreated({
        actorUserId: "teacher-1",
        schoolId: "school-1",
        classId: "class-1",
        assignmentTitle: "Fractions",
        className: "Grade 4",
        teacherName: "Teacher One",
        dueAt: new Date("2026-04-30T00:00:00.000Z"),
      })
    ).resolves.toBeUndefined();

    expect(mockSendAssignmentDue).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "student@example.lr",
        studentName: "Student One",
        assignmentTitle: "Fractions",
      })
    );
  });
});
