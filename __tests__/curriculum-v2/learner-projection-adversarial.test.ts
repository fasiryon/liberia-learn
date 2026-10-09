// Codex second-pass P1-2: stored data is adversarial. A key smuggled into any learner-visible
// field, a structure where text belongs, or an answer section in Markdown never reaches a learner;
// malformed native data makes the lesson not student-ready instead of being stringified.
import { beforeAll, describe, expect, it } from "vitest";
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
        masteryTask: `Show 3/4 two ways.\n**Expected Response:**\n${SECRET}\n\nStill part of the answer block.`,
        groupWork: `Discuss with your group.\n${SECTION}`,
      },
    });
    expect(leaks(projected)).toBe(false);
    for (const kept of ["Compare 1/2 and 2/4.", "Draw three strips.", "Write two equivalent fractions.", "Practise at home.", "Build a fraction wall.", "Show 3/4 two ways.", "Discuss with your group."]) {
      expect(JSON.stringify(projected)).toContain(kept);
    }
    expect(projected.activities).toEqual(["Draw three strips.", "Write two equivalent fractions.", "Build a fraction wall."]);
    // A blank line does not end an answer block; only a structural section boundary does.
    expect(JSON.stringify(projected)).not.toContain("Still part of the answer block.");
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
    const projected = projectStudentLessonPayload({ body: `Mixtures.\n\nSolution\n${SECRET}\n\n# Next topic\nNext topic.` });
    expect(leaks(projected)).toBe(false);
    expect(projected.body).toContain("Next topic.");
  });
});

