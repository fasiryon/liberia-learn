import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockIsGuardianPortalEnabled = vi.hoisted(() => vi.fn());
const mockIsGuardianLinkingEnabled = vi.hoisted(() => vi.fn());
const mockStudentGuardianFindFirst = vi.hoisted(() => vi.fn());
const mockStudentGuardianFindMany = vi.hoisted(() => vi.fn());
const mockStudentGuardianUpsert = vi.hoisted(() => vi.fn());
const mockStudentFindUnique = vi.hoisted(() => vi.fn());
const mockHomeworkSubmissionFindMany = vi.hoisted(() => vi.fn());
const mockAttendanceRecordFindMany = vi.hoisted(() => vi.fn());
const mockAuditLogCount = vi.hoisted(() => vi.fn());
const mockInviteTokenFindUnique = vi.hoisted(() => vi.fn());
const mockInviteTokenUpdate = vi.hoisted(() => vi.fn());
const mockTransaction = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
}));

vi.mock("@/lib/serverFlags", () => ({
  isGuardianPortalEnabled: mockIsGuardianPortalEnabled,
  isGuardianLinkingEnabled: mockIsGuardianLinkingEnabled,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    studentGuardian: {
      findFirst: mockStudentGuardianFindFirst,
      findMany: mockStudentGuardianFindMany,
      upsert: mockStudentGuardianUpsert,
    },
    student: { findUnique: mockStudentFindUnique },
    homeworkSubmission: { findMany: mockHomeworkSubmissionFindMany },
    attendanceRecord: { findMany: mockAttendanceRecordFindMany },
    auditLog: { count: mockAuditLogCount },
    inviteToken: {
      findUnique: mockInviteTokenFindUnique,
      update: mockInviteTokenUpdate,
    },
    $transaction: mockTransaction,
  },
}));

import { GET as guardianStudentsGET } from "@/app/api/guardian/students/route";
import { GET as guardianStudentGET } from "@/app/api/guardian/student/[studentId]/route";
import { POST as guardianLinkPOST } from "@/app/api/guardian/link/route";

function makeReq(path: string, body?: any) {
  return new Request(`http://localhost${path}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }) as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsGuardianPortalEnabled.mockReturnValue(true);
  mockIsGuardianLinkingEnabled.mockReturnValue(true);
  mockRequireRole.mockResolvedValue({
    id: "guardian-1",
    role: "GUARDIAN",
    schoolId: "school-1",
    isPlatformAdmin: false,
  });
  mockStudentGuardianFindMany.mockResolvedValue([]);
  mockAuditLogCount.mockResolvedValue(0);
  mockStudentGuardianFindFirst.mockResolvedValue({
    id: "link-1",
    relation: "Parent",
  });
  mockStudentFindUnique.mockResolvedValue({
    id: "student-1",
    userId: "user-1",
    currentGrade: 6,
    user: { name: "Student One", email: "s1@example.com", schoolId: "school-1" },
    placementTests: [],
  });
  mockHomeworkSubmissionFindMany.mockResolvedValue([]);
  mockAttendanceRecordFindMany.mockResolvedValue([]);
  mockInviteTokenFindUnique.mockResolvedValue({
    id: "invite-1",
    token: "tok-1",
    tokenType: "GUARDIAN_LINK",
    role: "GUARDIAN",
    schoolId: "school-1",
    studentId: "student-1",
    relation: "Parent",
    usedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
  });
  mockStudentGuardianUpsert.mockResolvedValue({ id: "link-1" });
  mockInviteTokenUpdate.mockResolvedValue({ id: "invite-1", usedAt: new Date() });
  mockTransaction.mockImplementation(async (ops: any[]) => Promise.all(ops));
});

describe("guardian portal + linking", () => {
  it("guardian students returns 404 when portal flag is off", async () => {
    mockIsGuardianPortalEnabled.mockReturnValue(false);
    const res = await guardianStudentsGET();
    expect(res.status).toBe(404);
  });

  it("guardian student details deny access when not linked", async () => {
    mockStudentGuardianFindFirst.mockResolvedValue(null);
    const res = await guardianStudentGET(makeReq("/api/guardian/student/student-1"), {
      params: { studentId: "student-1" },
    });
    expect(res.status).toBe(403);
  });

  it("guardian link returns 404 when linking flag is off", async () => {
    mockIsGuardianLinkingEnabled.mockReturnValue(false);
    const res = await guardianLinkPOST(makeReq("/api/guardian/link", { token: "tok-1" }));
    expect(res.status).toBe(404);
  });

  it("guardian link creates link for valid token", async () => {
    const res = await guardianLinkPOST(makeReq("/api/guardian/link", { token: "tok-1" }));
    expect(res.status).toBe(200);
    expect(mockStudentGuardianUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          studentId: "student-1",
          guardianId: "guardian-1",
          relation: "Parent",
        }),
      })
    );
  });

  it("guardian link rejects cross-tenant token", async () => {
    mockInviteTokenFindUnique.mockResolvedValue({
      id: "invite-2",
      token: "tok-2",
      tokenType: "GUARDIAN_LINK",
      role: "GUARDIAN",
      schoolId: "school-2",
      studentId: "student-2",
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const res = await guardianLinkPOST(makeReq("/api/guardian/link", { token: "tok-2" }));
    expect(res.status).toBe(403);
  });
});
