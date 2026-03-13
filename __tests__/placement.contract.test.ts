import { describe, expect, it, beforeEach, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockStudentFindFirst = vi.hoisted(() => vi.fn());
const mockPlacementCreate = vi.hoisted(() => vi.fn());
const mockStudentUpdate = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());

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
      answers: [{ questionId: "q1", difficulty: 2, correct: true, timeSpent: 12, selectedAnswer: 1 }],
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
});
