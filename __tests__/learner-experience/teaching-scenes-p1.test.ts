// Student Experience V3 P1: teaching-scene contract, release status from the registry, formative checks and
// the legacy-text presentation helpers (audience, labelled paragraphs, numbers for the place-value tool).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TEACHING_LESSON_CONTRACT_VERSION, requiresInteraction, sceneBlocks, teachingLessonAvailability, validateTeachingLesson, type TeachingLesson } from "@/lib/learner-experience/teaching/contract";
import { DEMO_TEACHING_LESSONS, GRADE7_PLACE_VALUE } from "@/lib/learner-experience/teaching/demoLessons";
import { checkSequence, checkSort, diagnosePlacement, digitCardsFor, moveItem, placementFeedback } from "@/lib/learner-experience/teaching/checks";
import { releasedTeachingAvailability } from "@/lib/learner-experience/teaching/availability";
import { publishedReleases } from "@/lib/learning-authority/publishedReleases";
import { digitsOf } from "@/lib/learner-experience/demo/placeValue";
import { timelinePositions } from "@/components/experience/teaching/TeachingBlocks";
import { labelledParagraph, numbersInBlocks, parseLessonBlocks, sectionAudience, splitLessonSections } from "@/lib/learner-experience/lessonText";
import { enrichGeneratedLesson } from "@/lib/curriculum/generatedLessonEnricher";

const registered = publishedReleases()[0];

describe("teaching-scene contract", () => {
  it("every demo lesson validates and covers four subjects", () => {
    for (const lesson of Object.values(DEMO_TEACHING_LESSONS)) expect(validateTeachingLesson(lesson)).toEqual([]);
    expect(new Set(Object.values(DEMO_TEACHING_LESSONS).map((lesson) => lesson.subject))).toEqual(new Set(["MATHEMATICS", "SCIENCE", "ENGLISH", "SOCIAL_STUDIES"]));
  });

  it("the Grade 7 lesson teaches with chart, ×10, builder, worked steps, digit cards and feedback questions", () => {
    const types = new Set(GRADE7_PLACE_VALUE.scenes.flatMap((scene) => sceneBlocks(scene).map((block) => block.type)));
    for (const type of ["GROUPED_NUMBER", "PLACE_VALUE_CHART", "TEN_TIMES", "NUMBER_BUILDER", "STEP_REVEAL", "DIGIT_CARDS", "CHOICE_CHECK", "CALLOUT"]) expect(types.has(type as never)).toBe(true);
    expect(GRADE7_PLACE_VALUE.scenes.map((scene) => scene.kind)).toEqual(["INTRODUCTION", "LEARN", "EXPLORE", "WORKED_EXAMPLE", "GUIDED_PRACTICE", "PRACTICE", "REVIEW"]);
  });

  it("rejects a check without feedback for every option, an unknown objective and a broken key", () => {
    const base = GRADE7_PLACE_VALUE;
    const practice = base.scenes.find((scene) => scene.id === "practice")!;
    const check = practice.blocks[0] as Extract<TeachingLesson["scenes"][number]["blocks"][number], { type: "CHOICE_CHECK" }>;
    const broken: TeachingLesson = { ...base, scenes: base.scenes.map((scene) => scene.id !== "practice" ? scene : { ...scene, objectiveIds: ["nope"], blocks: [{ ...check, items: [{ ...check.items[0], correctIndex: 9, optionFeedback: undefined }] }] }) };
    const problems = validateTeachingLesson(broken);
    expect(problems).toContain("scene_objective_unknown:practice");
    expect(problems).toContain("item_key_invalid:pv-check:q1");
    expect(problems).toContain("option_feedback_required:pv-check:q1");
  });

  it("only interactive blocks gate Continue", () => {
    const gating = GRADE7_PLACE_VALUE.scenes.flatMap((scene) => sceneBlocks(scene)).filter(requiresInteraction).map((block) => block.type);
    expect(gating.sort()).toEqual(["CHOICE_CHECK", "DIGIT_CARDS", "STEP_REVEAL"]);
  });
});

