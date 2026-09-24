import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockRequireRole, mockPrisma, mockGeneratePack } = vi.hoisted(() => ({
  mockRequireRole: vi.fn(),
  mockPrisma: {
    student: { findUnique: vi.fn() },
    class: { findFirst: vi.fn() },
    offlinePack: { create: vi.fn() },
  },
  mockGeneratePack: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/packs/generatePack", () => ({
  generatePack: mockGeneratePack,
  resolveWeekBounds: () => ({
    weekStart: new Date("2026-12-07T00:00:00Z"),
    weekEnd: new Date("2026-12-14T00:00:00Z"),
  }),
}));

import { POST } from "@/app/api/packs/week/route";

const STUDENT = { id: "stu-user-1", role: "STUDENT", schoolId: "school-1" };
const TEACHER = { id: "teacher-1", role: "TEACHER", schoolId: "school-1" };

function req(body: unknown) {
  return new NextRequest("http://localhost/api/packs/week", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/packs/week — audience and class scope (hostile)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.offlinePack.create.mockImplementation(async ({ data }: any) => ({ id: "pack-1", ...data }));
    mockGeneratePack.mockResolvedValue({ packId: "pack-1", blobUrl: "b", sizeBytes: 1, lessonCount: 1 });
  });

  it("a student requesting the teacher edition still receives the stripped student edition", async () => {
    mockRequireRole.mockResolvedValueOnce(STUDENT);
    mockPrisma.student.findUnique.mockResolvedValueOnce({ id: "stu-1", enrollments: [{ classId: "class-1" }] });
    const res = await POST(req({ audience: "teacher" }));
    expect(res.status).toBe(200);
    expect(mockPrisma.offlinePack.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ audience: "student", classId: "class-1" }) })
    );
  });

  it("a student cannot request a pack for a class they are not enrolled in", async () => {
    mockRequireRole.mockResolvedValueOnce(STUDENT);
    mockPrisma.student.findUnique.mockResolvedValueOnce({ id: "stu-1", enrollments: [{ classId: "class-1" }] });
    const res = await POST(req({ classId: "class-other-school" }));
    expect(res.status).toBe(403);
    expect(mockPrisma.offlinePack.create).not.toHaveBeenCalled();
  });

  it("a teacher cannot request a pack for another school's class", async () => {
    mockRequireRole.mockResolvedValueOnce(TEACHER);
    mockPrisma.class.findFirst.mockResolvedValueOnce(null);
    const res = await POST(req({ classId: "class-9", audience: "teacher" }));
    expect(res.status).toBe(403);
    expect(mockPrisma.class.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "class-9", schoolId: "school-1" } })
    );
    expect(mockGeneratePack).not.toHaveBeenCalled();
  });

  it("a teacher with no class gets a clear error instead of an unscoped platform-wide pack", async () => {
    mockRequireRole.mockResolvedValueOnce(TEACHER);
    mockPrisma.class.findFirst.mockResolvedValueOnce(null);
    const res = await POST(req({ audience: "teacher" }));
    expect(res.status).toBe(400);
    expect(mockGeneratePack).not.toHaveBeenCalled();
  });

  it("a teacher without a classId gets a pack for a class they teach", async () => {
    mockRequireRole.mockResolvedValueOnce(TEACHER);
    mockPrisma.class.findFirst.mockResolvedValueOnce({ id: "class-1" });
    const res = await POST(req({ audience: "teacher" }));
    expect(res.status).toBe(200);
    expect(mockPrisma.class.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { schoolId: "school-1", teacherId: "teacher-1" } })
    );
    expect(mockPrisma.offlinePack.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ audience: "teacher", classId: "class-1" }) })
    );
  });
});
