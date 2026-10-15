/**
 * Grade 7 Native Curriculum V1 — the first two native Grade 7 candidate lessons.
 *
 * The candidates are CandidateLessonV2 files (AUTHORED_FIXTURE, no live model call) that run through
 * the same strict parser, deterministic validator and deliverability checks as every Curriculum V2
 * lesson. What they cannot do yet is assemble into a CurriculumLessonV2: assembly needs a pinned
 * AuthoringContext (structured MOE objective → Grade 7 template cell → ontology release), and none of
 * those exist for these lessons. Instead of inventing them, this module records each lesson's
 * provisional LiberiaLearn objectives, how they relate to real MOE source items, and the exact
 * authority each binding still needs. Every result is a DRAFT; nothing here approves, publishes,
 * releases, scores, writes mastery or changes the live legacy rows the candidates may later replace.
 *
 * Learner-safe only: this module never reads the reviewer-only assessment materials (exit-ticket
 * answer keys, writing rubrics), which live in g7NativeReview.ts.
 */
import { createHash } from "crypto";
import { readFileSync } from "fs";
import path from "path";
import { canonicalizeJson } from "@/lib/curriculum/provenance/hash";
import type { LessonExperience, SceneMedia } from "@/lib/learner-experience/types";
import { ageBandForGrade } from "./authoringContext";
import { toLessonExperience } from "./compat";
import type { CandidateLessonV2, ReviewGap } from "./contract";
import { deliverabilityGaps, sceneDeliverability, type SceneDeliverability } from "./deliverability";
import { parseCandidateLessonV2 } from "./parse";
import { validateCandidateAgainstContext } from "./validate";

export const G7_NATIVE_PACKAGE_VERSION = "g7-native-curriculum/1.0.0" as const;
export const G7_CANDIDATE_DIR = "curriculum/v2/g7/candidates";
/** Candidate diagrams (repository files, not governed media). Served same-origin for dev previews only. */
export const G7_ASSET_DIR = "public/curriculum-candidates/g7-native-v1";
export const G7_ASSET_URL_BASE = "/curriculum-candidates/g7-native-v1";
/** Fixed so the committed review package is reproducible. */
export const G7_AUTHORED_AT = "2026-10-15T00:00:00.000Z";
export const G7_CANDIDATE_VERSION = "0.3.0";

/** How a provisional objective relates to an item in the structured MOE source. Never "is" the MOE objective. */
export type MoeRelation =
  | "BUILDS_ON"            // an earlier-grade MOE objective this lesson assumes and extends
  | "PREREQUISITE_FOR"     // a same-grade MOE objective that depends on this lesson's skill
  | "SOURCE_TEXT_UNSTRUCTURED" // MOE source text for this grade covers it, but the structured source has no OBJECTIVE item for it (OCR only, or misfiled as another kind)
  | "LATER_GRADE_SCOPE";   // the MOE places the closest objective in a later grade

export type MoeReference = Readonly<{
  relation: MoeRelation;
  /** Structured-source item id, or null when the text exists only in the OCR source (SOURCE_TEXT_UNSTRUCTURED). */
  moeItemId: string | null;
  grade: number;
  sourceMember: string;
  pages: readonly number[];
  /** Verbatim source text (structured item text or OCR line). */
  text: string;
  /** For OCR-only text: the column of the MOE grid it sits in. */
  sourceColumn?: "OBJECTIVES" | "CONTENTS";
  /** For OCR-only text that the structured source does hold, but under the wrong kind or period (not bindable as an objective). */
  misfiledAs?: Readonly<{ itemId: string; kind: string; period: number }>;
}>;

export type CandidateObjective = Readonly<{
  id: string;
  statement: string;
  /** No structured MOE Grade 7 OBJECTIVE item exists for any of these; the basis is an explicit LiberiaLearn proposal. */
  basis: "LIBERIALEARN_CANDIDATE";
  moeReferences: readonly MoeReference[];
}>;

/** The live legacy row a candidate may later replace. Metadata from the read-only cleanup snapshot; body from a read-only extract. Never written. */
export type LegacySource = Readonly<{
  contentPk: string;
  contentId: string;
  title: string;
  grade: number;
  subject: string;
  status: string;
  payloadApprovalStatus: string | null;
  unitId: string;
  unitVerification: string;
  sectionCount: number;
  currentRevisionId: string;
  snapshot: Readonly<{ path: string; capturedAt: string }>;
  learnerReferences: readonly Readonly<{ table: string; rows: number; policy: string }>[];
  /** The legacy revision body, read once in a READ ONLY transaction (scripts/extract-g7-legacy-revisions.ts) and compared in the reviewer-only legacy comparison. */
  bodyExtract: Readonly<{ path: string; contentHash: string; capturedAt: string }>;
}>;

