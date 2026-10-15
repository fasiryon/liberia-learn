/**
 * Grade 7 Native Curriculum V1 — REVIEWER-ONLY assessment and revision materials.
 *
 * This module holds what must never reach a learner device: candidate exit-ticket items with their
 * keys, the teacher writing rubric, and the instructional revision ledger. Learner-facing code
 * (g7Native.ts, the learner projection, the dev preview) must not import it; a test enforces that.
 *
 * Exit-ticket items use the existing governed item shape (GovernedItem in governedGrade4Math.ts) so a
 * future Grade 7 ontology release can bind them unchanged after qualified review. Until then they are
 * candidates: unreviewed, unreleased, and unscoreable by Assessment Player V2.
 */
import { readFileSync } from "fs";
import path from "path";
import type { GovernedItem } from "@/lib/learning-authority/governedGrade4Math";
import type { PlannedAssessmentTask } from "@/lib/curriculum/excellence/assessmentBlueprint";

export const G7_EXIT_ITEM_VERSION = "candidate-0.1.0" as const;
/** Items revised after the legacy comparison carry their own version, so a reviewer sees exactly which ones changed. */
export const G7_EXIT_ITEM_REVISED_VERSION = "candidate-0.2.0" as const;
/** Items changed by the Curriculum Excellence V1 review (v0.3.0 candidates). */
export const G7_EXIT_ITEM_EXCELLENCE_VERSION = "candidate-0.3.0" as const;

/** Machine-checkable statement of what the keyed option must equal (math only; writing is judged by people). */
export type ExitItemVerification =
  | Readonly<{ kind: "DIGIT_VALUE"; number: string; digit: string }>
  | Readonly<{ kind: "WORD_FORM"; number: number }>
  | Readonly<{ kind: "EXPANDED_FORM"; number: string }>
  | Readonly<{ kind: "ORDER_ASCENDING"; values: readonly string[] }>
  | Readonly<{ kind: "GREATEST"; values: readonly string[] }>;

export type CandidateExitItem = Readonly<{
  item: GovernedItem;
  assessmentRequestId: string;
  objectiveId: string;
  /** Distractor index → the misconception it is designed to catch. */
  distractorMisconceptions: Readonly<Record<number, string>>;
  verification: ExitItemVerification | null;
}>;

const item = (id: string, prompt: string, options: string[], correctIndex: number, hint: string, workedExample: string, version: string = G7_EXIT_ITEM_VERSION): GovernedItem =>
  ({ id, version, context: "PRACTICE", prompt, options, correctIndex, hint, workedExample });

const PV = "g7-pv-exit-ticket";
const PV1 = "ll-g7-math-place-value-read-write";
const PV2 = "ll-g7-math-place-value-digit-value";
const PV3 = "ll-g7-math-place-value-compare";
const ES = "g7-essay-exit-ticket";
const ES1 = "ll-g7-lit-essay-structure";
const ES2 = "ll-g7-lit-argument-build";
const ES3 = "ll-g7-lit-evidence-support";

