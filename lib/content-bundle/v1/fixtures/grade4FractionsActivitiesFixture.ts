/**
 * SYNTHETIC GOVERNED-CANDIDATE FIXTURE: not curriculum, not a published release, not reviewed,
 * not MOE-approved. Content Factory Wave 3B.
 *
 * The four Grade 4 fractions activity experiences (guided practice, independent practice,
 * classwork, homework) for the first vertical: equal parts and parts of a set. Derived from the
 * merged `grade4FractionsFixture` (left unchanged): same fixture objectives, lesson, unit,
 * assessments and tool policy; new bundle id, new activity item versions and an
 * `extensions.experience` body (activityExperience.ts) on each activity.
 *
 * Alignment refs name REAL repository records this content is a candidate for:
 *   - MOE objective `moe-math-g4-s1-p3-number-theory-and-fraction-obj4` ("Find parts of a set");
 *   - candidate lesson `ll-g4-math-fractions-equal-parts-2026.2@1.2.0` (PENDING_FOUNDER_REVIEW).
 * They are references, not approval: every alignment says UNREVIEWED_CANDIDATE, the bundle binds
 * only `fixture.` objective ids, and governance carries no review, lifecycle or release refs.
 *
 * Bottle caps, stones, mangoes and cassava bread follow the candidate lesson's materials so the
 * activities work with the physical sets that lesson requires.
 */
import { createHash } from "crypto";
import { ACTIVITY_EXPERIENCE_SCHEMA, type ActivityExperienceV1, type ExperienceItem, type FractionVisual, type SetObject } from "../activityExperience";
import type { ActivityDefinition, ContentBundleV1, JsonValue } from "../types";
import { buildGrade4FractionsFixture, G4_FRACTIONS_FIXTURE_IDS } from "./grade4FractionsFixture";

const syntheticSha256 = (label: string) => createHash("sha256").update(`fixture:${label}`, "utf8").digest("hex");
const base = G4_FRACTIONS_FIXTURE_IDS;
const V = "1.1.0-fixture";

export const G4_FRACTIONS_ACTIVITIES_FIXTURE_IDS = {
  ...base,
  bundleId: "fixture.bundle.g4-math-fractions-activities",
  resources: {
    ...base.resources,
    paperStrips: "fixture.resource.g4-math.paper-fraction-strips",
    homeworkSheet: "fixture.resource.g4-math.parts-of-a-set-homework-sheet",
    classworkGuide: "fixture.resource.g4-math.classwork-facilitation-guide",
  },
  alignment: {
    moeObjective: "moe-math-g4-s1-p3-number-theory-and-fraction-obj4",
    candidateLesson: "ll-g4-math-fractions-equal-parts-2026.2@1.2.0",
  },
} as const;

const ids = G4_FRACTIONS_ACTIVITIES_FIXTURE_IDS;
const alignment = { candidateObjectiveRefs: [ids.alignment.moeObjective], candidateLessonRefs: [ids.alignment.candidateLesson], reviewState: "UNREVIEWED_CANDIDATE" as const };

// ─── Picture helpers ─────────────────────────────────────────────────────────────────────────────

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const NOUN: Readonly<Record<SetObject, [string, string]>> = { BOTTLE_CAP: ["bottle cap", "bottle caps"], MANGO: ["mango", "mangoes"], STONE: ["stone", "stones"] };

function set(objects: number, object: SetObject, opts: { marked?: number; groups?: number | null; label?: string } = {}): FractionVisual {
  const marked = opts.marked ?? 0;
  const groups = opts.groups ?? null;
  const [, plural] = NOUN[object];
  const grouping = groups ? ` in ${groups} equal groups of ${objects / groups}` : "";
  const marking = marked > 0 ? `, ${marked} marked` : "";
  return { kind: "SET", objects, object, marked: range(marked), groups, label: opts.label ?? `${objects} ${plural}${grouping}${marking}` };
}

function strip(parts: number, opts: { shaded?: number; widths?: number[]; label?: string } = {}): FractionVisual {
  const shaded = opts.shaded ?? 0;
  return { kind: "STRIP", parts, shaded: range(shaded), widths: opts.widths ?? null, label: opts.label ?? `A strip cut into ${parts} equal parts${shaded > 0 ? `, ${shaded} shaded` : ""}` };
}

