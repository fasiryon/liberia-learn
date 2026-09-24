import { describe, expect, it, beforeEach, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockStudentFindFirst = vi.hoisted(() => vi.fn());
const mockPlacementCreate = vi.hoisted(() => vi.fn());
const mockStudentUpdate = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockTransaction = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    student: {
      findFirst: mockStudentFindFirst,
      update: mockStudentUpdate,
    },
    placementTest: {
      create: mockPlacementCreate,
    },
    $transaction: mockTransaction,
  },
}));

describe("placement contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue({
      id: "user-student-1",
      role: "STUDENT",
      schoolId: "school-cha",
    });
    mockStudentFindFirst.mockResolvedValue({
      id: "student-1",
      userId: "user-student-1",
    });
    mockPlacementCreate.mockImplementation(async ({ data }) => ({
      id: "placement-1",
      ...data,
    }));
    mockStudentUpdate.mockResolvedValue({
      id: "student-1",
      currentGrade: 4,
    });
    mockTransaction.mockImplementation(async (arr: any) => Promise.all(arr));
  });

  it("builds the payload shape accepted by the placement route", async () => {
    const payload = {
      band: "proficient",
      levelLabel: "Proficient",
      estimatedGrade: 4,
      rawScore: 8,
      totalQuestions: 10,
      details: {
        averageDifficulty: 3,
        difficultyRange: { min: 2, max: 4 },
      },
      questions: [
        {
          questionId: "q1",
          question: "What is 2 + 2?",
          options: ["3", "4", "5", "6"],
          correctAnswer: 1,
          explanation: "2 plus 2 equals 4.",
          difficulty: 2,
          subject: "mathematics",
          strand: "number sense",
          moeStandard: "MATH-G2-NS-01",
          whyThisQuestion: "This checks early addition fluency.",
          commonMistake: "Students may count incorrectly.",
          hint: "Add the two groups together.",
        },
      ],
      answers: Array.from({ length: 10 }, (_, i) => ({
        questionId: `q${i + 1}`,
        difficulty: 2,
        correct: i < 8,
        timeSpent: 12,
        selectedAnswer: 1,
      })),
      aiAnalysis: {
        overallNarrative: "The student showed strong foundational number sense.",
        strengths: ["Accurate addition"],
        areasForGrowth: ["Practice more multi-step problems"],
        subjectBreakdown: {
          numberSense: { score: 80, label: "Strong" },
        },
        teacherNote: "Continue reinforcing fluent addition.",
        confidenceExplanation: "Confidence is high because the student was consistent.",
        recommendedNextSteps: ["Give the student Grade 4 warm-up work."],
      },
    };

    const { POST } = await import("@/app/api/student/placement/route");
    const response = await POST(
      new Request("http://localhost/api/student/placement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    );

    expect(response.status).toBe(200);
    expect(mockPlacementCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        studentId: "student-1",
        band: "proficient",
        levelLabel: "Proficient",
        estimatedGrade: 4,
        rawScore: 8,
        totalQuestions: 10,
        aiAnalysis: payload.aiAnalysis,
      }),
    });
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "student.placement.created",
        resourceId: "placement-1",
      })
    );
  });

  it.each([
    ["rawScore above totalQuestions", { rawScore: 11, totalQuestions: 10 }],
    ["estimatedGrade out of range", { estimatedGrade: 13 }],
    ["non-integer grade", { estimatedGrade: 4.5 }],
    ["answers not matching totalQuestions", { answers: [{ questionId: "q1", correct: true }] }],
  ])("rejects an inconsistent client placement payload (hostile): %s", async (_label, override) => {
    const { POST } = await import("@/app/api/student/placement/route");
    const response = await POST(
      new Request("http://localhost/api/student/placement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estimatedGrade: 4, rawScore: 8, totalQuestions: 10, ...override }),
      })
    );
    expect(response.status).toBe(400);
    expect(mockPlacementCreate).not.toHaveBeenCalled();
  });

  it("derives the band on the server instead of trusting the client label (hostile)", async () => {
    const { POST } = await import("@/app/api/student/placement/route");
    await POST(
      new Request("http://localhost/api/student/placement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ band: "advanced", levelLabel: "Advanced", estimatedGrade: 4, rawScore: 2, totalQuestions: 10 }),
      })
    );
    expect(mockPlacementCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ band: "foundational", levelLabel: "Foundational" }),
    });
  });
});