/**
 * Content the candidate teaches beyond any MOE grade in the repository source. Recorded, never hidden:
 * it stays a proposal until the curriculum owner approves it, and blocks approval until then.
 */
export type ScopeExtension = Readonly<{
  id: string;
  scope: string;
  status: "PROPOSED_LIBERIALEARN_EXTENSION";
  approval: "PENDING_CURRICULUM_OWNER";
  objectiveIds: readonly string[];
  /** Candidate scenes that use the extended scope (a test checks this list against the candidate). */
  sceneIds: readonly string[];
  /** Reviewer-only exit items that use it. */
  exitItemIds: readonly string[];
  evidence: string;
  ifNotApproved: string;
}>;

export type G7NativeLesson = Readonly<{
  key: string;
  file: string;
  /** Candidate lesson id (cv2- prefix matches assembled V2 ids; -cand marks it unassembled). */
  lessonId: string;
  subject: "MATH" | "LITERACY";
  strand: string;
  unitLabel: string;
  objectives: readonly CandidateObjective[];
  legacy: LegacySource;
  /** Repository material the candidate reuses, pinned by path. */
  reusedMaterial: readonly Readonly<{ path: string; what: string }>[];
  /** Candidate media id → repository diagram file under G7_ASSET_DIR. */
  assets: Readonly<Record<string, string>>;
  scopeExtensions: readonly ScopeExtension[];
}>;

const G7_9_MATH = "GRADE 7-9/Math 7-9.pdf";
const G1_6_MATH = "GRADE-1-6/Math 1-6.pdf";
const G7_9_ENGLISH = "GRADE 7-9/English 7-9.pdf";
const G1_6_ENGLISH = "GRADE-1-6/English 1-6.pdf";
const SNAPSHOT = { path: "artifacts/curriculum-cleanup-v1/snapshot.json", capturedAt: "2026-09-26T09:07:15.873Z" } as const;
const LEGACY_EXTRACT_DIR = "artifacts/g7-native-curriculum-v1/legacy";
const LEGACY_CAPTURED_AT = "2026-10-15T19:09:16.876Z";

const G4_READ_WRITE: MoeReference = { relation: "BUILDS_ON", moeItemId: "moe-math-g4-s1-p1-numeration-addition-and-subtraction-obj1", grade: 4, sourceMember: G1_6_MATH, pages: [38], text: "Read and write whole numbers up to hundred thousand" };
const G4_COMPARE: MoeReference = { relation: "BUILDS_ON", moeItemId: "moe-math-g4-s1-p1-numeration-addition-and-subtraction-obj2", grade: 4, sourceMember: G1_6_MATH, pages: [38], text: "Compare and order whole numbers to hundred thousand" };
const G4_DECIMALS: MoeReference = { relation: "BUILDS_ON", moeItemId: "moe-math-g4-s2-p4-multiplication-and-division-of-2-digits-multipli-obj7", grade: 4, sourceMember: G1_6_MATH, pages: [45], text: "Read and write decimal numerals up to hundredths place." };
const G4_DECIMALS_COMPARE: MoeReference = { relation: "BUILDS_ON", moeItemId: "moe-math-g4-s2-p4-multiplication-and-division-of-2-digits-multipli-obj8", grade: 4, sourceMember: G1_6_MATH, pages: [45], text: "Compare and order decimal numerals up to hundredths place." };
const G6_ROUND: MoeReference = { relation: "BUILDS_ON", moeItemId: "moe-math-g6-s1-p3-operations-obj2", grade: 6, sourceMember: G1_6_MATH, pages: [67], text: "Round off decimals to the nearest tenth, hundredths and thousandths" };
const G7_CONVERT: MoeReference = { relation: "PREREQUISITE_FOR", moeItemId: "moe-math-g7-s1-p3-decimals-percents-and-fractions-obj1", grade: 7, sourceMember: G7_9_MATH, pages: [10], text: "Convert from decimal to percent/fraction and vice versa" };
const G7_APPLY: MoeReference = { relation: "PREREQUISITE_FOR", moeItemId: "moe-math-g7-s1-p3-decimals-percents-and-fractions-obj2", grade: 7, sourceMember: G7_9_MATH, pages: [10], text: "Apply decimal and percent to the solution of problems involving commissions, discounts, taxes, interest, profits and losses and rayolty" };

