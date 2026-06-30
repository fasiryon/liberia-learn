import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockStudentGuardianFindMany = vi.hoisted(() => vi.fn());
const mockEnrollmentFindMany = vi.hoisted(() => vi.fn());
const mockUserFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    studentGuardian: { findMany: mockStudentGuardianFindMany },
    enrollment: { findMany: mockEnrollmentFindMany },
    user: { findMany: mockUserFindMany },
  },
}));

describe("GET /api/guardian/linked-teachers", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue({ id: "guardian-1", role: "GUARDIAN" });
    mockStudentGuardianFindMany.mockResolvedValue([
      { studentId: "student-1", student: { user: { name: "Ada" } } },
    ]);
  });

  it("returns one recipient per teacher when a child has multiple teachers", async () => {
    // student-1 is enrolled in two classes with different teachers
    mockEnrollmentFindMany.mockResolvedValue([
      { studentId: "student-1", Class: { teacherId: "teacher-A" } },
      { studentId: "student-1", Class: { teacherId: "teacher-B" } },
    ]);
    mockUserFindMany.mockResolvedValue([
      { id: "teacher-A", name: "Mr. Cole" },
      { id: "teacher-B", name: "Ms. Toe" },
    ]);

    const { GET } = await import("@/app/api/guardian/linked-teachers/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(2);
    const teacherNames = body.map((r: { teacherName: string }) => r.teacherName).sort();
    expect(teacherNames).toEqual(["Mr. Cole", "Ms. Toe"]);
    expect(body.every((r: { studentId: string }) => r.studentId === "student-1")).toBe(true);
  }, 15_000);

  it("does not dedupe enrollments by studentId (so every teacher is reachable)", async () => {
    mockEnrollmentFindMany.mockResolvedValue([]);
    mockUserFindMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/guardian/linked-teachers/route");
    await GET();

    const callArg = mockEnrollmentFindMany.mock.calls[0]?.[0] ?? {};
    expect(callArg.distinct).toBeUndefined();
  }, 15_000);

  it("collapses duplicate teacher rows for the same student", async () => {
    mockEnrollmentFindMany.mockResolvedValue([
      { studentId: "student-1", Class: { teacherId: "teacher-A" } },
      { studentId: "student-1", Class: { teacherId: "teacher-A" } },
    ]);
    mockUserFindMany.mockResolvedValue([{ id: "teacher-A", name: "Mr. Cole" }]);

    const { GET } = await import("@/app/api/guardian/linked-teachers/route");
    const response = await GET();
    const body = await response.json();

    expect(body).toHaveLength(1);
    expect(body[0].teacherName).toBe("Mr. Cole");
  }, 15_000);
});
