import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireUser = vi.hoisted(() => vi.fn());
const mockRequireRole = vi.hoisted(() => vi.fn());
const mockIsEnrollmentInvitesEnabled = vi.hoisted(() => vi.fn());
const mockSendTeacherInvite = vi.hoisted(() => vi.fn());
const mockSendStudentInvite = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());

const mockInviteTokenCreate = vi.hoisted(() => vi.fn());
const mockInviteTokenFindFirst = vi.hoisted(() => vi.fn());
const mockInviteTokenUpdate = vi.hoisted(() => vi.fn());
const mockSchoolFindUnique = vi.hoisted(() => vi.fn());
const mockUserCreate = vi.hoisted(() => vi.fn());
const mockStudentCreate = vi.hoisted(() => vi.fn());
const mockStudentFindUnique = vi.hoisted(() => vi.fn());
const mockStudentGuardianUpsert = vi.hoisted(() => vi.fn());
const mockTransaction = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireUser: mockRequireUser,
  requireRole: mockRequireRole,
}));

vi.mock("@/lib/serverFlags", () => ({
  isEnrollmentInvitesEnabled: mockIsEnrollmentInvitesEnabled,
}));

vi.mock("@/lib/email", () => ({
  sendTeacherInvite: mockSendTeacherInvite,
  sendStudentInvite: mockSendStudentInvite,
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    inviteToken: {
      create: mockInviteTokenCreate,
      findFirst: mockInviteTokenFindFirst,
      update: mockInviteTokenUpdate,
    },
    school: { findUnique: mockSchoolFindUnique },
    user: { create: mockUserCreate },
    student: { create: mockStudentCreate, findUnique: mockStudentFindUnique },
    studentGuardian: { upsert: mockStudentGuardianUpsert },
    $transaction: mockTransaction,
  },
}));

import { POST as inviteTeacherPOST } from "@/app/api/rollout/invite/teacher/route";
import { POST as inviteStudentPOST } from "@/app/api/rollout/invite/student/route";
import { POST as inviteStudentBulkPOST } from "@/app/api/rollout/invite/student/bulk/route";
import { POST as onboardAcceptPOST } from "@/app/api/onboard/accept/route";

function makeReq(path: string, body?: any) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  }) as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsEnrollmentInvitesEnabled.mockReturnValue(true);
  mockRequireUser.mockResolvedValue({
    id: "admin-1",
    role: "ADMIN",
    schoolId: "school-1",
    isPlatformAdmin: false,
  });
  mockRequireRole.mockResolvedValue({
    id: "teacher-1",
    role: "TEACHER",
    schoolId: "school-1",
  });
  mockSchoolFindUnique.mockResolvedValue({ id: "school-1", name: "School 1" });
  mockInviteTokenCreate.mockResolvedValue({
    id: "invite-1",
    expiresAt: new Date(Date.now() + 60_000),
  });
  mockSendTeacherInvite.mockResolvedValue({ ok: true });
  mockSendStudentInvite.mockResolvedValue({ ok: true });
  mockTransaction.mockImplementation(async (cb: any) =>
    cb({
      user: { create: mockUserCreate },
      student: { create: mockStudentCreate, findUnique: mockStudentFindUnique },
      studentGuardian: { upsert: mockStudentGuardianUpsert },
      inviteToken: { update: mockInviteTokenUpdate },
    })
  );
  mockUserCreate.mockResolvedValue({ id: "user-1", role: "STUDENT" });
  mockInviteTokenUpdate.mockResolvedValue({ id: "invite-1", usedAt: new Date() });
});

describe("RR-1 enrollment invites", () => {
  it("teacher invite returns 404 when flag is off", async () => {
    mockIsEnrollmentInvitesEnabled.mockReturnValue(false);
    const res = await inviteTeacherPOST(
      makeReq("/api/rollout/invite/teacher", { email: "t1@test.lr" })
    );
    expect(res.status).toBe(404);
  });

  it("teacher invite requires admin or platform admin", async () => {
    mockRequireUser.mockResolvedValue({
      id: "teacher-2",
      role: "TEACHER",
      schoolId: "school-1",
      isPlatformAdmin: false,
    });
    const res = await inviteTeacherPOST(
      makeReq("/api/rollout/invite/teacher", { email: "t1@test.lr" })
    );
    expect(res.status).toBe(403);
  });

  it("student invite is tenant-bound to teacher school", async () => {
    await inviteStudentPOST(
      makeReq("/api/rollout/invite/student", { email: "s1@test.lr" })
    );
    expect(mockInviteTokenCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          schoolId: "school-1",
          tokenType: "ENROLL_STUDENT",
        }),
      })
    );
  });

  it("bulk student invite returns summary", async () => {
    const res = await inviteStudentBulkPOST(
      makeReq("/api/rollout/invite/student/bulk", {
        students: [{ email: "s1@test.lr" }, { email: "s2@test.lr" }],
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.invited).toBe(2);
    expect(data.results).toHaveLength(2);
  });
});

describe("RR-1 invite acceptance", () => {
  it("rejects expired tokens", async () => {
    mockInviteTokenFindFirst.mockResolvedValue({
      id: "invite-2",
      tokenType: "ENROLL_STUDENT",
      role: "STUDENT",
      schoolId: "school-1",
      usedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    });
    const res = await onboardAcceptPOST(
      makeReq("/api/onboard/accept", {
        token: "tok-expired",
        name: "Student",
        password: "Password123",
      })
    );
    expect(res.status).toBe(400);
  });

  it("rejects already used tokens", async () => {
    mockInviteTokenFindFirst.mockResolvedValue({
      id: "invite-3",
      tokenType: "ENROLL_STUDENT",
      role: "STUDENT",
      schoolId: "school-1",
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 1000),
    });
    const res = await onboardAcceptPOST(
      makeReq("/api/onboard/accept", {
        token: "tok-used",
        name: "Student",
        password: "Password123",
      })
    );
    expect(res.status).toBe(400);
  });

  it("denies enrollment accept when flag is off", async () => {
    mockIsEnrollmentInvitesEnabled.mockReturnValue(false);
    mockInviteTokenFindFirst.mockResolvedValue({
      id: "invite-4",
      tokenType: "ENROLL_STUDENT",
      role: "STUDENT",
      schoolId: "school-1",
      usedAt: null,
      expiresAt: new Date(Date.now() + 1000),
    });
    const res = await onboardAcceptPOST(
      makeReq("/api/onboard/accept", {
        token: "tok-enroll",
        name: "Student",
        password: "Password123",
      })
    );
    expect(res.status).toBe(404);
  });
});
