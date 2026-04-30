import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockRequireRole = vi.fn();
const mockLogLearningEvent = vi.fn();
const mockStudentFindUnique = vi.fn();
const mockAssignmentFindMany = vi.fn();
const mockAssignmentFindUnique = vi.fn();
const mockClassFindMany = vi.fn();
const mockEnrollmentFindFirst = vi.fn();
const mockStudentProgressFindMany = vi.fn();
const mockAssignmentSubmissionFindMany = vi.fn();
const mockTeacherActionFindMany = vi.fn();

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/events/logLearningEvent", () => ({ logLearningEvent: mockLogLearningEvent }));
vi.mock("@/lib/db", () => ({
  prisma: {
    student: { findUnique: mockStudentFindUnique },
    assignment: { findMany: mockAssignmentFindMany, findUnique: mockAssignmentFindUnique },
    class: { findMany: mockClassFindMany },
    enrollment: { findFirst: mockEnrollmentFindFirst },
    studentProgress: { findMany: mockStudentProgressFindMany },
    assignmentSubmission: { findMany: mockAssignmentSubmissionFindMany },
    teacherAction: { findMany: mockTeacherActionFindMany },
  },
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }) }));
vi.mock("@/app/student/assignments/[id]/AssignmentSubmissionClient", () => ({
  default: () => null,
}));

describe("assignment polling and view events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue({ id: "user-1", role: "STUDENT", schoolId: "school-1" });
    mockLogLearningEvent.mockResolvedValue(null);
    mockTeacherActionFindMany.mockResolvedValue([]);
  });

  it("assignment_viewed logs correctly", async () => {
    mockStudentFindUnique.mockResolvedValueOnce({
      id: "student-1",
      enrollments: [{ classId: "class-1" }],
    });
    mockAssignmentFindUnique.mockResolvedValueOnce({
      id: "assignment-1",
      title: "Essay",
      description: "Write",
      classId: "class-1",
      Class: { id: "class-1", schoolId: "school-1", name: "JSS 1A" },
      submissions: [],
    });
    const { default: Page } = await import("@/app/student/assignments/[id]/page");

    await Page({ params: { id: "assignment-1" } });

    expect(mockLogLearningEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "assignment_viewed",
        studentId: "student-1",
        target: { type: "assignment", id: "assignment-1" },
      })
    );
  });

  it("assignment_list_polled logs when count changes", async () => {
    mockStudentFindUnique.mockResolvedValueOnce({
      id: "student-1",
      enrollments: [{ classId: "class-1" }],
    });
    mockAssignmentFindMany.mockResolvedValueOnce([
      {
        id: "assignment-1",
        title: "A",
        description: null,
        classId: "class-1",
        dueAt: null,
        createdAt: new Date("2026-04-28T10:00:00Z"),
        points: 100,
        Class: { id: "class-1", name: "JSS 1A", subject: "MATH" },
        submissions: [],
      },
    ]);
    const { GET } = await import("@/app/api/student/assignments/route");

    await GET(new NextRequest("http://localhost/api/student/assignments?source=poll&previousCount=0"));

    expect(mockLogLearningEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "assignment_list_polled",
        metadata: { assignmentCount: 1, newCount: 1 },
      })
    );
  });

  it("shows targeted assignments to targeted students", async () => {
    mockStudentFindUnique.mockResolvedValueOnce({
      id: "student-1",
      enrollments: [{ classId: "class-1" }],
    });
    mockAssignmentFindMany.mockResolvedValueOnce([
      {
        id: "assignment-1",
        title: "Targeted remediation",
        description: null,
        classId: "class-1",
        dueAt: null,
        createdAt: new Date("2026-04-28T10:00:00Z"),
        points: 100,
        Class: { id: "class-1", name: "JSS 1A", subject: "MATH" },
        submissions: [{ id: "submission-1", score: null, turnedInAt: null }],
      },
    ]);
    mockTeacherActionFindMany.mockResolvedValueOnce([
      {
        targetId: "assignment-1",
        metadata: { targetStudentIds: ["student-1"] },
      },
    ]);
    const { GET } = await import("@/app/api/student/assignments/route");

    const response = await GET(new NextRequest("http://localhost/api/student/assignments"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ count: 1 });
  });

  it("hides targeted assignments from non-targeted students", async () => {
    mockStudentFindUnique.mockResolvedValueOnce({
      id: "student-2",
      enrollments: [{ classId: "class-1" }],
    });
    mockAssignmentFindMany.mockResolvedValueOnce([
      {
        id: "assignment-1",
        title: "Targeted remediation",
        description: null,
        classId: "class-1",
        dueAt: null,
        createdAt: new Date("2026-04-28T10:00:00Z"),
        points: 100,
        Class: { id: "class-1", name: "JSS 1A", subject: "MATH" },
        submissions: [],
      },
    ]);
    mockTeacherActionFindMany.mockResolvedValueOnce([
      {
        targetId: "assignment-1",
        metadata: { targetStudentIds: ["student-1"] },
      },
    ]);
    const { GET } = await import("@/app/api/student/assignments/route");

    const response = await GET(new NextRequest("http://localhost/api/student/assignments"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ assignments: [], count: 0 });
  });

  it("redirects non-targeted students away from targeted assignment detail", async () => {
    mockStudentFindUnique.mockResolvedValueOnce({
      id: "student-2",
      enrollments: [{ classId: "class-1" }],
    });
    mockAssignmentFindUnique.mockResolvedValueOnce({
      id: "assignment-1",
      title: "Essay",
      description: "Write",
      classId: "class-1",
      Class: { id: "class-1", schoolId: "school-1", name: "JSS 1A" },
      submissions: [],
    });
    mockTeacherActionFindMany.mockResolvedValueOnce([
      {
        targetId: "assignment-1",
        metadata: { targetStudentIds: ["student-1"] },
      },
    ]);
    const { default: Page } = await import("@/app/student/assignments/[id]/page");

    await expect(Page({ params: { id: "assignment-1" } })).rejects.toThrow("redirect:/assignments");
  });

  it("submission_viewed_by_teacher logs on teacher access", async () => {
    mockRequireRole.mockResolvedValueOnce({ id: "teacher-1", role: "TEACHER", schoolId: "school-1" });
    mockClassFindMany.mockResolvedValueOnce([{ id: "class-1" }]);
    mockEnrollmentFindFirst.mockResolvedValueOnce({ id: "enrollment-1" });
    mockStudentFindUnique.mockResolvedValueOnce({
      id: "student-1",
      user: { id: "student-user-1", name: "Student", email: "s@example.com" },
    });
    mockStudentProgressFindMany.mockResolvedValueOnce([]);
    mockAssignmentSubmissionFindMany.mockResolvedValueOnce([]);
    const { GET } = await import("@/app/api/teacher/students/[studentId]/route");

    await GET(new NextRequest("http://localhost/api/teacher/students/student-1?source=page"), {
      params: Promise.resolve({ studentId: "student-1" }),
    });

    expect(mockLogLearningEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "submission_viewed_by_teacher",
        studentId: "student-1",
      })
    );
  });

  it("does not duplicate poll event logs when count is unchanged", async () => {
    mockStudentFindUnique.mockResolvedValueOnce({
      id: "student-1",
      enrollments: [{ classId: "class-1" }],
    });
    mockAssignmentFindMany.mockResolvedValueOnce([]);
    const { GET } = await import("@/app/api/student/assignments/route");

    await GET(new NextRequest("http://localhost/api/student/assignments?source=poll&previousCount=0"));

    expect(mockLogLearningEvent).not.toHaveBeenCalled();
  });
});
