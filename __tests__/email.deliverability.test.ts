import { beforeEach, describe, expect, it, vi } from "vitest";

describe("email deliverability helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "test");
  });

  it("sendEmail returns early in test environment", async () => {
    const { sendEmail } = await import("@/lib/email");

    const result = await sendEmail({
      to: "student@example.lr",
      subject: "Test",
      html: "<p>Test</p>",
      text: "Test",
      type: "test_email",
      recipientRole: "student",
    });

    expect(result).toEqual({ ok: true, id: "test-no-send" });
  });

  it("renders all configured templates without throwing", async () => {
    const email = await import("@/lib/email");
    const commonUrl = "https://liberia-learn.vercel.app/login";

    const results = await Promise.all([
      email.sendSchoolEnrollmentReceived({
        to: "principal@example.lr",
        principalName: "Principal Doe",
        schoolName: "Capitol Hill Academy",
        loginId: "principal",
        temporaryPassword: "TempPass1",
      }),
      email.sendSchoolApprovalNotice({
        to: "principal@example.lr",
        principalName: "Principal Doe",
        schoolName: "Capitol Hill Academy",
        schoolCode: "LIB-MONT-1234",
        loginUrl: commonUrl,
      }),
      email.sendSchoolRejectionNotice({
        to: "principal@example.lr",
        schoolName: "Capitol Hill Academy",
        reason: "Missing registration document",
      }),
      email.sendPlatformAdminSchoolPending({
        to: "admin@example.lr",
        schoolName: "Capitol Hill Academy",
        county: "Montserrado",
        principalName: "Principal Doe",
      }),
      email.sendTeacherInvite({
        to: "teacher@example.lr",
        name: "Teacher Doe",
        schoolName: "Capitol Hill Academy",
        inviteUrl: commonUrl,
      }),
      email.sendStudentInvite({
        to: "student@example.lr",
        name: "Student Doe",
        schoolName: "Capitol Hill Academy",
        inviteUrl: commonUrl,
      }),
      email.sendGuardianInvite({
        to: "guardian@example.lr",
        guardianName: "Guardian Doe",
        studentName: "Student Doe",
        schoolName: "Capitol Hill Academy",
        inviteUrl: commonUrl,
      }),
      email.sendGuardianWelcome({
        to: "guardian@example.lr",
        guardianName: "Guardian Doe",
        schoolName: "Capitol Hill Academy",
        dashboardUrl: commonUrl,
      }),
      email.sendPasswordReset({
        to: "user@example.lr",
        name: "User Doe",
        resetUrl: commonUrl,
      }),
      email.sendHomeworkGraded({
        to: "student@example.lr",
        studentName: "Student Doe",
        homeworkTitle: "Fractions",
        score: 92,
        dashboardUrl: commonUrl,
      }),
      email.sendStudentWelcome({
        to: "student@example.lr",
        studentName: "Student Doe",
        schoolName: "Capitol Hill Academy",
        loginId: "student",
        loginUrl: commonUrl,
      }),
      email.sendCertificateAwarded({
        to: "student@example.lr",
        studentName: "Student Doe",
        certificateTitle: "Fractions Certificate",
        certificateCode: "ABC12345",
        verifyUrl: commonUrl,
      }),
      email.sendAssignmentDue({
        to: "student@example.lr",
        studentName: "Student Doe",
        assignmentTitle: "Fractions",
        className: "Grade 4",
        teacherName: "Teacher Doe",
        dueAt: new Date("2026-04-30T00:00:00.000Z"),
        assignmentUrl: commonUrl,
      }),
      email.sendWeeklyProgressToGuardian({
        to: "guardian@example.lr",
        guardianName: "Guardian Doe",
        studentName: "Student Doe",
        schoolName: "Capitol Hill Academy",
        weekSummary: [{ subject: "Math", homework: 2, avgScore: 85 }],
        dashboardUrl: commonUrl,
      }),
    ]);

    expect(results.every((result) => result.ok)).toBe(true);
  });
});