export const G7_EXIT_ITEMS: Readonly<Record<string, readonly CandidateExitItem[]>> = Object.freeze({
  "math-number-sense-place-value": [
    { assessmentRequestId: PV, objectiveId: PV2, distractorMisconceptions: { 0: "mc-place-shift", 1: "mc-place-shift", 3: "mc-place-shift" }, verification: { kind: "DIGIT_VALUE", number: "3462105", digit: "6" },
      item: item("g7-pv-exit-1", "What is the value of the 6 in 3,462,105?", ["600", "6,000", "60,000", "600,000"], 2, "Count the places from the right: ones, tens, hundreds, thousands, ten thousands.", "The 6 is in the ten-thousands place, so it is worth 6 × 10,000 = 60,000.") },
    { assessmentRequestId: PV, objectiveId: PV2, distractorMisconceptions: { 0: "mc-digit-not-value", 1: "mc-place-shift", 2: "mc-place-shift" }, verification: { kind: "DIGIT_VALUE", number: "24.068", digit: "8" },
      item: item("g7-pv-exit-2", "What is the value of the 8 in 24.068?", ["8", "0.8", "0.08", "0.008"], 3, "After the decimal point the places are tenths, hundredths, thousandths.", "The 8 is the third digit after the point, in the thousandths place, so it is worth 0.008.") },
    { assessmentRequestId: PV, objectiveId: PV1, distractorMisconceptions: { 0: "mc-zero-placeholder", 2: "mc-zero-placeholder", 3: "mc-zero-placeholder" }, verification: { kind: "WORD_FORM", number: 7_305_040 },
      item: item("g7-pv-exit-3", "Which number is seven million, three hundred five thousand, forty?", ["7,350,040", "7,305,040", "7,305,400", "730,540"], 1, "Write each period (millions, thousands, ones) as a group of three digits.", "Seven million → 7; three hundred five thousand → 305; forty → 040. Together: 7,305,040.") },
    { assessmentRequestId: PV, objectiveId: PV1, distractorMisconceptions: { 0: "mc-zero-placeholder", 1: "mc-place-shift", 3: "mc-digit-not-value" }, verification: { kind: "EXPANDED_FORM", number: "5.307" },
      item: item("g7-pv-exit-4", "Which shows 5.307 in expanded form?", ["5 + 0.3 + 0.07", "5 + 0.03 + 0.007", "5 + 0.3 + 0.007", "5 + 3 + 7"], 2, "Name the place of each digit after the point.", "5 ones, 3 tenths, 0 hundredths and 7 thousandths: 5 + 0.3 + 0.007.") },
    { assessmentRequestId: PV, objectiveId: PV3, distractorMisconceptions: { 2: "mc-shorter-decimal-bigger", 3: "mc-longer-decimal-bigger" }, verification: { kind: "ORDER_ASCENDING", values: ["0.3", "0.307", "0.37"] },
      item: item("g7-pv-exit-5", "Which list is in order from least to greatest?", ["0.37, 0.307, 0.3", "0.3, 0.307, 0.37", "0.307, 0.37, 0.3", "0.3, 0.37, 0.307"], 1, "Fill empty places with zeros: 0.300, 0.307, 0.370.", "As thousandths: 300, 307, 370. So the order is 0.3, 0.307, 0.37.", G7_EXIT_ITEM_EXCELLENCE_VERSION) },
    { assessmentRequestId: PV, objectiveId: PV3, distractorMisconceptions: { 0: "mc-compare-by-digits" }, verification: { kind: "GREATEST", values: ["6009999", "6010000"] },
      item: item("g7-pv-exit-6", "Which number is greater: 6,009,999 or 6,010,000?", ["6,009,999", "6,010,000", "They are equal"], 1, "Compare from the left until the digits differ.", "Both have 6 millions and 0 hundred thousands. In the ten thousands, 1 is more than 0, so 6,010,000 is greater.") },
  ],
  "literacy-essay-structure-argument": [
    { assessmentRequestId: ES, objectiveId: ES1, distractorMisconceptions: {}, verification: null,
      item: item("g7-essay-exit-1", "In an argumentative essay, where does the thesis statement usually appear?", ["At the end of the introduction", "In the middle of the second body paragraph", "Only in the title", "Only in the conclusion"], 0, "Think about what the reader needs to know before the body paragraphs begin.", "The thesis ends the introduction so the reader knows the claim and reasons before the body paragraphs argue them.") },
    { assessmentRequestId: ES, objectiveId: ES2, distractorMisconceptions: { 0: "mc-topic-not-thesis", 2: "mc-topic-not-thesis", 3: "mc-topic-not-thesis" }, verification: null,
      item: item("g7-essay-exit-2", "Which sentence is an arguable thesis statement?", ["Liberia has fifteen counties.", "Our school should start a debate club because debating builds confidence and clear thinking.", "This essay is about debate clubs.", "Debate clubs."], 1, "Could a sensible person disagree with it?", "Only the debate-club claim can be argued, and it names two reasons. The others are a fact, an announcement and a topic.") },
    { assessmentRequestId: ES, objectiveId: ES3, distractorMisconceptions: { 0: "mc-opinion-as-evidence", 2: "mc-irrelevant-evidence", 3: "mc-opinion-as-evidence" }, verification: null,
      item: item("g7-essay-exit-3", "Reason: reading every day builds vocabulary. Which evidence supports this reason best? (Musu's school is the made-up practice school from the lesson.)", ["Reading is fun.", "Musu's class read for 20 minutes a day for one term, and many learners then used new words from the books in their own writing.", "Books have many pages.", "Everyone should read."], 1, "Which option is specific and proves this exact reason?", "The example from Musu's class is specific and shows vocabulary growing. The others are opinions or unrelated facts. In real writing, the example must come from a real class or a source you can name.", G7_EXIT_ITEM_REVISED_VERSION) },
    { assessmentRequestId: ES, objectiveId: ES1, distractorMisconceptions: { 0: "mc-conclusion-new-idea" }, verification: null,
      item: item("g7-essay-exit-4", "What should the conclusion of an argumentative essay do?", ["Introduce a new reason the reader has not seen", "Restate the thesis in new words and sum up the main reasons", "List the sources only", "Repeat the introduction word for word"], 1, "Remember the three jobs of a conclusion.", "A conclusion restates the thesis in new words, sums up the reasons and ends with a final thought. New reasons belong in the body.") },
    { assessmentRequestId: ES, objectiveId: ES3, distractorMisconceptions: { 3: "mc-explain-restates-evidence" }, verification: null,
      item: item("g7-essay-exit-5", "In a PEEL paragraph, what does the Explain sentence do?", ["It shows how the evidence supports the point", "It starts a new topic", "It gives the essay title", "It repeats the evidence word for word"], 0, "The Explain sentence answers: so what?", "Explain connects the evidence to the point, showing why the evidence proves it.") },
    { assessmentRequestId: ES, objectiveId: ES2, distractorMisconceptions: { 1: "mc-ignore-counterargument", 2: "mc-ignore-counterargument" }, verification: null,
      item: item("g7-essay-exit-6", "Which sentence answers a counterargument?", ["Some people say a debate club takes time from homework, but meetings can be held once a week after classes.", "Debate clubs are great.", "I like debates.", "Many schools have clubs."], 0, "Look for an objection followed by a reply.", "It states an objection (time from homework) and answers it (meet once a week), which is how an essay answers the other side.") },
  ],
});