const G7_PARAGRAPHS: MoeReference = { relation: "SOURCE_TEXT_UNSTRUCTURED", moeItemId: null, grade: 7, sourceMember: G7_9_ENGLISH, pages: [4], text: "1. Construct paragraphs using subject and verb agreement, capitalization, punctuations etc.", sourceColumn: "OBJECTIVES", misfiledAs: { itemId: "moe-english-g7-s1-p1-constructing-sentences-antroduction-to-literatur-act1", kind: "ACTIVITY", period: 1 } };
const G7_KINDS_OF_PARAGRAPHS: MoeReference = { relation: "SOURCE_TEXT_UNSTRUCTURED", moeItemId: null, grade: 7, sourceMember: G7_9_ENGLISH, pages: [4], text: "2. Writing kinds of paragraphs E.g.) descriptive, narrative etc.", sourceColumn: "CONTENTS" };
const G6_PARAGRAPH_TYPES: MoeReference = { relation: "BUILDS_ON", moeItemId: "moe-english-g6-s1-a-subject-verb-agreement-b-using-verbs-in-senten-obj2", grade: 6, sourceMember: G1_6_ENGLISH, pages: [119], text: "Construct different types of paragraphs" };
const G8_COMPOSITION_ISSUES: MoeReference = { relation: "LATER_GRADE_SCOPE", moeItemId: "moe-english-g8-s2-composition-literature-and-reading-comprehension-obj3", grade: 8, sourceMember: G7_9_ENGLISH, pages: [18], text: "Develop composition on issues such as social norms, peer influences, decision making, etc." };
const G9_POINT_OF_VIEW: MoeReference = { relation: "LATER_GRADE_SCOPE", moeItemId: "moe-english-g9-s2-composition-literature-reading-comprehension-sem-obj3", grade: 9, sourceMember: G7_9_ENGLISH, pages: [32], text: "Develop and defend a points of view in composition" };