// Codex final merge gate P1-B: whitespace never ends a restricted block. A label-opened answer block runs
// to the next structural section boundary (a Markdown heading, a bold-only section line or a rule).
describe("P1-B final gate: blank lines cannot reopen restricted learner text", () => {
  const BLANK_SECRET = "MERGE_GATE_SECRET";
  const LABELS = ["Expected Answer", "Expected Response", "Answer Key", "Teacher Notes"];
  const FORMS: Array<[string, (label: string) => string]> = [
    ["bare label", (label) => label],
    ["Label:", (label) => `${label}:`],
    ["## heading", (label) => `## ${label}`],
    ["1. numbered", (label) => `1. ${label}`],
    ["- bullet", (label) => `- ${label}`],
  ];
  const GAPS = [1, 2];
  const cases = LABELS.flatMap((label) => FORMS.flatMap(([form, render]) => GAPS.map((gap): [string, string] =>
    [`${render(label).replace(/\s+/g, " ")} [${form}] + ${gap} blank line(s)`, `${render(label)}\n${"\n".repeat(gap)}${BLANK_SECRET}\n\nmore ${BLANK_SECRET}`])));
  const SAFE_BEFORE = "Learn safely.";
  const SAFE_AFTER = "Try it.";
  const withBoundary = (block: string) => `${SAFE_BEFORE}\n${block}\n\n# Practice\n${SAFE_AFTER}`;
  const leaksBlank = (value: unknown) => JSON.stringify(value ?? null).includes(BLANK_SECRET);
  const barGraphs = () => {
    const outcome = runG4Proof("bar-graphs.json", "moe-math-g4-s2-p6-geometry-and-statistics-obj6");
    if (outcome.status === "REJECTED") throw new Error(outcome.errors.join());
    return JSON.parse(JSON.stringify(outcome.lesson)) as any;
  };

  it("Codex's reproduction no longer leaks", () => {
    const projected = projectStudentLessonPayload({ body: `Learn safely.\nExpected Answer\n\n${BLANK_SECRET}\n\n# Practice\nTry it.` });
    expect(leaksBlank(projected)).toBe(false);
    expect(projected.body).toContain("Learn safely.");
    expect(projected.body).toContain("Try it.");
  });

  it.each(cases)("%s: no final learner output leaks; safe text around a real boundary survives", (_name, block) => {
    const text = withBoundary(block);
    // Legacy body, authored activities/classwork, lab instructions in a lesson and a standalone lab.
    const legacy = projectStudentLessonPayload({ body: text });
    const authored = projectStudentLessonPayload({ studentMaterials: { learnerMaterial: "Read.", classwork: [text, "Fold a strip."], independentItems: [text] } });
    const legacyActivities = projectStudentLessonPayload({ body: "Read.", activities: [text, "Fold a strip."] });
    const lessonLab = projectStudentLessonPayload({ body: "Read.", labs: [{ title: "Lab", procedure: [{ instruction: text }] }] });
    const authoredLab = projectStudentLessonPayload({ studentMaterials: { learnerMaterial: "Read.", lab: { title: "Lab", procedure: [{ instruction: text }] } } });
    const standaloneLab = projectStudentLabPayload({ title: "Lab", procedure: [{ instruction: text }], observationForm: [{ field: "f", prompt: text }] });
    for (const projected of [legacy, authored, legacyActivities, lessonLab, authoredLab, standaloneLab]) expect(leaksBlank(projected)).toBe(false);
    expect(legacy.body).toContain(SAFE_BEFORE);
    expect(legacy.body).toContain(SAFE_AFTER);
    expect(legacyActivities.activities).toContain("Fold a strip.");
    expect(JSON.stringify(standaloneLab)).toContain(SAFE_AFTER);

    // Native: scene body, age variant, key point and the compatibility-generated fallback text.
    const nativeCases: Array<(lesson: any) => void> = [
      (l) => { l.scenes[0].content.body = text; },
      (l) => { l.scenes[0].content.ageVariants = { UPPER_PRIMARY: { body: text } }; },
      (l) => { l.scenes[1].content.keyPoints = ["Safe point.", text]; },
    ];
    for (const inject of nativeCases) {
      const lesson = nativeLesson();
      inject(lesson);
      const projected = projectStudentLessonPayload({ curriculumV2: lesson });
      expect(leaksBlank(projected)).toBe(false);
      expect(projected.studentReady).toBe(false);
    }
    // Required media with a text-walkthrough fallback: compat.ts appends the fallback to the body.
    const fallbackLesson = barGraphs();
    fallbackLesson.scenes.find((scene: any) => scene.id === "read-graph").fallback.content = text;
    const fallbackProjected = projectStudentLessonPayload({ curriculumV2: fallbackLesson });
    expect(leaksBlank(fallbackProjected)).toBe(false);
    expect(fallbackProjected.studentReady).toBe(false);
  });

  it("a block with no later boundary stays hidden to the end of the text (fails closed)", () => {
    const projected = projectStudentLessonPayload({ body: `Read.\nExpected Response\n\n\n${BLANK_SECRET}\n\nAnother paragraph ${BLANK_SECRET}\n1. ${BLANK_SECRET}` });
    expect(leaksBlank(projected)).toBe(false);
    expect(projected.body).toBe("Read.");
  });

  it("bold-only section lines and rules are boundaries; numbered answer lists are not", () => {
    const projected = projectStudentLessonPayload({ body: `Read.\n**Expected Answer:**\n\n1. ${BLANK_SECRET}\n2. ${BLANK_SECRET}\n\n**Practice**\nTry it.\n\n---\nWrap up.` });
    expect(leaksBlank(projected)).toBe(false);
    expect(projected.body).toContain("**Practice**");
    expect(projected.body).toContain("Try it.");
    expect(projected.body).toContain("Wrap up.");
  });

  it("keeps ordinary prose and standalone answer options", () => {
    const body = "Check your answer with a partner.\n\nThere is more than one solution.\n\nWrite a short response below.";
    expect(projectStudentLessonPayload({ body }).body).toBe(body);
    const options = ["Compound", "Solution", "Answer", "Response"];
    const projected = projectStudentLessonPayload({ body: "Mixtures.", assessment: [{ question: "Salt water is a ...", options }] }) as any;
    expect(projected.assessment[0].options).toEqual(options);
    // A label with nothing after it but a boundary is ordinary text too.
    expect(projectStudentLessonPayload({ body: "Solution\n\n# Next\nGo on." }).body).toContain("Go on.");
  });

  it("all G4 fixture lessons still project as student-ready (no false positives)", () => {
    for (const [file, objective] of [["equivalent-fractions.json", FRACTIONS], ["bar-graphs.json", "moe-math-g4-s2-p6-geometry-and-statistics-obj6"], ["solid-figures.json", "moe-math-g4-s2-p6-geometry-and-statistics-obj5"]]) {
      const outcome = runG4Proof(file, objective);
      if (outcome.status === "REJECTED") throw new Error(outcome.errors.join());
      expect([file, projectStudentLessonPayload({ curriculumV2: outcome.lesson }).studentReady]).toEqual([file, true]);
    }
  });
});

