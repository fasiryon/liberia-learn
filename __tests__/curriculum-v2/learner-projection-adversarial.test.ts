// Codex second-pass P1-2: stored data is adversarial. A key smuggled into any learner-visible
// field, a structure where text belongs, or an answer section in Markdown never reaches a learner;
// malformed native data makes the lesson not student-ready instead of being stringified.
import { describe, expect, it } from "vitest";
import { projectStudentLabPayload, projectStudentLessonPayload } from "@/lib/curriculum/studentLessonProjection";
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

// Codex merge gate (third pass) P1-B: answer/teacher sections hidden in any learner-visible text
// field or collection — not only top-level legacy bodies — never reach a learner.
describe("P1-B third pass: restricted sections in every learner text field", () => {
  const SECTION = `## Expected Response\n${SECRET}`;
  const nativeInjections: Array<[string, (lesson: any) => void]> = [
    ["scene body", (l) => { l.scenes[0].content.body = `Safe text.\n${SECTION}`; }],
    ["scene body answer label", (l) => { l.scenes[0].content.body = `Safe text.\n**Expected Answer:** ${SECRET}`; }],
    ["key point", (l) => { l.scenes[1].content.keyPoints = ["Safe point.", `Answer: ${SECRET}`]; }],
    ["age-variant body", (l) => { l.scenes[0].content.ageVariants = { UPPER_PRIMARY: { body: `Safe.\n${SECTION}` } }; }],
    ["age-variant key point", (l) => { l.scenes[0].content.ageVariants = { EARLY_PRIMARY: { body: "Safe.", keyPoints: [`### Teacher notes\n${SECRET}`] } }; }],
    ["diagram step", (l) => { const scene = l.scenes.find((s: any) => s.interaction.kind === "DIAGRAM_REVEAL"); scene.interaction.steps[0].description = `Fold.\n${SECTION}`; }],
    ["scene fallback", (l) => { const scene = l.scenes.find((s: any) => s.fallback); if (scene) scene.fallback.content = `Draw it.\n${SECTION}`; else l.scenes[0].offline.note = `Text.\n${SECTION}`; }],
  ];

  it.each(nativeInjections)("native %s: the lesson is not student-ready and nothing leaks", (_name, inject) => {
    const lesson = nativeLesson();
    inject(lesson);
    const projected = projectStudentLessonPayload({ curriculumV2: lesson });
    expect(leaks(projected)).toBe(false);
    expect(projected.studentReady).toBe(false);
  });

  it("native rebuild rejects restricted text in prompts and feedback", () => {
    const e = experience();
    const choice = e.scenes.find((scene: any) => scene.interaction.kind === "MULTIPLE_CHOICE");
    choice.interaction.items[0].feedback.correct = `Yes.\n## Answer Key\n${SECRET}`;
    expect(() => rebuildLearnerExperience(e)).toThrow(/restricted_text/);
  });

  it("authored collections are filtered item by item before numbering, keeping safe items", () => {
    const projected = projectStudentLessonPayload({
      studentMaterials: {
        learnerMaterial: "Read about fractions.",
        guidedItems: ["Compare 1/2 and 2/4.", SECTION],
        classwork: [`## Expected Answer\n${SECRET}`, "Draw three strips."],
        independentItems: [`Answer: ${SECRET}`, "Write two equivalent fractions."],
        homework: [`1. ## Model Answers\n${SECRET}`, "Practise at home."],
        project: `Build a fraction wall.\n${SECTION}`,
        masteryTask: `Show 3/4 two ways.\n**Expected Response:**\n${SECRET}\n\nThen explain.`,
        groupWork: `Discuss with your group.\n${SECTION}`,
      },
    });
    expect(leaks(projected)).toBe(false);
    for (const kept of ["Compare 1/2 and 2/4.", "Draw three strips.", "Write two equivalent fractions.", "Practise at home.", "Build a fraction wall.", "Show 3/4 two ways.", "Then explain.", "Discuss with your group."]) {
      expect(JSON.stringify(projected)).toContain(kept);
    }
    expect(projected.activities).toEqual(["Draw three strips.", "Write two equivalent fractions.", "Build a fraction wall."]);
  });

  it("a heading numbered into a list is still recognised", () => {
    const projected = projectStudentLessonPayload({ body: `## Practice\n1. Try 2/4.\n2. ## Expected Answer\n${SECRET}\n## Wrap up\nDone.` });
    expect(leaks(projected)).toBe(false);
    expect(projected.body).toContain("Try 2/4.");
    expect(projected.body).toContain("Done.");
  });

  it("lab text (procedure, observation prompts, analysis questions, safety) is filtered in every lab path", () => {
    const lab = {
      title: "Shadows", labObjective: "Measure shadows.",
      procedure: [{ instruction: `Observe.\n${SECTION}` }, { instruction: "Measure at noon." }],
      observationForm: [{ field: "len", prompt: `Length?\nAnswer: ${SECRET}` }],
      analysisQuestions: [{ question: `Why?\n### Teacher notes\n${SECRET}` }],
      safetyNotes: `Do not look at the sun.\n${SECTION}`,
    };
    const standalone = projectStudentLabPayload(lab);
    const inLesson = projectStudentLessonPayload({ body: "Lesson.", labs: [lab] });
    const authored = projectStudentLessonPayload({ studentMaterials: { learnerMaterial: "Read.", lab } });
    for (const projected of [standalone, inLesson, authored]) expect(leaks(projected)).toBe(false);
    expect(JSON.stringify(standalone)).toContain("Measure at noon.");
    expect(JSON.stringify(standalone)).toContain("Do not look at the sun.");
    expect(authored.body).toContain("Measure at noon.");
  });

  it("legacy objectives, activities, assessment prompts and nested mixed structures are filtered", () => {
    const projected = projectStudentLessonPayload({
      body: "Learn.",
      objectives: ["Compare fractions.", `Answer: ${SECRET}`],
      activities: [`## Solutions\n${SECRET}`, "Fold paper."],
      assessment: [{ question: `Which is bigger?\n${SECTION}`, options: ["1/2", { answer: SECRET }, `Answer: ${SECRET}`], answer: SECRET }],
      pseudoLabs: [{ title: "Fold", steps: [`Fold.\n${SECTION}`, { solution: SECRET }] }],
    });
    expect(leaks(projected)).toBe(false);
    expect(projected.objectives).toEqual(["Compare fractions."]);
    expect(projected.activities).toEqual(["Fold paper."]);
    expect((projected.assessment as any[])[0].question).toBe("Which is bigger?");
  });
});

