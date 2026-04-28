import { describe, expect, it } from "vitest";
import {
  buildDeterministicLessonOrder,
  calculateReadiness,
  CURRICULUM_YEAR_TARGETS,
  deriveUnitTheme,
} from "@/lib/curriculum/yearPlan";

const lessons = [
  { contentId: "b", title: "Fractions Basics", grade: 4, subject: "MATH", contentType: "lesson", lessonType: null, payload: {} },
  { contentId: "a", title: "Addition Review", grade: 4, subject: "MATH", contentType: "lesson", lessonType: "review", payload: {} },
  { contentId: "c", title: "Fractions Assessment", grade: 4, subject: "MATH", contentType: "assessment", lessonType: null, payload: { teacherGuide: true } },
];

describe("full-year curriculum planning", () => {
  it("audit detects missing weeks", () => {
    const readiness = calculateReadiness({
      grade: 4,
      subject: "MATH",
      lessons,
      mappedContentIds: new Set(["a", "b"]),
      mappedWeeks: new Set([1, 2]),
      unitCount: 1,
    });

    expect(readiness.missingWeeks).toContain(3);
    expect(readiness.missingWeeks).toHaveLength(CURRICULUM_YEAR_TARGETS.weeksPerGradeSubject - 2);
  });

  it("orders lessons deterministically without duplication", () => {
    const orderedOnce = buildDeterministicLessonOrder(lessons).map((lesson) => lesson.contentId);
    const orderedTwice = buildDeterministicLessonOrder([...lessons].reverse()).map((lesson) => lesson.contentId);

    expect(orderedOnce).toEqual(orderedTwice);
    expect(new Set(orderedOnce).size).toBe(orderedOnce.length);
  });

  it("calculates readiness percentage against annual target", () => {
    const readiness = calculateReadiness({
      grade: 4,
      subject: "MATH",
      lessons,
      mappedContentIds: new Set(["a", "b", "c"]),
      mappedWeeks: new Set([1]),
      unitCount: 1,
    });

    expect(readiness.readinessPct).toBe(Math.round((3 / 180) * 100));
    expect(readiness.classification).toBe("CRITICAL");
  });

  it("derives a stable unit theme from titles", () => {
    expect(deriveUnitTheme(lessons, 1)).toBe("Fractions");
  });
});
