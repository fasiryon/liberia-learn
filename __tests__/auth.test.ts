import { describe, it, expect, vi } from "vitest";

// Mock next-auth's getServerSession
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

// Mock prisma
vi.mock("@/lib/db", () => ({
  prisma: {},
}));

// Mock bcryptjs
vi.mock("bcryptjs", () => ({
  default: { compare: vi.fn() },
}));

import { getServerSession } from "next-auth";
const mockGetServerSession = vi.mocked(getServerSession);

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

    const { requireRole } = await import("@/lib/auth");

    await expect(requireRole("ADMIN")).rejects.toMatchObject({
      message: "Forbidden",
      status: 403,
    });
  });
});

