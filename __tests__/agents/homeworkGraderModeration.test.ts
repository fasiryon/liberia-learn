import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockModerateText, mockEnqueueEscalation } = vi.hoisted(() => ({
  mockPrisma: {
    agent: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    agentTask: { create: vi.fn(), update: vi.fn() },
    agentMetric: { create: vi.fn() },
    systemEvent: { create: vi.fn() },
    homeworkSubmission: { findUnique: vi.fn(), update: vi.fn() },
  },
  mockModerateText: vi.fn(async (): Promise<{ verdict: "SAFE" | "UNSAFE" | "UNCERTAIN"; reason?: string }> => ({
    verdict: "SAFE",
  })),
  mockEnqueueEscalation: vi.fn(async () => ({ id: "escalation-1" })),
}));

const mockRoutedCompletion = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/ai/routedCompletion", () => ({ routedCompletion: mockRoutedCompletion }));
vi.mock("@/lib/agents/moderation", () => ({ moderateText: mockModerateText }));
vi.mock("@/lib/agents/escalation", () => ({ enqueueEscalation: mockEnqueueEscalation }));

import { HomeworkGrader } from "@/lib/ai/homework-grader";

const AGENT = { id: "agent-1" };
const TASK = { id: "task-1" };
const SUBMISSION = {
  id: "sub-1",
  answers: [{ answer: "The mitochondria is the powerhouse of the cell." }],
  Homework: { title: "Biology HW", instructions: "Answer the questions.", questions: [{ text: "What is the mitochondria?" }] },
  Student: { id: "student-1", user: { id: "user-1" } },
};

describe("HomeworkGrader.gradeSubmission (NR-9.6 moderation)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockModerateText.mockResolvedValue({ verdict: "SAFE" });
    mockPrisma.agent.findFirst.mockResolvedValue(AGENT);
    mockPrisma.agentTask.create.mockResolvedValue(TASK);
    mockPrisma.agentTask.update.mockResolvedValue(TASK);
    mockPrisma.agentMetric.create.mockResolvedValue({});
    mockPrisma.systemEvent.create.mockResolvedValue({});
    mockPrisma.agent.update.mockResolvedValue(AGENT);
    mockPrisma.homeworkSubmission.findUnique.mockResolvedValue(SUBMISSION);
  });

  it("grades normally when input and output are safe", async () => {
    mockRoutedCompletion.mockResolvedValue({
      content: JSON.stringify({
        overallScore: 85,
        overallFeedback: "Great work!",
        questions: [{ questionIndex: 0, score: 1, maxScore: 1, feedback: "Correct." }],
      }),
    });
    mockPrisma.homeworkSubmission.update.mockResolvedValue({ id: "sub-1" });

    const result = await HomeworkGrader.gradeSubmission("sub-1");

    expect(result.overallScore).toBe(85);
    expect(mockPrisma.homeworkSubmission.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ aiScore: 85 }) })
    );
    expect(mockEnqueueEscalation).not.toHaveBeenCalled();
  });

  it("blocks unsafe input, escalates, and routes through the existing failure path", async () => {
    mockModerateText.mockResolvedValueOnce({ verdict: "UNSAFE", reason: "unsafe_input" });

    await expect(HomeworkGrader.gradeSubmission("sub-1")).rejects.toThrow("content_moderation_blocked_input");

    expect(mockRoutedCompletion).not.toHaveBeenCalled();
    expect(mockEnqueueEscalation).toHaveBeenCalledWith(
      expect.objectContaining({ priority: "HIGH", userId: "user-1" })
    );
    expect(mockPrisma.agentTask.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "failed" }) })
    );
    expect(mockPrisma.systemEvent.create).toHaveBeenCalled();
  });

  it("blocks unsafe output, escalates, and routes through the existing failure path", async () => {
    mockRoutedCompletion.mockResolvedValue({
      content: JSON.stringify({
        overallScore: 85,
        overallFeedback: "unsafe",
        questions: [{ questionIndex: 0, score: 1, maxScore: 1, feedback: "unsafe" }],
      }),
    });
    mockModerateText
      .mockResolvedValueOnce({ verdict: "SAFE" }) // input
      .mockResolvedValueOnce({ verdict: "UNSAFE" }); // output

    await expect(HomeworkGrader.gradeSubmission("sub-1")).rejects.toThrow("content_moderation_blocked_output");

    expect(mockPrisma.homeworkSubmission.update).not.toHaveBeenCalled();
    expect(mockEnqueueEscalation).toHaveBeenCalledWith(
      expect.objectContaining({ priority: "HIGH", userId: "user-1" })
    );
  });
});