const asJson = (experience: ActivityExperienceV1) => experience as unknown as JsonValue;

// ─── 1. Guided practice ──────────────────────────────────────────────────────────────────────────

const guidedItems: ExperienceItem[] = [
  {
    itemKey: "gp-1",
    prompt: "Your turn. The 8 bottle caps are shared into 4 equal groups. Tap the caps to mark 1/4 of the set.",
    task: { kind: "MARK_SET", objects: 8, object: "BOTTLE_CAP", groups: 4, ask: { numerator: 1, denominator: 4 } },
    hints: [
      "Count the whole set first. How many caps are there altogether?",
      "The bottom number is 4, so the set is shared into 4 equal groups. Look at one group.",
      "The top number is 1. Mark every cap in 1 group, and no others.",
    ],
  },
  {
    itemKey: "gp-2",
    prompt: "6 mangoes are shared into 3 equal groups. Tap the mangoes to mark 2/3 of the set.",
    task: { kind: "MARK_SET", objects: 6, object: "MANGO", groups: 3, ask: { numerator: 2, denominator: 3 } },
    hints: [
      "The bottom number 3 tells you the set is in 3 equal groups. How many mangoes are in each group?",
      "The top number 2 tells you how many groups to mark.",
      "Mark all the mangoes in 2 of the groups.",
    ],
  },
  {
    itemKey: "gp-3",
    prompt: "Some bottle caps are marked. What fraction of the set is marked? Use the buttons to build your fraction.",
    task: { kind: "NAME_FRACTION", visual: set(5, "BOTTLE_CAP", { marked: 2 }) },
    hints: [
      "The bottom number is the whole set. Count every cap, marked or not.",
      "The top number is the part you are describing. Count only the marked caps.",
    ],
  },
  {
    itemKey: "gp-4",
    prompt: "This cassava bread is cut into 4 equal pieces. Tap the pieces to shade 3/4 of the bread.",
    task: { kind: "SHADE_STRIP", parts: 4, ask: { numerator: 3, denominator: 4 } },
    hints: [
      "The bread is the whole. It is cut into 4 equal pieces, which matches the bottom number.",
      "The top number is 3. Shade 3 of the pieces.",
    ],
  },
];

