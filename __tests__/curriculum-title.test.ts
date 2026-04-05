import { describe, expect, it } from "vitest";
import {
  buildCurriculumDisplayTitle,
  extractCurriculumTitle,
  formatCurriculumSubject,
} from "@/lib/curriculum/title";

describe("curriculum title helpers", () => {
  it("prefers explicit payload titles", () => {
    expect(extractCurriculumTitle({ title: "Fractions in Context" })).toBe(
      "Fractions in Context"
    );
    expect(extractCurriculumTitle({ lessonTitle: "Plant Growth" })).toBe(
      "Plant Growth"
    );
  });

  it("extracts the first markdown heading when title fields are absent", () => {
    expect(
      extractCurriculumTitle({
        body: "Intro text\n# Water Cycle Review\nMore text",
      })
    ).toBe("Water Cycle Review");
  });

  it("builds a friendly fallback when no stored or payload title exists", () => {
    expect(
      buildCurriculumDisplayTitle({
        subject: "COMPUTER_SCIENCE",
        gradeLevel: 5,
      })
    ).toBe("Computer Science Grade 5 Lesson");
  });

  it("formats subject labels for display", () => {
    expect(formatCurriculumSubject("SOCIAL_STUDIES")).toBe("Social Studies");
  });
});
