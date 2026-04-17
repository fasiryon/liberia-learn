import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("bcryptjs", () => ({
  default: { compare: vi.fn() },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

const mockGetServerSession = vi.mocked(getServerSession);
const mockUserFindUnique = vi.mocked(prisma.user.findUnique);
const mockUserFindFirst = vi.mocked(prisma.user.findFirst);
const mockCompare = vi.mocked((bcrypt as any).compare);

describe("auth helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requireUser throws 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { requireUser } = await import("@/lib/auth");

    await expect(requireUser()).rejects.toMatchObject({ message: "Unauthorized", status: 401 });
  });

  it("requireRole returns user when session is valid and role matches", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-1", email: "teacher@test.lr", name: "Test Teacher", role: "TEACHER", schoolId: "school-1" } } as any);
    mockUserFindUnique.mockResolvedValue({ passwordChangedAt: null } as any);

    const { requireRole } = await import("@/lib/auth");
    const user = await requireRole("TEACHER");

    expect(user).toMatchObject({ id: "user-1", role: "TEACHER" });
  });

  it("requireRole throws 403 when role does not match", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-1", email: "student@test.lr", name: "Test Student", role: "STUDENT", schoolId: "school-1" } } as any);
    mockUserFindUnique.mockResolvedValue({ passwordChangedAt: null } as any);

    const { requireRole } = await import("@/lib/auth");
    await expect(requireRole("ADMIN")).rejects.toMatchObject({ message: "Forbidden", status: 403 });
  });

  it("requireUser denies stale sessions after password change", async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    mockGetServerSession.mockResolvedValue({ user: { id: "user-1", email: "teacher@test.lr", name: "Test Teacher", role: "TEACHER", schoolId: "school-1", iat: nowSec - 3600 } } as any);
    mockUserFindUnique.mockResolvedValue({ passwordChangedAt: new Date(Date.now()) } as any);

    const { requireUser } = await import("@/lib/auth");
    await expect(requireUser()).rejects.toMatchObject({ message: "Session expired", status: 401 });
  });

  it("authorizes student ID plus PIN", async () => {
    mockUserFindFirst.mockResolvedValue({
      id: "student-user-1",
      email: "student@school.lr",
      loginId: "LBR-2024-001",
      name: "Student One",
      role: "STUDENT",
      hashedPwd: "hashed-pin",
      schoolId: "school-1",
      isPlatformAdmin: false,
      mustChangePIN: true,
      school: { status: "ACTIVE" },
    } as any);
    mockCompare.mockResolvedValue(true as never);

    const { authorizeCredentials } = await import("@/lib/auth");
    const user = await authorizeCredentials({ studentId: "lbr-2024-001", password: "1234" });

    expect(user).toMatchObject({ id: "student-user-1", loginId: "LBR-2024-001", role: "STUDENT", mustChangePIN: true });
    expect(mockUserFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { loginId: "LBR-2024-001" } }));
  });

  it("authorizes guardian phone plus PIN", async () => {
    mockUserFindFirst.mockResolvedValue({
      id: "guardian-1",
      email: "guardian@test.lr",
      loginId: null,
      name: "Guardian One",
      role: "GUARDIAN",
      hashedPwd: "hashed-pin",
      schoolId: "school-1",
      isPlatformAdmin: false,
      school: { status: "ACTIVE" },
    } as any);
    mockCompare.mockResolvedValue(true as never);

    const { authorizeCredentials } = await import("@/lib/auth");
    const user = await authorizeCredentials({ phone: "+231770000111", password: "1234" });

    expect(user).toMatchObject({ id: "guardian-1", role: "GUARDIAN" });
    expect(mockUserFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { role: "GUARDIAN", guardianPhoneE164: "+231770000111" } }));
  });
});

