/**
 * Interactive Learning V4 — the six representative V4 DRAFT candidates.
 *
 * Each candidate is a `candidate-lesson-v2/1.1.0` file authored as structured generator output (AI-authored in a
 * reviewed session, not a live model call) and run through exactly the pipeline every generated lesson takes:
 * strict parse → Visual Teaching Block Registry → deterministic validation and the V4 standard → deliverability →
 * the existing compat projection to a LessonExperience that Lesson Player V2 plays. Nothing here assembles,
 * approves, publishes, releases, scores, writes mastery, or changes a live lesson row or learner record.
 *
 * Source lineage is stated, never invented:
 *   FIRST_TEN_BOUND          the legacy row, revision and verified body hash pinned by the first-ten modernization
 *                            contract, and the immutable V0.2.1 package digests as the baseline this candidate does
 *                            not overwrite (those packages stay in restricted storage and are not read here)
 *   SOURCE_ROW_ONLY          the legacy row and revision from the committed cleanup snapshot; its body was never
 *                            extracted, so a legacy comparison is still owed
 *   SYNTHETIC_DEMONSTRATION  no approved source binding exists; it demonstrates the system and is never deliverable
 */
import { createHash } from "crypto";
import { readFileSync } from "fs";
import path from "path";
import { canonicalizeJson } from "@/lib/curriculum/provenance/hash";
import { ageBandForGrade } from "@/lib/curriculum/v2/authoringContext";
import { toLessonExperience } from "@/lib/curriculum/v2/compat";
import type { CandidateLessonV2, ReviewGap } from "@/lib/curriculum/v2/contract";
import { deliverabilityGaps, sceneDeliverability, type SceneDeliverability } from "@/lib/curriculum/v2/deliverability";
import { parseCandidateLessonV2 } from "@/lib/curriculum/v2/parse";
import { validateCandidateAgainstContext } from "@/lib/curriculum/v2/validate";
import type { LessonExperience } from "@/lib/learner-experience/types";
import { evaluateV4Standard, type StandardReport } from "./standard";

export const V4_CANDIDATE_DIR = "curriculum/v4/candidates";
export const V4_CANDIDATE_VERSION = "4.0.0-draft.1";
export const V4_REVIEW_DIR = "curriculum/review/v4-candidates";

const SNAPSHOT = { path: "artifacts/curriculum-cleanup-v1/snapshot.json", capturedAt: "2026-09-26T09:07:15.873Z", fileSha256: "ef89632f6b447011b9092fb17501a8eac52555783aa45d3c16a52d275ebaa16c" } as const;
const FIRST_TEN = { contract: "liberialearn-first-ten-modernization-contract/1.0.0+FT-A001+FT-A002", specRef: "docs/modernization-first-ten-spec-v1:curriculum/modernization/v1/first-ten/spec.json", specSha256: "648ec61a72e2ddff147444dadae75aff321866cfc660498a792b6a3b48e7a28b" } as const;
const V021 = { label: "first-three V0.2.1", root: "C:/restricted-authoring/review-packages/first-three-v021-final", handoff: "docs/architecture/content-factory/FIRST_THREE_V021_CANDIDATES_HANDOFF.md (PR #195)" } as const;

export type MoeRelation = "ALIGNS_WITH" | "BUILDS_ON" | "CONTENT_REFERENCE" | "PREREQUISITE_FOR";
export type V4Objective = Readonly<{ id: string; statement: string; moeReferences: readonly Readonly<{ relation: MoeRelation; moeItemId: string; text: string }>[] }>;

export type V4SourceBinding =
  | Readonly<{ kind: "FIRST_TEN_BOUND"; contentId: string; contentPk: string; legacyTitle: string; revisionId: string; legacyBodySha256: string; firstTenKey: string; contract: typeof FIRST_TEN.contract; specSha256: string;
      baseline: Readonly<{ label: string; packageDigest: string; lessonResourceDigest: string; manifestSha256: string; root: string; handoff: string; read: false }>;
      snapshot: typeof SNAPSHOT & Readonly<{ rowSha256: string }>; learnerReferences: string }>
  | Readonly<{ kind: "SOURCE_ROW_ONLY"; contentId: string; contentPk: string; legacyTitle: string; revisionId: string; snapshot: typeof SNAPSHOT & Readonly<{ rowSha256: string }> }>
  | Readonly<{ kind: "SYNTHETIC_DEMONSTRATION"; reason: string; relatedRows: readonly Readonly<{ contentId: string; title: string }>[] }>;

