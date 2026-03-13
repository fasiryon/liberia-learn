import { beforeEach, describe, expect, it, vi } from "vitest";

const mockStandardFindMany = vi.hoisted(() => vi.fn());
const mockCurriculumFindMany = vi.hoisted(() => vi.fn());
const mockCurriculumCreate = vi.hoisted(() => vi.fn());
const mockCurriculumUpdate = vi.hoisted(() => vi.fn());
const mockCurriculumDeleteMany = vi.hoisted(() => vi.fn());
const mockUnitFindFirst = vi.hoisted(() => vi.fn());
const mockUnitCreate = vi.hoisted(() => vi.fn());
const mockUnitDelete = vi.hoisted(() => vi.fn());
const mockRoutedCompletion = vi.hoisted(() => vi.fn());
const mockGenerateAssessmentItems = vi.hoisted(() => vi.fn());
const mockGenerateRubric = vi.hoisted(() => vi.fn());
const mockGenerateMasteryChecks = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    standard: { findMany: mockStandardFindMany },
    curriculumContent: {
      findMany: mockCurriculumFindMany,
      create: mockCurriculumCreate,
      update: mockCurriculumUpdate,
      deleteMany: mockCurriculumDeleteMany,
    },
    curriculumUnit: {
      findFirst: mockUnitFindFirst,
      create: mockUnitCreate,
      delete: mockUnitDelete,
    },
  },
}));

vi.mock("@/lib/ai/router", () => ({
  routedCompletion: mockRoutedCompletion,
}));

