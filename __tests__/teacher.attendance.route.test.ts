import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireUser = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockListTeacherAttendanceContext = vi.hoisted(() => vi.fn());
const mockUpsertAttendanceForTeacher = vi.hoisted(() => vi.fn());

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
    listTeacherAttendanceContext: mockListTeacherAttendanceContext,
    upsertAttendanceForTeacher: mockUpsertAttendanceForTeacher,
  };
});

import { GET, POST } from "@/app/api/teacher/attendance/route";

function makeNextRequest(url: string) {
  return { nextUrl: new URL(url) } as any;
}

describe("/api/teacher/attendance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({
      id: "teacher-1",
      role: "TEACHER",
      schoolId: "school-1",
      isPlatformAdmin: false,
    });
    mockLogAudit.mockResolvedValue(undefined);
    mockListTeacherAttendanceContext.mockResolvedValue({
      classes: [{ id: "class-1", name: "JSS 1A", subject: "MATH" }],
      roster: [{ studentId: "student-1", name: "Student One", currentGrade: 7 }],
      attendance: [{ studentId: "student-1", status: "PRESENT", notes: null }],
      selectedDate: new Date("2026-04-09T00:00:00.000Z"),
    });
    mockUpsertAttendanceForTeacher.mockResolvedValue([
      { studentId: "student-1", status: "LATE", notes: "Arrived after assembly" },
    ]);
  });

  it("lists attendance context for an authorized class", async () => {
    const res = await GET(
      makeNextRequest("http://localhost/api/teacher/attendance?classId=class-1&date=2026-04-09")
    );
    expect(res.status).toBe(200);
    expect(mockListTeacherAttendanceContext).toHaveBeenCalledWith(
      expect.objectContaining({ id: "teacher-1" }),
      "class-1",
      new Date("2026-04-09")
    );
  });

  it("creates or updates attendance and logs an audit event", async () => {
    const res = await POST(
      new Request("http://localhost/api/teacher/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: "class-1",
          date: "2026-04-09",
          records: [{ studentId: "student-1", status: "LATE", notes: "Arrived after assembly" }],
        }),
      }) as any
    );

    expect(res.status).toBe(200);
    expect(mockUpsertAttendanceForTeacher).toHaveBeenCalledWith(
      expect.objectContaining({ id: "teacher-1" }),
      expect.objectContaining({ classId: "class-1" })
    );
    expect(mockLogAudit).toHaveBeenCalledOnce();
  });

  it("rejects forbidden teacher access to an unauthorized class", async () => {
    mockListTeacherAttendanceContext.mockRejectedValueOnce(
      Object.assign(new Error("Forbidden"), { status: 403 })
    );

    const res = await GET(
      makeNextRequest("http://localhost/api/teacher/attendance?classId=class-9&date=2026-04-09")
    );

    expect(res.status).toBe(403);
  });

  it("rejects roster mismatches on save", async () => {
    mockUpsertAttendanceForTeacher.mockRejectedValueOnce(
      Object.assign(new Error("Student is not enrolled in this class"), { status: 400 })
    );

    const res = await POST(
      new Request("http://localhost/api/teacher/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: "class-1",
          date: "2026-04-09",
          records: [{ studentId: "student-999", status: "ABSENT" }],
        }),
      }) as any
    );

    expect(res.status).toBe(400);
  });

  it("denies non-teacher roles", async () => {
    mockRequireUser.mockResolvedValueOnce({
      id: "student-user-1",
      role: "STUDENT",
      schoolId: "school-1",
      isPlatformAdmin: false,
    });

    const res = await GET(makeNextRequest("http://localhost/api/teacher/attendance"));
    expect(res.status).toBe(403);
  });
});
