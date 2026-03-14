import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockFindUnique = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockNotifyAssignmentGraded = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/db", () => ({
  prisma: {
    assignmentSubmission: {
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
  },
}));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/assignment-notifications", () => ({
  notifyAssignmentGraded: mockNotifyAssignmentGraded,
}));

describe("PATCH /api/teacher/assignments/[id]/grade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue({
      id: "teacher-1",
      role: "TEACHER",
      schoolId: "school-1",
    });
    mockFindUnique.mockResolvedValue({
      id: "submission-1",
      assignmentId: "assignment-1",
      studentId: "student-1",
      Assignment: {
        id: "assignment-1",
        title: "Essay",
        Class: {
          schoolId: "school-1",
          teacherId: "teacher-1",
          School: { name: "Capitol Hill Academy" },
        },
      },
      Student: {
        id: "student-1",
        user: {
          id: "user-1",
          name: "Alice",
          email: "alice@example.com",
        },
      },
    });
    mockUpdate.mockResolvedValue({
      id: "submission-1",
      score: 88,
      feedback: "Strong effort with clear reasoning.",
      gradedAt: new Date("2026-03-13T12:00:00.000Z"),
    });
    mockLogAudit.mockResolvedValue(undefined);
    mockNotifyAssignmentGraded.mockResolvedValue(undefined);
  });

  it("saves grade and feedback and attempts guardian notification", async () => {
    const { PATCH } = await import("@/app/api/teacher/assignments/[id]/grade/route");
    const response = await PATCH(
      new Request("http://localhost/api/teacher/assignments/submission-1/grade", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grade: 88,
          feedback: "Strong effort with clear reasoning.",
        }),
      }) as any,
      { params: { id: "submission-1" } }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      submission: expect.objectContaining({
        id: "submission-1",
        score: 88,
      }),
    });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "submission-1" },
        data: expect.objectContaining({
          score: 88,
          feedback: "Strong effort with clear reasoning.",
          gradedBy: "teacher-1",
        }),
      })
    );
    expect(mockLogAudit).toHaveBeenCalledOnce();
    expect(mockNotifyAssignmentGraded).toHaveBeenCalledOnce();
  });

  it("returns 403 for a different teacher's submission", async () => {
    mockFindUnique.mockResolvedValue({
      id: "submission-1",
      Assignment: {
        id: "assignment-1",
        title: "Essay",
        Class: {
          schoolId: "school-1",
          teacherId: "teacher-2",
          School: { name: "Capitol Hill Academy" },
        },
      },
      Student: {
        id: "student-1",
        user: { id: "user-1", name: "Alice", email: "alice@example.com" },
      },
    });

    const { PATCH } = await import("@/app/api/teacher/assignments/[id]/grade/route");
    const response = await PATCH(
      new Request("http://localhost/api/teacher/assignments/submission-1/grade", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grade: 88,
          feedback: "Strong effort with clear reasoning.",
        }),
      }) as any,
      { params: { id: "submission-1" } }
    );

    expect(response.status).toBe(403);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