export type V4Lesson = Readonly<{
  key: string;
  file: string;
  lessonId: string;
  grade: number;
  subject: string;
  objectives: readonly V4Objective[];
  source: V4SourceBinding;
}>;

const MOE = {
  g7GeometryArea: { relation: "ALIGNS_WITH", moeItemId: "moe-math-g7-s2-p5-geometry-act3", text: "Assist learners to find the perimeter and area of a given polygon and present it to the class." },
  g7Polygons: { relation: "ALIGNS_WITH", moeItemId: "moe-math-g7-s2-p5-geometry-obj3", text: "Identify and write examples of the kinds and properties of angles and polygons." },
  g5Perimeter: { relation: "BUILDS_ON", moeItemId: "moe-math-g5-s2-p4-measurement-obj5", text: "Find perimeters of polygons." },
  g6Formulae: { relation: "BUILDS_ON", moeItemId: "moe-math-g6-s2-p4-uii-measurement-con4", text: "Find areas, volume, perimeter, and circumstance by measurement and using formulae." },
  g7Fractions: { relation: "CONTENT_REFERENCE", moeItemId: "moe-math-g7-s1-p2-fractions-con1", text: "Operations on fractions" },
  g5Equivalent: { relation: "BUILDS_ON", moeItemId: "moe-math-g5-s1-p1-multiplication-and-division-of-wh-ole-numbers-an-obj7", text: "Find equivalent fraction." },
  g5Multiply: { relation: "BUILDS_ON", moeItemId: "moe-math-g5-s1-p1-multiplication-and-division-of-wh-ole-numbers-an-obj2", text: "Multiply and divide whole numbers and decimals." },
  g5MultiplyProperties: { relation: "CONTENT_REFERENCE", moeItemId: "moe-math-g5-s1-p1-multiplication-and-division-of-wh-ole-numbers-an-con1", text: "Properties of multiplication" },
  g7Matter: { relation: "ALIGNS_WITH", moeItemId: "moe-general-science-g7-s1-p1-scientific-knowledge-measurement-and-non-living--obj6", text: "Discuss the state of matter and their properties" },
  g7MatterContent: { relation: "CONTENT_REFERENCE", moeItemId: "moe-general-science-g7-s1-p1-scientific-knowledge-measurement-and-non-living--con11", text: "Matter • Non-living matter characteristics and examples. • States of Matter • Solid, liquid and gas." },
  g7MapActivity: { relation: "ALIGNS_WITH", moeItemId: "moe-social-studies-g7-s1-p1-the-earth-and-the-solar-system-semester-one-act6", text: "Draw the map of Liberia and plot in the tribes according to the political sub-divisions." },
  g5Counties: { relation: "BUILDS_ON", moeItemId: "moe-social-studies-g5-s1-p1-geography-con6", text: "Ivory Coast on the East. Counties of Liberia:" },
  g7TextualEvidence: { relation: "ALIGNS_WITH", moeItemId: "moe-english-g7-s1-p1-constructing-sentences-antroduction-to-literatur-act6", text: "Learners read poem \"Mother to Son\" by Langston Hughes a) Analyze the poem b) Make connections to life citing textual evidence" },
  g6TextAnalysis: { relation: "BUILDS_ON", moeItemId: "moe-english-g6-s2-p5-english-and-reading-con1", text: "Analysis of texts Author's perspective Theme Style Tone Research Facts Corroborating evidence Information gathering" },
} as const satisfies Record<string, V4Objective["moeReferences"][number]>;