const guidedExperience: ActivityExperienceV1 = {
  schema: ACTIVITY_EXPERIENCE_SCHEMA,
  profile: "GUIDED_PRACTICE",
  learner: {
    goal: "I can find a fraction of a set by sharing it into equal groups.",
    intro: "First, watch how we find 1/4 of 12 bottle caps, one step at a time. Then you try with help.",
    purposeNote: "This is practice, not a test. Nothing you do here is saved or marked. Use the hints as much as you need.",
    materials: ["Bottle caps or stones, if you have them (optional)"],
    roles: [],
    workedExamples: [
      {
        exampleKey: "we-1",
        title: "Watch: 1/4 of 12 bottle caps",
        prompt: "What is 1/4 of 12 bottle caps?",
        steps: [
          { stepKey: "s1", text: "Count the whole set. There are 12 bottle caps, so the whole is the set of 12.", visual: set(12, "BOTTLE_CAP") },
          { stepKey: "s2", text: "The bottom number is 4. Share the 12 caps into 4 equal groups. Each group has 3 caps.", visual: set(12, "BOTTLE_CAP", { groups: 4 }) },
          { stepKey: "s3", text: "The top number is 1. Take 1 of the 4 groups. Mark its caps.", visual: set(12, "BOTTLE_CAP", { groups: 4, marked: 3 }) },
          { stepKey: "s4", text: "So 1/4 of 12 bottle caps is 3 bottle caps. We say: one-fourth of the set.", visual: set(12, "BOTTLE_CAP", { groups: 4, marked: 3, label: "12 bottle caps in 4 equal groups of 3; 1 group of 3 caps marked" }) },
        ],
      },
    ],
    items: guidedItems,
    selfCheck: [],
    familyNote: null,
    offline: { worksOffline: true, note: "Works without a connection once this page has loaded. Nothing is sent anywhere." },
  },
  teacher: {
    summary: "The teacher models one complete example (1/4 of 12) and learners then build fractions of a set with on-screen hints. Each item is scaffolded with up to three hints that move from counting the whole, to the meaning of the denominator, to the meaning of the numerator.",
    phases: [
      { label: "Model", minutes: 4, text: "Step through the worked example with the class. Ask a learner to say each step back before you click Next." },
      { label: "Guided try", minutes: 8, text: "Learners complete the four items. Circulate. When a learner sees 'Not yet', ask them to open the next hint and say it aloud." },
    ],
    grouping: null,
    materials: [
      { text: "Bottle caps or stones for learners who want to copy the picture with real objects", required: false },
      { text: "A device per learner or per pair, or project the screen and take answers from the class", required: false },
    ],
    lookFors: [
      "Counts the whole set before choosing the bottom number.",
      "Says what the bottom number does: it tells how many equal groups the set is shared into.",
      "Marks whole groups, not single objects scattered across groups.",
    ],
    misconceptions: [
      { sign: "Marks 4 caps for 1/4 of 8 (reads the denominator as a count of objects).", response: "Point to the 4 groups: the 4 tells how many groups, not how many caps. Ask how many caps are in one group." },
      { sign: "Names 2/3 for 2 marked out of 5 (compares marked to unmarked).", response: "Ask: what is the whole set? Count every cap together. The bottom number is the whole set." },
    ],
    differentiation: {
      support: ["Let the learner copy each picture with real bottle caps before tapping.", "Read prompts aloud; the page supports read-aloud."],
      extend: ["Ask: what is 3/4 of the same 12 caps? How do you know without counting one by one?"],
    },
    evidenceNote: "Practice only. Watch and listen during the guided try; nothing on this screen is recorded or used for mastery.",
    alignment,
  },
};

// ─── 2. Independent practice ─────────────────────────────────────────────────────────────────────

const independentExperience: ActivityExperienceV1 = {
  schema: ACTIVITY_EXPERIENCE_SCHEMA,
  profile: "INDEPENDENT_PRACTICE",
  learner: {
    goal: "I can name and make fractions of a set and of a whole on my own.",
    intro: "Six questions to try by yourself. Check each one. If it says 'Not yet', look again and try another way.",
    purposeNote: "This is practice, not a test. Nothing you do here is saved or marked, and it does not change your results.",
    materials: [],
    roles: [],
    workedExamples: [],
    items: [
      { itemKey: "ip-1", prompt: "Some of these mangoes are ripe (marked). What fraction of the mangoes are ripe?", task: { kind: "NAME_FRACTION", visual: set(8, "MANGO", { marked: 3, label: "8 mangoes, 3 ripe mangoes marked" }) }, hints: ["Count all the mangoes for the bottom number."] },
      { itemKey: "ip-2", prompt: "Tap the stones to mark 2/5 of these 10 stones.", task: { kind: "MARK_SET", objects: 10, object: "STONE", groups: null, ask: { numerator: 2, denominator: 5 } }, hints: ["Share the 10 stones into 5 equal groups in your head. How many in each group?"] },
      { itemKey: "ip-3", prompt: "A strip is cut into 8 equal parts. Tap the parts to shade 5/8 of the strip.", task: { kind: "SHADE_STRIP", parts: 8, ask: { numerator: 5, denominator: 8 } }, hints: [] },
      { itemKey: "ip-4", prompt: "Musu cut this cassava bread into 3 pieces. Is each piece one-third of the bread?", task: { kind: "EQUAL_PARTS", visual: strip(3, { widths: [1, 1, 2], label: "A bread cut into 3 pieces; the last piece is twice as long as the others" }) }, hints: ["Thirds must be 3 equal parts. Compare the sizes of the pieces."] },
      { itemKey: "ip-5", prompt: "What fraction of this strip is shaded?", task: { kind: "NAME_FRACTION", visual: strip(6, { shaded: 4 }) }, hints: [] },
      { itemKey: "ip-6", prompt: "Tap the bottle caps to mark 2/3 of these 12 bottle caps.", task: { kind: "MARK_SET", objects: 12, object: "BOTTLE_CAP", groups: null, ask: { numerator: 2, denominator: 3 } }, hints: ["First find 1/3 of 12. Then you need 2 of those groups."] },
    ],
    selfCheck: ["I counted the whole set or the whole strip first.", "I checked that the parts are equal."],
    familyNote: null,
    offline: { worksOffline: true, note: "Works without a connection once this page has loaded. Nothing is sent anywhere." },
  },
  teacher: {
    summary: "Six mixed items with less support: no worked example, at most one hint, and sets without drawn groups, so learners must share the set themselves. It mixes parts of a set, parts of a whole and one equal-parts judgement.",
    phases: [{ label: "Independent work", minutes: 12, text: "Learners work alone. Do not give the steps. Answer questions with a question: 'What is the whole?'" }],
    grouping: null,
    materials: [{ text: "Bottle caps or stones for learners who want to model the set", required: false }],
    lookFors: [
      "Shares a set into equal groups without drawn groups (items 2 and 6).",
      "Rejects unequal pieces as thirds (item 4).",
      "Moves between set and whole models without mixing up the denominator.",
    ],
    misconceptions: [
      { sign: "Marks 5 stones for 2/5 of 10.", response: "Ask them to make the 5 equal groups with real stones first, then mark 2 groups." },
      { sign: "Says unequal pieces are thirds because there are 3 of them.", response: "Fold a paper strip into 3 unequal pieces and compare it with a fair fold." },
    ],
    differentiation: {
      support: ["Allow real objects for items 2 and 6.", "Pair a learner who is stuck with the guided practice again before this."],
      extend: ["Ask the learner to write their own 'mark the set' question for a partner."],
    },
    evidenceNote: "Practice only, distinct from the formative check and unit assessment in this bundle. Results are not stored and do not update mastery.",
    alignment,
  },
};

