import { describe, expect, it } from "vitest";
import {
  NR13_GRADES,
  NR13_SUBJECTS,
  NR13_TARGET_LESSONS,
  buildNr13CoverageMatrix,
  buildNr13GenerationPlan,
  getNr13AuthorityRecords,
  isNr13Cell,
  validateNr13Lesson,
} from "@/lib/curriculum/nr13Grades58";
import { buildCoverageGenerationPlan } from "@/lib/curriculum/generationEngine";
import { isCompleteNr13Batch } from "../../scripts/nr13-grades58";

describe("NR-13 Grade 5-8 authored coverage", () => {
  it("builds 15 deterministic, substantive lessons in every authorized cell", () => {
    const allIds = new Set<string>();
    for (const grade of NR13_GRADES) {
      for (const subject of NR13_SUBJECTS) {
        const first = buildNr13GenerationPlan(grade, subject);
        const second = buildNr13GenerationPlan(grade, subject);
        expect(first).toHaveLength(NR13_TARGET_LESSONS);
        expect(first.map((lesson) => lesson.contentId)).toEqual(second.map((lesson) => lesson.contentId));
        expect(first.map((lesson) => lesson.hash)).toEqual(second.map((lesson) => lesson.hash));
        expect(getNr13AuthorityRecords(grade, subject).length).toBeGreaterThan(0);
        for (const lesson of first) {
          const result = validateNr13Lesson(lesson);
          expect(result, `${grade} ${subject} ${lesson.contentId}`).toMatchObject({ passed: true });
          expect(result.wordCount).toBeGreaterThanOrEqual(3500);
          expect(allIds.has(lesson.contentId)).toBe(false);
          allIds.add(lesson.contentId);
        }
      }
    }
    expect(allIds).toHaveLength(300);
  });

  it("keeps English literacy instruction distinct from Social Studies", () => {
    const english = buildNr13GenerationPlan(7, "ENGLISH")[0].payload as any;
    const social = buildNr13GenerationPlan(7, "SOCIAL_STUDIES")[0].payload as any;
    expect(english.subject).toBe("ENGLISH");
    expect(english.metadata.englishSkillArea).toBeTruthy();
    expect(social.subject).toBe("SOCIAL_STUDIES");
    expect(social.metadata.englishSkillArea).toBeUndefined();
    expect(english.strand).not.toBe(social.strand);
    expect(english.body_standard).toContain("Worked Example 1");
    expect(english.body_standard).toContain("Learner Materials");
    expect(english.body_standard).toContain("Model annotation");
    expect(english.studentMaterials.materialType).toContain("original");
    expect(english.studentMaterials.learnerMaterial).toContain("Gbarnga");
    expect(social.body_standard).toContain("Worked Example 1");
    expect(social.body_standard).toContain("Group Work and Discussion");
    expect(social.studentMaterials.materialType).toContain("evidence packet");
    expect(social.studentMaterials.learnerMaterial).toContain("Map key");
    expect(english.body_standard).not.toContain("read this passage and answer questions");
    expect(social.body_standard).not.toContain("read this passage and answer questions");
  });

  it("builds distinct stage lessons instead of triplicating one body", () => {
    const lessons = buildNr13GenerationPlan(5, "MATH").slice(0, 3);
    expect(lessons.map((lesson) => (lesson.payload as any).lessonStage)).toEqual([
      "Concept build",
      "Guided application",
      "Independent transfer",
    ]);
    expect(new Set(lessons.map((lesson) => lesson.hash)).size).toBe(3);
    expect(new Set(lessons.map((lesson) => (lesson.payload as any).body_standard)).size).toBe(3);
    expect(new Set(lessons.map((lesson) => (lesson.payload as any).objective)).size).toBe(3);
    expect(new Set(lessons.map((lesson) => (lesson.payload as any).studentMaterials.learnerMaterial)).size).toBe(3);
    expect(new Set(lessons.flatMap((lesson) => (lesson.payload as any).studentMaterials.independentItems)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(lessons.flatMap((lesson) => (lesson.payload as any).activities)).size).toBeGreaterThan(16);
    expect((buildNr13GenerationPlan(5, "SCIENCE")[0].payload as any).labs).toHaveLength(1);
  });

  it("creates four unique assessment options with the answer in its declared position", () => {
    for (const lesson of buildNr13GenerationPlan(6, "ENGLISH")) {
      const items = ((lesson.payload as any).assessmentPlan.lessonQuiz.items as Array<any>);
      for (const item of items) {
        expect(item.options).toHaveLength(4);
        expect(new Set(item.options).size).toBe(4);
        expect(item.options[item.correctIndex]).toBe(item.answerKey);
        expect(item.options.filter((option: string) => option === item.answerKey)).toHaveLength(1);
        expect(item.options.join(" ")).not.toContain("This does not match the stated evidence.");
      }
    }
  });

  it("preserves authority traceability and cross-grade bridges", () => {
    for (const subject of NR13_SUBJECTS) {
      const g5 = buildNr13GenerationPlan(5, subject)[0].payload as any;
      const g6 = buildNr13GenerationPlan(6, subject)[0].payload as any;
      const g7 = buildNr13GenerationPlan(7, subject)[0].payload as any;
      const g8 = buildNr13GenerationPlan(8, subject)[0].payload as any;
      expect(g5.authorityTrace.length).toBeGreaterThan(0);
      expect(g5.metadata.authorityCodes).toEqual(g5.moeAlignments);
      expect(g6.prerequisites[0]).toContain("Grade 5");
      expect(g7.prerequisites[0]).toContain("Grade 6");
      expect(g8.prerequisites[0]).toContain("Grade 7");
      expect(g8.nextConcepts[0]).toContain("Grade 9");
    }
  });

  it("routes English through the NR-13 authored engine and rejects out-of-scope cells", () => {
    expect(isNr13Cell(5, "ENGLISH")).toBe(true);
    expect(isNr13Cell(4, "ENGLISH")).toBe(false);
    expect(buildNr13GenerationPlan(4, "ENGLISH")).toEqual([]);
    const records = buildCoverageGenerationPlan({ grade: 8, subject: "english", limit: 15 });
    expect(records).toHaveLength(15);
    expect(records.every((record) => record.subject === "ENGLISH")).toBe(true);
    expect(records.every((record) => (record.payload as any).metadata.nr === "NR-13")).toBe(true);
    expect(records.every((record) => record.version === "nr13-2026.1")).toBe(true);
  });

  it("enforces the governed dry-run completion gate", () => {
    const batch = { grade: 5, subject: "ENGLISH", attempted: 15, passed: 15, failed: 0, items: Array.from({ length: 15 }, () => ({ contentId: "x", outcome: "dry_run" as const })) };
    expect(isCompleteNr13Batch("dry_run", 5, "ENGLISH", batch)).toBe(true);
    expect(isCompleteNr13Batch("dry_run", 5, "ENGLISH", { ...batch, failed: 1 })).toBe(false);
    expect(isCompleteNr13Batch("generate", 5, "ENGLISH", { ...batch, items: Array.from({ length: 14 }, () => ({ contentId: "x", outcome: "saved" as const })) })).toBe(false);
  });

  it("reports a complete authoritative matrix", () => {
    const matrix = buildNr13CoverageMatrix();
    expect(matrix).toHaveLength(20);
    expect(matrix.every((row) => row.lessons === 15 && row.units === 5 && row.practice === "COMPLETE" && row.assessment === "COMPLETE" && row.prerequisite === "COMPLETE" && row.nextConcept === "COMPLETE" && row.authority === "COMPLETE" && row.qualityStatus === "COMPLETE")).toBe(true);
  });
});
import { projectStudentLessonPayload } from "@/lib/curriculum/studentLessonProjection";
it("projects NR-13 learner content without teacher guidance or answer keys", () => {
  const lesson = buildNr13GenerationPlan(5, "ENGLISH")[0];
  const projected = projectStudentLessonPayload(lesson.payload);
  const body = String(projected.body_standard ?? "");
  expect(body).toContain("The school garden committee noticed");
  expect(body).toContain("## Your Independent Work");
  expect(body).not.toContain("## Teacher Explanation");
  expect(body).not.toContain("## Teacher Guidance");
  expect(body).not.toContain("## Answer Guide");
  expect(projected).not.toHaveProperty("studentMaterials");
  expect(projected.assessment).toBeUndefined();
  expect(projected.problemSets).toBeUndefined();
  const rejected = projectStudentLessonPayload({
    title: "Legacy lesson",
    body_standard: "## Teacher Guidance\nAsk the class to discuss the topic.",
  });
  expect(rejected.studentReady).toBe(false);
  expect(rejected.body_standard).toBe("");
});

it("projects standalone lab payloads without teacher notes or answer keys", async () => {
  const { projectStudentLabPayload } = await import("@/lib/curriculum/studentLessonProjection");
  const projected = projectStudentLabPayload({
    title: "Evidence lab",
    teacherSecret: "do not expose",
    procedure: [{ instruction: "Record the observation.", teacherNote: "Teacher prompt" }],
    analysisQuestions: [{ question: "What changed?", expectedAnswer: "The correct answer", scoringRubric: "Teacher rubric" }],
  });
  expect(projected).not.toHaveProperty("teacherSecret");
  expect((projected.procedure as any[])[0]).not.toHaveProperty("teacherNote");
  expect((projected.analysisQuestions as any[])[0]).not.toHaveProperty("expectedAnswer");
  expect((projected.analysisQuestions as any[])[0]).not.toHaveProperty("scoringRubric");
});