export const V4_LESSONS: readonly V4Lesson[] = Object.freeze([
  {
    key: "g7-math-area-perimeter", file: "g7-math-area-perimeter.json", lessonId: "cv4-cand-g7-math-area-perimeter", grade: 7, subject: "MATH",
    objectives: [
      { id: "ll-g7-math-ap-rectangles", statement: "Calculate the area and perimeter of rectangles with correct units, and decide which one a real-world problem needs.", moeReferences: [MOE.g7GeometryArea, MOE.g5Perimeter, MOE.g6Formulae] },
      { id: "ll-g7-math-ap-triangles", statement: "Calculate the area of a triangle from its base and perpendicular height, and its perimeter from its three sides.", moeReferences: [MOE.g7GeometryArea, MOE.g7Polygons, MOE.g6Formulae] },
    ],
    source: { kind: "SOURCE_ROW_ONLY", contentId: "hero-math-g7-geometry-area-and-perimeter-of-polygons", contentPk: "cmpyg7yx6003avoqgrqwkw7id", legacyTitle: "Calculating Area and Perimeter of Polygons for Real-World Applications", revisionId: "cmss9493703a7vo54xxnhxmjy", snapshot: { ...SNAPSHOT, rowSha256: "bada4c6dc59c80e333ae2e50633f46679d57e24a0421f3eba126dcbc21eb1d72" } },
  },
  {
    key: "g7-math-fractions", file: "g7-math-fractions.json", lessonId: "cv4-cand-g7-math-fractions", grade: 7, subject: "MATH",
    objectives: [
      { id: "ft07-o1", statement: "Represent fractions, including fractions equal to or greater than 1, on area models and a number line, naming the whole each fraction refers to.", moeReferences: [MOE.g7Fractions, MOE.g5Equivalent] },
      { id: "ft07-o2", statement: "Add and subtract fractions with like denominators, and with related denominators (e.g. halves, quarters, eighths), by using equivalent fractions.", moeReferences: [MOE.g7Fractions, MOE.g5Equivalent] },
      { id: "ft07-o3", statement: "Compare and order fractions using benchmarks (0, 1/2, 1), common denominators and the number line, and justify each comparison.", moeReferences: [MOE.g7Fractions, MOE.g5Equivalent] },
    ],
    source: { kind: "FIRST_TEN_BOUND", contentId: "lesson_mca_1", contentPk: "cmlrkjnow00dmvo7o4cajgquf", legacyTitle: "Understanding and Representing Fractions in Real-Life Contexts", revisionId: "cmss8mpl0000bvo1wos7i1ew4", legacyBodySha256: "872222a2435f151d6b215488ad2c3de2cc6c130f57d68fc5d7c6898ad301314f", firstTenKey: "ft07-g7-math-fractions", contract: FIRST_TEN.contract, specSha256: FIRST_TEN.specSha256,
      baseline: { label: V021.label, packageDigest: "cc2bc9a4d5c41eeccf5a4a0f35cb3d619780f7030a021c8431495ff5a659e1aa", lessonResourceDigest: "326c912dd588d7f895559f2cb1cfc001791538874ce909798768eb57fa520a04", manifestSha256: "36da28c83688f229ac46ba5cfee72c8a74ca4a23bbbb374a60c4d80fff5db1a8", root: V021.root, handoff: V021.handoff, read: false },
      snapshot: { ...SNAPSHOT, rowSha256: "77a8650161146251841d6ae82570a26c098db5320389c52c02315217f9991e47" }, learnerReferences: "first-ten dependencies: 4 scheduled works, 12 progress records, 19 learning events, 1 lesson plan, 1 audio asset (retained, never rewritten)." },
  },
  {
    key: "math-multiplication-models", file: "math-multiplication-models.json", lessonId: "cv4-demo-math-multiplication-models", grade: 5, subject: "MATH",
    objectives: [
      { id: "v4-demo-mult-models", statement: "Represent a multiplication as equal groups, an array and repeated addition, and explain why they show the same product.", moeReferences: [MOE.g5Multiply, MOE.g5MultiplyProperties] },
      { id: "v4-demo-mult-area-model", statement: "Multiply a two-digit number by a one- or two-digit number with an area model, splitting by place value.", moeReferences: [MOE.g5Multiply, MOE.g5MultiplyProperties] },
    ],
    source: { kind: "SYNTHETIC_DEMONSTRATION", reason: "No approved source lesson teaches equal groups, arrays and the area model together; the nearest rows are listed for a curriculum owner, not bound.", relatedRows: [{ contentId: "math-g7-multiplication-and-division-strategies-application", title: "Multiplication and Division Strategies for Real-Life Problem Solving" }, { contentId: "wk_krs5a_wed_p1", title: "Understanding Multiplication through Real-Life Applications" }] },
  },
  {
    key: "g7-science-states-of-matter", file: "g7-science-states-of-matter.json", lessonId: "cv4-cand-g7-science-states-of-matter", grade: 7, subject: "SCIENCE",
    objectives: [
      { id: "ft04-o1", statement: "Use the particle model to describe and compare solids, liquids and gases (arrangement, movement, shape and volume), with Liberian examples.", moeReferences: [MOE.g7Matter, MOE.g7MatterContent] },
      { id: "ft04-o2", statement: "Explain melting, freezing, evaporation, boiling and condensation as energy gained or lost by particles, and distinguish evaporation from boiling.", moeReferences: [MOE.g7Matter, MOE.g7MatterContent] },
      { id: "ft04-o3", statement: "Predict and explain, with evidence, what happens to temperature when ice melts in a drink (it stays at about 0 °C while ice remains), and recognise changes of state as reversible physical changes.", moeReferences: [MOE.g7Matter] },
    ],
    source: { kind: "FIRST_TEN_BOUND", contentId: "wk_mca7a_fri_p3", contentPk: "cmm7xs7v000e8vo70m7n72h3t", legacyTitle: "Understanding States of Matter Through Real-Life Examples", revisionId: "cmss8pt0j002fvo54be8gcrnd", legacyBodySha256: "d218a3e17da67bcf7e774bcace1a4080f3b2e6eb9e581d00b987ee3f8025c1e8", firstTenKey: "ft04-g7-science-states-of-matter", contract: FIRST_TEN.contract, specSha256: FIRST_TEN.specSha256,
      baseline: { label: V021.label, packageDigest: "daced29a1516f9cf0470430c2508ca560235c931b6101433c9f90c813ba2bd70", lessonResourceDigest: "e74b6feea9c54bbe2e7b09bf9e64a50601e57e853fa035305ae6f32043d744aa", manifestSha256: "3735caac694a761211e006e4fa9793c66f835acbef17c3e344a061a66d586f6b", root: V021.root, handoff: V021.handoff, read: false },
      snapshot: { ...SNAPSHOT, rowSha256: "9a3ad3a48343bf72dca080dd7b819fe53e29b563bd7a4792e36094d480080ba0" }, learnerReferences: "first-ten dependencies: 1 scheduled work, 13 progress records, 1 lesson plan (retained, never rewritten)." },
  },
  {
    key: "g7-civics-counties-capitals", file: "g7-civics-counties-capitals.json", lessonId: "cv4-cand-g7-civics-counties-capitals", grade: 7, subject: "CIVICS",
    objectives: [
      { id: "ft01-o1", statement: "Locate each of Liberia's 15 counties on an outline map and name its capital.", moeReferences: [MOE.g7MapActivity, MOE.g5Counties] },
      { id: "ft01-o2", statement: "Explain the difference between a county capital (the seat of county administration) and a county's largest or best-known town, and between the national capital and a county capital, using Nimba (Sanniquellie/Ganta) and Montserrado as examples.", moeReferences: [MOE.g7MapActivity] },
      { id: "ft01-o3", statement: "Use a county map to reason about location: name the counties crossed, and the capitals passed, on a route between two county capitals, and justify the answer from the map.", moeReferences: [MOE.g7MapActivity] },
    ],
    source: { kind: "FIRST_TEN_BOUND", contentId: "wk_mca7a_fri_p4", contentPk: "cmm7xs89200e9vo70t6qdlgho", legacyTitle: "Exploring the Counties and Capitals of Liberia", revisionId: "cmss8ptit002jvo540275dfvw", legacyBodySha256: "c7a1257c9520d452a623f474bc8c3b7987366a55e6c5a98947fdbeba1f5fb242", firstTenKey: "ft01-g7-civics-counties-capitals", contract: FIRST_TEN.contract, specSha256: FIRST_TEN.specSha256,
      baseline: { label: V021.label, packageDigest: "fd9de92735c99937cf0cc3fe0d1d85ce493bb9936d5d4b6b9d215f3cf31ab7b9", lessonResourceDigest: "401dd3406f576c5fcc0de8643071d32e3581c2030b0f669854a737cec1b4da25", manifestSha256: "cceab5702960bde4b5cc1b8d8b076ee613a1e67bc7262fc3837513c9ef18d9c7", root: V021.root, handoff: V021.handoff, read: false },
      snapshot: { ...SNAPSHOT, rowSha256: "0f91b323605e9a2fc96bbf310f31c7cd65f3796be0989caacff5f315f2740bec" }, learnerReferences: "first-ten dependencies: 1 scheduled work, 13 progress records, 3 learning events, 1 lesson plan (retained, never rewritten)." },
  },
  {
    key: "g7-english-reading-evidence", file: "g7-english-reading-evidence.json", lessonId: "cv4-cand-g7-english-reading-evidence", grade: 7, subject: "ENGLISH",
    objectives: [
      { id: "ll-g7-eng-read-infer", statement: "Read an informational text, explain words from context, and answer literal and inferential questions about it.", moeReferences: [MOE.g7TextualEvidence, MOE.g6TextAnalysis] },
      { id: "ll-g7-eng-cite-evidence", statement: "Select and quote the sentences in a text that support an answer, and explain how they support it.", moeReferences: [MOE.g7TextualEvidence, MOE.g6TextAnalysis] },
      { id: "ll-g7-eng-evidence-paragraph", statement: "Write and revise a short paragraph that makes a claim about a text, supports it with quoted evidence and explains it.", moeReferences: [MOE.g7TextualEvidence] },
    ],
    source: { kind: "SOURCE_ROW_ONLY", contentId: "english-g7-waec-style-reading-and-writing-performance", contentPk: "cmn9kgxde004ivotgtqr8fqgo", legacyTitle: "Mastering Reading Comprehension and Writing Skills for WAEC", revisionId: "cmss8r8o200e7vo546w0divyw", snapshot: { ...SNAPSHOT, rowSha256: "98d8b0db6b323d7d208c9e05d24931ae4438b32a058fe2b198cb158c2406e950" } },
  },
]);

