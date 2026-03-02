import { describe, it, expect, vi } from "vitest";

// Mock next-auth's getServerSession
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

// Mock prisma
vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock bcryptjs
vi.mock("bcryptjs", () => ({
  default: { compare: vi.fn() },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
const mockGetServerSession = vi.mocked(getServerSession);
const mockUserFindUnique = vi.mocked(prisma.user.findUnique);

describe("auth helpers", () => {
  it("requireUser throws 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);

    // Dynamic import after mocks are set up
    const { requireUser } = await import("@/lib/auth");

    await expect(requireUser()).rejects.toMatchObject({
      message: "Unauthorized",
      status: 401,
    });
  });

  it("requireRole returns user when session is valid and role matches", async () => {
    mockGetServerSession.mockResolvedValue({
      user: {
        id: "user-1",
        email: "teacher@test.lr",
        name: "Test Teacher",
        role: "TEACHER",
        schoolId: "school-1",
      },
    } as any);
    mockUserFindUnique.mockResolvedValue({ passwordChangedAt: null } as any);

    const { requireRole } = await import("@/lib/auth");

    const user = await requireRole("TEACHER");
    expect(user).toMatchObject({
      id: "user-1",
      role: "TEACHER",
    });
  });

  it("requireRole throws 403 when role does not match", async () => {
    mockGetServerSession.mockResolvedValue({
      user: {
        id: "user-1",
        email: "student@test.lr",
        name: "Test Student",
        role: "STUDENT",
        schoolId: "school-1",
      },
    } as any);
    mockUserFindUnique.mockResolvedValue({ passwordChangedAt: null } as any);

    const { requireRole } = await import("@/lib/auth");

    await expect(requireRole("ADMIN")).rejects.toMatchObject({
      message: "Forbidden",
      status: 403,
    });
  });

  it("requireUser denies stale sessions after password change", async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    mockGetServerSession.mockResolvedValue({
      user: {
        id: "user-1",
        email: "teacher@test.lr",
        name: "Test Teacher",
        role: "TEACHER",
        schoolId: "school-1",
        iat: nowSec - 3600,
      },
    } as any);
    mockUserFindUnique.mockResolvedValue({
      passwordChangedAt: new Date(Date.now()),
    } as any);

    const { requireUser } = await import("@/lib/auth");
    await expect(requireUser()).rejects.toMatchObject({
      message: "Session expired",
      status: 401,
    });
  });
});
