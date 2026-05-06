import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  classFindFirst: vi.fn(),
  curriculumFindMany: vi.fn(),
  routedCompletion: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    class: { findFirst: mocks.classFindFirst },
    curriculumContent: { findMany: mocks.curriculumFindMany },
  },
}));

vi.mock("@/lib/ai/routedCompletion", () => ({
  routedCompletion: mocks.routedCompletion,
}));

import { generateLessonPlan } from "@/lib/teacher/lessonPlanner";

describe("generateLessonPlan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.classFindFirst.mockResolvedValue({
      id: "class-1",
      schoolId: "school-1",
      teacherId: "teacher-1",
      name: "Grade 5 Math",
    });
  });

  it("returns 5 days", async () => {
    mocks.curriculumFindMany.mockResolvedValue([lesson("content-1", "Fractions")]);
    mocks.routedCompletion.mockResolvedValue({
      content: JSON.stringify({
        weekTitle: "Fractions week",
        days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((day) => ({
          day,
          lessonTitle: "Fractions",
          contentId: "content-1",
          objectives: ["Compare fractions"],
          suggestedActivities: ["Use market examples"],
          estimatedMinutes: 45,
        })),
        teacherNotes: "Check understanding daily.",
      }),
      inputTokens: 1,
      outputTokens: 1,
      estimatedCostUSD: 0,
      tier: "smart",
      model: "test",
    });

    const plan = await generateLessonPlan(baseInput());

    expect(plan.days).toHaveLength(5);
  });

  it("links only to real contentIds from DB", async () => {
    mocks.curriculumFindMany.mockResolvedValue([lesson("real-content", "Fractions")]);
    mocks.routedCompletion.mockResolvedValue({
      content: JSON.stringify({
        weekTitle: "Fractions week",
        days: [{ day: "Monday", lessonTitle: "Made up", contentId: "fake-content" }],
        teacherNotes: "Check IDs.",
      }),
      inputTokens: 1,
      outputTokens: 1,
      estimatedCostUSD: 0,
      tier: "smart",
      model: "test",
    });

    const plan = await generateLessonPlan(baseInput());

    expect(plan.days[0].contentId).toBe("real-content");
  });

  it("fails gracefully when no lessons exist", async () => {
    mocks.curriculumFindMany.mockResolvedValue([]);

    const plan = await generateLessonPlan(baseInput());

    expect(plan.days).toHaveLength(5);
    expect(plan.days.every((day) => day.contentId === null)).toBe(true);
    expect(plan.teacherNotes).toContain("No approved lessons");
  });

  it("scopes planning to the teacher's own classes", async () => {
    mocks.classFindFirst.mockResolvedValue(null);

    await expect(generateLessonPlan(baseInput())).rejects.toThrow("Class not found");
    expect(mocks.classFindFirst).toHaveBeenCalledWith({
      where: { id: "class-1", teacherId: "teacher-1" },
      select: { id: true, schoolId: true, teacherId: true, name: true },
    });
  });
});

function baseInput() {
  return {
    teacherId: "teacher-1",
    classId: "class-1",
    subject: "MATH",
    gradeLevel: 5,
    weekStartDate: "2026-05-04",
  };
}

function lesson(contentId: string, title: string) {
  return {
    contentId,
    title,
    payload: { title, learningObjectives: ["Compare fractions"] },
  };
}