export const G7_NATIVE_LESSONS: readonly G7NativeLesson[] = Object.freeze([
  {
    key: "math-number-sense-place-value",
    file: "math-number-sense-place-value.json",
    lessonId: "cv2-cand-g7-math-number-sense-place-value",
    subject: "MATH",
    strand: "Number sense / place value",
    unitLabel: "Number sense and place value (LiberiaLearn unit, not an MOE period)",
    objectives: [
      { id: "ll-g7-math-place-value-read-write", statement: "Read and write numbers from the millions to the thousandths in standard form, word form and expanded form.", basis: "LIBERIALEARN_CANDIDATE", moeReferences: [G4_READ_WRITE, G4_DECIMALS, G7_CONVERT] },
      { id: "ll-g7-math-place-value-digit-value", statement: "Explain the value of a digit from its place, using the ten-times relationship between neighbouring places from the thousandths to the millions.", basis: "LIBERIALEARN_CANDIDATE", moeReferences: [G4_READ_WRITE, G6_ROUND, G7_CONVERT] },
      { id: "ll-g7-math-place-value-compare", statement: "Compare and order whole numbers and decimals to the thousandths by comparing place values from the left.", basis: "LIBERIALEARN_CANDIDATE", moeReferences: [G4_COMPARE, G4_DECIMALS_COMPARE, G7_APPLY] },
    ],
    legacy: {
      contentPk: "cmoeaemvu01i6vor4u3zch5hq", contentId: "math-g7-1-number-sense-and-place-value-foundations", title: "Number Sense and Place Value: Foundations",
      grade: 7, subject: "MATH", status: "APPROVED", payloadApprovalStatus: "PENDING_APPROVAL", unitId: "math-g7-1-number-sense-and-place-value",
      unitVerification: "Cleanup plan V1 queues RETURN_FOR_REVIEW (row APPROVED while its payload is PENDING_APPROVAL).", sectionCount: 8, currentRevisionId: "cmss8t4hz00unvo54epnfst66",
      snapshot: SNAPSHOT,
      learnerReferences: [{ table: "CurriculumLessonPlan", rows: 1, policy: "REPOINT" }, { table: "LearningEvent", rows: 18, policy: "RETAIN_HISTORY" }, { table: "ScheduledWork", rows: 1, policy: "RETAIN_HISTORY" }],
      bodyExtract: { path: `${LEGACY_EXTRACT_DIR}/math-number-sense-place-value.json`, contentHash: "93cc90030c242b39cfbf9a86095802d967a7fd2dbcb6af7b9f7227f312fc540b", capturedAt: LEGACY_CAPTURED_AT },
    },
    reusedMaterial: [
      { path: "components/experience/demo/PlaceValueDemo.tsx", what: "Student Experience V3 synthetic DEMO: Musu's library fund example (L$2,350,480), practice items on 1,742,009, 3,060,500 and five million forty thousand nine, and their misconception feedback." },
      { path: "lib/learner-experience/demo/placeValue.ts", what: "Deterministic place-value arithmetic used by the package tests to verify every exit-ticket key." },
    ],
    assets: {
      "hero-numbers": "math-hero-numbers.svg",
      "place-value-chart": "math-place-value-chart.svg",
      "ten-times-ladder": "math-ten-times-ladder.svg",
      "library-fund": "math-library-fund.svg",
      "compare-decimals": "math-compare-decimals.svg",
    },
    scopeExtensions: [
      {
        id: "ext-g7-math-whole-numbers-millions",
        scope: "Reading, writing, valuing and comparing whole numbers in the millions (the millions period).",
        status: "PROPOSED_LIBERIALEARN_EXTENSION",
        approval: "PENDING_CURRICULUM_OWNER",
        objectiveIds: ["ll-g7-math-place-value-read-write", "ll-g7-math-place-value-digit-value", "ll-g7-math-place-value-compare"],
        sceneIds: ["intro", "objectives", "chart", "ten-times", "worked-example", "build-number", "counter-chart", "compare-strategy", "misconceptions", "practice", "review"],
        exitItemIds: ["g7-pv-exit-1", "g7-pv-exit-3", "g7-pv-exit-6"],
        evidence: "MOE Grade 4 stops at whole numbers to hundred thousand (Math 1-6 p.38), and the word \"million\" does not occur in the extracted MOE Math 1-6 or Math 7-9 text. Decimals to the thousandths do have MOE support (Grade 4 p.45, Grade 6 p.67).",
        ifNotApproved: "Limit whole numbers to hundred thousands (or mark the millions material as optional enrichment), and revise or withdraw exit items g7-pv-exit-1, g7-pv-exit-3 and g7-pv-exit-6 (legacy comparison A-M1, option B).",
      },
    ],
  },
  {
    key: "literacy-essay-structure-argument",
    file: "literacy-essay-structure-argument.json",
    lessonId: "cv2-cand-g7-literacy-essay-structure-argument",
    subject: "LITERACY",
    strand: "Writing / argumentative essay",
    unitLabel: "Paragraphs and text structure (LiberiaLearn unit, not an MOE period)",
    objectives: [
      { id: "ll-g7-lit-essay-structure", statement: "Identify and explain the parts of an argumentative essay: an introduction that ends with a thesis statement, body paragraphs that each begin with a topic sentence, and a conclusion.", basis: "LIBERIALEARN_CANDIDATE", moeReferences: [G7_PARAGRAPHS, G7_KINDS_OF_PARAGRAPHS, G6_PARAGRAPH_TYPES, G8_COMPOSITION_ISSUES] },
      { id: "ll-g7-lit-argument-build", statement: "Build an argument by writing an arguable thesis statement with reasons and answering a counterargument.", basis: "LIBERIALEARN_CANDIDATE", moeReferences: [G8_COMPOSITION_ISSUES, G9_POINT_OF_VIEW] },
      { id: "ll-g7-lit-evidence-support", statement: "Choose true, relevant and specific evidence for a reason and explain how it supports the claim in a PEEL paragraph.", basis: "LIBERIALEARN_CANDIDATE", moeReferences: [G7_PARAGRAPHS, G9_POINT_OF_VIEW] },
    ],
    legacy: {
      contentPk: "cmpyjp25s00cqvorwisg1rhyn", contentId: "hero-literacy-g7-essay-writing-structure-and-argumentation", title: "Understanding Essay Writing: Structure and Argumentation",
      grade: 7, subject: "LITERACY", status: "published", payloadApprovalStatus: null, unitId: "literacy-g7-6-paragraphs-and-text-structure",
      unitVerification: "Cleanup plan V1 keeps the unit key with reason no_verified_unit_match (no verified MOE unit).", sectionCount: 2, currentRevisionId: "cmss94dmc03b7vo54ryf3hqk1",
      snapshot: SNAPSHOT,
      learnerReferences: [{ table: "LearningEvent", rows: 1, policy: "RETAIN_HISTORY" }, { table: "ScheduledWork", rows: 42, policy: "RETAIN_HISTORY" }],
      bodyExtract: { path: `${LEGACY_EXTRACT_DIR}/literacy-essay-structure-argument.json`, contentHash: "3809f98290bae0a5b8364e4bc2faf8c257111f0c21e3c383acd45310fc236ba6", capturedAt: LEGACY_CAPTURED_AT },
    },
    reusedMaterial: [],
    assets: {
      "essay-structure": "literacy-essay-structure.svg",
      "peel-paragraph": "literacy-peel-paragraph.svg",
      "evidence-test": "literacy-evidence-test.svg",
    },
    scopeExtensions: [],
  },
]);

