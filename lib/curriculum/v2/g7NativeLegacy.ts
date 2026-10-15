/**
 * Grade 7 Native Curriculum V1 — REVIEWER-ONLY comparison of each candidate with the live legacy revision it may
 * later replace.
 *
 * The legacy bodies were read once from production through scripts/extract-g7-legacy-revisions.ts (a single READ
 * ONLY transaction) and committed under G7_LEGACY_EXTRACT_DIR with their stored and recomputed content hashes. This
 * module records the section-by-section comparison a qualified reviewer must confirm. It recommends; it decides
 * nothing. No recommendation here has been applied to a candidate unless `applied` says so, and nothing re-introduces
 * legacy material a reviewer has not accepted.
 *
 * Learner-facing code must not import this module (it quotes legacy model answers); a test enforces that.
 */
import { readFileSync } from "fs";
import path from "path";
import { hashCurriculumSnapshot } from "@/lib/curriculum/provenance/hash";
import type { G7NativeLesson } from "./g7Native";

export const G7_LEGACY_EXTRACT_DIR = "artifacts/g7-native-curriculum-v1/legacy";

/**
 * The candidate revision each comparison was first made against (PR #191 commit 4fdd897c). Later candidate
 * revisions apply recommendations from that comparison; the production evidence itself never changes.
 */
export const G7_LEGACY_COMPARISON_BASELINE: Readonly<Record<string, Readonly<{ commit: string; candidateSha256: string }>>> = Object.freeze({
  "math-number-sense-place-value": { commit: "4fdd897cd6263d9f651dbc141e36869c0b9503f9", candidateSha256: "5817d80911154bceb61fe117e0916ad64d0b7ae5c6afd2a2c6028b9cdc972ffb" },
  "literacy-essay-structure-argument": { commit: "4fdd897cd6263d9f651dbc141e36869c0b9503f9", candidateSha256: "e875feab4d8d9742f421ba98c4c8c59f753e613a3d67526a77409cdd6019f786" },
});

export type LegacyExtract = Readonly<{
  extraction: Readonly<{ script: string; target: string; transactionReadOnly: "on"; capturedAt: string }>;
  requested: Readonly<{ contentId: string; revisionId: string }>;
  verification: Readonly<{ revisionFound: boolean; revisionBelongsToRow: boolean; isCurrentRevision: boolean; revisionCount: number; storedContentHash: string; recomputedContentHash: string; contentHashMatches: boolean; liveRowEqualsRevision: boolean }>;
  content: Readonly<Record<string, unknown>>;
  payloadMetadata: Readonly<Record<string, unknown>>;
  provenance: Readonly<Record<string, unknown>>;
  revisions: readonly Readonly<Record<string, unknown>>[];
  revision: Readonly<{ id: string; snapshotSchemaVersion: number; contentHash: string; contentSnapshot: Readonly<Record<string, any>> }>;
}>;

export function legacyExtractPath(lesson: G7NativeLesson): string {
  return `${G7_LEGACY_EXTRACT_DIR}/${lesson.key}.json`;
}

export function loadLegacyExtract(lesson: G7NativeLesson): LegacyExtract {
  return JSON.parse(readFileSync(path.join(process.cwd(), legacyExtractPath(lesson)), "utf8")) as LegacyExtract;
}

/** Recomputes the revision hash from the committed snapshot, so the evidence cannot drift from what production stores. */
export function verifyLegacyExtract(lesson: G7NativeLesson, extract: LegacyExtract = loadLegacyExtract(lesson)) {
  const recomputed = hashCurriculumSnapshot(extract.revision.snapshotSchemaVersion, extract.revision.contentSnapshot);
  return {
    revisionId: extract.revision.id,
    matchesRequestedRevision: extract.revision.id === lesson.legacy.currentRevisionId && extract.requested.contentId === lesson.legacy.contentId,
    storedContentHash: extract.revision.contentHash,
    recomputedContentHash: recomputed,
    contentHashMatches: recomputed === extract.revision.contentHash,
  };
}

/** The `## ` headings of the legacy delivery body, in order. */
export function legacyBodyHeadings(extract: LegacyExtract): string[] {
  const body = String(extract.revision.contentSnapshot.delivery?.body ?? "");
  return body.split("\n").filter((line) => line.startsWith("## ")).map((line) => line.slice(3).trim());
}

export type LegacyDisposition =
  | "PRESERVED"     // kept in substance
  | "IMPROVED"      // kept and made more precise, correct or usable
  | "REORGANIZED"   // kept in substance but moved or split across scenes
  | "REPLACED"      // same instructional job, new material
  | "OMITTED"       // not carried into the candidate
  | "NOT_RESTORED"; // deliberately excluded because it is incorrect, misaligned or unsuitable

export type SectionComparison = Readonly<{ legacySection: string; legacyContent: string; candidateScenes: readonly string[]; disposition: LegacyDisposition; note: string }>;
export type ConcernCategory = "FACTUAL" | "MATHEMATICAL" | "LINGUISTIC" | "PEDAGOGICAL" | "ALIGNMENT" | "STRUCTURAL" | "GOVERNANCE";
export type Concern = Readonly<{ id: string; severity: "HIGH" | "MEDIUM" | "LOW"; category: ConcernCategory; where: string; finding: string; action: string }>;
export type Recommendation = Readonly<{
  id: string;
  kind: "RESTORE_ADAPTED" | "REVISE_CANDIDATE" | "DO_NOT_RESTORE" | "REVIEWER_DECISION";
  scenes: readonly string[];
  recommendation: string;
  rationale: string;
  /** True only when this change is already in the committed package; false means the reviewer decides. */
  applied: boolean;
}>;
export type AlignmentOption = Readonly<{ id: string; label: string; description: string; consequences: string }>;
export type AlternativeObjective = Readonly<{ id: string; statement: string; replaces: readonly string[]; moeBasis: string }>;
export type SceneImpact = Readonly<{ sceneId: string; action: "KEEP" | "ADAPT" | "MOVE_TO_EXTENSION"; note: string }>;
export type ItemImpact = Readonly<{ itemId: string; action: "KEEP" | "REVISE" | "REPLACE" | "MOVE_TO_EXTENSION"; note: string }>;
/** A fully worked-out option, prepared for the authority. Never applied: the candidate keeps its scope until a decision is recorded. */
export type PreparedAlternative = Readonly<{
  optionId: string;
  status: "PREPARED_NOT_APPLIED";
  title: string;
  summary: string;
  objectives: readonly AlternativeObjective[];
  sceneImpact: readonly SceneImpact[];
  itemImpact: readonly ItemImpact[];
  bindingPath: string;
}>;
export type AlignmentDecision = Readonly<{ id: string; question: string; evidence: readonly string[]; options: readonly AlignmentOption[]; authorRecommendation: string; preparedAlternative?: PreparedAlternative }>;

