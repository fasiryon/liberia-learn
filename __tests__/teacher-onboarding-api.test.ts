import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    teacherProfile: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    school: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { PATCH } from "@/app/api/teacher/onboarding/route";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";

describe("teacher onboarding PATCH", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (requireRole as any).mockResolvedValue({
      id: "u1",
      role: "TEACHER",
      schoolId: "s1",
      name: "Teacher",
    });
    (prisma.teacherProfile.findUnique as any).mockResolvedValue({
      id: "tp1",
      userId: "u1",
      schoolId: "s1",
      fullName: "Old Name",
      gradesTaught: ["G1_3"],
      subjectsTaught: ["MATH"],
      isOnboarded: false,
    });
    (prisma.school.findUnique as any).mockResolvedValue({ id: "s1" });
    (prisma.teacherProfile.upsert as any).mockResolvedValue({
      id: "tp1",
      userId: "u1",
      schoolId: "s1",
      fullName: "New Name",
      gradesTaught: ["G4_6"],
      subjectsTaught: ["SCIENCE"],
      isOnboarded: true,
      onboardedAt: new Date("2026-02-20T00:00:00.000Z"),
    });
    (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(prisma));
  });

  it("allows teacher to update own profile", async () => {
    const req = new Request("http://localhost/api/teacher/onboarding", {
      method: "PATCH",
      body: JSON.stringify({
        fullName: "New Name",
        gradesTaught: ["G4_6"],
        subjectsTaught: ["SCIENCE"],
        complete: true,
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(prisma.teacherProfile.upsert).toHaveBeenCalled();
    expect(logAudit).toHaveBeenCalled();
  });

  it("rejects updates for another user", async () => {
    const req = new Request("http://localhost/api/teacher/onboarding", {
      method: "PATCH",
      body: JSON.stringify({
        userId: "u2",
        fullName: "New Name",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(req as any);
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("Forbidden");
    expect(prisma.teacherProfile.upsert).not.toHaveBeenCalled();
  });

  it("rejects school assignment when not already assigned", async () => {
    (requireRole as any).mockResolvedValue({
      id: "u1",
      role: "TEACHER",
      schoolId: null,
      name: "Teacher",
    });
    (prisma.teacherProfile.findUnique as any).mockResolvedValue(null);

    const req = new Request("http://localhost/api/teacher/onboarding", {
      method: "PATCH",
      body: JSON.stringify({
        schoolId: "s2",
        fullName: "New Name",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(req as any);
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("School assignment required");
  });

  it("requires required fields to complete onboarding", async () => {
    (prisma.teacherProfile.findUnique as any).mockResolvedValue({
      id: "tp1",
      userId: "u1",
      schoolId: "s1",
      fullName: "Old Name",
      gradesTaught: [],
      subjectsTaught: [],
      isOnboarded: false,
    });

    const req = new Request("http://localhost/api/teacher/onboarding", {
      method: "PATCH",
      body: JSON.stringify({
        fullName: "New Name",
        complete: true,
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(req as any);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("gradesTaught is required");
  });
});