export function findG7NativeLesson(key: string): G7NativeLesson | null {
  return G7_NATIVE_LESSONS.find((lesson) => lesson.key === key) ?? null;
}

export function sha256(value: unknown): string {
  return createHash("sha256").update(canonicalizeJson(value)).digest("hex");
}

/** Hash of a text file with line endings normalized, so a CRLF checkout pins the same bytes. */
export function textFileSha256(relativePath: string): string {
  return createHash("sha256").update(readFileSync(path.join(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n")).digest("hex");
}

export function loadG7Candidate(lesson: G7NativeLesson): CandidateLessonV2 {
  return parseCandidateLessonV2(readFileSync(path.join(process.cwd(), G7_CANDIDATE_DIR, lesson.file), "utf8"));
}

/**
 * Authority gaps no candidate content can close: the binding chain that assembly requires does not exist
 * for these lessons. Each names exactly what an authorized human or governed process must supply.
 */
export function bindingGaps(lesson: G7NativeLesson): ReviewGap[] {
  const gaps: ReviewGap[] = [];
  const unstructured = lesson.objectives.some((objective) => objective.moeReferences.some((reference) => reference.relation === "SOURCE_TEXT_UNSTRUCTURED"));
  const laterGrade = lesson.objectives.some((objective) => objective.moeReferences.some((reference) => reference.relation === "LATER_GRADE_SCOPE"));
  gaps.push({ code: "MOE_OBJECTIVE_UNBOUND", severity: "BLOCKING", detail: `No structured MOE Grade 7 ${lesson.subject} OBJECTIVE item matches ${lesson.objectives.map((objective) => objective.id).join(", ")}; the objectives are LiberiaLearn candidates. A qualified curriculum reviewer must accept them as a LiberiaLearn extension (with the MOE relationships listed) or rebind the lesson to an existing MOE objective.` });
  if (unstructured) gaps.push({ code: "MOE_SOURCE_STRUCTURING_DEFECT", severity: "BLOCKING", detail: "MOE Grade 7 Language Arts paragraph-writing objectives (English 7-9.pdf p.4, objectives column of period II, OCR header 'PERIOD: 11') were structured as ACTIVITY items act1-act4 under period I, so no bindable Grade 7 paragraph objective exists. The structured source must be corrected through the source-structuring process before any Grade 7 writing objective can bind." });
  if (laterGrade) gaps.push({ code: "MOE_GRADE_SCOPE_REVIEW", severity: "BLOCKING", detail: "The MOE places argumentative composition ('develop and defend a point of view') in Grade 9 (p.32) and issue-based composition in Grade 8 (p.18). The reviewer decides whether this Grade 7 lesson stays as an introduction, is rescoped to paragraph writing, or moves grade." });
  gaps.push({ code: "TEMPLATE_CELL_MISSING", severity: "BLOCKING", detail: `No governed template cell exists for Grade 7 ${lesson.subject} (lib/learning-authority/cells has Grade 4 Math only), so no unit placement, interaction classification or concept link can be resolved.` });
  gaps.push({ code: "ONTOLOGY_RELEASE_MISSING", severity: "BLOCKING", detail: `No ontology release is registered for Grade 7 ${lesson.subject} (curriculum/releases/k12-scope.json); concepts, standard/skill bindings, governed items, evidence and tool policies are all absent.` });
  for (const extension of lesson.scopeExtensions) gaps.push({ code: "SCOPE_EXTENSION_UNAPPROVED", severity: "BLOCKING", detail: `${extension.id}: ${extension.scope} This is a proposed LiberiaLearn extension beyond the repository MOE source, pending curriculum-owner approval. ${extension.evidence} If not approved: ${extension.ifNotApproved}` });
  gaps.push({ code: "LEGACY_COMPARISON_SIGNOFF", severity: "BLOCKING", detail: `The legacy body of ${lesson.legacy.contentId} (revision ${lesson.legacy.currentRevisionId}, content hash ${lesson.legacy.bodyExtract.contentHash.slice(0, 12)}…) was read read-only and compared section by section in legacy-comparison.md. A qualified reviewer confirms the comparison and decides every restoration and revision recommendation before approval.` });
  return gaps;
}

export type G7CandidateOutcome = Readonly<{
  lesson: G7NativeLesson;
  candidate: CandidateLessonV2;
  candidateSha256: string;
  errors: readonly string[];
  gaps: readonly ReviewGap[];
  deliverability: readonly SceneDeliverability[];
  /** Instruction can be reviewed now; approval and release binding cannot complete while any BLOCKING gap remains. */
  status: "REJECTED" | "REVIEW_BLOCKED";
}>;

/** Strict parse, deterministic validation and deliverability for one candidate, plus its authority gaps. */
export function evaluateG7Candidate(lesson: G7NativeLesson): G7CandidateOutcome {
  const candidate = loadG7Candidate(lesson);
  const validation = validateCandidateAgainstContext(candidate, { grade: 7, subject: lesson.subject, ageBand: ageBandForGrade(7), objectives: lesson.objectives });
  // No governed items exist for any exit ticket yet, and no candidate proposes a lab.
  const deliverability = candidate.scenes.map((scene) => sceneDeliverability(scene, null, false));
  const gaps: ReviewGap[] = [
    ...bindingGaps(lesson),
    ...validation.gaps,
    ...deliverabilityGaps(deliverability),
    ...candidate.assessmentRequests.map((request): ReviewGap => ({ code: "ASSESSMENT_ITEMS_PENDING", severity: "BLOCKING", detail: `${request.id} has no governed items; candidate exit-ticket items are in the reviewer-only assessment review and must be reviewed and released in an ontology release before Assessment Player V2 can score them.` })),
  ];
  return { lesson, candidate, candidateSha256: sha256(candidate), errors: validation.errors, gaps, deliverability, status: validation.errors.length ? "REJECTED" : "REVIEW_BLOCKED" };
}

/**
 * The learner projection: what a future release would deliver through Lesson Player V2. Built by the
 * existing compat projection, so reviewer-only fields (expected observations, misconception notes,
 * gaps, provenance) never cross it. It carries no release (null) and an empty governed item list.
 */
export function g7LearnerProjection(lesson: G7NativeLesson, candidate: CandidateLessonV2 = loadG7Candidate(lesson)): LessonExperience {
  const experience = toLessonExperience({
    identity: { lessonId: lesson.lessonId, version: G7_CANDIDATE_VERSION, title: candidate.title, grade: 7, subject: lesson.subject, unitId: lesson.legacy.unitId },
    ageBand: ageBandForGrade(7),
    scenes: candidate.scenes,
    labLinks: [],
    assessmentHandoffs: candidate.assessmentRequests.map((request) => ({
      requestId: request.id, player: "ASSESSMENT_PLAYER_V2", scoring: "SERVER_AUTHORITY", objectiveIds: request.objectiveIds, interaction: request.interaction,
      evidenceType: request.evidenceType, difficulty: request.difficulty, misconceptionIds: request.misconceptionIds,
      tools: { allowed: request.tools.requested.filter((tool) => !request.tools.prohibited.includes(tool)), prohibited: request.tools.prohibited }, offline: request.offline,
      governedItems: [],
    })),
    objectives: lesson.objectives.map((objective) => ({ id: objective.id, statement: objective.statement, conceptIds: [], standardCodes: [], skillIds: [] })),
    authoring: { releaseId: null, releaseIdentity: null },
  });
  // Candidate diagrams are repository files, attached by declared media id with the candidate's own alt text.
  const scenes = experience.scenes.map((scene) => {
    const declared = candidate.scenes.find((candidateScene) => candidateScene.id === scene.id)?.media ?? [];
    const media: SceneMedia[] = declared.filter((item) => lesson.assets[item.id]).map((item) => ({ kind: "DIAGRAM", ref: `${G7_ASSET_URL_BASE}/${lesson.assets[item.id]}`, alt: item.altText }));
    return media.length ? { ...scene, media } : scene;
  });
  return {
    ...experience,
    authority: { ...experience.authority, note: "Grade 7 native candidate (Curriculum V2 draft). Not bound to an MOE objective or release, not reviewed, not approved, not published." },
    scenes,
    offline: { ...experience.offline, requiredAssets: [...new Set(scenes.flatMap((scene) => (scene.media ?? []).map((media) => media.ref)))] },
  };
}
