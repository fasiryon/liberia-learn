import { describe, expect, it } from "vitest";
import {
  getSubjectConceptGraph,
  inferConceptMetadata,
  summarizeConceptGraphs,
  validateSubjectProgression,
} from "@/lib/curriculum/conceptGraph";

describe("curriculum concept graph", () => {
  it("defines progression graphs for core academic subjects", () => {
    const summary = summarizeConceptGraphs();
    const subjects = summary.map((entry) => entry.subject);
    expect(subjects).toContain("MATH");
    expect(subjects).toContain("LITERACY");
    expect(subjects).toContain("SCIENCE");
    expect(getSubjectConceptGraph("MATH").length).toBeGreaterThanOrEqual(8);
  });

  it("infers concept metadata from unit sequencing", () => {
    const firstLesson = inferConceptMetadata({
      subject: "MATH",
      grade: 3,
      unitTitle: "Number Sense and Place Value",
      lessonTitle: "Number Sense and Place Value: Foundations",
      orderInUnit: 1,
    });
    const lastLesson = inferConceptMetadata({
      subject: "MATH",
      grade: 3,
      unitTitle: "Number Sense and Place Value",
      lessonTitle: "Number Sense and Place Value: Assessment and Reflection",
      orderInUnit: 5,
    });

    expect(firstLesson.primaryConcept).toBe("number_sense");
    expect(firstLesson.difficulty).toBe("intro");
    expect(lastLesson.difficulty).toBe("advanced");
    expect(lastLesson.nextConcepts).toContain("operations");
  });

  it("flags difficulty curve violations", () => {
    const violations = validateSubjectProgression({
      subject: "MATH",
      lessons: [
        {
          grade: 2,
          orderInUnit: 1,
          lessonTitle: "Patterns, Algebra, and Functions: Foundations",
          unitTitle: "Patterns, Algebra, and Functions",
          primaryConcept: "patterns_algebra_functions",
          prerequisites: ["operations"],
          nextConcepts: [],
          difficulty: "advanced",
        },
      ],
    });

    expect(violations.some((entry) => entry.includes("difficulty_curve_intro"))).toBe(true);
  });
});
