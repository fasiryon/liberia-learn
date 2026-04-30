import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUnitFindMany = vi.hoisted(() => vi.fn());
const mockCurriculumFindMany = vi.hoisted(() => vi.fn());
const mockCurriculumCount = vi.hoisted(() => vi.fn());
const mockSchoolFindUnique = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    school: { findUnique: mockSchoolFindUnique },
    curriculumUnit: { findMany: mockUnitFindMany },
    curriculumContent: { findMany: mockCurriculumFindMany, count: mockCurriculumCount },
  },
}));

import { compileTextbook, estimateTextbookSize } from "@/lib/ai/textbook/textbookCompiler";

beforeEach(() => {
  vi.clearAllMocks();
  mockSchoolFindUnique.mockResolvedValue({ name: "Monrovia Demonstration School" });
  mockCurriculumCount.mockResolvedValue(0);
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
    mockCurriculumCount.mockResolvedValue(2);
    mockCurriculumFindMany
      .mockResolvedValueOnce([
        {
          payload: {
            body: "Fractions describe parts of a whole.",
          },
        },
        {
          payload: {
            body: "Decimals help us record money and measurements.",
          },
        },
      ])
      .mockResolvedValueOnce([
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
      ])
      .mockResolvedValueOnce([
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
    expect(result.estimatedPages).toBeGreaterThan(0);
    expect(mockCurriculumFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ unitId: "unit-1" }),
    }));
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

  it("estimates textbook size without loading all lessons at once", async () => {
    mockUnitFindMany.mockResolvedValue([
      {
        id: "db-1",
        unitId: "unit-1",
        name: "Reading",
        description: null,
        subject: "ENGLISH",
        grade: 4,
        weekStart: 1,
        weekEnd: 2,
      },
    ]);
    mockCurriculumCount.mockResolvedValue(125);
    mockCurriculumFindMany
      .mockResolvedValueOnce(Array.from({ length: 100 }, () => ({ payload: { body: "word ".repeat(400) } })))
      .mockResolvedValueOnce(Array.from({ length: 25 }, () => ({ payload: { body: "word ".repeat(400) } })));

    const estimate = await estimateTextbookSize({ grade: 4, subject: "english" });

    expect(estimate.lessonCount).toBe(125);
    expect(estimate.estimatedPages).toBe(125);
    expect(estimate.estimatedPdfSizeBytes).toBe(6_250_000);
    expect(mockCurriculumFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100, skip: 0 }));
    expect(mockCurriculumFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100, skip: 100 }));
  });

  it("renders incrementally by appending sections as each unit is processed", async () => {
    mockUnitFindMany.mockResolvedValue([
      {
        id: "db-1",
        unitId: "unit-1",
        name: "Large Unit",
        description: "A large simulated unit.",
        subject: "SCIENCE",
        grade: 8,
        weekStart: 1,
        weekEnd: 2,
      },
    ]);
    mockCurriculumCount.mockResolvedValue(3);
    mockCurriculumFindMany
      .mockResolvedValueOnce(Array.from({ length: 3 }, () => ({ payload: { body: "word ".repeat(400) } })))
      .mockResolvedValueOnce(
        Array.from({ length: 3 }, (_, index) => ({
          id: `lesson-${index + 1}`,
          contentId: `lesson-${index + 1}`,
          unitId: "unit-1",
          orderInUnit: index + 1,
          lessonType: "lesson",
          payload: { title: `Lesson ${index + 1}`, body: "A compact lesson body." },
        }))
      );
    const sections: string[] = [];

    const result = await compileTextbook({
      subject: "science",
      gradeLevel: 8,
      onSection: (section) => {
        sections.push(section.type);
      },
    });

    expect(result.totalLessons).toBe(3);
    expect(sections).toEqual(["cover", "unit", "lesson", "lesson", "lesson", "summary"]);
  });

  it("throws a clear memory guard error when the lesson count exceeds the safe limit", async () => {
    mockUnitFindMany.mockResolvedValue([
      {
        id: "db-1",
        unitId: "unit-1",
        name: "Oversized",
        description: null,
        subject: "MATH",
        grade: 12,
        weekStart: 1,
        weekEnd: 40,
      },
    ]);
    mockCurriculumCount.mockResolvedValue(501);
    mockCurriculumFindMany.mockResolvedValueOnce([{ payload: { body: "word ".repeat(400) } }]);

    await expect(
      compileTextbook({ subject: "math", gradeLevel: 12, maxLessonsPerCompile: 500 })
    ).rejects.toThrow("Textbook exceeds safe compile size");
  });
});
