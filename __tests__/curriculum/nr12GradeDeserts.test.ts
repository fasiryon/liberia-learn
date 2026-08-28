import { describe, expect, it } from "vitest";
import {
  NR12_SUBJECTS,
  NR12_TARGET_LESSONS,
  buildNr12GenerationPlan,
  getNr12AuthorityRecords,
  isNr12Cell,
  validateNr12Lesson,
} from "@/lib/curriculum/nr12GradeDeserts";

describe("NR-12 Grade 2 and Grade 9 lesson generation", () => {
  it("builds exactly 15 deterministic lessons for every core subject cell", () => {
    for (const grade of [2, 9]) {
      for (const subject of NR12_SUBJECTS) {
        const first = buildNr12GenerationPlan(grade, subject);
        const second = buildNr12GenerationPlan(grade, subject);

        expect(first).toHaveLength(NR12_TARGET_LESSONS);
        expect(new Set(first.map((lesson) => lesson.contentId)).size).toBe(NR12_TARGET_LESSONS);
        expect(first.map((lesson) => lesson.contentId)).toEqual(second.map((lesson) => lesson.contentId));
        expect(first.map((lesson) => lesson.hash)).toEqual(second.map((lesson) => lesson.hash));
        expect(getNr12AuthorityRecords(grade, subject).length).toBeGreaterThan(0);
      }
    }
  });

  it("rejects non-NR-12 cells instead of silently inventing coverage", () => {
    expect(isNr12Cell(3, "MATH")).toBe(false);
    expect(isNr12Cell(2, "UNKNOWN")).toBe(false);
    expect(buildNr12GenerationPlan(3, "MATH")).toEqual([]);
  });

  it("makes every generated lesson substantive and assessment-ready", () => {
    for (const grade of [2, 9]) {
      for (const subject of NR12_SUBJECTS) {
        for (const lesson of buildNr12GenerationPlan(grade, subject)) {
          const result = validateNr12Lesson(lesson);
          expect(result, `${grade} ${subject} ${lesson.contentId}`).toMatchObject({ passed: true });
          expect(result.wordCount).toBeGreaterThanOrEqual(3500);
          expect(lesson.payload.moeAlignments).not.toEqual([]);
          expect((lesson.payload as any).assessmentPlan.lessonQuiz.items).toHaveLength(5);
          expect(new Set((lesson.payload as any).assessmentPlan.lessonQuiz.items.map((item: any) => item.correctIndex)).size).toBeGreaterThan(1);
          expect((lesson.payload as any).assessmentPlan.unitQuiz.questionCount).toBe(10);
          expect((lesson.payload as any).assessmentPlan.termExam.questionCount).toBe(30);
        }
      }
    }
  });
});