/** Teacher-facing rubric for the literacy writing practice (formative; teacher judgement, never auto-scored). */
export const G7_WRITING_RUBRIC = Object.freeze({
  lessonKey: "literacy-essay-structure-argument",
  sceneId: "write-argument",
  use: "Candidate rubric, teacher-scored: formative feedback on in-lesson writing, and the proposed scoring guide for the candidate end-of-lesson writing tasks (assessment definitions). Nothing in the platform computes a score or mastery from it; Assessment Player V2 has no constructed-response item type, and it becomes mastery evidence only after qualified review and a governed release.",
  status: "GOVERNED_CANDIDATE",
  criteria: [
    { id: "thesis", label: "Thesis statement", secure: "An arguable claim that names two clear reasons.", developing: "A claim with one reason, or reasons that are vague.", beginning: "A topic, a fact or an announcement instead of a claim." },
    { id: "point", label: "Point (topic sentence)", secure: "States reason one clearly and matches the thesis.", developing: "States a reason that only loosely matches the thesis.", beginning: "No topic sentence, or it repeats the thesis word for word." },
    { id: "evidence", label: "Evidence", secure: "Specific, true and relevant evidence (example, checkable fact or experience).", developing: "Relevant but general evidence.", beginning: "Opinion, an invented figure, or unrelated evidence." },
    { id: "explain-link", label: "Explain and link", secure: "Explains how the evidence proves the point and links back to the claim.", developing: "Explains or links, but not both; or the Explain sentence only restates the evidence.", beginning: "Evidence is left unexplained." },
    { id: "counterargument", label: "Counterargument and reply", secure: "States a fair objection and answers it with a reason.", developing: "States an objection but the reply only repeats the claim.", beginning: "No objection, or an objection left unanswered." },
  ],
} as const);

/** Every instructional decision relative to existing material. The section-by-section legacy comparison is in g7NativeLegacy.ts and awaits reviewer confirmation. */
export type RevisionEntry = Readonly<{ sceneId: string; change: "PRESERVED" | "REVISED" | "NEW"; source: string; rationale: string }>;

