import { beforeEach, describe, expect, it, vi } from "vitest";

const mockStudentProgressFindUnique = vi.hoisted(() => vi.fn());
const mockCertificateFindUnique = vi.hoisted(() => vi.fn());
const mockCertificateCreate = vi.hoisted(() => vi.fn());
const mockCertificateFindMany = vi.hoisted(() => vi.fn());
const mockEnrollmentFindMany = vi.hoisted(() => vi.fn());
const mockScheduledWorkFindMany = vi.hoisted(() => vi.fn());
const mockNotificationLogCreate = vi.hoisted(() => vi.fn());
const mockUserFindUnique = vi.hoisted(() => vi.fn());
const mockSendCertificateAwarded = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockLogLearningEvent = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    studentProgress: {
      findUnique: mockStudentProgressFindUnique,
    },
    certificate: {
      findUnique: mockCertificateFindUnique,
      create: mockCertificateCreate,
      findMany: mockCertificateFindMany,
    },
    enrollment: {
      findMany: mockEnrollmentFindMany,
    },
    scheduledWork: {
      findMany: mockScheduledWorkFindMany,
      findUnique: vi.fn(),
    },
    notificationLog: {
      create: mockNotificationLogCreate,
    },
    user: {
      findUnique: mockUserFindUnique,
    },
  },
}));

vi.mock("@/lib/email", () => ({
  sendCertificateAwarded: mockSendCertificateAwarded,
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
}));

vi.mock("@/lib/events/logLearningEvent", () => ({
  logLearningEvent: mockLogLearningEvent,
}));

describe("awardLessonQuizCertificates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogAudit.mockResolvedValue(undefined);
    mockLogLearningEvent.mockResolvedValue(undefined);
    mockNotificationLogCreate.mockResolvedValue({ id: "notif-1" });
    mockUserFindUnique.mockResolvedValue(null);
    mockSendCertificateAwarded.mockResolvedValue({ ok: true });
  });

  it("does not award a certificate below the passing score", async () => {
    const { awardLessonQuizCertificates } = await import(
      "@/lib/certificates/certificateService"
    );

    const result = await awardLessonQuizCertificates({
      studentId: "student-1",
      studentUserId: "user-1",
      schoolId: "school-1",
      classId: "class-1",
      subject: "SCIENCE",
      scheduledWorkId: "lesson-1",
      contentId: "content-1",
      lessonTitle: "Living Things",
      actingUserId: "user-1",
      quizScore: 0.6,
    });

    expect(result).toEqual({ lessonAwarded: false, subjectAwarded: false });
    expect(mockCertificateCreate).not.toHaveBeenCalled();
  });

  it("awards lesson and subject certificates when the student has completed every lesson in the subject", async () => {
    mockStudentProgressFindUnique.mockResolvedValue({ completedAt: new Date("2026-04-15T12:00:00Z") });
    mockCertificateFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mockCertificateCreate
      .mockResolvedValueOnce({ id: "cert-lesson-1", certificateCode: "ABC12345" })
      .mockResolvedValueOnce({ id: "cert-subject-1", certificateCode: "XYZ67890" });
    mockEnrollmentFindMany.mockResolvedValue([{ classId: "class-1" }]);
    mockScheduledWorkFindMany.mockResolvedValue([
      { id: "lesson-1" },
      { id: "lesson-2" },
    ]);
    mockCertificateFindMany.mockResolvedValue([
      { referenceId: "lesson-1" },
      { referenceId: "lesson-2" },
    ]);

    const { awardLessonQuizCertificates } = await import(
      "@/lib/certificates/certificateService"
    );

    const result = await awardLessonQuizCertificates({
      studentId: "student-1",
      studentUserId: "user-1",
      schoolId: "school-1",
      classId: "class-1",
      subject: "SCIENCE",
      scheduledWorkId: "lesson-1",
      contentId: "content-1",
      lessonTitle: "Living Things",
      actingUserId: "user-1",
      quizScore: 0.85,
    });

    expect(result).toEqual({ lessonAwarded: true, subjectAwarded: true });
    expect(mockCertificateCreate).toHaveBeenCalledTimes(2);
    expect(mockNotificationLogCreate).toHaveBeenCalledTimes(2);
    expect(mockLogAudit).toHaveBeenCalledTimes(2);
    expect(mockLogLearningEvent).toHaveBeenCalledTimes(2);
  });

  it("sends certificate award email when the student has an email address", async () => {
    mockStudentProgressFindUnique.mockResolvedValue({ completedAt: new Date("2026-04-15T12:00:00Z") });
    mockCertificateFindUnique.mockResolvedValueOnce(null);
    mockCertificateCreate.mockResolvedValueOnce({ id: "cert-lesson-1", certificateCode: "ABC12345" });
    mockEnrollmentFindMany.mockResolvedValue([]);
    mockUserFindUnique.mockResolvedValue({ email: "student@example.lr", name: "Student One" });

    const { awardLessonQuizCertificates } = await import(
      "@/lib/certificates/certificateService"
    );

    await awardLessonQuizCertificates({
      studentId: "student-1",
      studentUserId: "user-1",
      schoolId: "school-1",
      classId: "class-1",
      subject: "SCIENCE",
      scheduledWorkId: "lesson-1",
      contentId: "content-1",
      lessonTitle: "Living Things",
      actingUserId: "user-1",
      quizScore: 0.85,
    });

    expect(mockSendCertificateAwarded).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "student@example.lr",
        studentName: "Student One",
        certificateTitle: "Living Things",
        certificateCode: "ABC12345",
      })
    );
  });
});
