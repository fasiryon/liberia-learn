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
  mockSchoolFindUnique.mockResolvedValue({ name: "Scale Test School" });
});

describe("textbook compiler scale behavior", () => {
  it("estimates lesson count, pages, and PDF size using paged reads", async () => {
    mockUnitFindMany.mockResolvedValue([
      {
        id: "db-1",
        unitId: "unit-1",
        name: "Unit 1",
        description: null,
        subject: "SCIENCE",
        grade: 9,
        weekStart: 1,
        weekEnd: 4,
      },
    ]);
    mockCurriculumCount.mockResolvedValue(150);
    mockCurriculumFindMany
      .mockResolvedValueOnce(Array.from({ length: 100 }, () => ({ payload: { body: "word ".repeat(400) } })))
      .mockResolvedValueOnce(Array.from({ length: 50 }, () => ({ payload: { body: "word ".repeat(400) } })));

    const estimate = await estimateTextbookSize({ subject: "science", grade: 9 });

    expect(estimate).toEqual({
      lessonCount: 150,
      estimatedPages: 150,
      estimatedPdfSizeBytes: 7_500_000,
    });
    expect(mockCurriculumFindMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 100 }));
    expect(mockCurriculumFindMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 100, take: 100 }));
  });

  it("compiles incrementally one unit at a time and appends rendered sections", async () => {
    mockUnitFindMany.mockResolvedValue([
      {
        id: "db-1",
        unitId: "unit-1",
        name: "Unit 1",
        description: "First unit",
        subject: "MATH",
        grade: 7,
        weekStart: 1,
        weekEnd: 2,
      },
      {
        id: "db-2",
        unitId: "unit-2",
        name: "Unit 2",
        description: "Second unit",
        subject: "MATH",
        grade: 7,
        weekStart: 3,
        weekEnd: 4,
      },
    ]);
    mockCurriculumCount.mockResolvedValue(2);
    mockCurriculumFindMany
      .mockResolvedValueOnce([{ payload: { body: "word ".repeat(400) } }, { payload: { body: "word ".repeat(400) } }])
      .mockResolvedValueOnce([
        {
          id: "lesson-1",
          contentId: "lesson-1",
          unitId: "unit-1",
          orderInUnit: 1,
          lessonType: "lesson",
          payload: { title: "Lesson 1", body: "First lesson body." },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "lesson-2",
          contentId: "lesson-2",
          unitId: "unit-2",
          orderInUnit: 1,
          lessonType: "lesson",
          payload: { title: "Lesson 2", body: "Second lesson body." },
        },
      ]);
    const sections: string[] = [];

    const result = await compileTextbook({
      subject: "math",
      gradeLevel: 7,
      onSection: (section) => {
        sections.push(section.type);
      },
    });

    expect(result.totalLessons).toBe(2);
    expect(result.units.map((unit) => unit.unitId)).toEqual(["unit-1", "unit-2"]);
    expect(sections).toEqual(["cover", "unit", "lesson", "unit", "lesson", "summary"]);
    expect(mockCurriculumFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ unitId: "unit-1" }),
    }));
    expect(mockCurriculumFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ unitId: "unit-2" }),
    }));
  });

  it("stops before compiling when the safe lesson limit is exceeded", async () => {
    mockUnitFindMany.mockResolvedValue([
      {
        id: "db-1",
        unitId: "unit-1",
        name: "Oversized Unit",
        description: null,
        subject: "ENGLISH",
        grade: 12,
        weekStart: 1,
        weekEnd: 40,
      },
    ]);
    mockCurriculumCount.mockResolvedValue(501);
    mockCurriculumFindMany.mockResolvedValueOnce([{ payload: { body: "word ".repeat(400) } }]);

    await expect(
      compileTextbook({ subject: "english", gradeLevel: 12, maxLessonsPerCompile: 500 })
    ).rejects.toThrow("Textbook exceeds safe compile size");
  });
});
