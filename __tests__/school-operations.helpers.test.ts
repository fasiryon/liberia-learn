import { describe, expect, it, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  school: { create: vi.fn(), findUnique: vi.fn() },
  user: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
  notificationLog: { create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/events/logLearningEvent", () => ({ logLearningEvent: vi.fn() }));
vi.mock("@/lib/email", () => ({
  sendPlatformAdminSchoolPending: vi.fn().mockResolvedValue({ ok: true }),
  sendSchoolApprovalNotice: vi.fn(),
  sendSchoolEnrollmentReceived: vi.fn().mockResolvedValue({ ok: true }),
  sendSchoolRejectionNotice: vi.fn(),
  sendTeacherInvite: vi.fn(),
}));
vi.mock("@/lib/credentials", () => ({ sendCredentialSms: vi.fn() }));
vi.mock("@/lib/queue", () => ({
  enqueueJob: vi.fn(),
  isQueueConfigured: vi.fn().mockReturnValue(false),
  JobType: { STUDENT_IMPORT: "STUDENT_IMPORT" },
}));

import {
  generateTemporaryPassword,
  LIBERIAN_COUNTIES,
} from "@/lib/school-operations";

describe("school operations helpers", () => {
  it("includes all 15 Liberian counties for school enrollment", () => {
    expect(LIBERIAN_COUNTIES).toHaveLength(15);
    expect(LIBERIAN_COUNTIES).toContain("Montserrado");
    expect(LIBERIAN_COUNTIES).toContain("River Gee");
  });

  it("generates cryptographically random 8-character temporary passwords", () => {
    const password = generateTemporaryPassword();

    expect(password).toHaveLength(8);
    expect(password).toMatch(/^[A-Za-z0-9]+$/);
  });
});

describe("Sprint 6.5 regression: createSchoolEnrollmentRequest doesn't crash on platform-admin notification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (fn: any) =>
      fn({ school: mockPrisma.school, user: mockPrisma.user })
    );
    mockPrisma.school.create.mockResolvedValue({
      id: "school-1",
      name: "Barnesville Academy",
      county: "Montserrado",
      contactEmail: "principal@example.com",
      contactName: "Test Principal",
    });
    mockPrisma.user.create.mockResolvedValue({ id: "user-1", email: "principal@example.com" });
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.notificationLog.create.mockResolvedValue({});
  });

  it("does not filter platform-admin lookup with email: { not: null } against the non-nullable User.email column", async () => {
    const { createSchoolEnrollmentRequest } = await import("@/lib/school-operations");

    await createSchoolEnrollmentRequest({
      schoolName: "Barnesville Academy",
      county: "Montserrado",
      district: "Greater Monrovia",
      schoolType: "Public",
      principalFullName: "Test Principal",
      email: "principal@example.com",
      phone: "+231770000000",
      estimatedStudentEnrollment: 200,
    });

    expect(mockPrisma.user.findMany).toHaveBeenCalledTimes(1);
    const where = mockPrisma.user.findMany.mock.calls[0][0].where;
    expect(where).toEqual({ role: "ADMIN", isPlatformAdmin: true });
  });

  it("completes successfully end to end without throwing", async () => {
    const { createSchoolEnrollmentRequest } = await import("@/lib/school-operations");

    await expect(
      createSchoolEnrollmentRequest({
        schoolName: "Barnesville Academy",
        county: "Montserrado",
        district: "Greater Monrovia",
        schoolType: "Public",
        principalFullName: "Test Principal",
        email: "principal@example.com",
        phone: "+231770000000",
        estimatedStudentEnrollment: 200,
      })
    ).resolves.toMatchObject({ schoolId: "school-1" });
  });
});
