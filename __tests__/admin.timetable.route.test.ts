import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireUser = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockListTimetableForSchool = vi.hoisted(() => vi.fn());
const mockListOperationalReferencesForSchool = vi.hoisted(() => vi.fn());
const mockCreateTimetableForSchool = vi.hoisted(() => vi.fn());
const mockUpdateTimetableForSchool = vi.hoisted(() => vi.fn());
const mockDeleteTimetableForSchool = vi.hoisted(() => vi.fn());

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
    listTimetableForSchool: mockListTimetableForSchool,
    listOperationalReferencesForSchool: mockListOperationalReferencesForSchool,
    createTimetableForSchool: mockCreateTimetableForSchool,
    updateTimetableForSchool: mockUpdateTimetableForSchool,
    deleteTimetableForSchool: mockDeleteTimetableForSchool,
  };
});

import { DELETE, GET, PATCH, POST } from "@/app/api/admin/timetable/route";

function makeNextRequest(url: string) {
  return { nextUrl: new URL(url) } as any;
}

describe("/api/admin/timetable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      schoolId: "school-1",
      isPlatformAdmin: false,
    });
    mockLogAudit.mockResolvedValue(undefined);
    mockListTimetableForSchool.mockResolvedValue([{ id: "tt-1" }]);
    mockListOperationalReferencesForSchool.mockResolvedValue({
      teachers: [{ id: "teacher-1", name: "Teacher One" }],
      classes: [{ id: "class-1", name: "JSS 1A", subject: "MATH" }],
    });
    mockCreateTimetableForSchool.mockResolvedValue({
      id: "tt-1",
      teacherId: "teacher-1",
      classId: "class-1",
      dayOfWeek: "MONDAY",
      periodLabel: "Period 1",
    });
    mockUpdateTimetableForSchool.mockResolvedValue({
      id: "tt-1",
      teacherId: "teacher-1",
      classId: "class-1",
      dayOfWeek: "TUESDAY",
      periodLabel: "Period 2",
    });
    mockDeleteTimetableForSchool.mockResolvedValue(undefined);
  });

  it("lists timetable entries for the requesting admin school", async () => {
    const res = await GET(makeNextRequest("http://localhost/api/admin/timetable"));
    expect(res.status).toBe(200);
    expect(mockListTimetableForSchool).toHaveBeenCalledWith("school-1");
  });

  it("creates a timetable entry and logs an audit event", async () => {
    const res = await POST(
      new Request("http://localhost/api/admin/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: "class-1",
          teacherId: "teacher-1",
          subject: "MATH",
          dayOfWeek: "MONDAY",
          periodLabel: "Period 1",
        }),
      }) as any
    );

    expect(res.status).toBe(201);
    expect(mockCreateTimetableForSchool).toHaveBeenCalledWith(
      "school-1",
      expect.objectContaining({ classId: "class-1", teacherId: "teacher-1" })
    );
    expect(mockLogAudit).toHaveBeenCalledOnce();
  });

  it("updates a timetable entry", async () => {
    const res = await PATCH(
      new Request("http://localhost/api/admin/timetable", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timetableId: "tt-1",
          dayOfWeek: "TUESDAY",
          periodLabel: "Period 2",
        }),
      }) as any
    );

    expect(res.status).toBe(200);
    expect(mockUpdateTimetableForSchool).toHaveBeenCalledWith(
      "school-1",
      expect.objectContaining({ timetableId: "tt-1" })
    );
  });

  it("rejects cross-school list access for non-platform admins", async () => {
    const res = await GET(makeNextRequest("http://localhost/api/admin/timetable?schoolId=school-2"));
    expect(res.status).toBe(403);
    expect(mockListTimetableForSchool).not.toHaveBeenCalled();
  });

  it("deletes a timetable entry", async () => {
    const res = await DELETE(
      new Request("http://localhost/api/admin/timetable", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timetableId: "tt-1" }),
      }) as any
    );

    expect(res.status).toBe(200);
    expect(mockDeleteTimetableForSchool).toHaveBeenCalledWith("school-1", "tt-1");
  });
});