export function findV4Lesson(key: string): V4Lesson | null {
  return V4_LESSONS.find((lesson) => lesson.key === key) ?? null;
}

export function sha256(value: unknown): string {
  return createHash("sha256").update(canonicalizeJson(value)).digest("hex");
}

/** Raw candidate text with line endings normalized, so a CRLF checkout pins the same bytes. */
export function candidateText(lesson: V4Lesson): string {
  return readFileSync(path.join(process.cwd(), V4_CANDIDATE_DIR, lesson.file), "utf8").replace(/\r\n/g, "\n");
}

export function loadV4Candidate(lesson: V4Lesson): CandidateLessonV2 {
  return parseCandidateLessonV2(candidateText(lesson));
}

/** Authority gaps no candidate content can close; each names who or what must supply it. */
export function v4BindingGaps(lesson: V4Lesson): ReviewGap[] {
  const gaps: ReviewGap[] = [
    { code: "MOE_OBJECTIVE_UNBOUND", severity: "BLOCKING", detail: `Objectives ${lesson.objectives.map((objective) => objective.id).join(", ")} are LiberiaLearn candidates related to MOE items (${[...new Set(lesson.objectives.flatMap((objective) => objective.moeReferences.map((reference) => `${reference.relation} ${reference.moeItemId}`)))].join("; ")}). A qualified curriculum reviewer binds them or rejects them.` },
    { code: "ONTOLOGY_RELEASE_MISSING", severity: "BLOCKING", detail: `No ontology release is registered for Grade ${lesson.grade} ${lesson.subject}; no governed assessment items, tool policy or concept bindings exist.` },
    { code: "V4_HUMAN_REVIEW_REQUIRED", severity: "BLOCKING", detail: "AI-authored V4 draft. A qualified subject reviewer checks accuracy, grade fit and pedagogy; a second reviewer checks the reasoning and transfer tasks (Curriculum Excellence V1)." },
  ];
  if (lesson.source.kind === "SOURCE_ROW_ONLY") gaps.push({ code: "LEGACY_BODY_NOT_COMPARED", severity: "BLOCKING", detail: `The legacy body of ${lesson.source.contentId} (revision ${lesson.source.revisionId}) lives only in the production database and was not read. A read-only extract and a section-by-section comparison are owed before this candidate can replace it.` });
  if (lesson.source.kind === "FIRST_TEN_BOUND") gaps.push({ code: "V021_BASELINE_RECONCILIATION", severity: "BLOCKING", detail: `This V4 candidate is new work beside the immutable ${lesson.source.baseline.label} package ${lesson.source.baseline.packageDigest.slice(0, 12)}… (not read, not changed). The factory owner decides how V4 presentation is merged with the V0.2.1 assessment tasks and media before any re-pin.` });
  if (lesson.source.kind === "SYNTHETIC_DEMONSTRATION") gaps.push({ code: "SYNTHETIC_DEMONSTRATION", severity: "BLOCKING", detail: `${lesson.source.reason} It can never be delivered to students as curriculum.` });
  return gaps;
}

