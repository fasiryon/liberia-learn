import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockIsExamSystemEnabled = vi.hoisted(() => vi.fn());
const mockGenerateExam = vi.hoisted(() => vi.fn());
const mockExamCreate = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/serverFlags", () => ({ isExamSystemEnabled: mockIsExamSystemEnabled }));
vi.mock("@/lib/exams/examGenerator", () => ({ generateExam: mockGenerateExam }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/db", () => ({
  prisma: {
    exam: { create: mockExamCreate },
  },
}));

import { POST } from "@/app/api/admin/exams/generate/route";

function makeReq(body: unknown) {
  return new Request("http://localhost/api/admin/exams/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

describe("POST /api/admin/exams/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsExamSystemEnabled.mockReturnValue(true);
    mockRequireRole.mockResolvedValue({ id: "teacher-1", role: "TEACHER", schoolId: "school-1" });
    mockGenerateExam.mockResolvedValue({
      title: "Grade 6 Math Exam",
      subject: "MATH",
      grade: 6,
      moeStandards: ["M1"],
      timeLimit: 60,
      passingScore: 0.7,
      questions: [
        {
          prompt: "Q1",
          options: ["A", "B", "C", "D"],
          correctIndex: 1,
          explanation: "Because",
          moeCode: "M1",
          points: 1,
        },
      ],
    });
    mockExamCreate.mockResolvedValue({ id: "exam-1" });
    mockLogAudit.mockResolvedValue(undefined);
  });

  it("requires ADMIN or TEACHER session", async () => {
    mockRequireRole.mockRejectedValueOnce(Object.assign(new Error("Unauthorized"), { status: 401 }));
    const res = await POST(makeReq({ subject: "MATH", grade: 6, moeStandards: ["M1"] }));
    expect(res.status).toBe(401);
  });

  it("persists exam and questions to DB", async () => {
    await POST(makeReq({ subject: "MATH", grade: 6, moeStandards: ["M1"] }));
    expect(mockExamCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "Grade 6 Math Exam",
          questions: expect.objectContaining({
            create: expect.any(Array),
          }),
        }),
      })
    );
  });

  it("returns examId", async () => {
    const res = await POST(makeReq({ subject: "MATH", grade: 6, moeStandards: ["M1"] }));
    const body = await res.json();
    expect(body.examId).toBe("exam-1");
  });

  it("returns 404 when ENABLE_EXAM_SYSTEM is false", async () => {
    mockIsExamSystemEnabled.mockReturnValue(false);
    const res = await POST(makeReq({ subject: "MATH", grade: 6, moeStandards: ["M1"] }));
    expect(res.status).toBe(404);
  });
});