export type LegacyComparison = Readonly<{
  legacySummary: readonly string[];
  sections: readonly SectionComparison[];
  /** Candidate scenes with no legacy counterpart. */
  newScenes: readonly Readonly<{ sceneId: string; what: string }>[];
  objectives: readonly Readonly<{ legacy: string; candidate: readonly string[]; change: string }>[];
  assessment: readonly Readonly<{ aspect: string; legacy: string; candidate: string; reviewNeeded: string }>[];
  legacyConcerns: readonly Concern[];
  candidateConcerns: readonly Concern[];
  recommendations: readonly Recommendation[];
  alignment: readonly AlignmentDecision[];
}>;

export const G7_LEGACY_COMPARISON: Readonly<Record<string, LegacyComparison>> = Object.freeze({
  "math-number-sense-place-value": {
    legacySummary: [
      "The legacy body is a template shell (payload metadata: model \"template-engine\", source \"national_curriculum_generation\", estimated cost 0). Its ten sections describe what a teacher should do (\"Model one complete math example…\") but contain no numbers, place names, examples, questions or answers.",
      "`delivery.bodyBlock` (Day 1, Day 2, Home Support) repeats sentences from the same sections; it adds no material.",
      "The only concrete material is one offline lab, \"Understanding Place Value with Local Materials\" (25 minutes, 3 steps): leaves, stones and cassava stand for tens, ones and hundreds; learners build a number such as 123 and record it. Its two analysis questions ask how 345 breaks into hundreds, tens and units (expected \"3 hundreds, 4 tens, and 5 units\") and why place value matters.",
      "Assessment is a sentence (\"a short exit task with two checks…\"); `assessmentQuestions` and `problemSets` are empty, so the legacy lesson has no keyed items to compare.",
      "Standards: a keyword alignment (confidence low) to LiberiaLearn code LR-MATH-G7_9-04, \"Apply the Pythagorean theorem and basic trigonometric ratios\". The payload's own `moeAlignments` is empty.",
      "Governance: row status APPROVED, payload approvalStatus pending_approval, provenance UNVERIFIED with origin LEGACY_UNKNOWN (single BACKFILL_SNAPSHOT revision). Payload metadata nevertheless says qualityValidated: true and marks every section complete.",
    ],
    sections: [
      { legacySection: "Objective", legacyContent: "\"Students in Grade 7 will explain and apply number sense and place value ideas using age-appropriate math tasks.\"", candidateScenes: ["objectives"], disposition: "IMPROVED", note: "One unmeasurable objective became three measurable ones (read/write, digit value, compare) with a success check on 3,462,105.68." },
      { legacySection: "Teacher Explanation", legacyContent: "Instruction to the teacher to introduce the concept with modelling, Liberia-relevant examples, vocabulary and a check; no content.", candidateScenes: ["chart", "ten-times"], disposition: "REPLACED", note: "The candidate supplies the explanation itself: the millions-to-thousandths chart, periods, zero as a place holder, and the ×10 / ÷10 relationship." },
      { legacySection: "Worked Example", legacyContent: "\"Model one complete math example connected to number sense and place value…\" (placeholder; no example).", candidateScenes: ["worked-example", "compare-strategy"], disposition: "REPLACED", note: "Two complete worked examples: value, expanded and word form of L$2,350,480 with a check by adding; ordering 0.5, 0.45, 0.405 and 4,099,999 vs 4,100,000." },
      { legacySection: "Guided Practice", legacyContent: "One shared and one partner task \"with teacher prompts\" (no tasks given).", candidateScenes: ["build-number", "counter-chart", "guided-decimals"], disposition: "REPLACED", note: "Concrete guided tasks with feedback. The legacy partner task is now the counter-chart pair activity (R-M1)." },
      { legacySection: "Independent Practice", legacyContent: "Individual work, then \"explain one answer in writing or orally\" (no items).", candidateScenes: ["practice", "reflect"], disposition: "REPLACED", note: "Five independent items with feedback. The legacy \"explain one answer\" intent is kept in the written place-versus-value reflection." },
      { legacySection: "Assessment", legacyContent: "\"Use a short exit task with two checks: one recall item and one application item.\" No items exist.", candidateScenes: ["exit-ticket"], disposition: "REPLACED", note: "Six candidate exit items (reviewer only), each mapped to an objective and misconception and machine-verified. See the assessment comparison." },
      { legacySection: "Remediation", legacyContent: "Re-teach with simpler examples, sentence frames and one scaffolded task (generic).", candidateScenes: ["misconceptions", "warm-up"], disposition: "IMPROVED", note: "Four named misconceptions with targeted responses and per-option feedback; the warm-up diagnoses Grade 4 gaps before teaching." },
      { legacySection: "Extension", legacyContent: "Ask confident learners to solve a harder version or justify reasoning (generic).", candidateScenes: [], disposition: "OMITTED", note: "The candidate has no extension task. See R-M3." },
      { legacySection: "Guardian Support", legacyContent: "Learner explains the main idea at home and does a short task with household materials (generic).", candidateScenes: ["home-practice"], disposition: "IMPROVED", note: "Restored as a concrete, device-free home task: find a large number and a decimal, read them to a family member and name digit values (R-M2)." },
      { legacySection: "Metadata", legacyContent: "Grade 7 MATH unit \"Number Sense and Place Value\" lesson \"Number Sense and Place Value: Foundations\".", candidateScenes: [], disposition: "IMPROVED", note: "Title revised to \"Millions to Thousandths\" (see the revision ledger); unit placement is a reviewer decision." },
      { legacySection: "Lab: Understanding Place Value with Local Materials", legacyContent: "Leaves = tens, stones = ones, cassava = hundreds; build and record a number such as 123; analysis questions on 345.", candidateScenes: ["build-number", "counter-chart"], disposition: "IMPROVED", note: "Restored as the counter-chart pair activity: identical counters in labelled columns from millions to thousandths, with a ten-for-one exchange (R-M1). The legacy token values and the hundreds-only range are not restored (L-M3, L-M4)." },
      { legacySection: "Standards alignment (LR-MATH-G7_9-04)", legacyContent: "Keyword alignment, confidence low: \"Apply the Pythagorean theorem and basic trigonometric ratios\".", candidateScenes: [], disposition: "NOT_RESTORED", note: "Wrong topic; the candidate records exact MOE relationships instead." },
    ],
    newScenes: [
      { sceneId: "intro", what: "Hook with a large money amount (L$2,350,480) and a decimal measurement (2.375 kg)." },
      { sceneId: "warm-up", what: "Diagnostic check of Grade 4 place value and tenths." },
      { sceneId: "misconceptions", what: "Three misconception checks (longer decimal is bigger, dropped zeros, decimal word form)." },
      { sceneId: "review", what: "Four key ideas before the exit ticket." },
    ],
    objectives: [
      { legacy: "Explain and apply number sense and place value ideas using age-appropriate math tasks.", candidate: ["ll-g7-math-place-value-read-write", "ll-g7-math-place-value-digit-value", "ll-g7-math-place-value-compare"], change: "Scope made explicit: whole numbers to the millions and decimals to the thousandths, read/write in three forms, digit value through the ×10 relationship, comparing from the left. The legacy objective named no range; its only worked content (the lab) stopped at hundreds." },
    ],
    assessment: [
      { aspect: "Items", legacy: "None. A one-line instruction for a teacher-made exit task.", candidate: "Six single-choice candidate items in GovernedItem shape (assessment-review.json), 2 per objective.", reviewNeeded: "Approve, revise or reject each item and key; confirm 2 items per objective is enough evidence." },
      { aspect: "Answer expectations", legacy: "Lab analysis: \"3 hundreds, 4 tens, and 5 units\" for 345 (correct); \"helps in understanding the value of numbers and performing arithmetic operations\" (acceptable).", candidate: "Keys verified by machine against independent place-value arithmetic; distractors mapped to named misconceptions.", reviewNeeded: "Confirm distractors are plausible for Liberian Grade 7 learners and none is defensibly correct." },
      { aspect: "Scoring", legacy: "Lab rubric: \"1 point for each correct place value identification\"; no mastery path.", candidate: "No local scoring: Assessment Player V2 scores only after a released ontology binding (SERVER_AUTHORITY).", reviewNeeded: "Decide the evidence context (DIAGNOSTIC or PRACTICE) for the release." },
      { aspect: "Calculator", legacy: "Not addressed.", candidate: "Calculators prohibited in the exit ticket.", reviewNeeded: "Confirm the tool policy." },
    ],
    legacyConcerns: [
      { id: "L-M1", severity: "HIGH", category: "STRUCTURAL", where: "All body sections", finding: "The body contains no mathematics: every section is a template instruction with the topic name inserted. A learner or teacher receives nothing to teach from.", action: "Nothing to preserve from the body. The candidate replaces every section." },
      { id: "L-M2", severity: "HIGH", category: "ALIGNMENT", where: "standards.moeAlignments", finding: "Aligned (keyword, low confidence) to LR-MATH-G7_9-04, the Pythagorean theorem and trigonometric ratios, which is unrelated to place value. LR-* codes are LiberiaLearn codes (lib/curriculum/nr13Grades58.ts), not MOE items.", action: "Do not carry the alignment forward." },
      { id: "L-M3", severity: "MEDIUM", category: "PEDAGOGICAL", where: "Lab steps 1-2", finding: "Different objects stand for different values (1 cassava = 100, 1 leaf = 10, 1 stone = 1). The tokens do not show that ten of one place make one of the next, so learners can build 123 by counting objects without understanding the grouping.", action: "If the activity is restored, use identical counters placed in labelled columns of a paper chart, with a ten-for-one exchange (R-M1)." },
      { id: "L-M4", severity: "MEDIUM", category: "ALIGNMENT", where: "Lab", finding: "The lab only reaches hundreds (MOE Grade 2-3 scope: Math 1-6 p.14 and p.26), far below Grade 7.", action: "Restore only the method, at the Grade 7 range." },
      { id: "L-M5", severity: "LOW", category: "STRUCTURAL", where: "Lab materials", finding: "Materials list bottle caps and cups that no step uses; quantities (10 leaves, 20 stones, 5 cassava) do not match a number-building task.", action: "Not restored." },
      { id: "L-M6", severity: "LOW", category: "LINGUISTIC", where: "Lab analysis question 1", finding: "Uses \"units\"; the MOE Grade 3 objective (Math 1-6 p.26) and the candidate use \"ones\".", action: "Keep \"ones\"." },
      { id: "L-M7", severity: "MEDIUM", category: "GOVERNANCE", where: "Row status and payload metadata", finding: "Row status APPROVED while payload approvalStatus is pending_approval; metadata claims qualityValidated: true and full contentCompleteness for placeholder text. Provenance is UNVERIFIED, origin LEGACY_UNKNOWN.", action: "Treat the legacy approval as unverified; it is not evidence of review." },
    ],
    candidateConcerns: [
      { id: "C-M1", severity: "HIGH", category: "ALIGNMENT", where: "Objectives, chart, worked-example, practice, exit items 1, 3, 6", finding: "No MOE grade in the repository source covers whole numbers in the millions: Grade 4 stops at hundred thousand (Math 1-6 p.38), and the word \"million\" does not occur anywhere in the extracted Math 1-6 or Math 7-9 text. The millions range is a LiberiaLearn extension.", action: "Recorded as proposed extension ext-g7-math-whole-numbers-millions (blocking gap SCOPE_EXTENSION_UNAPPROVED), pending curriculum-owner approval (A-M1)." },
      { id: "C-M2", severity: "MEDIUM", category: "PEDAGOGICAL", where: "Whole lesson", finding: "No group hands-on activity and no home connection. The legacy lesson had both (generic, but the intent is sound for classrooms with few devices).", action: "Addressed: counter-chart (R-M1) and home-practice (R-M2), applied." },
      { id: "C-M3", severity: "LOW", category: "LINGUISTIC", where: "intro, worked-example", finding: "Writes Liberian dollars as L$; the legacy essay lesson and other LiberiaLearn content use LD$. Both are in use in Liberia.", action: "Reviewer chooses one convention (R-M4)." },
      { id: "C-M4", severity: "LOW", category: "FACTUAL", where: "intro", finding: "A market trader weighing 2.375 kg of rice assumes a scale that reads grams. Many market scales do not.", action: "Reviewer confirms the context is realistic or substitutes one (for example a shop's digital scale)." },
    ],
    recommendations: [
      { id: "R-M1", kind: "RESTORE_ADAPTED", scenes: ["build-number", "counter-chart"], recommendation: "Restore the legacy local-materials activity as a no-device pair activity, adapted: pairs draw a chart from millions to thousandths and place identical counters (stones, bottle caps or seeds) in the columns; ten counters in a column are exchanged for one counter in the next column to the left. Applied as scene counter-chart (exchange 14 hundredths, build 2,050,316.47, partners build and read each other's numbers).", rationale: "Keeps the legacy's hands-on, offline intent and pair work, fixes L-M3, and reaches the Grade 7 range.", applied: true },
      { id: "R-M2", kind: "RESTORE_ADAPTED", scenes: ["home-practice"], recommendation: "Add a home connection: the learner finds one large number (a price, a calendar or a figure heard on the radio) and one decimal measurement, writes them in a chart on paper or in the sand, reads both to a family member and names the value of any digit they point to. Applied as scene home-practice (no device, no printing, nothing to buy; works with a family member who does not read).", rationale: "Restores the legacy guardian-support intent with a concrete, low-resource task.", applied: true },
      { id: "R-M3", kind: "REVIEWER_DECISION", scenes: ["practice"], recommendation: "Decide whether to add an extension task, for example: using the digits 0, 3, 5, 7 and 9 once each with three decimal places, write the greatest and the least number possible and explain why.", rationale: "The legacy named an extension but gave none; the candidate has none.", applied: false },
      { id: "R-M4", kind: "REVIEWER_DECISION", scenes: ["intro", "worked-example"], recommendation: "Choose L$ or LD$ for Liberian dollars and apply it across Grade 7 content.", rationale: "C-M3.", applied: false },
      { id: "R-M5", kind: "DO_NOT_RESTORE", scenes: [], recommendation: "Do not restore the LR-MATH-G7_9-04 alignment, the cassava/leaf/stone token values, the hundreds-only range, or \"units\" terminology.", rationale: "L-M2, L-M3, L-M4, L-M6.", applied: false },
    ],
    alignment: [
      {
        id: "A-M1",
        question: "Should place value through the thousandths remain a Grade 7 prerequisite/reinforcement lesson supporting decimals, fractions and percentages?",
        evidence: [
          "MOE Grade 7 Math (Math 7-9 pp.2-16) has six periods: Arithmetic skills and Sets (S1 P1), Fractions (P2), Decimals, percents and fractions (P3, p.10), Basic algebra (S2 P4), Geometry (P5), Co-ordinate geometry (P6). None has a place-value objective (test: \"the structured source has no Grade 7 objective…\").",
          "Grade 7 P3 (p.10): obj1 \"Convert from decimal to percent/fraction and vice versa\"; obj2 \"Apply decimal and percent to the solution of problems involving commissions, discounts, taxes, interest, profits and losses and rayolty\" [sic]. Both use decimal place value.",
          "Earlier grades: G3 place value to thousands (Math 1-6 p.26); G4 read/write and compare whole numbers to hundred thousand (p.38) and decimals to hundredths (p.45); G5 multiply and divide whole numbers and decimals; G6 \"Round off decimals to the nearest tenth, hundredths and thousandths\" (p.67).",
          "The word \"million\" does not occur in the extracted Math 1-6 or Math 7-9 text (curriculum/sources/intermediate).",
          "The legacy row is lesson 1 of LiberiaLearn unit math-g7-1-number-sense-and-place-value; MOE Grade 7 period 1 is Arithmetic skills and Sets, not number sense.",
        ],
        options: [
          { id: "A", label: "Keep as a prerequisite/reinforcement lesson before P3", description: "Keep the three objectives as LiberiaLearn candidates with their PREREQUISITE_FOR relationships to Math 7-9 p.10, placed before the decimals, percents and fractions period. Millions stay as a labelled extension of the Grade 4 range.", consequences: "No content change. The authority must accept a LiberiaLearn extension beyond any MOE grade (millions)." },
          { id: "B", label: "Keep, but rescope to decimal place value", description: "Make tenths to thousandths (reading, digit value, comparing) the core, matching G4 p.45 and G6 p.67 and feeding P3 directly. Whole numbers above hundred thousand become optional enrichment.", consequences: "Revise intro, chart, worked-example, practice items 1-3 and exit items 1, 3 and 6 (or mark them enrichment); regenerate the package." },
          { id: "C", label: "Use as a diagnostic/remediation resource only", description: "Remove the lesson from the Grade 7 core sequence and offer it when the warm-up or P3 work shows place-value gaps.", consequences: "No Grade 7 core objective. Retiring or repointing the legacy unit needs a separate authorized change that respects its learner history." },
        ],
        authorRecommendation: "A, placed as a prerequisite to Math 7-9 P3 rather than as unit 1 core content, with millions labelled as a LiberiaLearn extension. This is the author's recommendation, not a decision; a qualified Math reviewer and the curriculum authority decide.",
      },
    ],
  },

  "literacy-essay-structure-argument": {
    legacySummary: [
      "The legacy body (34,044 characters, model metadata \"gpt-4o+gpt-4o-mini\", generated 2026-06-03) has 16 numbered sections (section 5 is missing). `delivery.body`, `bodyBlock` and `bodyStandard` are identical.",
      "It teaches the three-part essay through an extended story (Boima comparing two market stalls at Waterside Market) and a jollof-rice metaphor, with market revenue calculations inside the core concept.",
      "Worked examples are single paragraphs on cassava (\"standard method\") and palm oil (\"brainstorm first\"). Guided and independent practice are nine writing prompts whose model answers sit in `assessment.problemSets` (answerKey per prompt).",
      "The exit ticket is two open questions with model answers (parts of an essay and their roles; how structure makes an argument persuasive). There is no rubric and no keyed item.",
      "Objectives: (1) identify and explain essay structure; (2) develop and articulate a clear, logical argument supported by evidence; (3) apply critical thinking to evaluate the strength of arguments \"preparing them for future careers and civic engagements\".",
      "Standards: keyword alignment (confidence low) to LiberiaLearn code LR-LIT-G7_9-02, \"Write persuasive and argumentative essays with evidence and reasoning\" (a Grade 7-9 band code, not an MOE item).",
    ],
    sections: [
      { legacySection: "1. Hook — The Real-World Challenge", legacyContent: "Boima overhears two vendors (Fatu and Kpaan) arguing whose stall is most successful and decides to write an essay comparing them.", candidateScenes: ["intro"], disposition: "REPLACED", note: "Candidate hook: a PTA disagreement about a school garden, which needs an argument rather than a comparison. Both are Liberian community settings." },
      { legacySection: "2. Learning Objectives", legacyContent: "Three objectives (structure; logical argument with evidence; evaluate argument strength for careers and civic life).", candidateScenes: ["objectives"], disposition: "IMPROVED", note: "Objective 1 kept and made specific; objective 2 kept and extended with a counterargument; objective 3 narrowed to choosing and explaining evidence. See the objective comparison." },
      { legacySection: "3. Prior Knowledge Activation", legacyContent: "Parts of a short story; fact versus opinion (\"Liberia gained independence in 1847\"); a time you persuaded someone.", candidateScenes: ["warm-up"], disposition: "REORGANIZED", note: "Fact versus opinion preserved (new example); topic sentence added. Short-story parts and the persuasion experience omitted." },
      { legacySection: "4. Core Concept — Concrete Foundation", legacyContent: "Introduction (hook, thesis), body (topic sentences; pricing, customer engagement and quality paragraphs with LD$ calculations), conclusion; extra worked-example notes; checks for understanding (discussion, paragraph building, peer review, local context, role play, mathematics integration).", candidateScenes: ["essay-structure", "model-plan", "peel", "peer-review"], disposition: "IMPROVED", note: "The three parts and their jobs are kept, shorter and in plain language, with a full model plan. Peer review is restored as a structured activity (R-L4). Revenue calculations, the food metaphors and role play are not restored (L-L5, L-L8)." },
      { legacySection: "6. Key Vocabulary", legacyContent: "Thesis, evidence, argument, each with a definition, an example and a memory tip.", candidateScenes: ["thesis", "evidence", "essay-structure"], disposition: "REORGANIZED", note: "Thesis and evidence are defined where they are used; \"argument\" is taught through the claim/reasons structure. No separate glossary. The legacy thesis example contradicts its own story (L-L4)." },
      { legacySection: "7. Worked Example 1 — Standard Method", legacyContent: "Paragraph on why cassava is a Liberian staple: thesis, topic sentence, evidence, conclusion.", candidateScenes: ["peel"], disposition: "REPLACED", note: "Replaced by a PEEL paragraph from the garden essay. The legacy example gives one paragraph both a thesis and a different topic sentence and mislabels its reasons (L-L1, L-L2)." },
      { legacySection: "8. Worked Example 2 — Alternative Method", legacyContent: "Brainstorm bullet points (palm oil), organise them, then write the paragraph.", candidateScenes: ["plan-argument"], disposition: "IMPROVED", note: "The brainstorm-then-organise method is restored as the learner's own planning step, with real evidence and its source for each reason (R-L2). The palm-oil content is not restored (L-L10)." },
      { legacySection: "9. Error Analysis", legacyContent: "Three errors: unrelated facts as evidence; no conclusion; misplaced topic sentence.", candidateScenes: ["evidence-check", "thesis"], disposition: "IMPROVED", note: "Irrelevant evidence, circular reasoning and ignoring the other side are checked with feedback. The legacy error 1 example is itself wrong (L-L3) and is not restored." },
      { legacySection: "10. Guided Practice — Problem 1", legacyContent: "Write an introductory paragraph: \"The Importance of Education in Rural Liberia\".", candidateScenes: ["model-plan"], disposition: "OMITTED", note: "The candidate models an introduction (hook and thesis) but never asks the learner to write one (R-L3)." },
      { legacySection: "11. Guided Practice — Problem 2", legacyContent: "Draft the first body paragraph: \"Why Public Transportation is Essential in Monrovia\".", candidateScenes: ["order-paragraph", "write-argument"], disposition: "REPLACED", note: "Body-paragraph practice is kept as ordering a PEEL paragraph and writing one PEEL paragraph." },
      { legacySection: "12. Guided Practice — Problem 3", legacyContent: "Draft introduction and first body paragraph: \"The Role of Local Markets in Strengthening Local Economies\".", candidateScenes: ["write-argument"], disposition: "REPLACED", note: "Narrowed to a thesis and one PEEL paragraph." },
      { legacySection: "13. Independent Practice — Tier 1", legacyContent: "Write a conclusion (learning technology); explain the significance of a thesis.", candidateScenes: ["write-conclusion", "exit-ticket"], disposition: "IMPROVED", note: "Conclusion writing is restored on the lesson's own garden plan, with the no-new-reasons rule the legacy model answer broke (R-L3, L-L7). Thesis knowledge is checked by exit items 1 and 2." },
      { legacySection: "14. Independent Practice — Tier 2 Standard", legacyContent: "Draft an introduction (sports and unity); write a body paragraph (renewable energy).", candidateScenes: ["write-argument"], disposition: "REPLACED", note: "One body paragraph kept in the candidate's writing task; introduction writing omitted." },
      { legacySection: "15. Independent Practice — Tier 3 Advanced", legacyContent: "Analyse storytelling and cultural heritage; evaluate traditional versus modern education methods.", candidateScenes: [], disposition: "OMITTED", note: "Analytical and comparative writing is beyond this lesson's objectives." },
      { legacySection: "16. Group Discussion", legacyContent: "\"How does essay writing help us understand real-life issues in Liberian society?\" with five discussion points.", candidateScenes: [], disposition: "OMITTED", note: "No discussion task. The candidate's reflection is individual. Optional classroom discussion is a reviewer decision." },
      { legacySection: "17. Assessment, Exit Ticket, and Lesson Summary", legacyContent: "Two open exit questions with model answers; five key takeaways; next-lesson preview (styles of essays, peer review).", candidateScenes: ["exit-ticket", "review"], disposition: "REPLACED", note: "Exit ticket becomes six single-choice candidate items; takeaways become five plain key ideas. See the assessment comparison." },
      { legacySection: "Problem sets (model answers)", legacyContent: "Nine model answers (gp1-gp3, ip1a-ip3b) for the practice prompts above.", candidateScenes: ["write-argument"], disposition: "NOT_RESTORED", note: "Model answers present unsourced figures as evidence and one conclusion adds new reasons (L-L5, L-L7). The candidate uses a rubric and an expected observation instead." },
      { legacySection: "Standards alignment (LR-LIT-G7_9-02)", legacyContent: "Keyword alignment, confidence low: \"Write persuasive and argumentative essays with evidence and reasoning\".", candidateScenes: [], disposition: "NOT_RESTORED", note: "A LiberiaLearn Grade 7-9 band code, not an MOE item; the MOE places argumentative writing in Grade 9." },
    ],
    newScenes: [
      { sceneId: "evidence", what: "Four kinds of evidence and four tests; forbids invented facts and figures." },
      { sceneId: "reflect", what: "Writer self-assessment and next step." },
    ],
    objectives: [
      { legacy: "Identify and explain the structure of a well-organized essay, including introduction, body, and conclusion.", candidate: ["ll-g7-lit-essay-structure"], change: "Kept; narrowed to the argumentative essay and made specific (thesis ends the introduction; each body paragraph opens with a topic sentence)." },
      { legacy: "Develop and articulate a clear, logical argument supported by evidence.", candidate: ["ll-g7-lit-argument-build", "ll-g7-lit-evidence-support"], change: "Split into building an arguable thesis with reasons and choosing/explaining evidence. Answering a counterargument is NEW and raises the demand toward MOE Grade 8-9 scope." },
      { legacy: "Apply critical thinking to evaluate the strength of arguments in various contexts, preparing them for future careers and civic engagements.", candidate: ["ll-g7-lit-evidence-support"], change: "Narrowed: the candidate evaluates evidence and reasons inside one argument; it does not ask learners to evaluate other people's arguments. The career/civic framing is dropped." },
    ],
    assessment: [
      { aspect: "Items", legacy: "Two open questions with model answers; no rubric, no key.", candidate: "Six single-choice candidate items (structure 2, argument 2, evidence 2) in GovernedItem shape.", reviewNeeded: "Approve, revise or reject each item and key." },
      { aspect: "Construct", legacy: "Learners explain the parts of an essay and why structure persuades (constructed response).", candidate: "Recognition only in the exit ticket; production is in the formative writing task, judged by the teacher with a four-criterion rubric.", reviewNeeded: "Decide whether a teacher-marked constructed exit prompt is required (R-L6)." },
      { aspect: "Answer expectations", legacy: "Model answers are long, use comparisons (\"building a house in Monrovia\") and include unsourced claims.", candidate: "Expected observations are short descriptions of what a secure answer shows; no model answer is presented as evidence.", reviewNeeded: "Confirm the rubric levels and expected observations." },
      { aspect: "Practice volume", legacy: "Nine writing prompts across three tiers (intro, body, conclusion, analysis).", candidate: "One thesis and one PEEL paragraph, plus ordering and choice items.", reviewNeeded: "Decide whether the lighter writing load is right for one Grade 7 lesson (R-L3)." },
    ],
    legacyConcerns: [
      { id: "L-L1", severity: "HIGH", category: "PEDAGOGICAL", where: "7. Worked Example 1", finding: "One paragraph is given both a \"thesis\" (\"Cassava is a staple… due to its versatility and nutritional benefits\") and a different \"topic sentence\", so thesis and topic sentence are presented as two parts of the same paragraph.", action: "Do not restore." },
      { id: "L-L2", severity: "MEDIUM", category: "LINGUISTIC", where: "7. Worked Example 1, step 1", finding: "Says the thesis \"reflects both a cause—its versatility—and an effect—its resultant health benefits\". Versatility and nutrition are two reasons, not a cause and an effect.", action: "Do not restore." },
      { id: "L-L3", severity: "HIGH", category: "PEDAGOGICAL", where: "9. Error Analysis, mistake 1", finding: "Calls \"Cassava is a staple because it is affordable\" an unrelated fact. Affordability is a relevant reason why a food is a staple, so the lesson teaches a wrong rule about relevance.", action: "Do not restore; the candidate's irrelevant-evidence check uses a clearly unrelated example." },
      { id: "L-L4", severity: "MEDIUM", category: "STRUCTURAL", where: "6. Key Vocabulary vs 4. Core Concept", finding: "Vocabulary says Boima's thesis was that Kpaan's stall had the better strategy; the core concept argues for Fatu's stall.", action: "Not restored." },
      { id: "L-L5", severity: "HIGH", category: "FACTUAL", where: "4. Core Concept; problem sets gp2, ip2b", finding: "Model answers present unsourced figures and claims as evidence: daily fuel about LD$500 and maintenance over LD$5,000 a month, 60 of 100 customers being regulars, schools offering evening classes \"a first in many areas\", small-scale wind turbines in rural Nimba. A lesson about evidence models invented evidence.", action: "Do not restore any figure without a named, checkable source." },
      { id: "L-L6", severity: "LOW", category: "MATHEMATICAL", where: "4. Core Concept, quality paragraph", finding: "\"200 tomatoes a day at 20% higher quality premium\" alongside an LD$5 price difference: the 20% is unexplained and unused. The other calculations are correct (50 × 85 = 4,250; 50 × 100 = 5,000; 100 × 90 = 9,000; 80 × 100 = 8,000; 200 × 5 = 1,000).", action: "Not restored (the arithmetic is off-objective for an English lesson)." },
      { id: "L-L7", severity: "MEDIUM", category: "PEDAGOGICAL", where: "Problem set ip1a (model conclusion)", finding: "The model conclusion adds new points (coding, project-based learning, online research), which contradicts the rule that a conclusion adds no new reasons.", action: "Do not restore." },
      { id: "L-L8", severity: "MEDIUM", category: "LINGUISTIC", where: "Whole body", finding: "Reading level well above Grade 7 (\"elucidate\", \"multifarious\", \"irrefutable\", \"encapsulating\"), long paragraphs and extended food metaphors that compete with the teaching point.", action: "Not restored; the candidate uses plain language." },
      { id: "L-L9", severity: "MEDIUM", category: "STRUCTURAL", where: "Sections 5, 10-15", finding: "Section 5 is missing. Guided-practice explanations refer to model text the learner cannot see (\"To expand on this explanation…\"). Independent prompts have no success criteria.", action: "Not restored." },
      { id: "L-L10", severity: "LOW", category: "FACTUAL", where: "8. Worked Example 2", finding: "\"High vitamin A content\": red palm oil is rich in provitamin A carotenoids (beta-carotene), not vitamin A itself. Acceptable only as a simplification.", action: "If palm oil is reused, say \"rich in beta-carotene, which the body turns into vitamin A\"." },
      { id: "L-L11", severity: "MEDIUM", category: "ALIGNMENT", where: "standards.moeAlignments", finding: "LR-LIT-G7_9-02 is a LiberiaLearn band code (keyword, low). The MOE Grade 7 English text has no persuasive or argumentative writing; it appears in Grade 9 (p.28, p.32).", action: "Do not carry forward." },
    ],
    candidateConcerns: [
      { id: "C-L1", severity: "HIGH", category: "PEDAGOGICAL", where: "evidence-check (option 2), order-paragraph (sentence D), exit item g7-essay-exit-3", finding: "Model evidence was written as the learner's own real experience (\"Last term our agriculture club harvested greens and pepper…\", \"our school's greens and pepper were used in lunch for a whole week last term\", \"After our class read for 20 minutes a day for one term…\"), while the lesson tells learners never to make up evidence.", action: "Addressed by R-L1 (applied): attributed to Musu's made-up practice school, labelled as made up in the evidence scene, item g7-essay-exit-3 revised to candidate-0.2.0." },
      { id: "C-L2", severity: "HIGH", category: "ALIGNMENT", where: "Objectives, essay-structure, model-plan, evidence-check q3, exit items 1, 2, 4, 6", finding: "Full argumentative essays and counterarguments are MOE Grade 8-9 scope (p.18, p.22, p.28, p.32). The Grade 7 MOE writing objective is paragraph construction (p.4). The candidate's prerequisite also assumes Grade 7 paragraph writing is already done.", action: "Alignment decision A-L1." },
      { id: "C-L3", severity: "MEDIUM", category: "PEDAGOGICAL", where: "write-argument", finding: "Learners never planned before writing, never wrote an introduction or a conclusion, and did not evaluate anyone else's argument (legacy objective 3).", action: "Addressed by R-L2, R-L3 and R-L4 (applied): plan-argument, write-conclusion, peer-review. Writing an introduction is still not practised (reviewer decides)." },
      { id: "C-L4", severity: "LOW", category: "FACTUAL", where: "Revision ledger, peel", finding: "The ledger described PEEL as \"widely used in West African secondary writing\" without a source.", action: "Claim removed from the ledger; the reviewer confirms PEEL suits Liberian classrooms (R-L5)." },
      { id: "C-L5", severity: "MEDIUM", category: "ALIGNMENT", where: "Objective alignment table", finding: "The Grade 7 paragraph objective was labelled \"OCR only (no structured item)\". The structured source does hold it, misfiled as ACTIVITY moe-english-g7-s1-p1-constructing-sentences-antroduction-to-literatur-act1 under period I.", action: "Corrected: the reference now names the misfiled item and the OCR column (R-L7)." },
    ],
    recommendations: [
      { id: "R-L1", kind: "REVISE_CANDIDATE", scenes: ["peel", "evidence", "evidence-check", "order-paragraph", "write-argument", "exit-ticket"], recommendation: "Attribute every illustrative experience to Musu's school and say plainly that it is a made-up practice school: the evidence scene states that Musu's school examples are not facts and that learners' own evidence must be real; evidence-check option b, order-paragraph sentence D and the PEEL evidence step name Musu's school; write-argument tells learners not to borrow those examples; exit item g7-essay-exit-3 now cites Musu's class (version candidate-0.2.0).", rationale: "C-L1: the lesson must not model making up personal evidence.", applied: true },
      { id: "R-L2", kind: "RESTORE_ADAPTED", scenes: ["plan-argument", "write-argument"], recommendation: "Restore the legacy brainstorm-then-organise method as a planning step before writing: brainstorm at least four reasons, choose two, and attach one piece of real evidence with its source to each. Applied as scene plan-argument; write-argument now writes from the plan.", rationale: "Legacy Worked Example 2 method is sound; the candidate jumped from models to writing.", applied: true },
      { id: "R-L3", kind: "RESTORE_ADAPTED", scenes: ["write-conclusion"], recommendation: "Add a short task to write a three- or four-sentence conclusion for the model garden plan: restate the thesis in new words, sum up the two reasons, end with a final thought, add no new reason. Applied as scene write-conclusion. Under the paragraph-centred alternative (A-L1 option A) it moves to an extension.", rationale: "Legacy practised conclusions; the candidate only modelled them.", applied: true },
      { id: "R-L4", kind: "RESTORE_ADAPTED", scenes: ["peer-review"], recommendation: "Restore structured peer review: partners swap PEEL paragraphs, check them against four questions (point, evidence, explain, link) and write one strength and one next step with sentence starters; a learner working alone reviews their own paragraph. Applied as scene peer-review.", rationale: "Restores legacy objective 3 (evaluating arguments) and the legacy peer-review check in a form that works offline.", applied: true },
      { id: "R-L5", kind: "REVISE_CANDIDATE", scenes: ["peel"], recommendation: "Remove the unsourced \"widely used in West African secondary writing\" claim from the revision ledger.", rationale: "C-L4. Reviewer-only text; no learner content changes.", applied: true },
      { id: "R-L6", kind: "REVIEWER_DECISION", scenes: ["exit-ticket"], recommendation: "Decide whether the exit ticket needs one teacher-marked constructed prompt (for example, \"Explain what each part of an argumentative essay does\") in addition to the six single-choice items.", rationale: "The legacy exit ticket asked for explanation; the candidate measures recognition, and writing evidence stays formative.", applied: false },
      { id: "R-L7", kind: "REVISE_CANDIDATE", scenes: [], recommendation: "Record the Grade 7 paragraph objective reference with its misfiled structured item and its OCR column.", rationale: "C-L5. Reviewer-facing alignment metadata only.", applied: true },
      { id: "R-L8", kind: "DO_NOT_RESTORE", scenes: [], recommendation: "Do not restore the cassava worked example, error-analysis mistake 1, the market revenue calculations, the food metaphors, the nine legacy model answers, the Tier 3 analytical tasks or the LR-LIT-G7_9-02 alignment.", rationale: "L-L1 to L-L11.", applied: false },
    ],
    alignment: [
      {
        id: "A-L1",
        question: "What should this lesson teach in Grade 7, given the MOE Grade 7 paragraph-writing objectives, the source-structuring defect, and the Grade 8-9 argumentative-composition objectives?",
        evidence: [
          "English 7-9 p.4 (OCR; header \"GRADE: 7 PERIOD: 11\", the period after p.2's \"PERIOD: 1\" and before p.6's \"PERIOD: 111\", so period II): topic \"PARAGRAPH WRITING/LITERATURE AND READING COMPREHENSION\". Objectives column: \"1. Construct paragraphs using subject and verb agreement, capitalization, punctuations etc. 2. Develop vocabulary in paragraph writing using prefixes and suffixes 3. Discuss element of short stories… 4. Learners create simple short stories.\" Contents column: \"1. Writing paragraphs using proper grammar mechanics. 2. Writing kinds of paragraphs E.g.) descriptive, narrative etc.\"",
          "Structuring defect: those four objectives are filed as ACTIVITY items act1-act4 under period I (moe-english-g7-s1-p1-constructing-sentences-antroduction-to-literatur-*, confidence MEDIUM, flags CONTINUATION_PAGE_ASSIGNMENT and OCR_TEXT). Period I's real objectives (p.2) are sentences, kinds of sentences, friendly letters, folk tales, prose and poetry.",
          "No Grade 7 page of the English 7-9 OCR mentions essays, theses, argument or persuasion; \"point of view\" on p.11 is a literary term.",
          "Grade 6 (English 1-6 p.119): \"Construct different types of paragraphs\". Grade 8: \"Develop paragraphs\" (p.14); \"Develop composition on issues such as social norms, peer influences, decision making, etc.\" (p.18); \"Conduct research, analyze and form opinions on topics for debates\" (p.22, structured as CONTENT). Grade 9: \"Compose various kinds of writings\" including persuasive and argumentative (p.28); \"Develop and defend a points of view in composition\" (p.32).",
          "The legacy row sits in LiberiaLearn unit literacy-g7-6-paragraphs-and-text-structure, a paragraph unit.",
          "The candidate's own success check and writing task are a thesis plus one PEEL paragraph, which is paragraph-level work.",
        ],
        options: [
          { id: "A", label: "Rescope to Grade 7 paragraph writing", description: "Teach the persuasive (opinion) paragraph as one of the \"kinds of paragraphs\" in English 7-9 p.4: a claim as topic sentence, a reason, evidence, explanation and link (PEEL). Keep the three-part essay as a brief preview; move counterarguments to an extension.", consequences: "Revise objectives 1-2, essay-structure, model-plan, evidence-check q3 and exit items 1, 4 and 6; regenerate. Can bind to the p.4 objective once the structuring defect is corrected." },
          { id: "B", label: "Keep as a Grade 7 introduction to argumentative essays", description: "Keep the content, labelled as a LiberiaLearn extension that previews Grade 8 (p.18, p.22) and Grade 9 (p.28, p.32).", consequences: "No content change. The authority must accept teaching Grade 9 MOE scope in Grade 7; no Grade 7 MOE binding is possible." },
          { id: "C", label: "Move to Grade 8 or 9 and fill Grade 7 separately", description: "Rebind the candidate to Grade 9 p.32 (or Grade 8 p.18/p.22) and author a separate Grade 7 paragraph lesson for the legacy slot.", consequences: "Most scenes reusable at the higher grade (raise the writing demand). The Grade 7 slot needs new content, and repointing the legacy row needs a separate authorized change that respects its 42 ScheduledWork rows." },
        ],
        authorRecommendation: "A, because it keeps the lesson in Grade 7 without moving a Grade 9 objective down, and the candidate's practice is already paragraph-level. In every option, request correction of the p.4 structuring defect (and the p.22 objective filed as CONTENT) through the source-structuring process. This is the author's recommendation, not a decision; a qualified English reviewer and the curriculum authority decide.",
        preparedAlternative: {
          optionId: "A",
          status: "PREPARED_NOT_APPLIED",
          title: "Writing a persuasive paragraph (Grade 7 paragraph-writing scope)",
          summary: "The same lesson rebuilt around one persuasive (opinion) paragraph, a kind of paragraph under English 7-9 p.4. The essay becomes a short preview of where paragraphs go; counterarguments and full conclusions become an extension. Prepared so the authority can choose it; the candidate keeps its current objectives and grade scope until a decision is recorded.",
          objectives: [
            { id: "alt-g7-lit-persuasive-paragraph", statement: "Write a persuasive paragraph that opens with a topic sentence stating a clear opinion and a reason, then gives evidence, explains it and links back (PEEL), using correct subject-verb agreement, capitalization and punctuation.", replaces: ["ll-g7-lit-essay-structure"], moeBasis: "English 7-9 p.4, period II objectives column item 1 (\"Construct paragraphs using subject and verb agreement, capitalization, punctuations etc.\"; misfiled as ACTIVITY act1) and contents item 2 (\"Writing kinds of paragraphs E.g.) descriptive, narrative etc.\"). Bindable only after the structuring defect is corrected." },
            { id: "alt-g7-lit-claim-topic-sentence", statement: "Tell an arguable opinion from a topic, a fact or an announcement, and write a topic sentence that states an opinion with a reason.", replaces: ["ll-g7-lit-argument-build"], moeBasis: "Same p.4 paragraph objective; answering a counterargument is left to Grade 8-9 (p.18, p.22, p.32)." },
            { id: "ll-g7-lit-evidence-support", statement: "Choose true, relevant and specific evidence for a reason and explain how it supports the claim in a PEEL paragraph.", replaces: ["ll-g7-lit-evidence-support"], moeBasis: "Unchanged; supports the p.4 paragraph objective." },
          ],
          sceneImpact: [
            { sceneId: "intro", action: "ADAPT", note: "Same PTA garden situation; the goal becomes one convincing paragraph." },
            { sceneId: "objectives", action: "ADAPT", note: "State the three alternative objectives." },
            { sceneId: "warm-up", action: "KEEP", note: "Topic sentence and fact versus opinion are exactly the prior knowledge needed." },
            { sceneId: "essay-structure", action: "ADAPT", note: "Shorten to a preview: a paragraph is one building block of an essay." },
            { sceneId: "model-plan", action: "MOVE_TO_EXTENSION", note: "The full essay plan with an answer to the other side becomes optional extension reading." },
            { sceneId: "thesis", action: "ADAPT", note: "Teach the opinion topic sentence; same claim-versus-topic/fact/announcement items." },
            { sceneId: "peel", action: "KEEP", note: "Core model." },
            { sceneId: "evidence", action: "KEEP", note: "Core; keeps the made-up-practice-school notice." },
            { sceneId: "evidence-check", action: "ADAPT", note: "Keep questions 1-2; move question 3 (the other side) to the extension." },
            { sceneId: "order-paragraph", action: "KEEP", note: "Core." },
            { sceneId: "plan-argument", action: "ADAPT", note: "Plan one paragraph: opinion, one reason, real evidence and its source." },
            { sceneId: "write-argument", action: "ADAPT", note: "Write one persuasive PEEL paragraph; add a grammar-mechanics check (subject-verb agreement, capitals, punctuation) from p.4." },
            { sceneId: "write-conclusion", action: "MOVE_TO_EXTENSION", note: "Essay conclusions are essay-level; the paragraph's Link sentence does this job in Grade 7." },
            { sceneId: "peer-review", action: "KEEP", note: "Add one mechanics question to the four PEEL questions." },
            { sceneId: "review", action: "ADAPT", note: "Key ideas for a persuasive paragraph." },
            { sceneId: "exit-ticket", action: "ADAPT", note: "See item impact." },
            { sceneId: "reflect", action: "KEEP", note: "Ask which part of the paragraph is hardest." },
          ],
          itemImpact: [
            { itemId: "g7-essay-exit-1", action: "REVISE", note: "Ask where the topic sentence usually appears in a paragraph." },
            { itemId: "g7-essay-exit-2", action: "REVISE", note: "Same item, worded as an opinion topic sentence." },
            { itemId: "g7-essay-exit-3", action: "KEEP", note: "Evidence choice is unchanged." },
            { itemId: "g7-essay-exit-4", action: "REPLACE", note: "Replace the essay-conclusion item with one on the job of the Link sentence." },
            { itemId: "g7-essay-exit-5", action: "KEEP", note: "The Explain sentence is unchanged." },
            { itemId: "g7-essay-exit-6", action: "MOVE_TO_EXTENSION", note: "Counterargument; replace with a subject-verb agreement or punctuation item from p.4." },
          ],
          bindingPath: "No binding is made here. If option A is chosen: correct the p.4 structuring defect so the period II paragraph objective exists as a Grade 7 OBJECTIVE item, record the objective-basis decision, revise the candidate as above, regenerate the package with new hashes, and only then propose bindings in a Grade 7 release.",
        },
      },
    ],
  },
});