// ─── 3. Classwork ────────────────────────────────────────────────────────────────────────────────

const classworkExperience: ActivityExperienceV1 = {
  schema: ACTIVITY_EXPERIENCE_SCHEMA,
  profile: "CLASSWORK",
  learner: {
    goal: "I can share a set into equal groups and explain what each number in a fraction tells us.",
    intro: "Work with a partner and a pile of bottle caps. Use the caps for each question, then write your answers in your exercise book.",
    purposeNote: "This is classwork. Your teacher will look at your written work and listen to you explain it.",
    materials: ["12 bottle caps or stones for each pair", "The parts of a set worksheet", "Your exercise book and a pencil"],
    roles: [
      { role: "Sharer", text: "Puts the caps into equal groups and says how many are in each group." },
      { role: "Checker", text: "Checks the groups are really equal and writes the fraction. Swap jobs after every question." },
    ],
    workedExamples: [],
    items: [
      { itemKey: "cw-1", prompt: "Share 9 caps into 3 equal groups. Draw your groups. How many caps are in 1/3 of the set?", task: { kind: "ON_PAPER", visual: set(9, "BOTTLE_CAP", { groups: 3 }) }, hints: [] },
      { itemKey: "cw-2", prompt: "Make a set of 10 caps. Share them into 5 equal groups. Draw the set and circle 2/5 of it.", task: { kind: "ON_PAPER", visual: set(10, "BOTTLE_CAP", { groups: 5 }) }, hints: [] },
      { itemKey: "cw-3", prompt: "Look at the picture. Write the fraction of the stones that are marked.", task: { kind: "ON_PAPER", visual: set(6, "STONE", { marked: 2 }) }, hints: [] },
      { itemKey: "cw-4", prompt: "Kollie says 3/5 of these mangoes are ripe, because 3 are ripe and 5 are not. Is Kollie right? Explain to your partner, then write your answer.", task: { kind: "ON_PAPER", visual: set(8, "MANGO", { marked: 3, label: "8 mangoes, 3 ripe mangoes marked" }) }, hints: [] },
      { itemKey: "cw-5", prompt: "Draw a set of 12 objects. Show 3/4 of the set.", task: { kind: "ON_PAPER", visual: null }, hints: [] },
      { itemKey: "cw-6", prompt: "Tell your partner what the bottom number of 2/6 tells us. Then write one sentence about it.", task: { kind: "ON_PAPER", visual: null }, hints: [] },
    ],
    selfCheck: ["Our groups have the same number of caps.", "We counted the whole set for the bottom number.", "We swapped jobs after every question."],
    familyNote: null,
    offline: { worksOffline: true, note: "Fully offline: real bottle caps, the printed worksheet and exercise books." },
  },
  teacher: {
    summary: "A teacher-led pair activity with real bottle caps. Learners share sets into equal groups, record them on paper and explain a common error (3/5 for 3 out of 8). It produces written work and talk the teacher can observe.",
    phases: [
      { label: "Launch", minutes: 5, text: "With the whole class, share 9 caps into 3 groups at the front. Ask: 'What does the 3 in 1/3 tell us?' Assign Sharer and Checker roles." },
      { label: "Pair work", minutes: 15, text: "Pairs complete questions 1 to 6 with their caps. Partners swap roles after every question. Stop at question 4 with each pair and listen to their explanation." },
      { label: "Share", minutes: 5, text: "Two pairs show question 4. Agree as a class that the bottom number is the whole set of 8, so 3/8 of the mangoes are ripe." },
    ],
    grouping: "Pairs, with Sharer and Checker roles that swap after each question. In large classes, groups of 3 can add a Reporter for the Share phase.",
    materials: [
      { text: "12 bottle caps or stones per pair", required: true },
      { text: "Parts of a set worksheet (one per pair, or copied onto the board)", required: true },
      { text: "Exercise books and pencils", required: true },
    ],
    lookFors: [
      "Groups are equal before a fraction is named.",
      "Question 4: explains that the whole set is 8, so 3/5 compares ripe with not ripe.",
      "Uses the words 'whole set', 'equal groups', 'top number' and 'bottom number' in explanations.",
    ],
    misconceptions: [
      { sign: "Writes 3/5 for question 4.", response: "Ask the pair to count the whole set together. Which number tells us the whole?" },
      { sign: "Unequal groups in questions 1 and 2.", response: "Ask the Checker to count each group aloud." },
      { sign: "Writes 4/3 for three-fourths.", response: "Read it back aloud: 'four-thirds'. Ask which number tells how many groups." },
    ],
    differentiation: {
      support: ["Let pairs who are struggling do questions 1 to 4 only.", "Give pairs who need it a set with drawn group circles."],
      extend: ["Ask pairs to find 2/3 and 3/4 of the same 12 caps and say which is more."],
    },
    evidenceNote: "Formative: written worksheet answers and teacher observation of the pair explanations, scored against the learner-visible criteria. The scoring guide is a teacher-only resource. This preview records nothing.",
    alignment,
  },
};