export const G7_REVISION_LEDGER: Readonly<Record<string, Readonly<{ legacyComparison: "RECORDED_AWAITING_REVIEWER_SIGNOFF"; titleRevision: Readonly<{ from: string; to: string; rationale: string }>; entries: readonly RevisionEntry[] }>>> = Object.freeze({
  "math-number-sense-place-value": {
    legacyComparison: "RECORDED_AWAITING_REVIEWER_SIGNOFF",
    titleRevision: { from: "Number Sense and Place Value: Foundations", to: "Number Sense and Place Value: Millions to Thousandths", rationale: "Names the exact Grade 7 scope: whole-number places to the millions and decimal places to the thousandths, which the MOE Grade 7 decimals, percents and fractions period builds on." },
    entries: [
      { sceneId: "intro", change: "REVISED", source: "PlaceValueDemo.tsx scene 'intro' (Big numbers are all around us)", rationale: "Kept the school-fund context; added a decimal measurement (2.375 kg) because Grade 7 extends place value below one." },
      { sceneId: "objectives", change: "NEW", source: "—", rationale: "States three measurable objectives and a success check (the DEMO listed goals only inside the intro)." },
      { sceneId: "warm-up", change: "NEW", source: "—", rationale: "Prior-knowledge activation on Grade 4 place value and tenths, with diagnostic feedback. Curriculum Excellence V1 (v0.3.0): Now a readiness check with one item per stated prerequisite (adds 7 × 1,000; 5,384 becomes 45,384 to reach the thousands period) and tells learners who miss one to ask the teacher, who reviews it before the chart (diagnostic routes in the assessment definitions)." },
      { sceneId: "chart", change: "REVISED", source: "PlaceValueDemo.tsx scene 'explain' (4,205,316 chart)", rationale: "Preserved the 4,205,316 example and the zero-holds-ten-thousands point; extended the chart to thousandths (4,205,316.27) and introduced the term 'period'." },
      { sceneId: "ten-times", change: "NEW", source: "—", rationale: "Makes the ×10 / ÷10 relationship explicit across the decimal point; the DEMO stated it in one sentence. Curriculum Excellence V1 (v0.3.0): Teaches against the place-shift error (new mc-place-shift), which most digit-value distractors actually represent." },
      { sceneId: "worked-example", change: "REVISED", source: "PlaceValueDemo.tsx scene 'example' (Musu's library fund)", rationale: "Preserved the three-step value-of-3 example; added expanded form, word form and a check-by-adding step." },
      { sceneId: "build-number", change: "REVISED", source: "PlaceValueTools.tsx NumberBuilder (interactive DEMO tool)", rationale: "The DEMO builder is not a renderable lesson interaction, so the candidate declares NUMERIC with a written fallback and a paper chart with counters for classrooms without devices." },
      { sceneId: "counter-chart", change: "REVISED", source: "Legacy lab 'Understanding Place Value with Local Materials' (revision cmss8t4hz00unvo54epnfst66); legacy comparison R-M1", rationale: "Keeps the legacy's offline, hands-on pair work, but with identical counters in labelled columns and a ten-for-one exchange, at the Grade 7 range (millions to thousandths). Does not restore the cassava/leaf/stone token values or the hundreds-only range." },
      { sceneId: "guided-decimals", change: "NEW", source: "—", rationale: "Guided decimal place-value items with per-option feedback." },
      { sceneId: "compare-strategy", change: "NEW", source: "—", rationale: "Compare-from-the-left method for decimals and whole numbers (objective 3). Curriculum Excellence V1 (v0.3.0): Adds the whole-number case (6,010,000 > 6,009,999) for the new mc-compare-by-digits misconception." },
      { sceneId: "misconceptions", change: "NEW", source: "—", rationale: "Targets three common errors: longer decimal is bigger, dropped zero placeholders, decimal word form. Curriculum Excellence V1 (v0.3.0): Adds the shorter-is-greater decimal error (new mc-shorter-decimal-bigger) beside longer-is-greater." },
      { sceneId: "practice", change: "PRESERVED", source: "PlaceValueDemo.tsx PRACTICE q1–q3", rationale: "Items on 1,742,009, 3,060,500 and 5,040,009 kept with their feedback; one word changed in q3 feedback ('group name' → 'period name') to match the chart scene. Two new items added (cocoa tonnes comparison, thousandths)." },
      { sceneId: "reason-it-out", change: "NEW", source: "Curriculum Excellence V1 gap report (LM-RSN-1)", rationale: "Independent, unscaffolded written reasoning (no hints): explain a decimal comparison and the ten-times relationship, so learners practise justifying before any mastery evidence." },
      { sceneId: "challenge", change: "NEW", source: "Curriculum Excellence V1 gap report (GE-EXT-1)", rationale: "Optional, non-gating enrichment puzzle (digits closest to 4) that needs reasoning about every place; placed before the review so it never follows the exit ticket." },
      { sceneId: "review", change: "REVISED", source: "PlaceValueDemo.tsx scene 'review'", rationale: "Kept the three takeaways; added zero placeholders and comparing. Curriculum Excellence V1 (v0.3.0): Adds a progression key idea: decimals lead to the MOE Grade 7 fractions-and-percents period (0.375 is 375 thousandths)." },
      { sceneId: "exit-ticket", change: "NEW", source: "—", rationale: "Assessment handoff to Assessment Player V2; candidate items are reviewer-only until released." },
      { sceneId: "reflect", change: "NEW", source: "—", rationale: "Written explanation of place versus value." },
      { sceneId: "home-practice", change: "REVISED", source: "Legacy 'Guardian Support' section (revision cmss8t4hz00unvo54epnfst66); legacy comparison R-M2", rationale: "Turns the legacy's generic home-support sentence into a concrete, device-free task that a family member who does not read can still share." },
    ],
  },
  "literacy-essay-structure-argument": {
    legacyComparison: "RECORDED_AWAITING_REVIEWER_SIGNOFF",
    titleRevision: { from: "Understanding Essay Writing: Structure and Argumentation", to: "Understanding Essay Writing: Structure and Argument", rationale: "Plainer word for Grade 7 learners; the topic is unchanged." },
    entries: [
      { sceneId: "intro", change: "NEW", source: "—", rationale: "Community decision (PTA meeting, school garden) as the reason to write an argument." },
      { sceneId: "objectives", change: "NEW", source: "—", rationale: "Three measurable objectives and a success check." },
      { sceneId: "warm-up", change: "NEW", source: "—", rationale: "Activates MOE Grade 6–7 paragraph knowledge (topic sentence) and fact versus opinion. Curriculum Excellence V1 (v0.3.0): Its fact-versus-opinion item is now the diagnostic for that prerequisite (assessment definitions)." },
      { sceneId: "readiness-writing", change: "NEW", source: "Curriculum Excellence V1 gap report (NF-PRG-1)", rationale: "Diagnoses the paragraph-writing and two-sides prerequisites by production rather than recognition, with a paragraph-frame or pair-talk route before the essay scenes." },
      { sceneId: "essay-structure", change: "NEW", source: "—", rationale: "Three-part essay structure with the job of each part." },
      { sceneId: "model-plan", change: "NEW", source: "—", rationale: "Complete model plan on a Liberian school topic, including a counterargument paragraph." },
      { sceneId: "thesis", change: "NEW", source: "—", rationale: "Distinguishes claims from topics, facts and announcements with feedback." },
      { sceneId: "peel", change: "NEW", source: "—", rationale: "PEEL paragraph model (Point, Evidence, Explain, Link). Whether PEEL is familiar in Liberian classrooms is for the reviewer to confirm (legacy comparison R-L5). The model evidence is attributed to Musu's (made-up) school garden (R-L1). Curriculum Excellence V1 (v0.3.0): Teaches against the Explain-restates-evidence error (new mc-explain-restates-evidence)." },
      { sceneId: "evidence", change: "NEW", source: "—", rationale: "Kinds of evidence and four tests; explicitly forbids invented figures, and says that Musu's school examples are made-up practice examples, not facts (R-L1)." },
      { sceneId: "evidence-check", change: "NEW", source: "—", rationale: "Misconception checks: irrelevant evidence, circular reasoning, ignoring the other side. The model evidence is attributed to Musu's practice school instead of the learner's own school (R-L1)." },
      { sceneId: "order-paragraph", change: "NEW", source: "—", rationale: "Declared ORDERING interaction with a written fallback. Sentence D is attributed to Musu's practice school (R-L1)." },
      { sceneId: "plan-argument", change: "REVISED", source: "Legacy section '8. Worked Example 2 — Alternative Method' (revision cmss94dmc03b7vo54ryf3hqk1); legacy comparison R-L2", rationale: "Restores the legacy brainstorm-then-organise method as the learner's own planning step: brainstorm, choose two reasons, attach real evidence with its source. The writing topics moved here from write-argument." },
      { sceneId: "write-argument", change: "NEW", source: "—", rationale: "Interactive writing practice: thesis plus one PEEL paragraph from the learner's plan, teacher-reviewed with the rubric." },
      { sceneId: "write-conclusion", change: "REVISED", source: "Legacy section '13. Independent Practice — Tier 1' (write a conclusion) (revision cmss94dmc03b7vo54ryf3hqk1); legacy comparison R-L3", rationale: "Restores conclusion writing on the lesson's own garden plan, keeping the rule the legacy model answer broke: no new reasons." },
      { sceneId: "peer-review", change: "REVISED", source: "Legacy '4. Core Concept' checks for understanding (peer review) and objective 3 (revision cmss94dmc03b7vo54ryf3hqk1); legacy comparison R-L4", rationale: "Restores structured peer review with the four PEEL questions, one strength and one next step; a learner working alone reviews their own paragraph." },
      { sceneId: "write-independently", change: "NEW", source: "Curriculum Excellence V1 gap report (LM-PRG-1)", rationale: "Unscaffolded writing (no hints, model or partner) on a second topic, so every objective reaches independent practice before mastery evidence." },
      { sceneId: "challenge", change: "NEW", source: "Curriculum Excellence V1 gap report (GE-EXT-1)", rationale: "Optional, non-gating five-paragraph essay with a reasoned self-evaluation; argumentative essays stay pending the MOE grade-scope decision." },
      { sceneId: "review", change: "NEW", source: "—", rationale: "Six key ideas, including planning before writing." },
      { sceneId: "exit-ticket", change: "NEW", source: "—", rationale: "Assessment handoff; candidate items reviewer-only until released." },
      { sceneId: "reflect", change: "NEW", source: "—", rationale: "Writer self-assessment and next step." },
    ],
  },
});

