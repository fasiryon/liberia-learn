import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  requireRole: vi.fn(),
  studentFindUnique: vi.fn(),
  examFindFirst: vi.fn(),
  examFindMany: vi.fn(),
  enrollmentFindFirst: vi.fn(),
  academicEnrollmentFindFirst: vi.fn(),
  examAttemptFindFirst: vi.fn(),
  examAttemptCreate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser, requireRole: mocks.requireRole }));
vi.mock("@/lib/serverFlags", () => ({ isExamSystemEnabled: () => true }));
vi.mock("@/lib/outcomes/examReadiness", () => ({ buildStudentExamReadiness: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/db", () => ({
  prisma: {
    student: { findUnique: mocks.studentFindUnique },
    exam: { findFirst: mocks.examFindFirst, findMany: mocks.examFindMany },
    enrollment: { findFirst: mocks.enrollmentFindFirst },
    academicEnrollment: { findFirst: mocks.academicEnrollmentFindFirst },
    examAttempt: { findFirst: mocks.examAttemptFindFirst, create: mocks.examAttemptCreate },
  },
}));

import { GET as listExams } from "@/app/api/student/exams/route";
import { POST as startExam } from "@/app/api/student/exams/[examId]/start/route";

const QUESTIONS = [
  { id: "q1", examId: "exam-1", prompt: "Which is greater?", options: ["0.7", "0.65"], correctIndex: 0, explanation: "Seven tenths exceeds sixty-five hundredths.", moeCode: "M7.1", points: 2 },
  { id: "q2", examId: "exam-1", prompt: "7 × 1,000?", options: ["700", "7,000"], correctIndex: 1, explanation: "Multiplying by 1,000 shifts three places.", moeCode: "M7.2", points: 1 },
];

const EXAM = { id: "exam-1", title: "Decimals", subject: "MATH", grade: 7, status: "PUBLISHED", timeLimit: 30, passingScore: 0.7, moeStandards: ["M7"], classId: null, academicYearId: null, questions: QUESTIONS, class: null, _count: { questions: 2 } };

function assertNoKeyMaterial(body: unknown) {
  const serialized = JSON.stringify(body);
  expect(serialized).not.toContain("correctIndex");
  expect(serialized).not.toContain("explanation");
  expect(serialized).not.toContain("Seven tenths exceeds");
}

describe("legacy student exam routes withhold keys and explanations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.studentFindUnique.mockResolvedValue({ id: "student-1", currentGrade: 7, user: { schoolId: "school-1" } });
  });

  it("start returns only allow-listed question fields, in a stable server order", async () => {
    mocks.requireUser.mockResolvedValue({ id: "user-1", role: "STUDENT" });
    mocks.examFindFirst.mockResolvedValue(EXAM);
    mocks.examAttemptFindFirst.mockResolvedValue(null);
    mocks.examAttemptCreate.mockResolvedValue({ id: "attempt-1", startedAt: new Date("2026-11-01T10:00:00.000Z") });
    const response = await startExam(new Request("http://localhost/x", { method: "POST" }) as never, { params: { examId: "exam-1" } });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.questions).toEqual([
      { id: "q1", examId: "exam-1", prompt: "Which is greater?", options: ["0.7", "0.65"], moeCode: "M7.1", points: 2 },
      { id: "q2", examId: "exam-1", prompt: "7 × 1,000?", options: ["700", "7,000"], moeCode: "M7.2", points: 1 },
    ]);
    assertNoKeyMaterial(body);
    expect(mocks.examFindFirst.mock.calls[0][0].include.questions).toEqual({ orderBy: { id: "asc" } });
  });

  it("list excludes deleted exams and withholds key material", async () => {
    mocks.requireRole.mockResolvedValue({ id: "user-1", role: "STUDENT" });
    mocks.examFindMany.mockResolvedValue([EXAM]);
    const response = await listExams();
    const body = await response.json();
    assertNoKeyMaterial(body);
    expect(mocks.examFindMany.mock.calls[0][0].where).toMatchObject({ schoolId: "school-1", grade: 7, status: "PUBLISHED", deletedAt: null });
  });
});
