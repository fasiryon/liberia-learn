import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockClassFindUnique = vi.hoisted(() => vi.fn());
const mockBuildRollup = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/db", () => ({ prisma: { class: { findUnique: mockClassFindUnique } } }));
vi.mock("@/lib/teacher/classDifferentiation", () => ({ buildClassDifferentiationRollup: mockBuildRollup }));

import { GET } from "@/app/api/teacher/classes/[classId]/differentiation/route";

function makeReq() {
  return new Request("http://localhost/api/teacher/classes/class-1/differentiation") as any;
}

describe("GET /api/teacher/classes/[classId]/differentiation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires TEACHER or ADMIN role", async () => {
    mockRequireRole.mockRejectedValueOnce(Object.assign(new Error("Forbidden"), { status: 403 }));
    const res = await GET(makeReq(), { params: { classId: "class-1" } });
    expect(res.status).toBe(403);
  });

  it("404s when the class does not belong to the requester's school", async () => {
    mockRequireRole.mockResolvedValue({ id: "teacher-1", role: "TEACHER", schoolId: "school-1" });
    mockClassFindUnique.mockResolvedValue({ id: "class-1", schoolId: "school-2", teacherId: "teacher-1" });

    const res = await GET(makeReq(), { params: { classId: "class-1" } });
    expect(res.status).toBe(404);
    expect(mockBuildRollup).not.toHaveBeenCalled();
  });

  it("403s when a TEACHER requests a class they do not teach", async () => {
    mockRequireRole.mockResolvedValue({ id: "teacher-1", role: "TEACHER", schoolId: "school-1" });
    mockClassFindUnique.mockResolvedValue({ id: "class-1", schoolId: "school-1", teacherId: "someone-else" });

    const res = await GET(makeReq(), { params: { classId: "class-1" } });
    expect(res.status).toBe(403);
    expect(mockBuildRollup).not.toHaveBeenCalled();
  });

  it("allows an ADMIN to view any class in their school", async () => {
    mockRequireRole.mockResolvedValue({ id: "admin-1", role: "ADMIN", schoolId: "school-1" });
    mockClassFindUnique.mockResolvedValue({ id: "class-1", schoolId: "school-1", teacherId: "teacher-1" });
    mockBuildRollup.mockResolvedValue({ classId: "class-1", className: "Math", studentCount: 0, generatedAt: "now", groups: [] });

    const res = await GET(makeReq(), { params: { classId: "class-1" } });
    expect(res.status).toBe(200);
    expect(mockBuildRollup).toHaveBeenCalledWith("class-1");
  });

  it("returns the rollup for the class's own teacher", async () => {
    mockRequireRole.mockResolvedValue({ id: "teacher-1", role: "TEACHER", schoolId: "school-1" });
    mockClassFindUnique.mockResolvedValue({ id: "class-1", schoolId: "school-1", teacherId: "teacher-1" });
    mockBuildRollup.mockResolvedValue({ classId: "class-1", className: "Math", studentCount: 2, generatedAt: "now", groups: [] });

    const res = await GET(makeReq(), { params: { classId: "class-1" } });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.studentCount).toBe(2);
  });
});