describe("released versus candidate versus demo comes from the registry, not the lesson's claim", () => {
  const claim = (overrides: Partial<TeachingLesson["authority"]>, lesson: Partial<TeachingLesson> = {}): TeachingLesson => ({ ...GRADE7_PLACE_VALUE, ...lesson, authority: { ...GRADE7_PLACE_VALUE.authority, ...overrides } });

  it("demo fixtures are DEMO and never learner-deliverable", () => {
    for (const lesson of Object.values(DEMO_TEACHING_LESSONS)) {
      const status = releasedTeachingAvailability(lesson);
      expect(status.label).toBe("DEMO");
      expect(status.learnerDeliverable).toBe(false);
    }
  });

  it("a lesson that claims approval without a registered release stays a candidate", () => {
    const status = releasedTeachingAvailability(claim({ status: "APPROVED_RELEASE", releaseId: "grade7-math-release-that-does-not-exist" }));
    expect(status.label).toBe("CANDIDATE");
    expect(status.learnerDeliverable).toBe(false);
  });

  it("a registered release only counts for its own grade and subject", () => {
    expect(registered.grade).toBe(4);
    const wrongGrade = releasedTeachingAvailability(claim({ status: "APPROVED_RELEASE", releaseId: registered.id }));
    expect(wrongGrade.label).toBe("CANDIDATE");
    const matching = releasedTeachingAvailability(claim({ status: "APPROVED_RELEASE", releaseId: registered.id }, { grade: registered.grade }));
    expect(matching.label).toBe("RELEASED");
    expect(matching.learnerDeliverable).toBe(true);
  });

  it("drafts are candidates and a throwing lookup is never treated as released", () => {
    expect(teachingLessonAvailability(claim({ status: "CURRICULUM_V2_DRAFT" }), () => null).label).toBe("CANDIDATE");
    expect(teachingLessonAvailability(claim({ status: "APPROVED_RELEASE", releaseId: "x" }), () => { throw new Error("tampered"); }).label).toBe("CANDIDATE");
  });

  it("the contract version is pinned", () => {
    expect(GRADE7_PLACE_VALUE.contractVersion).toBe(TEACHING_LESSON_CONTRACT_VERSION);
  });

  it("teaching code makes no network or storage call and no evidence/mastery write", () => {
    for (const file of ["lib/learner-experience/teaching/contract.ts", "lib/learner-experience/teaching/checks.ts", "components/experience/teaching/TeachingBlocks.tsx", "components/experience/teaching/TeachingLessonPlayer.tsx"]) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(/fetch\(|localStorage|sessionStorage|indexedDB|\/api\/|mastery\w*\(|evidence\w*\(/);
    }
  });
});

describe("formative checks", () => {
  it("digit cards are exactly the target's own digits", () => {
    expect([...digitCardsFor(5_040_009)].sort()).toEqual([...digitsOf(5_040_009)].sort());
    expect(digitCardsFor(5_040_009)).not.toEqual(digitsOf(5_040_009));
  });

  it("names the misconception behind a placement", () => {
    const target = 5_040_009;
    expect(diagnosePlacement(target, [5, 0, null, 0, 0, 0, 9])).toEqual({ kind: "INCOMPLETE", remaining: 1 });
    expect(diagnosePlacement(target, digitsOf(target))).toEqual({ kind: "CORRECT" });
    expect(diagnosePlacement(target, [...digitsOf(target)].reverse()).kind).toBe("REVERSED");
    expect(diagnosePlacement(target, [5, 4, 0, 0, 0, 0, 9]).kind).toBe("ZEROS_MISPLACED");
    expect(diagnosePlacement(target, [9, 0, 4, 0, 0, 0, 5])).toMatchObject({ kind: "WRONG_PLACE", placeIndex: 0, expected: 5, placed: 9 });
    expect(placementFeedback(target, { kind: "ZEROS_MISPLACED" }).text).toMatch(/zero holds a place/);
    expect(placementFeedback(target, { kind: "WRONG_PLACE", placeIndex: 0, expected: 5, placed: 9 }).text).toMatch(/millions place.*9,000,000.*5,000,000/);
  });

  it("checks sorting and ordering without counting unplaced cards as wrong", () => {
    const cards = [{ id: "a", group: "noun" }, { id: "b", group: "verb" }];
    expect(checkSort(cards, { a: "noun" })).toMatchObject({ allPlaced: false, allCorrect: false });
    expect(checkSort(cards, { a: "noun", b: "verb" })).toMatchObject({ allPlaced: true, allCorrect: true });
    expect(checkSequence(["1", "2", "3"], ["1", "3", "2"])).toEqual({ correct: false, inPlace: 1, firstWrong: 1 });
    expect(checkSequence(["1", "2", "3"], ["1", "2", "3"]).correct).toBe(true);
    expect(moveItem(["a", "b", "c"], 2, 1)).toEqual(["a", "b", "c"]);
    expect(moveItem(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
  });

  it("places timeline events roughly to scale but never on top of each other", () => {
    const positions = timelinePositions([1822, 1847, 1945, 2006]);
    expect(positions[0]).toBe(0);
    expect(positions[3]).toBe(100);
    for (let i = 1; i < positions.length; i++) expect(positions[i] - positions[i - 1]).toBeGreaterThanOrEqual(18);
    expect(positions[2] - positions[1]).toBeGreaterThan(positions[1] - positions[0]);
  });
});

describe("legacy text presentation helpers", () => {
  const generated = enrichGeneratedLesson({ contentId: "t", grade: 7, subject: "MATH", payload: { title: "Number Sense and Place Value", unitTitle: "Number Sense and Place Value", objectives: ["x"] } }).payload;
  const sections = splitLessonSections(parseLessonBlocks(generated.body_standard), "Number Sense and Place Value");

  it("labels sections written for the teacher or the family from their authored headings only", () => {
    const byTitle = Object.fromEntries(sections.map((section) => [section.title, sectionAudience(section.title)]));
    expect(byTitle["Teacher Explanation"]).toBe("TEACHER");
    expect(byTitle["Remediation Support"]).toBe("TEACHER");
    expect(byTitle["Materials and Activity Notes"]).toBe("TEACHER");
    expect(byTitle["Guardian Support"]).toBe("FAMILY");
    expect(byTitle["Objective"]).toBe("LEARNER");
    expect(byTitle["Guided Practice"]).toBe("LEARNER");
    expect(byTitle["Worked Examples or Demonstrations"]).toBe("LEARNER");
  });

  it("splits an authored run-in label without rewording", () => {
    expect(labelledParagraph("Worked Example 1: The teacher solves one problem step by step.")).toEqual({ label: "Worked Example 1", text: "The teacher solves one problem step by step." });
    expect(labelledParagraph("In this lesson we read many big numbers together: this is a sentence, not a label.")).toBeNull();
    expect(labelledParagraph("Note: hi")).toBeNull();
  });

  it("finds large whole numbers written in the lesson, not years, decimals or fractions", () => {
    const blocks = parseLessonBlocks("In 2024 Musu's school collected 2,350,480 Liberian dollars. A road cost 4205316. Prices: 3.14, 12,000.5 and 1/10000. Also 1,742,009 and 2,350,480 again.");
    expect(numbersInBlocks(blocks)).toEqual([2_350_480, 4_205_316, 1_742_009]);
  });
});
