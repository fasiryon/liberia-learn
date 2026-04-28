import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockHandleApiError = vi.hoisted(() =>
  vi.fn((err: any) =>
    new Response(JSON.stringify({ error: err.message ?? "error" }), {
      status: err.status ?? 500,
    })
  )
);
const mockAssignLessonToSlot = vi.hoisted(() => vi.fn());
const mockRemoveLessonFromSlot = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/errors/apiErrorHandler", () => ({ handleApiError: mockHandleApiError }));
vi.mock("@/lib/timetable/timetableService", () => ({
  assignLessonToSlot: mockAssignLessonToSlot,
  removeLessonFromSlot: mockRemoveLessonFromSlot,
}));

import { POST, DELETE } from "@/app/api/teacher/timetable/[timetableId]/assign/route";

const TEACHER = {
  id: "teacher-1",
  role: "TEACHER",
  schoolId: "school-1",
  isPlatformAdmin: false,
};

function makeReq(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

function makeDeleteReq(url: string) {
  return new Request(url, { method: "DELETE" }) as any;
}

describe("POST /api/teacher/timetable/[timetableId]/assign", () => {
  beforeEach(() => vi.clearAllMocks());

  it("teacher can assign a lesson to their own slot", async () => {
    mockRequireRole.mockResolvedValueOnce(TEACHER);
    mockAssignLessonToSlot.mockResolvedValueOnce({ id: "ta-1" });

    const res = await POST(
      makeReq("http://localhost/api/teacher/timetable/slot-1/assign", {
        assignedDate: "2026-04-27",
        title: "Algebra: Quadratic Equations",
        curriculumContentId: "content-123",
        instructions: null,
      }),
      { params: { timetableId: "slot-1" } }
    );

    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.assignment.id).toBe("ta-1");
    expect(mockAssignLessonToSlot).toHaveBeenCalledWith(
      "slot-1",
      "teacher-1",
      "school-1",
      expect.objectContaining({ title: "Algebra: Quadratic Equations" })
    );
  });

  it("propagates 404 when teacher does not own the slot", async () => {
    mockRequireRole.mockResolvedValueOnce(TEACHER);
    mockAssignLessonToSlot.mockRejectedValueOnce(
      Object.assign(new Error("Slot not found"), { status: 404 })
    );

    const res = await POST(
      makeReq("http://localhost/api/teacher/timetable/slot-999/assign", {
        assignedDate: "2026-04-27",
        title: "Test",
        curriculumContentId: null,
        instructions: null,
      }),
      { params: { timetableId: "slot-999" } }
    );

    expect(res.status).toBe(404);
  });

  it("returns 403 for non-teacher role", async () => {
    mockRequireRole.mockRejectedValueOnce(
      Object.assign(new Error("Forbidden"), { status: 403 })
    );

    const res = await POST(
      makeReq("http://localhost/api/teacher/timetable/slot-1/assign", {
        assignedDate: "2026-04-27",
        title: "Test",
      }),
      { params: { timetableId: "slot-1" } }
    );

    expect(res.status).toBe(403);
  });

  it("fires logAudit on successful assignment", async () => {
    mockRequireRole.mockResolvedValueOnce(TEACHER);
    mockAssignLessonToSlot.mockResolvedValueOnce({ id: "ta-1" });

    await POST(
      makeReq("http://localhost/api/teacher/timetable/slot-1/assign", {
        assignedDate: "2026-04-27",
        title: "Algebra",
        curriculumContentId: null,
        instructions: null,
      }),
      { params: { timetableId: "slot-1" } }
    );

    expect(mockLogAudit).toHaveBeenCalledOnce();
    expect(mockLogAudit.mock.calls[0][0]).toMatchObject({
      action: "teacher.timetable.assign",
      resourceType: "timetable_assignment",
    });
  });
});

describe("DELETE /api/teacher/timetable/[timetableId]/assign", () => {
  beforeEach(() => vi.clearAllMocks());

  it("removes assignment when date param is provided", async () => {
    mockRequireRole.mockResolvedValueOnce(TEACHER);
    mockRemoveLessonFromSlot.mockResolvedValueOnce(undefined);

    const res = await DELETE(
      makeDeleteReq(
        "http://localhost/api/teacher/timetable/slot-1/assign?assignedDate=2026-04-27"
      ),
      { params: { timetableId: "slot-1" } }
    );

    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
  });

  it("returns 400 when assignedDate param is missing", async () => {
    mockRequireRole.mockResolvedValueOnce(TEACHER);

    const res = await DELETE(
      makeDeleteReq("http://localhost/api/teacher/timetable/slot-1/assign"),
      { params: { timetableId: "slot-1" } }
    );

    expect(res.status).toBe(400);
  });
});
