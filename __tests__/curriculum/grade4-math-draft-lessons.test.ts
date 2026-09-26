import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { GRADE4_MATH_DRAFT_LESSONS } from "@/lib/curriculum/authority/grade4Math";
import { GRADE4_FRACTIONS_LESSON } from "@/lib/curriculum/authority/grade4FractionsLesson";
import type { StructuredCurriculumItem } from "@/lib/learning-authority/structuredCurriculumAuthority";

const structured = JSON.parse(fs.readFileSync("curriculum/structured/moe-structured-v1.json", "utf8")) as { items: StructuredCurriculumItem[] };
const g4Objectives = structured.items.filter((item) => item.grade === 4 && item.subject === "MATH" && item.kind === "OBJECTIVE");
const FOUNDER_OBJECTIVE = "moe-math-g4-s1-p3-number-theory-and-fraction-obj4";

describe("Grade 4 Math draft lessons", () => {
  it("covers every MOE objective exactly once, except the one bound to the founder-reviewed lesson", () => {
    expect(GRADE4_MATH_DRAFT_LESSONS).toHaveLength(43);
    const covered = GRADE4_MATH_DRAFT_LESSONS.map((lesson) => lesson.moeObjectiveId).sort();
    const expected = g4Objectives.map((item) => item.id).filter((id) => id !== FOUNDER_OBJECTIVE).sort();
    expect(covered).toEqual(expected);
  });

  it("has unique content ids that never collide with the governed lesson", () => {
    const ids = GRADE4_MATH_DRAFT_LESSONS.map((lesson) => lesson.contentId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain(GRADE4_FRACTIONS_LESSON.contentId);
    for (const id of ids) expect(id).toMatch(/^ll-g4-math-[a-z0-9-]+-2026\.1$/);
  });

  it("stays draft authority and never claims MOE approval", () => {
    for (const lesson of GRADE4_MATH_DRAFT_LESSONS) {
      expect(lesson.authority.state).toBe("DRAFT_UNREVIEWED");
      expect(lesson.authority.moeApprovalState).toBe("NOT_CLAIMED");
      expect(lesson.version).toBe("0.1.0");
      expect(JSON.stringify(lesson.payload)).not.toMatch(/moe[- ]approved|approved by the (moe|ministry)/i);
    }
  });

  it("gives every lesson all component types with well-formed items", () => {
    for (const lesson of GRADE4_MATH_DRAFT_LESSONS) {
      const { payload } = lesson;
      expect(payload.body.length, lesson.contentId).toBeGreaterThan(300);
      expect(payload.objectives.length).toBeGreaterThanOrEqual(2);
      expect(payload.activities.length).toBeGreaterThanOrEqual(3);
      expect(payload.practice.length).toBeGreaterThanOrEqual(4);
      expect(payload.homework.length).toBeGreaterThanOrEqual(3);
      expect(payload.quiz.length).toBeGreaterThanOrEqual(3);
      expect(payload.offline.trim()).not.toBe("");
      expect(payload.teacherNotes.trim()).not.toBe("");
      for (const item of [...payload.quiz, payload.diagnosticCheck, payload.assessment]) {
        expect(item.options, `${lesson.contentId}: ${item.prompt}`).toContain(item.answer);
        expect(new Set(item.options).size, `${lesson.contentId}: ${item.prompt}`).toBe(item.options.length);
        expect(item.options.length).toBe(4);
      }
      for (const problem of [...payload.practice, ...payload.homework]) {
        expect(problem.prompt.trim()).not.toBe("");
        expect(problem.answer.trim()).not.toBe("");
      }
    }
  });

  it("labels every price or statistic in a prompt as example data", () => {
    for (const lesson of GRADE4_MATH_DRAFT_LESSONS) {
      const prompts = [
        ...lesson.payload.practice.map((x) => x.prompt), ...lesson.payload.homework.map((x) => x.prompt),
        ...lesson.payload.quiz.map((x) => x.prompt), lesson.payload.assessment.prompt, ...lesson.payload.activities,
      ];
      for (const prompt of prompts.filter((text) => /L\$\s?\d/.test(text))) {
        expect(prompt, `${lesson.contentId}: ${prompt}`).toMatch(/example|illustrative/i);
      }
    }
  });
});
