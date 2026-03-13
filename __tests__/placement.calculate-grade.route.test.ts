import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockRoutedCompletion = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
}));

vi.mock("@/lib/ai/router", () => ({
  routedCompletion: mockRoutedCompletion,
}));

describe("POST /api/placement/calculate-grade", () => {
  beforeEach(() => {
    vi.resetModules();
    mockRequireRole.mockReset();
    mockLogAudit.mockReset();
    mockRoutedCompletion.mockReset();
    mockRequireRole.mockResolvedValue({ id: "student-1", schoolId: "school-1", role: "STUDENT" });
    mockRoutedCompletion.mockResolvedValue({
      content: JSON.stringify({
        overallNarrative: "The student showed solid number sense and is ready for the next level.",
        strengths: ["Strong place value understanding", "Good accuracy on easier items"],
        areasForGrowth: ["More practice with operations", "Improve confidence on harder questions"],
        subjectBreakdown: {
          numberSense: { score: 80, label: "Strong" },
          operations: { score: 60, label: "Developing" },
        },
        teacherNote: "Focus next on multi-step operations and checking work carefully.",
        confidenceExplanation: "Confidence is high because the student was consistently accurate across difficulty levels.",
        recommendedNextSteps: [
          "Review multi-step operations with guided practice.",
          "Have the student explain their reasoning aloud.",
        ],
      }),
      tier: "smart",
      model: "gpt-4o-mini",
      inputTokens: 100,
      outputTokens: 200,
      estimatedCostUSD: 0.01,
    });
  });

  it("returns aiAnalysis with all required fields", async () => {
    const { POST } = await import("@/app/api/placement/calculate-grade/route");
    const response = await POST(
      new Request("http://localhost/api/placement/calculate-grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questions: [
            {
              question: "Which digit is in the hundreds place in 482?",
              options: ["4", "8", "2", "0"],
              difficulty: 3,
              strand: "Number sense",
            },
          ],
          answers: [
            {
              questionId: "q1",
              difficulty: 3,
              correct: true,
              selectedAnswer: 0,
              timeSpent: 8,
            },
          ],
        }),
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.band).toBe("advanced");
    expect(body.aiAnalysis).toMatchObject({
      overallNarrative: expect.any(String),
      strengths: expect.any(Array),
      areasForGrowth: expect.any(Array),
      subjectBreakdown: expect.any(Object),
      teacherNote: expect.any(String),
      confidenceExplanation: expect.any(String),
      recommendedNextSteps: expect.any(Array),
    });
    expect(mockRoutedCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ forceSmartTier: true })
    );
    expect(mockLogAudit).toHaveBeenCalled();
  });

  it("derives placement bands across all score ranges", async () => {
    const { derivePlacementBand } = await import("@/app/api/placement/calculate-grade/route");
    expect(derivePlacementBand(4, 10)).toBe("foundational");
    expect(derivePlacementBand(5, 10)).toBe("developing");
    expect(derivePlacementBand(8, 10)).toBe("proficient");
    expect(derivePlacementBand(9, 10)).toBe("advanced");
  });
});