export type V4CandidateOutcome = Readonly<{
  lesson: V4Lesson;
  candidate: CandidateLessonV2;
  candidateSha256: string;
  errors: readonly string[];
  gaps: readonly ReviewGap[];
  standard: StandardReport;
  deliverability: readonly SceneDeliverability[];
  status: "REJECTED" | "REVIEW_BLOCKED";
}>;

export function evaluateV4Candidate(lesson: V4Lesson): V4CandidateOutcome {
  const candidate = loadV4Candidate(lesson);
  const context = { grade: lesson.grade, subject: lesson.subject, ageBand: ageBandForGrade(lesson.grade), objectives: lesson.objectives };
  const validation = validateCandidateAgainstContext(candidate, context);
  const deliverability = candidate.scenes.map((scene) => sceneDeliverability(scene, null, false));
  const gaps: ReviewGap[] = [
    ...v4BindingGaps(lesson),
    ...validation.gaps,
    ...deliverabilityGaps(deliverability),
    ...candidate.assessmentRequests.map((request): ReviewGap => ({ code: "ASSESSMENT_ITEMS_PENDING", severity: "BLOCKING", detail: `${request.id} has no governed items; Assessment Player V2 items must be authored, reviewed and released before mastery can be evidenced.` })),
  ];
  return { lesson, candidate, candidateSha256: sha256(candidate), errors: validation.errors, gaps, standard: evaluateV4Standard(candidate, context), deliverability, status: validation.errors.length ? "REJECTED" : "REVIEW_BLOCKED" };
}

