import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRoutedCompletion = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ai/router", () => ({ routedCompletion: mockRoutedCompletion }));

import { getTeacherClassInsightsResponse } from "@/lib/ai/teacher/classInsights";

import type { TeacherClassPerformance } from "@/lib/reporting/teacherClassPerformance";

const SAMPLE_CLASS = {
  classId: "class-1",
  className: "JSS 1A",
  subject: "MATH",
  studentCount: 32,
  lessonCount: 6,
  lessonCompletionRate: 78,
  averageQuizScore: 64,
  lessonQuizPerformance: [
    {
      lessonKey: "lesson-1",
      lessonTitle: "Fractions",
      averageQuizScore: 42,
      attemptCount: 18,
    },
  ],
  strugglingLesson: {
    lessonKey: "lesson-1",
    lessonTitle: "Fractions",
    averageQuizScore: 42,
    attemptCount: 18,
  },
  topStudents: [],
  bottomStudents: [],
  atRiskStudents: [],
} satisfies TeacherClassPerformance;

describe("teacher class insights service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns validated class insights", async () => {
    mockRoutedCompletion.mockResolvedValue({
      content: JSON.stringify({
        recommendations: [
          "Reteach fraction equivalence with one worked example and a quick oral check.",
          "Keep mixed-ability pairs for guided practice before independent work.",
          "Use one exit question before homework so you catch errors early.",
        ],
        strugglingLesson: "Fractions",
        reteachApproach:
          "Model one fraction problem on the board, then ask the class to explain each step before moving on.",
      }),
      tier: "smart",
      model: "gpt-5",
      inputTokens: 120,
      outputTokens: 90,
      estimatedCostUSD: 0.01,
    });

    const result = await getTeacherClassInsightsResponse(SAMPLE_CLASS);

    expect(result.hadFallback).toBe(false);
    expect(result.recommendations).toHaveLength(3);
    expect(result.strugglingLesson).toBe("Fractions");
  });

  it("falls back when the response is invalid", async () => {
    mockRoutedCompletion.mockResolvedValue({
      content: "not-json",
      tier: "smart",
      model: "gpt-5",
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUSD: 0,
    });

    const result = await getTeacherClassInsightsResponse(SAMPLE_CLASS);

    expect(result.hadFallback).toBe(true);
    expect(result.recommendations).toHaveLength(3);
  });
});
