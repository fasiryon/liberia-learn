import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockStudentFindUnique = vi.hoisted(() => vi.fn());
const mockAssignmentFindUnique = vi.hoisted(() => vi.fn());
const mockAssignmentSubmissionUpsert = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockNotifyAssignmentSubmitted = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/db", () => ({
  prisma: {
    student: { findUnique: mockStudentFindUnique },
    assignment: { findUnique: mockAssignmentFindUnique },
    assignmentSubmission: { upsert: mockAssignmentSubmissionUpsert },
  },
}));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/assignment-notifications", () => ({
  notifyAssignmentSubmitted: mockNotifyAssignmentSubmitted,
}));

describe("POST /api/student/assignments/[id]/submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue({ id: "user-1", role: "STUDENT", schoolId: "school-1" });
    mockStudentFindUnique.mockResolvedValue({
      id: "student-1",
      user: { name: "Student One", schoolId: "school-1" },
      enrollments: [{ classId: "class-1" }],
    });
    mockAssignmentFindUnique.mockResolvedValue({
      id: "assignment-1",
      title: "Essay",
      classId: "class-1",
      Class: { id: "class-1", schoolId: "school-1", School: { name: "Capitol Hill Academy" } },
    });
    mockAssignmentSubmissionUpsert.mockResolvedValue({ id: "submission-1", turnedInAt: new Date("2026-03-13T12:00:00.000Z") });
    mockLogAudit.mockResolvedValue(undefined);
    mockNotifyAssignmentSubmitted.mockResolvedValue(undefined);
  });

  it("submits the assignment and attempts guardian notification", async () => {
    const { POST } = await import("@/app/api/student/assignments/[id]/submit/route");
    const response = await POST(
      new Request("http://localhost/api/student/assignments/assignment-1/submit", {
        method: "POST",
        body: JSON.stringify({ content: "My assignment response" }),
        headers: { "Content-Type": "application/json" },
      }) as any,
      { params: { id: "assignment-1" } }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, submissionId: "submission-1" });
    expect(mockNotifyAssignmentSubmitted).toHaveBeenCalledOnce();
  });
});
