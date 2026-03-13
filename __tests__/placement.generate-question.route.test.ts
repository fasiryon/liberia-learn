import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockCreate = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
}));

vi.mock("@/lib/ai/openaiClient", () => ({
  getOpenAIClientOrThrow: () => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }),
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
}));

describe("POST /api/placement/generate-question", () => {
  beforeEach(() => {
    vi.resetModules();
    mockRequireRole.mockReset();
    mockCreate.mockReset();
    mockLogAudit.mockReset();
    mockRequireRole.mockResolvedValue({ id: "student-1", schoolId: "school-1", role: "STUDENT" });
  });

  it("returns enriched placement question fields", async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              question: "Which digit is in the hundreds place in 482?",
              options: ["4", "8", "2", "0"],
              correctAnswer: 0,
              explanation: "The 4 is in the hundreds place.",
              difficulty: 3,
              subject: "mathematics",
              strand: "Number sense",
              moeStandard: "MATH-G5-NS-01",
              whyThisQuestion: "This tests whether the student understands place value at difficulty 3.",
              commonMistake: "Students often confuse tens and hundreds place.",
              hint: "Think about the position of each digit.",
            }),
          },
        },
      ],
    });

    const { POST } = await import("@/app/api/placement/generate-question/route");
    const response = await POST(
      new Request("http://localhost/api/placement/generate-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ difficulty: 3, subject: "mathematics", previousAnswers: [] }),
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      subject: "mathematics",
      strand: "Number sense",
      moeStandard: "MATH-G5-NS-01",
    });
    expect(body.whyThisQuestion).toContain("difficulty 3");
    expect(body.commonMistake).toContain("hundreds");
    expect(body.hint).toContain("position");
    expect(mockLogAudit).toHaveBeenCalled();
  });
});
