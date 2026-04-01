import { beforeEach, describe, expect, it, vi } from "vitest";

const mockStudentFindUnique = vi.hoisted(() => vi.fn());
const mockNotificationLogCreate = vi.hoisted(() => vi.fn());
const mockSendGuardianSMS = vi.hoisted(() => vi.fn());

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

describe("assignment notification helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotificationLogCreate.mockResolvedValue(undefined);
    mockSendGuardianSMS.mockResolvedValue({ status: "sent" });
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
});