describe("P1-B third pass: restricted heading and label forms", () => {
  const LABELS = ["Expected Answer", "Expected Response", "Answer", "Answers", "Answer Key", "Correct Answer", "Solution", "Solutions", "Mark Scheme", "Scoring Guide", "Teacher Notes", "Teacher Guide"];
  const FORMS: Array<[string, (label: string) => string]> = [
    ...[1, 2, 3, 4, 5, 6].map((level): [string, (label: string) => string] => [`h${level}`, (label) => `${"#".repeat(level)} ${label}`]),
    ["numbered heading", (label) => `1. ## ${label}`],
    ["1. label", (label) => `1. ${label}`],
    ["1) label", (label) => `1) ${label}`],
    ["A. label", (label) => `A. ${label}`],
    ["- label", (label) => `- ${label}`],
    ["bold label with colon", (label) => `**${label}:**`],
  ];
  const cases = LABELS.flatMap((label) => FORMS.map(([form, render]): [string, string] => [`${form} / ${label}`, render(label)]));

  it.each(cases)("%s removes its section and keeps the surrounding learner text", (_name, line) => {
    // A level-1 heading closes a restricted section at any level (a deeper one would be its subsection).
    const body = `Read the story.\n\n${line}\n${SECRET}\n\n# Practice\nTry it yourself.`;
    for (const projected of [projectStudentLessonPayload({ body }), projectStudentLessonPayload({ activities: [body], body: "x" })]) {
      expect(leaks(projected)).toBe(false);
      expect(JSON.stringify(projected)).toContain("Read the story.");
      expect(JSON.stringify(projected)).toContain("Try it yourself.");
    }
  });

  it("keeps ordinary prose that uses the words answer, solution or teacher", () => {
    const prose = [
      "Answer the questions below in full sentences.",
      "Write your answer in the box.",
      "There is more than one solution to this puzzle.",
      "Ask your teacher if you need help.",
      "## Answer the questions below",
      "## Solutions to pollution",
      "Correct answers earn a star sticker.",
    ];
    const projected = projectStudentLessonPayload({ body: prose.join("\n") });
    for (const line of prose) expect(projected.body).toContain(line);
  });
});

describe("P1-B third pass: legitimate one-word content survives", () => {
  it("keeps a one-word option such as Solution and keeps option positions", () => {
    const projected = projectStudentLessonPayload({
      body: "Mixtures.",
      assessment: [{ question: "Salt dissolved in water is a ...", options: ["Compound", "Solution", "Element", "Answer"] }],
    }) as any;
    expect(JSON.stringify(projected)).toContain('"options":["Compound","Solution","Element","Answer"]');
  });

  it("still hides a bare label line when content follows it", () => {
    const projected = projectStudentLessonPayload({ body: `Mixtures.\n\nSolution\n${SECRET}\n\nNext topic.` });
    expect(leaks(projected)).toBe(false);
    expect(projected.body).toContain("Next topic.");
  });
});