// ─── 4. Homework ─────────────────────────────────────────────────────────────────────────────────

const homeworkExperience: ActivityExperienceV1 = {
  schema: ACTIVITY_EXPERIENCE_SCHEMA,
  profile: "HOMEWORK",
  learner: {
    goal: "I can show a fraction of a set using things I find at home.",
    intro: "You can do this at home without a phone or the internet. Find 8 small things that are the same kind, like stones, seeds or bottle caps. Write and draw in your exercise book.",
    purposeNote: "This is homework practice. Bring your exercise book to class. Your teacher will go over it with you.",
    materials: ["8 small things at home (stones, seeds or bottle caps)", "Your exercise book and a pencil"],
    roles: [],
    workedExamples: [],
    items: [
      { itemKey: "hw-1", prompt: "Put your 8 things into 4 equal groups. Draw your groups in your exercise book.", task: { kind: "ON_PAPER", visual: set(8, "STONE", { groups: 4 }) }, hints: ["Put one thing in each group, then another, until all 8 are used. Each group must have the same number."] },
      { itemKey: "hw-2", prompt: "Circle 1/4 of your set in your drawing. Write how many things you circled.", task: { kind: "ON_PAPER", visual: null }, hints: ["1/4 means 1 of your 4 equal groups."] },
      { itemKey: "hw-3", prompt: "Draw 6 mangoes. Colour 2 of them. Write the fraction of the mangoes you coloured.", task: { kind: "ON_PAPER", visual: set(6, "MANGO", { label: "6 mangoes to copy and colour" }) }, hints: ["The bottom number is all the mangoes you drew."] },
      { itemKey: "hw-4", prompt: "Draw a rectangle. Divide it into 4 equal parts. Shade 3/4 of it.", task: { kind: "ON_PAPER", visual: strip(4, { label: "A rectangle divided into 4 equal parts, ready to shade" }) }, hints: ["Fold a scrap of paper in half, then in half again, to see 4 equal parts."] },
    ],
    selfCheck: ["I counted the whole set first.", "Each of my groups has the same number of things.", "The bottom number of my fraction is the whole set."],
    familyNote: "For a grown-up at home: your child is learning that a fraction can name part of a set. Ask them to show you 1/4 of their 8 things and explain how they know.",
    offline: { worksOffline: true, note: "No device or internet needed. Everything is done with things at home and an exercise book. The printed sheet has the same questions." },
  },
  teacher: {
    summary: "A short, device-free homework that repeats the core idea with objects found at home. Learner instructions stand alone, with no teacher needed. A self-check and a family note replace live help.",
    phases: [
      { label: "Set", minutes: 2, text: "Before learners leave, show the 8 things idea with stones and read the self-check aloud." },
      { label: "At home", minutes: 15, text: "Learners complete four questions in their exercise books." },
      { label: "Next-day review", minutes: 5, text: "Pairs compare question 3. Collect books from learners whose drawings show unequal groups." },
    ],
    grouping: null,
    materials: [
      { text: "Exercise books", required: true },
      { text: "Printed homework sheet (optional; the questions can be copied from the board)", required: false },
    ],
    lookFors: ["Draws 4 equal groups of 2 for question 1.", "Writes the whole set as the bottom number in question 3.", "Shades parts of a rectangle that are equal in question 4."],
    misconceptions: [{ sign: "Writes 2/4 for 2 coloured out of 6 mangoes (counts uncoloured mangoes).", response: "In review, count all 6 mangoes together and rewrite the fraction." }],
    differentiation: {
      support: ["Learners without 8 objects can draw 8 circles instead."],
      extend: ["Find 3/4 of the same 8 things and draw it."],
    },
    evidenceNote: "Practice only. Written work is reviewed in class the next day; nothing is submitted online and no connection is assumed.",
    alignment,
  },
};

