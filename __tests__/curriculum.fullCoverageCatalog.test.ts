import { describe, expect, it } from "vitest";
import {
  FULL_COVERAGE_CATALOG,
  listCoverageEntries,
  summarizeCoverageCatalog,
} from "@/lib/curriculum/fullCoverageCatalog";

describe("full coverage catalog", () => {
  it("defines full K12 core coverage at school-year scale", () => {
    const gradeOneCore = listCoverageEntries({ grade: 1 }).filter((entry) => entry.tier === "core");
    const gradeTwelveCore = listCoverageEntries({ grade: 12 }).filter((entry) => entry.tier === "core");

    expect(gradeOneCore).toHaveLength(5);
    expect(gradeTwelveCore).toHaveLength(5);
    for (const entry of gradeOneCore) {
      expect(entry.unitsPerYear).toBe(8);
      expect(entry.lessonsPerUnit).toBe(5);
      expect(entry.totalLessonTarget).toBe(40);
    }
  });

  it("exceeds the original 1500-lesson expansion requirement", () => {
    const summary = summarizeCoverageCatalog();
    expect(FULL_COVERAGE_CATALOG.length).toBeGreaterThan(60);
    expect(summary.totalLessonTarget).toBeGreaterThanOrEqual(1500);
    expect(summary.coreLessonTarget).toBe(2400);
    expect(summary.byGrade["1"]).toBeGreaterThan(150);
    expect(summary.byGrade["12"]).toBeGreaterThan(100);
  });
});
