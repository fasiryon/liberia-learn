import { beforeEach, describe, expect, it, vi } from "vitest";

const mockStudentFindUnique = vi.hoisted(() => vi.fn());
const mockAdaptiveAttemptFindMany = vi.hoisted(() => vi.fn());
const mockMasteryProfileFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    student: { findUnique: mockStudentFindUnique },
    studentAdaptiveAttempt: { findMany: mockAdaptiveAttemptFindMany },
    studentMasteryProfile: { findMany: mockMasteryProfileFindMany },
  },
}));

import { detectMasteryGaps } from "@/lib/adaptive/gapDetector";

beforeEach(() => {
  vi.clearAllMocks();
  mockStudentFindUnique.mockResolvedValue({ currentGrade: 6 });
  mockAdaptiveAttemptFindMany.mockResolvedValue([]);
  mockMasteryProfileFindMany.mockResolvedValue([]);
});

describe("detectMasteryGaps", () => {
  it("returns empty array when student has no assessment history", async () => {
    await expect(detectMasteryGaps("student-1")).resolves.toEqual([]);
  });

  it("identifies gaps where averageScore < 0.70", async () => {
    mockAdaptiveAttemptFindMany.mockResolvedValue([
      {
        strandCode: "fractions",
        subject: "MATH",
        grade: 6,
        score: 0.5,
        completedAt: new Date("2026-03-10T00:00:00.000Z"),
      },
      {
        strandCode: "fractions",
        subject: "MATH",
        grade: 6,
        score: 0.6,
        completedAt: new Date("2026-03-11T00:00:00.000Z"),
      },
    ]);

    const gaps = await detectMasteryGaps("student-1");
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({
      strand: "fractions",
      subject: "MATH",
      averageScore: 0.55,
      attemptCount: 2,
    });
  });

  it("excludes strands where averageScore >= 0.70", async () => {
    mockAdaptiveAttemptFindMany.mockResolvedValue([
      {
        strandCode: "reading_comp",
        subject: "LITERACY",
        grade: 6,
        score: 0.7,
        completedAt: new Date("2026-03-11T00:00:00.000Z"),
      },
    ]);

    await expect(detectMasteryGaps("student-1")).resolves.toEqual([]);
  });

  it("sorts gaps weakest first", async () => {
    mockAdaptiveAttemptFindMany.mockResolvedValue([
      {
        strandCode: "fractions",
        subject: "MATH",
        grade: 6,
        score: 0.6,
        completedAt: new Date("2026-03-11T00:00:00.000Z"),
      },
      {
        strandCode: "grammar",
        subject: "LITERACY",
        grade: 6,
        score: 0.3,
        completedAt: new Date("2026-03-11T00:00:00.000Z"),
      },
    ]);

    const gaps = await detectMasteryGaps("student-1");
    expect(gaps.map((gap) => gap.strand)).toEqual(["grammar", "fractions"]);
  });
});
