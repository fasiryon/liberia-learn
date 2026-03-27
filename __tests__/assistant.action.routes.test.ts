import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireUser = vi.hoisted(() => vi.fn());
const mockStudentFindUnique = vi.hoisted(() => vi.fn());
const mockUserFindUnique = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireUser: mockRequireUser,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    student: {
      findUnique: mockStudentFindUnique,
    },
    user: {
      findUnique: mockUserFindUnique,
    },
  },
}));

import { POST as adminInterventionPost } from "@/app/api/admin/intervention/suggest/route";
import { POST as guardianStudyPlanPost } from "@/app/api/guardian/study-plan/route";
import { POST as studentPracticePost } from "@/app/api/student/practice/generate/route";
import { POST as teacherAssignmentPost } from "@/app/api/teacher/assignment/generate/route";
import { POST as teacherLessonPost } from "@/app/api/teacher/lesson/improve/route";

const validBody = {
  question: "Explain fractions",
  subject: "MATH",
  gradeLevel: "7",
  contextMode: "lesson",
};

describe("assistant action routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStudentFindUnique.mockResolvedValue({
      currentGrade: 7,
      enrollments: [{ Class: { subject: "MATH" } }],
    });
    mockUserFindUnique.mockResolvedValue({
      guardianOf: [
        {
          student: {
            currentGrade: 7,
            enrollments: [{ Class: { subject: "MATH" } }],
          },
        },
      ],
    });
  });

  it("allows teacher assignment draft generation for TEACHER", async () => {
    mockRequireUser.mockResolvedValue({ id: "teacher-1", role: "TEACHER", schoolId: "school-1" });

    const response = await teacherAssignmentPost(
      new Request("http://localhost/api/teacher/assignment/generate", {
        method: "POST",
        body: JSON.stringify(validBody),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.draft.summary).toContain("Draft assignment");
  });

  it("returns 401 when the action route is unauthenticated", async () => {
    mockRequireUser.mockRejectedValue(Object.assign(new Error("Unauthorized"), { status: 401 }));

    const response = await teacherAssignmentPost(
      new Request("http://localhost/api/teacher/assignment/generate", {
        method: "POST",
        body: JSON.stringify(validBody),
      })
    );

    expect(response.status).toBe(401);
  });

  it("blocks teacher lesson improvement for non-teacher roles", async () => {
    mockRequireUser.mockResolvedValue({ id: "student-1", role: "STUDENT", schoolId: "school-1" });

    const response = await teacherLessonPost(
      new Request("http://localhost/api/teacher/lesson/improve", {
        method: "POST",
        body: JSON.stringify(validBody),
      })
    );

    expect(response.status).toBe(403);
  });

  it("allows admin intervention draft generation for ADMIN", async () => {
    mockRequireUser.mockResolvedValue({ id: "admin-1", role: "ADMIN", schoolId: "school-1" });

    const response = await adminInterventionPost(
      new Request("http://localhost/api/admin/intervention/suggest", {
        method: "POST",
        body: JSON.stringify({ ...validBody, contextMode: "governance" }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.draft.summary).toContain("Intervention suggestion");
  });

  it("allows student practice draft generation only for STUDENT", async () => {
    mockRequireUser.mockResolvedValue({ id: "student-1", role: "STUDENT", schoolId: "school-1" });

    const response = await studentPracticePost(
      new Request("http://localhost/api/student/practice/generate", {
        method: "POST",
        body: JSON.stringify({ ...validBody, role: "STUDENT", contextMode: "learning" }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.draft.summary).toContain("Practice draft");
    expect(payload.draft.summary).toContain("Grade 7");
  });

  it("blocks guardian study plan generation for non-guardian roles", async () => {
    mockRequireUser.mockResolvedValue({ id: "admin-1", role: "ADMIN", schoolId: "school-1" });

    const response = await guardianStudyPlanPost(
      new Request("http://localhost/api/guardian/study-plan", {
        method: "POST",
        body: JSON.stringify({ ...validBody, contextMode: "support" }),
      })
    );

    expect(response.status).toBe(403);
  });

  it("rejects student practice requests outside enrolled subjects", async () => {
    mockRequireUser.mockResolvedValue({ id: "student-1", role: "STUDENT", schoolId: "school-1" });

    const response = await studentPracticePost(
      new Request("http://localhost/api/student/practice/generate", {
        method: "POST",
        body: JSON.stringify({ ...validBody, subject: "SCIENCE", gradeLevel: "9" }),
      })
    );

    expect(response.status).toBe(403);
  });

  it("rejects guardian study plan requests outside linked student scope", async () => {
    mockRequireUser.mockResolvedValue({ id: "guardian-1", role: "GUARDIAN", schoolId: "school-1" });

    const response = await guardianStudyPlanPost(
      new Request("http://localhost/api/guardian/study-plan", {
        method: "POST",
        body: JSON.stringify({ ...validBody, subject: "SCIENCE", gradeLevel: "9", contextMode: "support" }),
      })
    );

    expect(response.status).toBe(403);
  });

  it("rejects guardian study plan requests that mix grade and subject across different linked students", async () => {
    mockRequireUser.mockResolvedValue({ id: "guardian-1", role: "GUARDIAN", schoolId: "school-1" });
    mockUserFindUnique.mockResolvedValue({
      guardianOf: [
        {
          student: {
            currentGrade: 7,
            enrollments: [{ Class: { subject: "MATH" } }],
          },
        },
        {
          student: {
            currentGrade: 5,
            enrollments: [{ Class: { subject: "LITERACY" } }],
          },
        },
      ],
    });

    const response = await guardianStudyPlanPost(
      new Request("http://localhost/api/guardian/study-plan", {
        method: "POST",
        body: JSON.stringify({ ...validBody, subject: "LITERACY", gradeLevel: "7", contextMode: "support" }),
      })
    );

    expect(response.status).toBe(403);
  });

  it("ignores client role for teacher draft generation", async () => {
    mockRequireUser.mockResolvedValue({ id: "teacher-1", role: "TEACHER", schoolId: "school-1" });

    const response = await teacherAssignmentPost(
      new Request("http://localhost/api/teacher/assignment/generate", {
        method: "POST",
        body: JSON.stringify({ ...validBody, role: "ADMIN" }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
  });
});