vi.mock("@/lib/curriculum-helpers", () => ({
  generateAssessmentItems: mockGenerateAssessmentItems,
  generateRubric: mockGenerateRubric,
  generateMasteryChecks: mockGenerateMasteryChecks,
  slugify: (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
}));

import { assembleUnit } from "@/lib/ai/units/unitAssembler";

const unitRecord = {
  id: "cu-db-1",
  unitId: "unit-1",
  name: "Number Sense",
  description: "Understand place value and operations.",
  subject: "MATH",
  grade: 5,
  schoolId: "school-1",
  targetStandardCodes: ["MATH-5-01"],
  weekStart: 1,
  weekEnd: 2,
  createdById: "admin-1",
  createdAt: new Date("2026-03-12T10:00:00.000Z"),
  updatedAt: new Date("2026-03-12T10:00:00.000Z"),
};

const existingLessons = [
  {
    id: "lesson-intro",
    contentId: "lesson-intro",
    contentType: "lesson",
    status: "APPROVED",
    grade: 5,
    subject: "MATH",
    unitId: null,
    orderInUnit: null,
    lessonType: null,
    payload: {
      title: "Introduction to Number Sense",
      body: "Students explore what numbers mean in daily Liberian contexts.",
      objectives: ["Describe the meaning of place value."],
      activities: ["Talk about prices in the market."],
      assessmentQuestions: ["What digit is in the tens place?"],
    },
  },
  {
    id: "lesson-core-1",
    contentId: "lesson-core-1",
    contentType: "lesson",
    status: "APPROVED",
    grade: 5,
    subject: "MATH",
    unitId: null,
    orderInUnit: null,
    lessonType: null,
    payload: {
      title: "Place Value with Large Numbers",
      body: "Students analyze place value using population and money examples.",
      objectives: ["Read and write large numbers."],
      activities: ["Build numbers with cards."],
      assessmentQuestions: ["What is the value of the 6 in 6,245?"],
    },
  },
  {
    id: "lesson-core-2",
    contentId: "lesson-core-2",
    contentType: "lesson",
    status: "published",
    grade: 5,
    subject: "MATH",
    unitId: null,
    orderInUnit: null,
    lessonType: null,
    payload: {
      title: "Comparing Whole Numbers",
      body: "Students compare quantities using symbols and real examples.",
      objectives: ["Compare numbers correctly."],
      activities: ["Rank school attendance totals."],
      assessmentQuestions: ["Which number is greater?"],
    },
  },
  {
    id: "lesson-assessment",
    contentId: "lesson-assessment",
    contentType: "assessment",
    status: "APPROVED",
    grade: 5,
    subject: "MATH",
    unitId: null,
    orderInUnit: null,
    lessonType: null,
    payload: {
      title: "Number Sense Quiz",
      body: "Assessment content.",
      assessmentQuestions: ["Question 1"],
    },
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockStandardFindMany.mockResolvedValue([
    { code: "MATH-5-01", description: "Use place value to read, write, and compare whole numbers." },
  ]);
  mockCurriculumFindMany.mockResolvedValue(existingLessons);
  mockUnitFindFirst.mockResolvedValue(null);
  mockUnitCreate.mockResolvedValue(unitRecord);
  mockCurriculumUpdate.mockImplementation(async ({ where, data }) => ({
    ...existingLessons.find((lesson) => lesson.id === where.id),
    ...data,
  }));

  let createCount = 0;
  mockCurriculumCreate.mockImplementation(async ({ data }) => {
    createCount += 1;
    return {
      id: `created-${createCount}`,
      ...data,
    };
  });

  mockRoutedCompletion
    .mockResolvedValueOnce({
      content: JSON.stringify({
        introObjective: "Introduce number sense and activate prior knowledge.",
        coreObjectives: [
          "Read and write large numbers using place value.",
          "Compare and order whole numbers correctly.",
          "Use estimation to reason about number size.",
        ],
        practiceFocus: "Practice place value and comparison with increasing difficulty.",
        reviewObjective: "Review the main number sense concepts before the assessment.",
      }),
      model: "gpt-5",
    })
    .mockResolvedValue({
      content: JSON.stringify({
        title: "Generated Lesson",
        objectives: ["Objective 1"],
        body: "This generated lesson body is long enough to satisfy validation for testing purposes in the unit assembler.",
        activities: ["Activity 1"],
        assessmentQuestions: ["Question 1", "Question 2", "Question 3"],
        answerKey: ["Answer 1"],
        estimatedMinutes: 40,
        moeAlignments: ["MATH-5-01"],
      }),
      model: "gpt-5",
    });

  mockGenerateAssessmentItems.mockReturnValue([
    {
      id: "q1",
      question: "What is the value of 6 in 6,245?",
      options: [
        { label: "A", text: "6,000" },
        { label: "B", text: "600" },
      ],
      correctAnswer: "A",
    },
  ]);
  mockGenerateRubric.mockReturnValue({ bands: ["Exceeds", "Meets"] });
  mockGenerateMasteryChecks.mockReturnValue(["Can compare large numbers"]);
});

describe("assembleUnit", () => {
  it("creates a CurriculumUnit record in DB", async () => {
    await assembleUnit({
      subject: "MATH",
      gradeLevel: 5,
      unitTitle: "Number Sense",
      unitDescription: "Understand place value and operations.",
      schoolId: "school-1",
      createdById: "admin-1",
    });

    expect(mockUnitCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Number Sense",
          schoolId: "school-1",
          createdById: "admin-1",
        }),
      })
    );
  });

  it("generates 7 linked lessons and reuses existing lessons before creating missing ones", async () => {
    const result = await assembleUnit({
      subject: "MATH",
      gradeLevel: 5,
      unitTitle: "Number Sense",
      unitDescription: "Understand place value and operations.",
      schoolId: "school-1",
      createdById: "admin-1",
    });

    expect(result.lessons).toHaveLength(7);
    expect(mockCurriculumUpdate).toHaveBeenCalledTimes(4);
    expect(mockCurriculumCreate).toHaveBeenCalledTimes(3);
    expect(result.lessons.every((lesson) => lesson.unitId === "unit-1")).toBe(true);
  });

  it("assigns the correct lessonType sequence across the assembled unit", async () => {
    const result = await assembleUnit({
      subject: "MATH",
      gradeLevel: 5,
      unitTitle: "Number Sense",
      unitDescription: "Understand place value and operations.",
      schoolId: "school-1",
      createdById: "admin-1",
    });

    expect(result.lessons.map((lesson) => lesson.lessonType)).toEqual([
      "intro",
      "core",
      "core",
      "core",
      "practice",
      "review",
      "assessment",
    ]);
  });
});
