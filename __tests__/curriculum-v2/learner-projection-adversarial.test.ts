// Codex second-pass P1-2: stored data is adversarial. A key smuggled into any learner-visible
// field, a structure where text belongs, or an answer section in Markdown never reaches a learner;
// malformed native data makes the lesson not student-ready instead of being stringified.
import { describe, expect, it } from "vitest";
import { projectStudentLessonPayload } from "@/lib/curriculum/studentLessonProjection";
import { toLessonExperience } from "@/lib/curriculum/v2/compat";
import { runG4Proof } from "@/lib/curriculum/v2/g4Proof";
import { assertNoLearnerSecretKeys, LearnerProjectionError, rebuildLearnerExperience } from "@/lib/learner-experience/learnerSafeExperience";
import type { CurriculumLessonV2 } from "@/lib/curriculum/v2/contract";

const SECRET = "S3CRET-KEY";
const FRACTIONS = "moe-math-g4-s1-p3-number-theory-and-fraction-obj5";
const nativeLesson = (): CurriculumLessonV2 & Record<string, any> => {
  const outcome = runG4Proof("equivalent-fractions.json", FRACTIONS);
  if (outcome.status === "REJECTED") throw new Error(outcome.errors.join());
  return JSON.parse(JSON.stringify(outcome.lesson));
};
const experience = () => JSON.parse(JSON.stringify(toLessonExperience(nativeLesson()))) as any;
const leaks = (value: unknown) => JSON.stringify(value ?? null).includes(SECRET);

describe("P1-2 native: the learner experience is rebuilt from primitives", () => {
  const injections: Array<[string, (e: any) => void]> = [
    ["object as lesson title", (e) => { e.title = { answerKey: SECRET }; }],
    ["object as scene title", (e) => { e.scenes[0].title = { answer: SECRET }; }],
    ["object inside keyPoints", (e) => { e.scenes[0].content.keyPoints = ["ok", { answerKey: SECRET }]; }],
    ["object as age-band body", (e) => { e.scenes[0].content.ageVariants = { UPPER_PRIMARY: { body: { solution: SECRET } } }; }],
    ["unknown age band", (e) => { e.scenes[0].content.ageVariants = { TEACHER: { body: SECRET } }; }],
    ["number as grade string", (e) => { e.grade = "4"; }],
    ["unknown authority status", (e) => { e.authority.status = "APPROVED_BY_TEACHER"; }],
    ["unknown interaction kind", (e) => { e.scenes[0].interaction = { kind: "REVEAL_ANSWERS", answers: [SECRET] }; }],
    ["stringified object in body", (e) => { e.scenes[0].content.body = "[object Object]"; }],
  ];

  it.each(injections)("rejects %s", (_name, inject) => {
    const e = experience();
    inject(e);
    expect(() => rebuildLearnerExperience(e)).toThrow(LearnerProjectionError);
  });

  it("drops unknown keys at every level instead of forwarding them", () => {
    const e = experience();
    e.teacherNotes = SECRET;
    e.scenes[0].misconceptionNotes = SECRET;
    e.scenes[0].content.expectedObservation = SECRET;
    e.authority.reviewerComment = SECRET;
    const handoff = e.scenes.find((scene: any) => scene.interaction.kind === "ASSESSMENT_HANDOFF");
    handoff.interaction.assessment.items[0].correctIndex = 2;
    handoff.interaction.assessment.items[0].rationale = SECRET;
    const rebuilt = rebuildLearnerExperience(e);
    expect(leaks(rebuilt)).toBe(false);
    expect(JSON.stringify(rebuilt.scenes.find((scene) => scene.interaction.kind === "ASSESSMENT_HANDOFF"))).not.toContain("correctIndex");
  });

  it("a stored V2 artifact with a structure in a learner field is not student-ready and leaks nothing", () => {
    const lesson = nativeLesson();
    (lesson as any).identity.title = { answerKey: SECRET };
    const projected = projectStudentLessonPayload({ title: "Fractions", curriculumV2: lesson });
    expect(projected.studentReady).toBe(false);
    expect(leaks(projected)).toBe(false);
    const keyPoints = nativeLesson();
    (keyPoints as any).scenes[0].content.keyPoints = [{ expectedAnswer: SECRET }];
    const second = projectStudentLessonPayload({ curriculumV2: keyPoints });
    expect(second.studentReady).toBe(false);
    expect(leaks(second)).toBe(false);
  });

  it("an unmodified native lesson still projects and keeps only formative instant-feedback keys", () => {
    const projected = projectStudentLessonPayload({ curriculumV2: nativeLesson(), answerKey: SECRET, teacherNotes: SECRET });
    expect(projected.studentReady).toBe(true);
    expect(leaks(projected)).toBe(false);
  });
});

describe("P1-2 final secret-key scan", () => {
  it("throws on a secret-named key at any depth or spelling", () => {
    for (const value of [{ a: { answer_key: 1 } }, { a: [{ "Teacher-Notes": 1 }] }, { markScheme: 1 }, { scenes: [{ correctIndex: 1 }] }]) {
      expect(() => assertNoLearnerSecretKeys(value)).toThrow(LearnerProjectionError);
    }
  });

  it("allows correctIndex only on a formative multiple-choice item", () => {
    expect(() => assertNoLearnerSecretKeys({ lessonExperience: { scenes: [{ interaction: { items: [{ correctIndex: 0 }] } }] } })).not.toThrow();
    expect(() => assertNoLearnerSecretKeys({ lessonExperience: { scenes: [{ interaction: { assessment: { items: [{ correctIndex: 0 }] } } }] } })).toThrow();
  });
});

describe("P1-2 legacy: scalars and Markdown answer sections", () => {
  it("never forwards a structure under title, grade, subject or lessonFormat", () => {
    const projected = projectStudentLessonPayload({
      title: { answerKey: SECRET }, grade: { solution: SECRET }, subject: [SECRET], lessonFormat: { rubric: SECRET }, body: "## Learn\n\nHalves.",
    });
    expect(leaks(projected)).toBe(false);
    expect(projected.title).toBeUndefined();
    expect(projected.body).toContain("Halves.");
    expect(projectStudentLessonPayload({ title: "Halves", grade: 4, body: "x" })).toMatchObject({ title: "Halves", grade: 4 });
  });

  it("removes answer headings and answer labels in any spelling, and keeps learner headings that use the words", () => {
    const body = [
      "# Fractions", "Learn halves.",
      "## Expected Response", `${SECRET} 1`,
      "### 3. Model Answers", `${SECRET} 2`,
      "## **Solution:**", `${SECRET} 3`,
      "## Practice", "Try 1/2 + 1/4.",
      `**Answer:** ${SECRET} 4`,
      "**Expected Response:**", `${SECRET} 5`, "",
      "- Answer: " + `${SECRET} 6`,
      "## Answer the questions below", "What is 1/2 of 8?",
      "## Solutions to pollution", "Plant trees.",
    ].join("\n");
    const projected = projectStudentLessonPayload({ body });
    expect(leaks(projected)).toBe(false);
    for (const kept of ["Learn halves.", "Try 1/2 + 1/4.", "What is 1/2 of 8?", "Plant trees."]) expect(projected.body).toContain(kept);
  });

  it("filters authored learner material through the same answer-section rule", () => {
    const projected = projectStudentLessonPayload({
      studentMaterials: { learnerMaterial: `## Read\n\nFractions name parts.\n\n## Answer Key\n\n${SECRET}` },
    });
    expect(leaks(projected)).toBe(false);
    expect(projected.body).toContain("Fractions name parts.");
  });
});