// Codex final merge gate (cf49fe3b) P1-B: a colon label with inline content ("Expected Answer: X")
// opens the same hidden block as a bare label. Its inline text and every continuation line,
// paragraph and list stay hidden until a structural boundary.
describe("P1-B inline labels: continuation text stays hidden until a structural boundary", () => {
  const INLINE = "INLINE_SECRET";
  const MORE = "CONTINUATION_SECRET";
  const LABELS = ["Expected Answer", "Expected Response", "Answer Key", "Teacher Notes"];
  const FORMS: Array<[string, (label: string) => string]> = [
    ["Label:", (label) => `${label}: ${INLINE}`],
    ["## Label:", (label) => `## ${label}: ${INLINE}`],
    ["1. Label:", (label) => `1. ${label}: ${INLINE}`],
    ["1) Label:", (label) => `1) ${label}: ${INLINE}`],
    ["A. Label:", (label) => `A. ${label}: ${INLINE}`],
    ["- Label:", (label) => `- ${label}: ${INLINE}`],
  ];
  const CONTINUATIONS: Array<[string, string]> = [
    ["wrapped line", `${MORE} wrapped`],
    ["one blank line", `\n${MORE} after one blank`],
    ["multiple blank lines", `\n\n\n${MORE} after blanks`],
    ["multiple paragraphs", `${MORE} one\n\n${MORE} two\n\n${MORE} three`],
    ["numbered answer list", `1. ${MORE} a\n2. ${MORE} b`],
    ["bullet answer list", `- ${MORE} a\n- ${MORE} b`],
    ["paragraphs and a list", `${MORE} reason\n\n1. ${MORE} step\n2. ${MORE} step\n\n${MORE} closing`],
  ];
  const BOUNDARIES: Array<[string, string, string]> = [
    ["Markdown heading", "# Practice", "Try another market problem."],
    ["bold-only heading", "**Practice**", "Try another market problem."],
    ["horizontal rule", "---", "Try another market problem."],
  ];
  const cases = LABELS.flatMap((label) => FORMS.flatMap(([form, render]) => CONTINUATIONS.map(([shape, continuation]): [string, string, string] =>
    [`${label} [${form}] + ${shape}`, render(label), continuation])));
  const leaksInline = (value: unknown) => /INLINE_SECRET|CONTINUATION_SECRET/.test(JSON.stringify(value ?? null));
  let nativeBase: string;
  let barGraphsBase: string;
  const fromBase = (base: string) => JSON.parse(base);

  beforeAll(() => {
    nativeBase = JSON.stringify(nativeLesson());
    const outcome = runG4Proof("bar-graphs.json", "moe-math-g4-s2-p6-geometry-and-statistics-obj6");
    if (outcome.status === "REJECTED") throw new Error(outcome.errors.join());
    barGraphsBase = JSON.stringify(outcome.lesson);
  });

  it("Codex's exact reproduction no longer leaks", () => {
    const projected = projectStudentLessonPayload({ body: "Learn safely.\nExpected Answer: FIRST_SECRET\nWRAPPED_SECRET\n\nSECOND_PARAGRAPH_SECRET\n\n# Practice\nTry it." });
    expect(JSON.stringify(projected)).not.toMatch(/FIRST_SECRET|WRAPPED_SECRET|SECOND_PARAGRAPH_SECRET/);
    expect(projected.body).toContain("Learn safely.");
    expect(projected.body).toContain("# Practice\nTry it.");
  });

  it("the market example keeps only the practice section", () => {
    const body = "Expected Answer: L$200\nBecause 70 + 50 + 100 = 220,\nBoima cannot buy all three.\n\n1. Add the prices.\n2. Compare with 200.\n\n# Practice\nTry another market problem.";
    expect(projectStudentLessonPayload({ body }).body).toBe("# Practice\nTry another market problem.");
  });

  it.each(cases)("%s: every final projection hides the inline and continuation text", (_name, labelLine, continuation) => {
    for (const [, boundary, after] of BOUNDARIES) {
      const text = `Learn safely.\n${labelLine}\n${continuation}\n\n${boundary}\n${after}`;
      const projections = {
        legacyBody: projectStudentLessonPayload({ body: text }),
        legacyActivities: projectStudentLessonPayload({ body: "Read.", activities: [text, "Fold a strip."] }),
        authoredClasswork: projectStudentLessonPayload({ studentMaterials: { learnerMaterial: "Read.", classwork: [text, "Fold a strip."] } }),
        independentItems: projectStudentLessonPayload({ studentMaterials: { learnerMaterial: "Read.", independentItems: [text] } }),
        lessonLab: projectStudentLessonPayload({ body: "Read.", labs: [{ title: "Lab", procedure: [{ instruction: text }] }] }),
        authoredLab: projectStudentLessonPayload({ studentMaterials: { learnerMaterial: "Read.", lab: { title: "Lab", procedure: [{ instruction: text }] } } }),
        standaloneLab: projectStudentLabPayload({ title: "Lab", procedure: [{ instruction: text }] }),
      };
      for (const [path, projected] of Object.entries(projections)) expect([path, boundary, leaksInline(projected)]).toEqual([path, boundary, false]);
      // Safe learner text before the label and after the real boundary survives. A "## Label:" heading
      // opens a Markdown section, which only a heading at the same or a higher level ends; a bold line
      // or rule inside it stays hidden (fails closed).
      expect(projections.legacyBody.body).toContain("Learn safely.");
      expect(projections.legacyActivities.activities).toContain("Fold a strip.");
      if (!labelLine.startsWith("## ") || boundary.startsWith("# ")) {
        expect(projections.legacyBody.body).toContain(after);
        expect(JSON.stringify(projections.standaloneLab)).toContain(after);
      }

      const nativeInjections: Array<[string, (lesson: any) => void]> = [
        ["native scene body", (l) => { l.scenes[0].content.body = text; }],
        ["native age variant", (l) => { l.scenes[0].content.ageVariants = { UPPER_PRIMARY: { body: text } }; }],
        ["native key point", (l) => { l.scenes[1].content.keyPoints = ["Safe point.", text]; }],
      ];
      for (const [path, inject] of nativeInjections) {
        const lesson = fromBase(nativeBase);
        inject(lesson);
        const projected = projectStudentLessonPayload({ curriculumV2: lesson });
        expect([path, boundary, leaksInline(projected), projected.studentReady]).toEqual([path, boundary, false, false]);
      }
      const fallbackLesson = fromBase(barGraphsBase);
      fallbackLesson.scenes.find((scene: any) => scene.id === "read-graph").fallback.content = text;
      const fallbackProjected = projectStudentLessonPayload({ curriculumV2: fallbackLesson });
      expect(["generated fallback", boundary, leaksInline(fallbackProjected), fallbackProjected.studentReady]).toEqual(["generated fallback", boundary, false, false]);
    }
  });

  it("keeps ordinary prose, Expected Value choices and standalone answer options", () => {
    const body = "Check your answer with a partner.\nThe solution can be explained another way.\nThe expected value of a fair die is 3.5.";
    expect(projectStudentLessonPayload({ body }).body).toBe(body);
    const options = ["Solution", "Expected Value", "Answer", "Mean"];
    const projected = projectStudentLessonPayload({ body: "Statistics.", assessment: [{ question: "Which word names the long-run average?", options }] }) as any;
    expect(projected.assessment[0].options).toEqual(options);
  });
});