/** Candidate assessment definitions (Curriculum Excellence V1): prerequisite diagnostics, constructed and reasoning mastery tasks, original writing, delayed retention, transfer and optional extension. Reviewer only; nothing scores them. */
export const G7_ASSESSMENT_DEFINITION_DIR = "curriculum/v2/g7/assessment-definitions";

export type G7AssessmentDefinitionTask = PlannedAssessmentTask & Readonly<{
  prompt: string;
  /** Candidate scene and response that delivers this task to learners, when it is part of the lesson itself. */
  deliveredBy?: string;
  key?: string;
  scoringGuide?: unknown;
  targetsMisconceptions?: readonly string[];
  note?: string;
}>;

export type G7AssessmentDefinitions = Readonly<{
  lessonKey: string;
  audience: "REVIEWER_ONLY";
  status: "GOVERNED_CANDIDATE";
  notice: string;
  authors: readonly Readonly<{ kind: "AI" | "HUMAN"; agentId: string; modelFamily?: string | null; modelId?: string | null; sessionId?: string | null }>[];
  /** Exit items kept for diagnosis but not counted as mastery evidence. */
  diagnosticOnlyExitItemIds: readonly string[];
  diagnosticOnlyRationale?: string;
  tasks: readonly G7AssessmentDefinitionTask[];
}>;

export function loadG7AssessmentDefinitions(lessonKey: string): G7AssessmentDefinitions {
  const raw = JSON.parse(readFileSync(path.join(process.cwd(), G7_ASSESSMENT_DEFINITION_DIR, `${lessonKey}.json`), "utf8")) as G7AssessmentDefinitions;
  if (raw.lessonKey !== lessonKey || raw.audience !== "REVIEWER_ONLY" || raw.status !== "GOVERNED_CANDIDATE") throw new Error(`assessment definitions for ${lessonKey} are not reviewer-only governed candidates`);
  return { ...raw, tasks: raw.tasks.map((task) => ({ ...task, source: "EXCELLENCE_PLAN" as const, ref: `definition:${task.id}` })) };
}
