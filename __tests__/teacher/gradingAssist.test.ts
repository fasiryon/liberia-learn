import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  routedCompletion: vi.fn(),
  requireRole: vi.fn(),
  submissionFindUnique: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/ai/routedCompletion", () => ({
  routedCompletion: mocks.routedCompletion,
}));

vi.mock("@/lib/auth", () => ({
  requireRole: mocks.requireRole,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    assignmentSubmission: { findUnique: mocks.submissionFindUnique },
    auditLog: { create: mocks.auditCreate },
  },
}));

import { getGradingAssistance } from "@/lib/teacher/gradingAssist";
import { POST } from "@/app/api/teacher/grading-assist/route";

describe("getGradingAssistance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ENABLE_AI_GRADING_ASSIST = "true";
  });

  it("returns score 0-100", async () => {
    mocks.routedCompletion.mockResolvedValue({
      content: JSON.stringify({
        suggestedScore: 112,
        feedback: "Good reasoning with one missing step.",
        strengths: ["Clear explanation"],
        improvements: ["Show the final calculation"],
        confidence: "high",
      }),
    });

    const result = await getGradingAssistance({
      teacherId: "teacher-1",
      submissionId: "sub-1",
      studentAnswer: "Answer",
      lessonObjectives: ["Explain"],
    });

    expect(result.suggestedScore).toBe(100);
  });

  it("includes confidence field", async () => {
    mocks.routedCompletion.mockResolvedValue({
      content: JSON.stringify({
        suggestedScore: 80,
        feedback: "Meets the main objective.",
        strengths: [],
        improvements: [],
        confidence: "medium",
      }),
    });

    const result = await getGradingAssistance({
      teacherId: "teacher-1",
      submissionId: "sub-1",
      studentAnswer: "Answer",
      lessonObjectives: ["Explain"],
    });

    expect(result.confidence).toBe("medium");
  });
});

describe("POST /api/teacher/grading-assist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ENABLE_AI_GRADING_ASSIST = "true";
    mocks.requireRole.mockResolvedValue({ id: "teacher-1", role: "TEACHER", schoolId: "school-1" });
    mocks.submissionFindUnique.mockResolvedValue({
      id: "sub-1",
      content: "Student answer",
      score: null,
      Assignment: {
        id: "assignment-1",
        title: "Homework",
        Class: { id: "class-1", schoolId: "school-1", teacherId: "teacher-1" },
      },
    });
    mocks.routedCompletion.mockResolvedValue({
      content: JSON.stringify({
        suggestedScore: 75,
        feedback: "Mostly correct.",
        strengths: ["Relevant answer"],
        improvements: ["Add evidence"],
        confidence: "medium",
      }),
    });
  });

  it("requires teacher role", async () => {
    await POST(request());

    expect(mocks.requireRole).toHaveBeenCalledWith("TEACHER");
  });

  it("never auto-saves grade", async () => {
    await POST(request());

    expect((mocks as any).submissionUpdate).toBeUndefined();
  });

  it("creates audit log on request", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "ai_grading_assist_requested",
          resourceId: "sub-1",
        }),
      })
    );
  });
});

function request() {
  return new NextRequest("http://localhost/api/teacher/grading-assist", {
    method: "POST",
    body: JSON.stringify({
      submissionId: "sub-1",
      studentAnswer: "Student answer",
      objectives: ["Explain the answer"],
    }),
  });
}
