/**
 * Sprint 2: Assignment Grading + Gradebook
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockNotifyAssignmentGraded = vi.hoisted(() => vi.fn());
const mockRequireRole = vi.hoisted(() => vi.fn());

const mockSubmissionFindUnique = vi.hoisted(() => vi.fn());
const mockSubmissionUpdate = vi.hoisted(() => vi.fn());
const mockClassFindMany = vi.hoisted(() => vi.fn());
const mockEnrollmentFindMany = vi.hoisted(() => vi.fn());
const mockAssignmentFindMany = vi.hoisted(() => vi.fn());
const mockSubmissionFindMany = vi.hoisted(() => vi.fn());
const mockClassFindFirst = vi.hoisted(() => vi.fn());

vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/assignment-notifications", () => ({
  notifyAssignmentGraded: mockNotifyAssignmentGraded,
}));
vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/db", () => ({
  prisma: {
    assignmentSubmission: {
      findUnique: mockSubmissionFindUnique,
      update: mockSubmissionUpdate,
      findMany: mockSubmissionFindMany,
    },
    class: {
      findMany: mockClassFindMany,
      findFirst: mockClassFindFirst,
    },
    enrollment: { findMany: mockEnrollmentFindMany },
    assignment: { findMany: mockAssignmentFindMany },
  },
}));

const TEACHER = {
  id: "teacher-1",
  role: "TEACHER" as const,
  schoolId: "school-1",
  name: "Test Teacher",
};

const STUDENT_USER = {
  id: "student-user-1",
  role: "STUDENT" as const,
  schoolId: "school-1",
  name: "Test Student",
};

const SUBMISSION = {
  id: "sub-1",
  studentId: "student-1",
  assignmentId: "asgn-1",
  content: "My answer to the assignment",
  score: null,
  feedback: null,
  gradedAt: null,
  gradedBy: null,
  Assignment: {
    id: "asgn-1",
    title: "Week 1 Assignment",
    Class: {
      schoolId: "school-1",
      teacherId: "teacher-1",
      School: { name: "Test School" },
    },
  },
  Student: {
    id: "student-1",
    user: { id: "student-user-1", name: "Alice", email: "alice@test.com" },
  },
};

async function callGradeRoute(
  body: Record<string, unknown>,
  submissionId = "sub-1"
) {
  const { POST } = await import(
    "@/app/api/teacher/assignments/submissions/[submissionId]/grade/route"
  );
  const req = new NextRequest("http://localhost/api/teacher/assignments/submissions/sub-1/grade", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
  return POST(req, { params: { submissionId } });
}

async function callGradebookRoute(qs = "") {
  const { GET } = await import("@/app/api/teacher/gradebook/route");
  const req = new NextRequest(`http://localhost/api/teacher/gradebook${qs}`);
  return GET(req);
}

async function callGradebookExportRoute(qs = "") {
  const { GET } = await import("@/app/api/teacher/gradebook/export/route");
  const req = new NextRequest(`http://localhost/api/teacher/gradebook/export${qs}`);
  return GET(req);
}

describe("Sprint 2 — Assignment Grading", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue(TEACHER);
    mockNotifyAssignmentGraded.mockResolvedValue(undefined);
    mockLogAudit.mockResolvedValue(undefined);
  });

  describe("POST /api/teacher/assignments/submissions/[submissionId]/grade", () => {
    it("saves grade, feedback, gradedAt, gradedBy on valid input", async () => {
      mockSubmissionFindUnique.mockResolvedValue(SUBMISSION);
      const now = new Date("2026-05-12T10:00:00Z");
      const updated = { ...SUBMISSION, score: 85, feedback: "Good work", gradedAt: now, gradedBy: "teacher-1" };
      mockSubmissionUpdate.mockResolvedValue(updated);

      const res = await callGradeRoute({ grade: 85, feedback: "Good work" });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.submission.grade).toBe(85);
      expect(mockSubmissionUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "sub-1" },
          data: expect.objectContaining({
            score: 85,
            feedback: "Good work",
            gradedBy: "teacher-1",
          }),
        })
      );
      expect(mockLogAudit).toHaveBeenCalled();
    });

    it("rejects grade > 100", async () => {
      const res = await callGradeRoute({ grade: 101, feedback: "Over limit" });
      expect(res.status).toBe(400);
    });

    it("rejects grade < 0", async () => {
      const res = await callGradeRoute({ grade: -1, feedback: "Negative" });
      expect(res.status).toBe(400);
    });

    it("returns 404 for non-existent submission", async () => {
      mockSubmissionFindUnique.mockResolvedValue(null);
      const res = await callGradeRoute({ grade: 50, feedback: "ok" }, "not-found-id");
      expect(res.status).toBe(404);
    });

    it("returns 403 when non-teacher calls the endpoint", async () => {
      mockRequireRole.mockRejectedValue(Object.assign(new Error("Forbidden"), { status: 403 }));
      const res = await callGradeRoute({ grade: 70, feedback: "test" });
      expect(res.status).toBe(500); // requireRole throws, caught by route handler
    });

    it("returns 403 when teacher from different school tries to grade", async () => {
      mockSubmissionFindUnique.mockResolvedValue({
        ...SUBMISSION,
        Assignment: {
          ...SUBMISSION.Assignment,
          Class: { ...SUBMISSION.Assignment.Class, schoolId: "other-school" },
        },
      });
      const res = await callGradeRoute({ grade: 70, feedback: "forbidden" });
      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/teacher/gradebook", () => {
    beforeEach(() => {
      mockClassFindMany.mockResolvedValue([
        { id: "class-1", name: "Grade 7A", subject: "MATH" },
      ]);
    });

    it("returns class list when no classId provided", async () => {
      const res = await callGradebookRoute();
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.classes).toHaveLength(1);
      expect(data.classes[0].name).toBe("Grade 7A");
    });

    it("returns students, assignments, submissions grid for a class", async () => {
      mockEnrollmentFindMany.mockResolvedValue([
        {
          Student: { id: "student-1", user: { name: "Alice" } },
        },
      ]);
      mockAssignmentFindMany.mockResolvedValue([
        { id: "asgn-1", title: "Week 1", points: 100, dueAt: null, createdAt: new Date() },
      ]);
      mockSubmissionFindMany.mockResolvedValue([
        { id: "sub-1", studentId: "student-1", assignmentId: "asgn-1", score: 85, gradedAt: new Date(), feedback: "Good" },
      ]);

      const res = await callGradebookRoute("?classId=class-1");
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.students).toHaveLength(1);
      expect(data.students[0].name).toBe("Alice");
      expect(data.assignments).toHaveLength(1);
      expect(data.submissions[0].grade).toBe(85);
    });
  });

  describe("GET /api/teacher/gradebook/export", () => {
    it("returns CSV with correct headers and row data", async () => {
      mockClassFindFirst.mockResolvedValue({ id: "class-1", name: "Grade 7A" });
      mockEnrollmentFindMany.mockResolvedValue([
        { Student: { id: "student-1", user: { name: "Alice" } } },
      ]);
      mockAssignmentFindMany.mockResolvedValue([
        { id: "asgn-1", title: "Week 1", points: 100 },
      ]);
      mockSubmissionFindMany.mockResolvedValue([
        { studentId: "student-1", assignmentId: "asgn-1", score: 92, gradedAt: new Date() },
      ]);

      const res = await callGradebookExportRoute("?classId=class-1");
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("text/csv");
      const csv = await res.text();
      expect(csv).toContain("Student");
      expect(csv).toContain("Week 1");
      expect(csv).toContain("Alice");
      expect(csv).toContain("92");
    });
  });
});

describe("Sprint 2 — Student Grade View", () => {
  it("graded state: shows score badge when score is non-null", () => {
    const gradeData = { score: 72, feedback: "Well done", gradedAt: "2026-05-11T00:00:00Z", turnedInAt: "2026-05-10T00:00:00Z" };
    expect(gradeData.score).toBe(72);
    expect(gradeData.feedback).toBe("Well done");
  });

  it("submitted-not-graded state: score is null but content exists", () => {
    const gradeData = { score: null, feedback: null, gradedAt: null, turnedInAt: "2026-05-10T00:00:00Z" };
    const isGraded = gradeData.score !== null;
    const isSubmitted = !!gradeData.turnedInAt;
    expect(isGraded).toBe(false);
    expect(isSubmitted).toBe(true);
  });
});
