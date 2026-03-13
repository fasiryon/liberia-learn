import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUnitFindMany = vi.hoisted(() => vi.fn());
const mockCurriculumFindMany = vi.hoisted(() => vi.fn());
const mockSchoolFindUnique = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    school: { findUnique: mockSchoolFindUnique },
    curriculumUnit: { findMany: mockUnitFindMany },
    curriculumContent: { findMany: mockCurriculumFindMany },
  },
}));

import { compileTextbook } from "@/lib/ai/textbook/textbookCompiler";

beforeEach(() => {
  vi.clearAllMocks();
  mockSchoolFindUnique.mockResolvedValue({ name: "Monrovia Demonstration School" });
});

describe("compileTextbook", () => {
  it("returns the correct structure when units and lessons exist", async () => {
    mockUnitFindMany.mockResolvedValue([
      {
        id: "db-1",
        unitId: "unit-1",
        name: "Fractions",
        description: "Build fraction understanding.",
        subject: "MATH",
        grade: 5,
        weekStart: 1,
      },
      {
        id: "db-2",
        unitId: "unit-2",
        name: "Decimals",
        description: "Connect decimals to money and measurement.",
        subject: "MATH",
        grade: 5,
        weekStart: 3,
      },
    ]);
    mockCurriculumFindMany.mockResolvedValue([
      {
        id: "lesson-1",
        contentId: "lesson-1",
        unitId: "unit-1",
        orderInUnit: 1,
        lessonType: "intro",
        payload: {
          title: "Intro to Fractions",
          body: "Fractions describe parts of a whole.",
          assessmentQuestions: ["What is a fraction?"],
          answerKey: ["A fraction names equal parts of a whole."],
        },
      },
      {
        id: "lesson-2",
        contentId: "lesson-2",
        unitId: "unit-2",
        orderInUnit: 1,
        lessonType: "intro",
        payload: {
          title: "Intro to Decimals",
          body: "Decimals help us record money and measurements.",
        },
      },
    ]);

    const result = await compileTextbook({
      subject: "MATH",
      gradeLevel: 5,
      schoolId: "school-1",
    });

    expect(result.subject).toBe("MATH");
    expect(result.gradeLevel).toBe(5);
    expect(result.schoolName).toBe("Monrovia Demonstration School");
    expect(result.units).toHaveLength(2);
    expect(result.totalLessons).toBe(2);
    expect(result.units[0].lessons[0].title).toBe("Intro to Fractions");
  });

  it("returns an empty units array gracefully when no units exist", async () => {
    mockUnitFindMany.mockResolvedValue([]);
    mockCurriculumFindMany.mockResolvedValue([]);

    const result = await compileTextbook({
      subject: "SCIENCE",
      gradeLevel: 6,
    });

    expect(result.units).toEqual([]);
    expect(result.totalLessons).toBe(0);
    expect(result.title).toContain("SCIENCE");
    expect(result.schoolName).toBe("Ministry of Education, Liberia");
  });
});
