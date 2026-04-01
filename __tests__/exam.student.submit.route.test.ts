import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockIsExamSystemEnabled = vi.hoisted(() => vi.fn());
const mockStudentFindUnique = vi.hoisted(() => vi.fn());
const mockExamAttemptFindFirst = vi.hoisted(() => vi.fn());
const mockExamAttemptUpdate = vi.hoisted(() => vi.fn());
const mockExamCertificationUpsert = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockTransaction = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/serverFlags", () => ({ isExamSystemEnabled: mockIsExamSystemEnabled }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/db", () => ({
  prisma: {
    student: { findUnique: mockStudentFindUnique },
    examAttempt: {
      findFirst: mockExamAttemptFindFirst,
      update: mockExamAttemptUpdate,
    },
    examCertification: {
      upsert: mockExamCertificationUpsert,
    },
    $transaction: mockTransaction,
  },
}));

import { POST } from "@/app/api/student/exams/[examId]/submit/route";

function makeReq(body: unknown) {
  return new Request("http://localhost/api/student/exams/exam-1/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

function makeAttempt(startedAt = new Date(Date.now() - 10 * 60 * 1000)) {
  return {
    id: "attempt-1",
    examId: "exam-1",
    studentId: "student-1",
    answers: [],
    score: 0,
    passed: false,
    startedAt,
    submittedAt: null,
    integrityFlags: [],
    exam: {
      id: "exam-1",
      subject: "MATH",
      grade: 6,
      passingScore: 0.7,
      timeLimit: 60,
      questions: [
        { id: "q1", correctIndex: 1, moeCode: "M1" },
        { id: "q2", correctIndex: 2, moeCode: "M2" },
      ],
    },
  };
}

describe("POST /api/student/exams/[examId]/submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsExamSystemEnabled.mockReturnValue(true);
    mockRequireRole.mockResolvedValue({ id: "user-1", role: "STUDENT", schoolId: "school-1" });
    mockStudentFindUnique.mockResolvedValue({ id: "student-1" });
    mockExamAttemptFindFirst
      .mockResolvedValueOnce(makeAttempt())
      .mockResolvedValueOnce(null);
    mockExamAttemptUpdate.mockResolvedValue(undefined);
    mockExamCertificationUpsert.mockResolvedValue(undefined);
    mockLogAudit.mockResolvedValue(undefined);
    mockTransaction.mockImplementation(async (cb: any) => {
      const tx = {
        examAttempt: { update: mockExamAttemptUpdate },
        examCertification: { upsert: mockExamCertificationUpsert },
      };
      return cb(tx);
    });
  });

  it("grades correctly and returns score", async () => {
    const res = await POST(makeReq({ attemptId: "attempt-1", answers: [1, 2] }), { params: { examId: "exam-1" } });
    const body = await res.json();
    expect(body.score).toBe(1);
    expect(body.passed).toBe(true);
  });

  it("creates certification when passed=true", async () => {
    await POST(makeReq({ attemptId: "attempt-1", answers: [1, 2] }), { params: { examId: "exam-1" } });
    expect(mockExamCertificationUpsert).toHaveBeenCalledOnce();
  });

  it("does not create certification when passed=false", async () => {
    mockExamAttemptFindFirst.mockReset();
    mockExamAttemptFindFirst
      .mockResolvedValueOnce(makeAttempt())
      .mockResolvedValueOnce(null);
    await POST(makeReq({ attemptId: "attempt-1", answers: [0, 0] }), { params: { examId: "exam-1" } });
    expect(mockExamCertificationUpsert).not.toHaveBeenCalled();
  });

  it("adds time_exceeded flag when over time limit", async () => {
    mockExamAttemptFindFirst.mockReset();
    mockExamAttemptFindFirst
      .mockResolvedValueOnce(makeAttempt(new Date(Date.now() - 70 * 60 * 1000)))
      .mockResolvedValueOnce(null);
    await POST(makeReq({ attemptId: "attempt-1", answers: [1, 2] }), { params: { examId: "exam-1" } });
    expect(mockExamAttemptUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          integrityFlags: expect.arrayContaining(["time_exceeded"]),
        }),
      })
    );
  });

  it("prevents resubmission if already passed", async () => {
    mockExamAttemptFindFirst.mockReset();
    mockExamAttemptFindFirst
      .mockResolvedValueOnce(makeAttempt())
      .mockResolvedValueOnce({ id: "attempt-pass" });
    const res = await POST(makeReq({ attemptId: "attempt-1", answers: [1, 2] }), { params: { examId: "exam-1" } });
    expect(res.status).toBe(409);
  });

  it("requires STUDENT session", async () => {
    mockRequireRole.mockRejectedValueOnce(Object.assign(new Error("Unauthorized"), { status: 401 }));
    const res = await POST(makeReq({ attemptId: "attempt-1", answers: [1, 2] }), { params: { examId: "exam-1" } });
    expect(res.status).toBe(401);
  });
});