/** What Lesson Player V2 plays: the existing compat projection, with no release and no governed items. */
export function v4LearnerProjection(lesson: V4Lesson, candidate: CandidateLessonV2 = loadV4Candidate(lesson)): LessonExperience {
  const experience = toLessonExperience({
    identity: { lessonId: lesson.lessonId, version: V4_CANDIDATE_VERSION, title: candidate.title, grade: lesson.grade, subject: lesson.subject, unitId: lesson.key },
    ageBand: ageBandForGrade(lesson.grade),
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
  const note = lesson.source.kind === "SYNTHETIC_DEMONSTRATION"
    ? "Interactive Learning V4 synthetic demonstration. Not curriculum; never delivered to students."
    : `Interactive Learning V4 DRAFT candidate for ${lesson.source.contentId}. Not bound to an MOE objective or release, not reviewed, not approved, not published.`;
  return { ...experience, authority: { ...experience.authority, note, candidateContentIds: lesson.source.kind === "SYNTHETIC_DEMONSTRATION" ? [] : [lesson.source.contentId] } };
}

/** The deterministic review manifest: identical inputs always give identical bytes. */
export function buildV4ReviewManifest() {
  return {
    manifestVersion: "v4-candidates-review/1.0.0",
    candidateContract: "candidate-lesson-v2/1.1.0",
    candidateVersion: V4_CANDIDATE_VERSION,
    governance: { state: "DRAFT", humanReviewRequired: true, published: false, approved: false, learnerDeliverable: false },
    lessons: V4_LESSONS.map((lesson) => {
      const outcome = evaluateV4Candidate(lesson);
      const projection = v4LearnerProjection(lesson, outcome.candidate);
      return {
        key: lesson.key, lessonId: lesson.lessonId, grade: lesson.grade, subject: lesson.subject, title: outcome.candidate.title,
        source: lesson.source,
        candidate: { file: `${V4_CANDIDATE_DIR}/${lesson.file}`, fileSha256: createHash("sha256").update(candidateText(lesson)).digest("hex"), canonicalSha256: outcome.candidateSha256 },
        learnerProjectionSha256: sha256(projection),
        status: outcome.status,
        errors: outcome.errors,
        standard: { family: outcome.standard.family, balance: outcome.standard.balance, totals: outcome.standard.totals, practice: outcome.standard.practice, problems: outcome.standard.problems.map((problem) => `${problem.severity}:${problem.code}${problem.sceneId ? `:${problem.sceneId}` : ""}`) },
        scenes: outcome.candidate.scenes.map((scene) => ({ id: scene.id, phase: scene.teaching?.phase ?? null, blocks: [...(scene.teaching?.blocks ?? []), ...(scene.teaching?.visual ? [scene.teaching.visual] : [])].map((block) => block.type) })),
        blockingGaps: outcome.gaps.filter((gap) => gap.severity === "BLOCKING").map((gap) => gap.code),
      };
    }),
  };
}
