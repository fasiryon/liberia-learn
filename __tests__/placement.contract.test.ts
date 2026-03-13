import { describe, expect, it, beforeEach, vi } from "vitest";
import { buildPlacementPayload } from "@/components/PlacementTest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockStudentFindFirst = vi.hoisted(() => vi.fn());
const mockPlacementCreate = vi.hoisted(() => vi.fn());
const mockStudentUpdate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
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
    const payload = buildPlacementPayload({
      scorePercent: 80,
      correctCount: 8,
      totalQuestions: 10,
      estimatedGrade: 4,
      track: "ELEMENTARY",
      answers: [{ questionId: "q1", selected: "A", correct: true }],
      questions: [
        {
          id: "q1",
          text: "What is 2 + 2?",
          options: ["3", "4", "5", "6"],
          answer: "4",
          difficulty: 1,
        },
      ],
    });

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
      }),
    });
  });
});
