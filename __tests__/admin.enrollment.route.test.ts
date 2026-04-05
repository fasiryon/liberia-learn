import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireUser = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockListAcademicEnrollmentsForSchool = vi.hoisted(() => vi.fn());
const mockCreateAcademicEnrollmentForSchool = vi.hoisted(() => vi.fn());
const mockUpdateAcademicEnrollmentStatusForSchool = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireUser: mockRequireUser,
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
}));

vi.mock("@/lib/records/systemOfRecord", async () => {
  const actual = await vi.importActual<typeof import("@/lib/records/systemOfRecord")>("@/lib/records/systemOfRecord");
  return {
    ...actual,
    listAcademicEnrollmentsForSchool: mockListAcademicEnrollmentsForSchool,
    createAcademicEnrollmentForSchool: mockCreateAcademicEnrollmentForSchool,
    updateAcademicEnrollmentStatusForSchool: mockUpdateAcademicEnrollmentStatusForSchool,
  };
});

import { GET, PATCH, POST } from "@/app/api/admin/enrollment/route";

function makeNextRequest(url: string) {
  return { nextUrl: new URL(url) } as any;
}

describe("/api/admin/enrollment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      schoolId: "school-1",
      isPlatformAdmin: false,
    });
    mockLogAudit.mockResolvedValue(undefined);
    mockListAcademicEnrollmentsForSchool.mockResolvedValue([]);
    mockCreateAcademicEnrollmentForSchool.mockResolvedValue({
      id: "enr-1",
      studentId: "student-1",
      academicYearId: "ay-1",
      grade: 6,
      status: "ACTIVE",
    });
    mockUpdateAcademicEnrollmentStatusForSchool.mockResolvedValue({
      id: "enr-1",
      studentId: "student-1",
      academicYearId: "ay-1",
      grade: 6,
      status: "PROMOTED",
    });
  });

  it("lists academic enrollments for the requesting school", async () => {
    const res = await GET(makeNextRequest("http://localhost/api/admin/enrollment"));
    expect(res.status).toBe(200);
    expect(mockListAcademicEnrollmentsForSchool).toHaveBeenCalledWith("school-1");
  });

  it("creates a school-year enrollment", async () => {
    const res = await POST(
      new Request("http://localhost/api/admin/enrollment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: "student-1",
          academicYearId: "ay-1",
          grade: 6,
          status: "ACTIVE",
        }),
      }) as any
    );

    expect(res.status).toBe(201);
    expect(mockCreateAcademicEnrollmentForSchool).toHaveBeenCalledWith(
      "school-1",
      expect.objectContaining({ studentId: "student-1", academicYearId: "ay-1" })
    );
  });

  it("rejects cross-school access for non-platform admins", async () => {
    const res = await GET(makeNextRequest("http://localhost/api/admin/enrollment?schoolId=school-2"));
    expect(res.status).toBe(403);
  });

  it("updates enrollment status for promotion foundation", async () => {
    const res = await PATCH(
      new Request("http://localhost/api/admin/enrollment", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrollmentId: "enr-1",
          status: "PROMOTED",
        }),
      }) as any
    );

    expect(res.status).toBe(200);
    expect(mockUpdateAcademicEnrollmentStatusForSchool).toHaveBeenCalledWith("school-1", "enr-1", "PROMOTED");
  });
});
