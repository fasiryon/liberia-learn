import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockAssignmentSubmissionFindMany = vi.hoisted(() => vi.fn());
const mockAssignmentFindMany = vi.hoisted(() => vi.fn());
const mockClassFindUnique = vi.hoisted(() => vi.fn());
const mockScheduledWorkFindUnique = vi.hoisted(() => vi.fn());
const mockCurriculumContentFindUnique = vi.hoisted(() => vi.fn());
const mockAssignmentCreate = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/db", () => ({
  prisma: {
    assignmentSubmission: {
      findMany: mockAssignmentSubmissionFindMany,
    },
    assignment: {
      findMany: mockAssignmentFindMany,
      create: mockAssignmentCreate,
    },
    class: {
      findUnique: mockClassFindUnique,
    },
    scheduledWork: {
      findUnique: mockScheduledWorkFindUnique,
    },
    curriculumContent: {
      findUnique: mockCurriculumContentFindUnique,
    },
  },
}));

describe("/api/teacher/assignments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue({
      id: "teacher-1",
      role: "TEACHER",
      schoolId: "school-1",
    });
    mockAssignmentSubmissionFindMany.mockResolvedValue([]);
    mockAssignmentFindMany.mockResolvedValue([]);
    mockClassFindUnique.mockResolvedValue({
      id: "class-1",
      name: "JSS 2 Mathematics",
      schoolId: "school-1",
      teacherId: "teacher-1",
    });
    mockScheduledWorkFindUnique.mockResolvedValue(null);
    mockCurriculumContentFindUnique.mockResolvedValue(null);
    mockAssignmentCreate.mockResolvedValue({
      id: "assignment-1",
      title: "Fractions exit ticket",
      description: "Show your working for each problem.",
      classId: "class-1",
      dueAt: new Date("2026-04-03T09:00:00.000Z"),
      points: 25,
      generationMethod: "manual",
      Class: {
        id: "class-1",
        name: "JSS 2 Mathematics",
        subject: "MATH",
      },
    });
    mockLogAudit.mockResolvedValue(undefined);
  });

  it("creates a teacher-scoped assignment", async () => {
    const { POST } = await import("@/app/api/teacher/assignments/route");
    const response = await POST(
      new Request("http://localhost/api/teacher/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: "class-1",
          title: "Fractions exit ticket",
          description: "Show your working for each problem.",
          dueAt: "2026-04-03T09:00:00.000Z",
          points: 25,
        }),
      })
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      assignment: expect.objectContaining({
        id: "assignment-1",
        title: "Fractions exit ticket",
        classId: "class-1",
      }),
    });
    expect(mockAssignmentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          classId: "class-1",
          title: "Fractions exit ticket",
          points: 25,
          generationMethod: "manual",
        }),
      })
    );
    expect(mockLogAudit).toHaveBeenCalledOnce();
  });

  it("rejects teachers creating assignments for another teacher's class", async () => {
    mockClassFindUnique.mockResolvedValue({
      id: "class-1",
      name: "JSS 2 Mathematics",
      schoolId: "school-1",
      teacherId: "teacher-2",
    });

    const { POST } = await import("@/app/api/teacher/assignments/route");
    const response = await POST(
      new Request("http://localhost/api/teacher/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: "class-1",
          title: "Fractions exit ticket",
          description: "Show your working for each problem.",
          points: 25,
        }),
      })
    );

    expect(response.status).toBe(403);
    expect(mockAssignmentCreate).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid teacher create payloads", async () => {
    const { POST } = await import("@/app/api/teacher/assignments/route");
    const response = await POST(
      new Request("http://localhost/api/teacher/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: "class-1",
          title: "No",
          points: 0,
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(mockAssignmentCreate).not.toHaveBeenCalled();
  });
});