// ─── Bundle ─────────────────────────────────────────────────────────────────────────────────────

function withExperience(activity: ActivityDefinition, patch: Partial<ActivityDefinition>, experience: ActivityExperienceV1): ActivityDefinition {
  return { ...activity, ...patch, identity: { ...activity.identity, itemVersion: V }, extensions: { experience: asJson(experience) } };
}

export function buildGrade4FractionsActivitiesFixture(): ContentBundleV1 {
  const merged = buildGrade4FractionsFixture();
  const byId = (id: string) => merged.activities.find((a) => a.identity.itemId === id)!;
  const r = ids.resources;

  const activities: ActivityDefinition[] = [
    withExperience(byId(ids.guidedPractice), {
      title: "Guided practice: find a fraction of a set",
      objectiveIds: [ids.objectives.equalParts, ids.objectives.partsOfSet],
      instructions: {
        learner: [
          { stepId: "g1", text: "Watch the worked example: 1/4 of 12 bottle caps.", resourceIds: [] },
          { stepId: "g2", text: "Try four questions. Use a hint whenever you need one.", resourceIds: [] },
        ],
        teacher: [
          { stepId: "t1", text: "Model the worked example with the class before learners try on their own.", resourceIds: [r.teacherNote] },
          { stepId: "t2", text: "When a learner sees 'Not yet', ask them to open the next hint and read it aloud.", resourceIds: [] },
        ],
      },
      resourceIds: [r.counters],
      expectedDurationMinutes: 12,
      collaborationMode: "INDIVIDUAL",
      evidenceIntent: { kind: "PRACTICE_ONLY", forms: ["OBSERVATION"] },
    }, guidedExperience),
    withExperience(byId(ids.independentPractice), {
      title: "Independent practice: fractions of a set and a whole",
      objectiveIds: [ids.objectives.partsOfSet, ids.objectives.equalParts],
      instructions: {
        learner: [{ stepId: "i1", text: "Answer six questions on your own. Check each answer and try again if it says 'Not yet'.", resourceIds: [] }],
        teacher: [{ stepId: "t1", text: "Do not give the steps. Ask 'What is the whole?' instead.", resourceIds: [] }],
      },
      expectedDurationMinutes: 12,
      evidenceIntent: { kind: "PRACTICE_ONLY", forms: ["DIGITAL_RESPONSE"] },
    }, independentExperience),
    withExperience(byId(ids.classwork), {
      title: "Classwork: share bottle caps with a partner",
      objectiveIds: [ids.objectives.partsOfSet, ids.objectives.equalParts],
      instructions: {
        learner: [
          { stepId: "c1", text: "Work with a partner. One of you is the Sharer and one is the Checker. Swap after every question.", resourceIds: [r.counters] },
          { stepId: "c2", text: "Answer questions 1 to 6 on the worksheet, in your exercise book.", resourceIds: [r.worksheet] },
        ],
        teacher: [
          { stepId: "t1", text: "Launch with 9 caps in 3 groups at the front of the class, then assign roles.", resourceIds: [r.classworkGuide] },
          { stepId: "t2", text: "Listen to each pair explain question 4. Use the scoring guide after class.", resourceIds: [r.answerKey] },
        ],
      },
      resourceIds: [r.counters, r.worksheet],
      expectedDurationMinutes: 25,
      collaborationMode: "PAIR",
      evidenceIntent: { kind: "FORMATIVE", forms: ["WRITTEN", "OBSERVATION"] },
    }, classworkExperience),
    withExperience(byId(ids.homework), {
      title: "Homework: fractions of a set at home",
      instructions: {
        learner: [{ stepId: "h1", text: "Find 8 small things at home. Answer four questions in your exercise book, then use the self-check.", resourceIds: [r.homeworkSheet] }],
        teacher: [{ stepId: "t1", text: "Read the self-check aloud before learners leave. Review question 3 in pairs the next day.", resourceIds: [] }],
      },
      resourceIds: [r.homeworkSheet],
      expectedDurationMinutes: 15,
      evidenceIntent: { kind: "PRACTICE_ONLY", forms: ["WRITTEN"] },
    }, homeworkExperience),
  ];

  return {
    ...merged,
    identity: { ...merged.identity, bundleId: ids.bundleId, title: "FIXTURE: Grade 4 Mathematics, Fractions activities (governed candidate)" },
    activities,
    resources: [
      ...merged.resources,
      { resourceId: r.paperStrips, resourceVersion: V, kind: "MANIPULATIVE", audience: "LEARNER", title: "Paper fraction strips", locale: "en-LR", assetId: null },
      { resourceId: r.homeworkSheet, resourceVersion: V, kind: "WORKSHEET", audience: "LEARNER", title: "Fractions of a set homework sheet", locale: "en-LR", assetId: "fixture.asset.parts-of-a-set-homework-sheet" },
      { resourceId: r.classworkGuide, resourceVersion: V, kind: "TEACHER_NOTE", audience: "TEACHER", title: "Classwork facilitation guide", locale: "en-LR", assetId: null },
    ],
    offline: {
      ...merged.offline,
      assets: [
        ...merged.offline.assets,
        { assetId: "fixture.asset.parts-of-a-set-homework-sheet", assetVersion: V, sha256: syntheticSha256("homework-sheet"), byteSize: 64_200, mediaType: "application/pdf", audience: "LEARNER" },
      ],
      allowedCapabilities: [...merged.offline.allowedCapabilities, "PRINTABLE_WORKSHEETS"],
    },
    learnerSupport: {
      ...merged.learnerSupport,
      remediation: [...merged.learnerSupport.remediation.map((s) => ({ ...s, resourceIds: [...s.resourceIds, r.paperStrips] }))],
    },
  };
}
