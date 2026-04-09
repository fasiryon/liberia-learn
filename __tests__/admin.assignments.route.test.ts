import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireUser = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockListTeacherAssignmentsForSchool = vi.hoisted(() => vi.fn());
const mockListOperationalReferencesForSchool = vi.hoisted(() => vi.fn());
const mockCreateTeacherAssignmentForSchool = vi.hoisted(() => vi.fn());
const mockUpdateTeacherAssignmentForSchool = vi.hoisted(() => vi.fn());
const mockDeleteTeacherAssignmentForSchool = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireUser: mockRequireUser,
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
}));

vi.mock("@/lib/records/schoolOperations", async () => {
  const actual = await vi.importActual<typeof import("@/lib/records/schoolOperations")>("@/lib/records/schoolOperations");
  return {
    ...actual,
    listTeacherAssignmentsForSchool: mockListTeacherAssignmentsForSchool,
    listOperationalReferencesForSchool: mockListOperationalReferencesForSchool,
    createTeacherAssignmentForSchool: mockCreateTeacherAssignmentForSchool,
    updateTeacherAssignmentForSchool: mockUpdateTeacherAssignmentForSchool,
    deleteTeacherAssignmentForSchool: mockDeleteTeacherAssignmentForSchool,
  };
});

import { DELETE, GET, PATCH, POST } from "@/app/api/admin/assignments/route";

function makeNextRequest(url: string) {
  return { nextUrl: new URL(url) } as any;
}

describe("/api/admin/assignments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      schoolId: "school-1",
      isPlatformAdmin: false,
    });
    mockLogAudit.mockResolvedValue(undefined);
    mockListTeacherAssignmentsForSchool.mockResolvedValue([{ id: "assign-1" }]);
    mockListOperationalReferencesForSchool.mockResolvedValue({
      teachers: [{ id: "teacher-1", name: "Teacher One" }],
      classes: [{ id: "class-1", name: "JSS 1A", subject: "MATH" }],
    });
    mockCreateTeacherAssignmentForSchool.mockResolvedValue({
      id: "assign-1",
      teacherId: "teacher-1",
      classId: "class-1",
      subject: "MATH",
      isPrimary: true,
    });
    mockUpdateTeacherAssignmentForSchool.mockResolvedValue({
      id: "assign-1",
      teacherId: "teacher-1",
      classId: "class-1",
      subject: "SCIENCE",
      isPrimary: false,
    });
    mockDeleteTeacherAssignmentForSchool.mockResolvedValue(undefined);
  });

  it("lists teacher assignments for the requesting admin school", async () => {
    const res = await GET(makeNextRequest("http://localhost/api/admin/assignments"));
    expect(res.status).toBe(200);
    expect(mockListTeacherAssignmentsForSchool).toHaveBeenCalledWith("school-1");
  });

  it("creates a teacher assignment", async () => {
    const res = await POST(
      new Request("http://localhost/api/admin/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: "teacher-1",
          classId: "class-1",
          subject: "MATH",
          isPrimary: true,
        }),
      }) as any
    );

    expect(res.status).toBe(201);
    expect(mockCreateTeacherAssignmentForSchool).toHaveBeenCalledWith(
      "school-1",
      expect.objectContaining({ teacherId: "teacher-1", classId: "class-1" })
    );
    expect(mockLogAudit).toHaveBeenCalledOnce();
  });

  it("updates a teacher assignment", async () => {
    const res = await PATCH(
      new Request("http://localhost/api/admin/assignments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: "assign-1",
          subject: "SCIENCE",
          isPrimary: false,
        }),
      }) as any
    );

    expect(res.status).toBe(200);
    expect(mockUpdateTeacherAssignmentForSchool).toHaveBeenCalledWith(
      "school-1",
      expect.objectContaining({ assignmentId: "assign-1" })
    );
  });

  it("rejects cross-school access for non-platform admins", async () => {
    const res = await GET(makeNextRequest("http://localhost/api/admin/assignments?schoolId=school-2"));
    expect(res.status).toBe(403);
    expect(mockListTeacherAssignmentsForSchool).not.toHaveBeenCalled();
  });

  it("deletes a teacher assignment", async () => {
    const res = await DELETE(
      new Request("http://localhost/api/admin/assignments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId: "assign-1" }),
      }) as any
    );

    expect(res.status).toBe(200);
    expect(mockDeleteTeacherAssignmentForSchool).toHaveBeenCalledWith("school-1", "assign-1");
  });
});
