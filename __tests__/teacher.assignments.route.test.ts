import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockAssignmentSubmissionFindMany = vi.hoisted(() => vi.fn());
const mockAssignmentFindMany = vi.hoisted(() => vi.fn());
const mockClassFindUnique = vi.hoisted(() => vi.fn());
const mockScheduledWorkFindUnique = vi.hoisted(() => vi.fn());
const mockCurriculumContentFindUnique = vi.hoisted(() => vi.fn());
const mockAssignmentCreate = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockNotifyAssignmentCreated = vi.hoisted(() => vi.fn());
const mockLogLearningEvent = vi.hoisted(() => vi.fn());
const mockTeacherActionCreate = vi.hoisted(() => vi.fn());
const mockEnrollmentFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/assignment-notifications", () => ({ notifyAssignmentCreated: mockNotifyAssignmentCreated }));
vi.mock("@/lib/events/logLearningEvent", () => ({ logLearningEvent: mockLogLearningEvent }));
vi.mock("@/lib/push/sendPush", () => ({ sendPushToMany: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    assignmentSubmission: {
      findMany: mockAssignmentSubmissionFindMany,
    },
    assignment: {
      findMany: mockAssignmentFindMany,
      create: mockAssignmentCreate,
    },
    teacherAction: {
      create: mockTeacherActionCreate,
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
    enrollment: {
      findMany: mockEnrollmentFindMany,
    },
  },
}));

describe("/api/teacher/assignments", () => {
  beforeEach(() => {
    vi.resetModules();
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
        Teacher: {
          name: "Teacher A",
          email: "teacher@example.com",
        },
      },
    });
    mockLogAudit.mockResolvedValue(undefined);
    mockNotifyAssignmentCreated.mockResolvedValue(undefined);
    mockLogLearningEvent.mockResolvedValue(null);
    mockTeacherActionCreate.mockResolvedValue(undefined);
    mockEnrollmentFindMany.mockResolvedValue([]);
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
    expect(mockLogLearningEvent).toHaveBeenCalledOnce();
    expect(mockNotifyAssignmentCreated).toHaveBeenCalledOnce();
    expect(mockTeacherActionCreate).toHaveBeenCalledOnce();
  }, 15_000);

  it("teacher sees targeted remediation assignments normally", async () => {
    mockAssignmentFindMany.mockResolvedValue([
      {
        id: "assignment-1",
        title: "Targeted remediation",
        description: "Practice fractions",
        classId: "class-1",
        dueAt: null,
        createdAt: new Date("2026-04-03T09:00:00.000Z"),
        points: 100,
        Class: {
          id: "class-1",
          name: "JSS 2 Mathematics",
          subject: "MATH",
          Teacher: { name: "Teacher A", email: "teacher@example.com" },
          enrollments: [
            { Student: { id: "student-1", user: { name: "Student One", email: "s1@example.com" } } },
            { Student: { id: "student-2", user: { name: "Student Two", email: "s2@example.com" } } },
          ],
        },
        submissions: [{ id: "submission-1", score: null, turnedInAt: null, Student: { id: "student-1", user: { name: "Student One", email: "s1@example.com" } } }],
      },
    ]);

    const { GET } = await import("@/app/api/teacher/assignments/route");
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      assignments: [
        expect.objectContaining({
          id: "assignment-1",
          title: "Targeted remediation",
          studentCount: 2,
        }),
      ],
    });
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
  }, 15_000);

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
  }, 15_000);
});
