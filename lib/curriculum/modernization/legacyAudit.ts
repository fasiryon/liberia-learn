/**
 * Library-wide legacy lesson audit against Curriculum Excellence Standard V1.
 *
 * Evaluates one exact legacy revision (CurriculumContentRevision snapshot, schema v1) across the 18
 * modernization audit areas, each tied to Excellence V1 criteria. Two kinds of finding are kept apart:
 *
 *   MECHANICAL          deterministic, reproducible from the snapshot bytes (counts, arithmetic, structure).
 *   JUDGMENT_INDICATOR  a mechanical signal that something needs expert judgment (possible mislabel,
 *                       unsourced statistic, reading level). It is never a verdict on its own.
 *
 * Areas whose criteria need human judgment (accuracy of explanations, conceptual depth, cultural
 * accuracy, alignment decisions) are reported AWAITING_INDEPENDENT_REVIEW. This module never rates a
 * judgment criterion MET, never treats published content as effective, and never rates learning.
 * The automated auditor is not a reviewer: its output is mechanical evidence for one.
 */
import { createHash } from "crypto";
import { canonicalizeJson } from "@/lib/curriculum/provenance/hash";
import type { LibraryExtractRecord } from "./extract";
import {
  applicableExaminations, loadMoeObjectives, parseLegacyAlignmentClaims, resolveMoeCell, suggestMoeObjectives,
  WAEC_TAG_EVIDENCE, type MoeObjective, type ObjectiveSuggestion,
} from "./moeAuthority";
import {
  checkArithmetic, excerpt, factualClaimIndicators, flattenText, fleschKincaidGrade, hasContent, liberianContextMarkers,
  numberedItems, paragraphs, primaryText, questionCount, serializationArtifacts, sentences, skeletonKey, splitSections, subjectScores,
  SUBJECT_FAMILY, topicWords, wordCount, type Section, type SectionRole, type SnapshotV1,
} from "./text";

export const LIBRARY_AUDIT_VERSION = "liberialearn-library-audit/1.0.0" as const;

export const AUDIT_AREAS = [
  "SUBJECT_ACCURACY", "CONCEPTUAL_DEPTH", "GRADE_APPROPRIATENESS", "PREREQUISITE_DIAGNOSTIC", "SEQUENCE_WORKED_EXAMPLES",
  "COGNITIVE_LOAD", "MISCONCEPTION_FEEDBACK", "GUIDED_INDEPENDENT_PRACTICE", "AUTHENTIC_PERFORMANCE_REASONING",
  "ASSESSMENT_VALIDITY", "DELAYED_RETENTION", "TRANSFER", "ACCESSIBILITY_OFFLINE", "LIBERIAN_CONTEXT_EVIDENCE",
  "MOE_TRACEABILITY", "WAEC_ALIGNMENT", "ADVANCED_ENRICHMENT", "STUDENT_EXPERIENCE_V3",
] as const;
export type AuditArea = (typeof AUDIT_AREAS)[number];

/** Excellence V1 criteria each area evidences (lib/curriculum/excellence/standard.ts). */
export const AREA_CRITERIA: Readonly<Record<AuditArea, readonly string[]>> = Object.freeze({
  SUBJECT_ACCURACY: ["NF-ACC-1", "NF-ACC-2"],
  CONCEPTUAL_DEPTH: ["LM-CON-2", "NF-ACC-2"],
  GRADE_APPROPRIATENESS: ["NF-ALN-3", "LM-ACS-1"],
  PREREQUISITE_DIAGNOSTIC: ["NF-PRG-1"],
  SEQUENCE_WORKED_EXAMPLES: ["LM-PRG-1"],
  COGNITIVE_LOAD: ["LM-ACS-1"],
  MISCONCEPTION_FEEDBACK: ["LM-CON-1"],
  GUIDED_INDEPENDENT_PRACTICE: ["LM-PRG-1"],
  AUTHENTIC_PERFORMANCE_REASONING: ["LM-RSN-1", "GE-RSN-1"],
  ASSESSMENT_VALIDITY: ["NF-ASM-1", "NF-ACC-1", "LM-ASM-1", "LM-ASM-2"],
  DELAYED_RETENTION: ["LM-ASM-3"],
  TRANSFER: ["GE-TRN-1"],
  ACCESSIBILITY_OFFLINE: ["NF-ACS-1"],
  LIBERIAN_CONTEXT_EVIDENCE: ["NF-REL-1", "LM-REL-1"],
  MOE_TRACEABILITY: ["NF-ALN-1"],
  WAEC_ALIGNMENT: ["NF-ALN-2"],
  ADVANCED_ENRICHMENT: ["GE-EXT-1"],
  STUDENT_EXPERIENCE_V3: ["NF-ACS-1"],
});

/** Areas that need a qualified human before anything beyond mechanical indicators can be said. */
const JUDGMENT_AREAS: ReadonlySet<AuditArea> = new Set<AuditArea>([
  "SUBJECT_ACCURACY", "CONCEPTUAL_DEPTH", "GRADE_APPROPRIATENESS", "LIBERIAN_CONTEXT_EVIDENCE", "MOE_TRACEABILITY",
]);

export type FindingKind = "MECHANICAL" | "JUDGMENT_INDICATOR" | "GOVERNANCE";
export type FindingSeverity = "BLOCKING" | "MAJOR" | "MINOR" | "INFO";

export type AuditFinding = Readonly<{
  id: string;
  area: AuditArea;
  code: string;
  kind: FindingKind;
  severity: FindingSeverity;
  /** Exact location: "delivery.body#s5 \"Worked Example 1\"" or a snapshot JSON pointer. */
  where: string;
  evidence: string;
  issue: string;
  proposedCorrection: string;
}>;

export type AreaStatus = "MET" | "PARTIALLY_MET" | "NOT_MET" | "NOT_APPLICABLE" | "AWAITING_INDEPENDENT_REVIEW";

export type AreaResult = Readonly<{
  area: AuditArea;
  criteria: readonly string[];
  /** Mechanical status from the checks; judgment areas stay AWAITING_INDEPENDENT_REVIEW unless a mechanical check already failed. */
  status: AreaStatus;
  basis: "MECHANICAL" | "MECHANICAL_PLUS_JUDGMENT";
  findingIds: readonly string[];
}>;

export const REVIEW_OUTCOMES = [
  "PASS_MECHANICAL_CHECKS", "REVISE", "REBUILD_REQUIRED", "BLOCKED_SOURCE_OR_AUTHORITY", "AWAITING_INDEPENDENT_REVIEW",
] as const;
export type ReviewOutcome = (typeof REVIEW_OUTCOMES)[number];

export type AuditMetrics = Readonly<{
  primaryTextField: string | null;
  learnerWords: number;
  structuredWords: number;
  sections: number;
  maxSectionWords: number;
  denseSections: number;
  longParagraphs: number;
  fkGrade: number | null;
  boilerplateSentenceShare: number;
  objectives: number;
  workedExampleSections: number;
  guidedPracticeSections: number;
  independentPracticeSections: number;
  assessmentQuestions: number;
  keyedQuestions: number;
  arithmeticChecked: number;
  arithmeticErrors: number;
  liberianContextMarkers: number;
  factualClaimIndicators: number;
  imagesWithoutAlt: number;
  alignmentClaims: number;
  resolvedMoeIds: number;
  inventedAlignmentCodes: number;
}>;

export type LessonAudit = Readonly<{
  auditVersion: typeof LIBRARY_AUDIT_VERSION;
  contentId: string;
  revisionId: string;
  contentHash: string;
  grade: number;
  subject: string;
  mechanicalOutcome: Exclude<ReviewOutcome, "AWAITING_INDEPENDENT_REVIEW">;
  /** No independent reviewer has rated this exact revision against Excellence V1. */
  judgmentStatus: "AWAITING_INDEPENDENT_REVIEW";
  /** The reported outcome: the mechanical outcome when it is decisive (rebuild / blocked), otherwise awaiting review. */
  reviewOutcome: ReviewOutcome;
  moeCell: Readonly<{ relation: string; moeSubject: string | null; objectiveCount: number }>;
  moeObjectiveLeads: readonly ObjectiveSuggestion[];
  examinations: readonly string[];
  areas: readonly AreaResult[];
  findings: readonly AuditFinding[];
  metrics: AuditMetrics;
  /** Mechanical audit is design evidence only; it is never learning evidence. */
  isLearningEvidence: false;
  auditDigest: string;
}>;

/** Library-wide facts a single-lesson audit needs (boilerplate, duplicates). Built once per extract. */
export type LibraryAuditContext = Readonly<{
  /** skeletonKey (topic words removed) → number of distinct lessons containing that sentence skeleton. */
  sentenceLessonCounts: ReadonlyMap<string, number>;
  boilerplateThreshold: number;
  /** contentId → other contentIds sharing the same normalized title in the same grade/subject. */
  duplicateTitles: ReadonlyMap<string, readonly string[]>;
  /** contentId → other contentIds with byte-identical learner text. */
  duplicateBodies: ReadonlyMap<string, readonly string[]>;
  objectives: readonly MoeObjective[];
}>;

const DENSE_SECTION_WORDS = 300;
/** Demo and smoke-test rows that were written into the production catalog. */
export const isDemoOrTestFixture = (contentId: string, version: string) =>
  /^(demo-content-|cha-demo-|p2a-production-smoke)/.test(contentId) || /multimedia-demo/.test(contentId) || version.startsWith("p2a-production-smoke");
const NEIGHBOUR_FAMILIES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  COMPUTING: ["ENGINEERING", "MATH"], ENGINEERING: ["SCIENCE", "MATH", "COMPUTING"], SCIENCE: ["MATH", "ENGINEERING"],
  MATH: ["SCIENCE", "COMPUTING", "ENGINEERING"], SOCIAL: [], LANGUAGE: [],
});
const LONG_PARAGRAPH_WORDS = 120;
/** Text budget per lesson for emergent readers (grades 1-3), learner-facing words. */
const EMERGENT_READER_WORD_BUDGET = 1200;

export function buildLibraryAuditContext(records: readonly LibraryExtractRecord[], objectives: readonly MoeObjective[] = loadMoeObjectives()): LibraryAuditContext {
  const sentenceLessonCounts = new Map<string, number>();
  const titleGroups = new Map<string, string[]>();
  const bodyGroups = new Map<string, string[]>();
  for (const record of records) {
    const snapshot = record.revision?.contentSnapshot as SnapshotV1 | undefined;
    if (!snapshot) continue;
    const { text } = primaryText(snapshot);
    const topic = topicWords(snapshot.identity.title ?? "");
    const keys = new Set(sentences(text).filter((sentence) => wordCount(sentence) >= 8).map((sentence) => skeletonKey(sentence, topic)));
    for (const key of keys) sentenceLessonCounts.set(key, (sentenceLessonCounts.get(key) ?? 0) + 1);
    const titleKey = `${record.row.grade}|${record.row.subject}|${(record.row.title ?? snapshot.identity.title ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}`;
    titleGroups.set(titleKey, [...(titleGroups.get(titleKey) ?? []), record.contentId]);
    if (text.trim()) {
      const bodyKey = createHash("sha256").update(text.replace(/\s+/g, " ").trim()).digest("hex");
      bodyGroups.set(bodyKey, [...(bodyGroups.get(bodyKey) ?? []), record.contentId]);
    }
  }
  const peers = (groups: Map<string, string[]>) => {
    const out = new Map<string, readonly string[]>();
    for (const ids of groups.values()) if (ids.length > 1) for (const id of ids) out.set(id, Object.freeze(ids.filter((other) => other !== id).sort()));
    return out;
  };
  return Object.freeze({
    sentenceLessonCounts,
    boilerplateThreshold: Math.max(8, Math.ceil(records.length * 0.01)),
    duplicateTitles: peers(titleGroups),
    duplicateBodies: peers(bodyGroups),
    objectives,
  });
}

type Draft = Omit<AuditFinding, "id">;

const sectionRef = (field: string | null, section: Section) => `delivery.${field ?? "body"}#s${section.index} "${excerpt(section.heading, 60)}" (line ${section.line})`;

function structuredQuestions(snapshot: SnapshotV1): { prompts: number; keyed: number; where: string[] } {
  let prompts = 0;
  let keyed = 0;
  const where: string[] = [];
  const quiz = snapshot.assessment.quiz as { questions?: unknown } | null;
  const quizQuestions = Array.isArray(quiz?.questions) ? quiz.questions : [];
  quizQuestions.forEach((question) => {
    prompts += 1;
    const record = (question ?? {}) as Record<string, unknown>;
    if (["expectedAnswer", "answer", "correctAnswer", "correct", "answerKey"].some((key) => hasContent(record[key]))) keyed += 1;
  });
  if (quizQuestions.length) where.push("assessment.quiz.questions");
  const list = Array.isArray(snapshot.assessment.assessmentQuestions) ? snapshot.assessment.assessmentQuestions : [];
  list.forEach((question) => {
    prompts += 1;
    if (question && typeof question === "object" && ["expectedAnswer", "answer", "correctAnswer", "correct", "answerKey"].some((key) => hasContent((question as Record<string, unknown>)[key]))) keyed += 1;
  });
  if (list.length) where.push("assessment.assessmentQuestions");
  const problemSets = Array.isArray(snapshot.assessment.problemSets) ? snapshot.assessment.problemSets : [];
  for (const set of problemSets) {
    const problems = Array.isArray((set as { problems?: unknown })?.problems) ? (set as { problems: unknown[] }).problems : [];
    for (const problem of problems) {
      prompts += 1;
      const record = (problem ?? {}) as Record<string, unknown>;
      if (["answer", "solution", "expectedAnswer", "correctAnswer"].some((key) => hasContent(record[key]))) keyed += 1;
    }
  }
  if (problemSets.length) where.push("assessment.problemSets");
  return { prompts, keyed, where };
}

/**
 * Audits one legacy revision. Deterministic: the same snapshot and context always produce the same
 * findings, outcome and digest.
 */
export function auditLegacyLesson(record: LibraryExtractRecord, context: LibraryAuditContext): LessonAudit {
  if (!record.revision) throw new Error(`NO_CURRENT_REVISION:${record.contentId}`);
  if (record.revision.snapshotSchemaVersion !== 1) throw new Error(`UNSUPPORTED_SNAPSHOT_SCHEMA:${record.contentId}:${record.revision.snapshotSchemaVersion}`);
  const snapshot = record.revision.contentSnapshot as SnapshotV1;
  const grade = record.row.grade;
  const subject = record.row.subject.toUpperCase();
  const drafts: Draft[] = [];
  const add = (finding: Draft) => drafts.push(finding);

  const { field, text } = primaryText(snapshot);
  const sections = splitSections(text);
  const headed = sections.filter((section) => section.level > 0);
  const byRole = (role: SectionRole) => headed.filter((section) => section.role === role);
  const instructionText = ["workedExamples", "guidedPractice", "independentPractice", "teacherExplanation", "realWorldApplication", "remediation", "extension", "activities"]
    .map((key) => flattenText(snapshot.instruction[key])).join("\n");
  const assessmentText = flattenText(snapshot.assessment);
  const structuredWords = wordCount(instructionText) + wordCount(assessmentText);
  const learnerWords = wordCount(text);
  const allText = `${snapshot.identity.title}\n${text}\n${instructionText}\n${assessmentText}`;
  const objectives = snapshot.instruction.objectives ?? [];

  // ── Structural integrity, duplicates ─────────────────────────────────────
  const totalWords = learnerWords + structuredWords;
  if (totalWords < 250) {
    add({ area: "CONCEPTUAL_DEPTH", code: "STUB_CONTENT", kind: "MECHANICAL", severity: "BLOCKING", where: `delivery.${field ?? "body"}`,
      evidence: `${totalWords} words of learner and structured content`, issue: "The revision is a stub: there is not enough content to teach the stated objective.",
      proposedCorrection: "Replace with a full candidate lesson (Track C); keep the legacy revision for history." });
  }
  const topic = topicWords(snapshot.identity.title ?? "");
  const sentenceKeys = sentences(text).filter((sentence) => wordCount(sentence) >= 8);
  const boilerplate = sentenceKeys.filter((sentence) => (context.sentenceLessonCounts.get(skeletonKey(sentence, topic)) ?? 0) >= context.boilerplateThreshold);
  const boilerplateShare = sentenceKeys.length ? boilerplate.length / sentenceKeys.length : 0;
  if (sentenceKeys.length >= 5 && boilerplateShare >= 0.4) {
    add({ area: "CONCEPTUAL_DEPTH", code: "TEMPLATE_SHELL", kind: "MECHANICAL", severity: boilerplateShare >= 0.6 ? "BLOCKING" : "MAJOR", where: `delivery.${field}`,
      evidence: `${Math.round(boilerplateShare * 100)}% of substantive sentences recur, with only the topic words changed, in ≥${context.boilerplateThreshold} lessons, e.g. "${excerpt(boilerplate[0], 120)}"`,
      issue: "Much of the lesson is template text shared across the library rather than instruction specific to this objective.",
      proposedCorrection: boilerplateShare >= 0.6 ? "Rebuild the teaching sequence for this objective (Track C)." : "Replace template passages with objective-specific explanation and examples (Track B)." });
  }
  // Placeholder sections describe what a section should contain instead of containing it.
  const instructional = headed.filter((section) => !["OBJECTIVES", "TEACHER_NOTES", "GUARDIAN", "OTHER"].includes(section.role));
  const placeholders = instructional.filter((section) =>
    section.words > 0 && section.words < 70 && !/\d|["“”]|e\.g\.|for example|for instance/i.test(section.text)
    && /^(model|use|guide|ask|re-?teach|provide|include|create|introduce|give|have|invite|encourage|present|show|review|learners (complete|work|practise|practice)|students (complete|work)|the teacher (introduces|models|guides|explains))\b/i.test(section.text.trim()));
  // A second template style describes the lesson in "should" sentences ("Guided practice should include…").
  const instructionalSentences = instructional.flatMap((section) => sentences(section.text));
  const META_DIRECTIVE = /\b(the teacher should|learners should|students should|should (include|ask|use|build|be able|end|move|connect)|this lesson teaches|worked example \d+: (model|compare|show))\b/i;
  const metaShare = instructionalSentences.length ? instructionalSentences.filter((sentence) => META_DIRECTIVE.test(sentence) && !/\d/.test(sentence.replace(/worked example \d+/i, ""))).length / instructionalSentences.length : 0;
  if (instructional.length >= 4 && metaShare >= 0.5) placeholders.push(...instructional.filter((section) => !placeholders.includes(section)));
  if (placeholders.length >= 4 && placeholders.length >= instructional.length / 2) {
    add({ area: "CONCEPTUAL_DEPTH", code: "PLACEHOLDER_CONTENT", kind: "MECHANICAL", severity: "BLOCKING", where: sectionRef(field, placeholders[0]),
      evidence: `${placeholders.length} of ${instructional.length} instructional sections are directions with no content, e.g. "${excerpt(placeholders[0].text, 110)}"`,
      issue: "The lesson is a template shell: sections say what to teach (\"Model one complete example…\") but contain no explanation, example or item.",
      proposedCorrection: "Replace with a full candidate lesson (Track C); keep the legacy revision for history." });
  }
  const sameBody = context.duplicateBodies.get(record.contentId);
  if (sameBody?.length) {
    add({ area: "STUDENT_EXPERIENCE_V3", code: "DUPLICATE_LEARNER_TEXT", kind: "MECHANICAL", severity: "MAJOR", where: `delivery.${field}`,
      evidence: `identical learner text in ${sameBody.slice(0, 3).join(", ")}${sameBody.length > 3 ? ` (+${sameBody.length - 3})` : ""}`,
      issue: "The same learner text is catalogued as more than one lesson.", proposedCorrection: "Choose one canonical lesson; map the others to it in the legacy mapping plan (never delete referenced rows)." });
  }
  const sameTitle = context.duplicateTitles.get(record.contentId);
  if (sameTitle?.length && !sameBody?.length) {
    add({ area: "STUDENT_EXPERIENCE_V3", code: "DUPLICATE_TITLE", kind: "MECHANICAL", severity: "MINOR", where: "identity.title",
      evidence: `same grade/subject/title as ${sameTitle.slice(0, 3).join(", ")}${sameTitle.length > 3 ? ` (+${sameTitle.length - 3})` : ""}`,
      issue: "Several lessons share a title in the same grade and subject; learners and teachers cannot tell them apart.", proposedCorrection: "Disambiguate titles or consolidate in the modernization plan." });
  }

  // ── 1. Subject-matter accuracy ───────────────────────────────────────────
  // Error-analysis sections and sentences that describe a learner's mistake show wrong arithmetic on purpose.
  const DELIBERATE_ERROR = /(error|mistake|incorrect|wrong|might (say|write|think|calculate)|may (say|write|think|calculate)|confus|instead of|rather than|misconception)/i;
  const checkedSources = [
    ...sections.filter((section) => section.role !== "ERROR_ANALYSIS").map((section) => ({ text: section.text, section: section as Section | undefined, where: sectionRef(field, section) })),
    { text: `${instructionText}
${assessmentText}`, section: undefined, where: "instruction/assessment (structured)" },
  ];
  let arithmeticCount = 0;
  const arithmeticErrors: { expression: string; computed: number; where: string }[] = [];
  for (const source of checkedSources) {
    for (const check of checkArithmetic(source.text)) {
      const context = source.text.slice(Math.max(0, check.index - 160), check.index + check.expression.length + 60);
      if (DELIBERATE_ERROR.test(context)) continue;
      arithmeticCount += 1;
      if (!check.correct) arithmeticErrors.push({ expression: check.expression, computed: check.computed, where: source.where });
    }
  }
  for (const error of arithmeticErrors.slice(0, 5)) {
    add({ area: "SUBJECT_ACCURACY", code: "ARITHMETIC_ERROR", kind: "MECHANICAL", severity: arithmeticErrors.length >= 3 ? "BLOCKING" : "MAJOR",
      where: error.where, evidence: `"${error.expression}" but the computed value is ${error.computed}`, issue: "Stated arithmetic is wrong; learners would copy an incorrect result.",
      proposedCorrection: "Correct the stated result to the computed value in the evidence, then re-check every dependent step and answer." });
  }
  const family = SUBJECT_FAMILY[subject];
  const scores = subjectScores(allText);
  if (family) {
    const own = scores[family] ?? 0;
    const [topFamily, topScore] = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    // Cross-curricular neighbours (a computing lesson about shapes, an engineering lesson about solar energy) are not mislabels.
    const neighbour = NEIGHBOUR_FAMILIES[family]?.includes(topFamily) ?? false;
    if (topFamily !== family && !neighbour && topScore >= 15 && topScore >= 4 * Math.max(own, 1)) {
      add({ area: "SUBJECT_ACCURACY", code: "POSSIBLE_SUBJECT_MISLABEL", kind: "JUDGMENT_INDICATOR", severity: "MAJOR", where: "identity.subject",
        evidence: `labelled ${subject}; ${topFamily.toLowerCase()} vocabulary ${topScore} vs ${family.toLowerCase()} ${own}`,
        issue: "The content reads as a different subject from its catalogue label, so it may be mis-mapped.",
        proposedCorrection: "A curriculum reviewer confirms the subject; a confirmed mis-mapping moves the lesson to Track C (replace and re-catalogue) and every assignment that relied on the label is reviewed." });
    }
  }
  const artifacts = serializationArtifacts(`${text}
${instructionText}`);
  if (artifacts) {
    add({ area: "STUDENT_EXPERIENCE_V3", code: "SERIALIZATION_ARTIFACT", kind: "MECHANICAL", severity: "MAJOR", where: `delivery.${field}`,
      evidence: `${artifacts} placeholder(s) such as "[object Object]" in learner or instruction text`,
      issue: "Content was lost when the lesson was saved; learners see a placeholder instead of the material (often worked examples).",
      proposedCorrection: "Recover the lost material from an earlier source revision if one exists; otherwise rewrite it. Treat the affected sections as missing." });
  }

  // ── 2. Conceptual depth ──────────────────────────────────────────────────
  const concept = byRole("CONCEPT");
  const conceptWords = concept.reduce((sum, section) => sum + section.words, 0) + wordCount(flattenText(snapshot.instruction.teacherExplanation));
  if (headed.length > 0 && conceptWords < 80) {
    add({ area: "CONCEPTUAL_DEPTH", code: "THIN_CONCEPT_EXPLANATION", kind: "MECHANICAL", severity: "MAJOR", where: concept[0] ? sectionRef(field, concept[0]) : `delivery.${field}`,
      evidence: `${conceptWords} words of concept explanation`, issue: "The core idea is barely explained before practice begins.",
      proposedCorrection: "Add an explicit explanation of the concept with a representation (diagram, model or example) before worked examples." });
  }

  // ── 3. Grade appropriateness ─────────────────────────────────────────────
  const fk = fleschKincaidGrade(text);
  if (fk !== null && fk > grade + 3) {
    add({ area: "GRADE_APPROPRIATENESS", code: "READING_LEVEL_ABOVE_GRADE", kind: "JUDGMENT_INDICATOR", severity: fk > grade + 5 ? "MAJOR" : "MINOR", where: `delivery.${field}`,
      evidence: `Flesch-Kincaid grade ${fk} for a grade ${grade} lesson`, issue: "Sentence and word length suggest the text is harder to read than the grade allows.",
      proposedCorrection: "Shorten sentences and gloss vocabulary without lowering the conceptual demand; confirm with a language reviewer." });
  }
  if (grade <= 3 && learnerWords > EMERGENT_READER_WORD_BUDGET) {
    add({ area: "GRADE_APPROPRIATENESS", code: "TEXT_LOAD_EXCEEDS_EMERGENT_READER_BUDGET", kind: "MECHANICAL", severity: "MAJOR", where: `delivery.${field}`,
      evidence: `${learnerWords} learner-facing words; budget for grades 1-3 is ${EMERGENT_READER_WORD_BUDGET}`,
      issue: "Emergent readers cannot work through this much text; the lesson depends on reading it can't assume.",
      proposedCorrection: "Rebuild as short teacher-led scenes with oral, pictorial and concrete activities (Track B)." });
  }

  // ── 4. Prerequisites and diagnostic ──────────────────────────────────────
  const prior = byRole("PRIOR_KNOWLEDGE");
  const priorText = prior.map((section) => section.text).join("\n");
  const diagnostic = questionCount(priorText) > 0 || numberedItems(priorText) > 0;
  const fallback = /\b(if (students|learners|pupils|they) (struggle|cannot|can't|are unable|have difficulty|do not|don't)|re-?teach|review (the|this) first|small group|go back to)\b/i.test(`${priorText}\n${flattenText(snapshot.instruction.remediation)}`);
  if (!prior.length) {
    add({ area: "PREREQUISITE_DIAGNOSTIC", code: "NO_PREREQUISITE_CHECK", kind: "MECHANICAL", severity: "MAJOR", where: `delivery.${field}`, evidence: "no prior-knowledge or warm-up section",
      issue: "Instruction assumes prerequisites it never checks.", proposedCorrection: "Add a short diagnostic per prerequisite with a stated route for learners who lack it." });
  } else if (!diagnostic || !fallback) {
    add({ area: "PREREQUISITE_DIAGNOSTIC", code: !diagnostic ? "PRIOR_KNOWLEDGE_NOT_DIAGNOSTIC" : "NO_FALLBACK_ROUTE", kind: "MECHANICAL", severity: "MAJOR", where: sectionRef(field, prior[0]),
      evidence: !diagnostic ? "prior-knowledge section asks no question" : "no route stated for learners who lack the prerequisite",
      issue: "The prerequisite is mentioned but not diagnosed with a fallback, so learners without it fall behind unseen.",
      proposedCorrection: "Turn activation into a diagnostic item per prerequisite and state what happens when a learner misses it." });
  }

  // ── 5. Sequence and worked examples ──────────────────────────────────────
  const worked = byRole("WORKED_EXAMPLE");
  const workedStructured = hasContent(snapshot.instruction.workedExamples);
  if (!worked.length && !workedStructured) {
    add({ area: "SEQUENCE_WORKED_EXAMPLES", code: "NO_WORKED_EXAMPLE", kind: "MECHANICAL", severity: "MAJOR", where: `delivery.${field}`, evidence: "no worked-example section or structured workedExamples",
      issue: "Learners never see the method modelled before practising it.", proposedCorrection: "Add at least two worked examples that fade support (Track B)." });
  } else if (worked.length && worked.every((section) => !/\bstep\b|^\s*\d+[.)]|first|then|next|finally|so\b/im.test(section.text))) {
    add({ area: "SEQUENCE_WORKED_EXAMPLES", code: "WORKED_EXAMPLE_WITHOUT_STEPS", kind: "MECHANICAL", severity: "MINOR", where: sectionRef(field, worked[0]),
      evidence: excerpt(worked[0].text, 140), issue: "Worked examples state answers without showing the reasoning steps.", proposedCorrection: "Show each step and why it is taken." });
  }
  const order: SectionRole[] = ["CONCEPT", "WORKED_EXAMPLE", "GUIDED_PRACTICE", "INDEPENDENT_PRACTICE", "ASSESSMENT"];
  const firstAt = order.map((role) => headed.find((section) => section.role === role)?.index ?? -1).filter((index) => index >= 0);
  if (firstAt.some((index, i) => i > 0 && index < firstAt[i - 1])) {
    add({ area: "SEQUENCE_WORKED_EXAMPLES", code: "SEQUENCE_OUT_OF_ORDER", kind: "MECHANICAL", severity: "MINOR", where: `delivery.${field}`,
      evidence: `first sections by role: ${order.map((role) => `${role}@${headed.find((section) => section.role === role)?.index ?? "-"}`).join(" ")}`,
      issue: "Practice or assessment appears before the instruction it depends on.", proposedCorrection: "Reorder to explain → model → guided → independent → check." });
  }

  // ── 6. Cognitive load ─────────────────────────────────────────────────────
  const dense = headed.filter((section) => section.words > DENSE_SECTION_WORDS);
  const longParagraphs = sections.flatMap((section) => paragraphs(section.text)).filter((paragraph) => wordCount(paragraph) > LONG_PARAGRAPH_WORDS);
  if (dense.length) {
    add({ area: "COGNITIVE_LOAD", code: "DENSE_SECTION", kind: "MECHANICAL", severity: dense.length >= 3 ? "MAJOR" : "MINOR", where: sectionRef(field, dense[0]),
      evidence: `${dense.length} section(s) over ${DENSE_SECTION_WORDS} words; largest ${Math.max(...dense.map((section) => section.words))}`,
      issue: "Sections carry more text than one scene can present without overload.", proposedCorrection: "Split into scenes with one idea each and move teacher-only material out of learner text." });
  }
  if (longParagraphs.length >= 3) {
    add({ area: "COGNITIVE_LOAD", code: "LONG_PARAGRAPHS", kind: "MECHANICAL", severity: "MINOR", where: `delivery.${field}`,
      evidence: `${longParagraphs.length} paragraphs over ${LONG_PARAGRAPH_WORDS} words, e.g. "${excerpt(longParagraphs[0], 100)}"`,
      issue: "Long unbroken paragraphs raise reading load.", proposedCorrection: "Break into short paragraphs, lists or labelled steps." });
  }

  // ── 7. Misconceptions and corrective feedback ────────────────────────────
  const errorSections = byRole("ERROR_ANALYSIS");
  const optionFeedback = (() => {
    const quiz = snapshot.assessment.quiz as { questions?: { options?: { feedback?: unknown }[] }[] } | null;
    return (quiz?.questions ?? []).some((question) => (question.options ?? []).some((option) => hasContent(option.feedback)));
  })();
  if (!errorSections.length) {
    add({ area: "MISCONCEPTION_FEEDBACK", code: "NO_MISCONCEPTION_TEACHING", kind: "MECHANICAL", severity: "MAJOR", where: `delivery.${field}`, evidence: "no error-analysis or misconception section",
      issue: "Common errors are neither taught against nor anticipated.", proposedCorrection: "Catalogue the objective's misconceptions and teach against each (Track A)." });
  }
  if (!optionFeedback) {
    add({ area: "MISCONCEPTION_FEEDBACK", code: "NO_MISCONCEPTION_SPECIFIC_FEEDBACK", kind: "MECHANICAL", severity: "MAJOR", where: "assessment",
      evidence: "no item carries response-specific feedback or a misconception-mapped distractor",
      issue: "Wrong answers cannot be diagnosed or corrected by cause.", proposedCorrection: "Map each distractor or response pattern to a catalogued misconception with corrective feedback." });
  }

  // ── 8. Guided and independent practice ───────────────────────────────────
  const guided = byRole("GUIDED_PRACTICE");
  const independent = byRole("INDEPENDENT_PRACTICE");
  const guidedStructured = hasContent(snapshot.instruction.guidedPractice);
  const independentStructured = hasContent(snapshot.instruction.independentPractice);
  if (!guided.length && !guidedStructured) {
    add({ area: "GUIDED_INDEPENDENT_PRACTICE", code: "NO_GUIDED_PRACTICE", kind: "MECHANICAL", severity: "MAJOR", where: `delivery.${field}`, evidence: "no guided-practice section or field",
      issue: "Learners go from watching to working alone with no supported attempt.", proposedCorrection: "Add guided items with partial support and feedback (Track B)." });
  }
  if (!independent.length && !independentStructured) {
    add({ area: "GUIDED_INDEPENDENT_PRACTICE", code: "NO_INDEPENDENT_PRACTICE", kind: "MECHANICAL", severity: "MAJOR", where: `delivery.${field}`, evidence: "no independent-practice section or field",
      issue: "Learners never practise without support.", proposedCorrection: "Add unscaffolded practice for each objective (Track B)." });
  }

  // ── 9. Authentic performance and reasoning ───────────────────────────────
  const reasoningPrompts = (`${independent.map((s) => s.text).join("\n")}\n${byRole("ASSESSMENT").map((s) => s.text).join("\n")}\n${assessmentText}`.match(/\b(explain|justify|why|prove|show (that|how|your)|convince|argue|compare|evaluate|in your own words)\b/gi) ?? []).length;
  const rubric = hasContent(snapshot.assessment.rubric);
  if (!reasoningPrompts) {
    add({ area: "AUTHENTIC_PERFORMANCE_REASONING", code: "NO_REASONING_TASK", kind: "MECHANICAL", severity: "MAJOR", where: "assessment / independent practice",
      evidence: "no explain/justify/compare prompt in independent work or assessment", issue: "Learners are never asked to produce reasoning, only answers.",
      proposedCorrection: "Add a constructed-response reasoning or performance task at scaffold NONE scored by a rubric." });
  } else if (!rubric) {
    add({ area: "AUTHENTIC_PERFORMANCE_REASONING", code: "REASONING_TASK_WITHOUT_RUBRIC", kind: "MECHANICAL", severity: "MINOR", where: "assessment.rubric",
      evidence: `${reasoningPrompts} reasoning prompt(s), no rubric`, issue: "Reasoning prompts exist but nothing says what good reasoning looks like, so they cannot be scored consistently.",
      proposedCorrection: "Attach a short analytic rubric (protected) to each reasoning task." });
  }

  // ── 10. Assessment validity and answer quality ───────────────────────────
  const assessmentSections = byRole("ASSESSMENT");
  const bodyAssessmentQuestions = assessmentSections.reduce((sum, section) => sum + Math.max(questionCount(section.text), numberedItems(section.text)), 0);
  const structured = structuredQuestions(snapshot);
  const totalQuestions = bodyAssessmentQuestions + structured.prompts;
  const answerKeySections = byRole("ANSWER_KEY");
  const keyedInBody = answerKeySections.length > 0 || /\b(answer key|correct answer|answers?:)/i.test(assessmentSections.map((s) => s.text).join("\n"));
  const keyed = structured.keyed + (keyedInBody ? bodyAssessmentQuestions : 0);
  if (totalQuestions === 0) {
    add({ area: "ASSESSMENT_VALIDITY", code: "NO_END_OF_LESSON_ASSESSMENT", kind: "MECHANICAL", severity: "MAJOR", where: "assessment", evidence: "no assessment questions found in body or structured fields",
      issue: "Nothing checks whether learners met the objectives.", proposedCorrection: "Add an independent end-of-lesson demonstration covering every objective." });
  } else {
    if (keyed < totalQuestions) {
      add({ area: "ASSESSMENT_VALIDITY", code: "UNKEYED_ASSESSMENT_ITEMS", kind: "MECHANICAL", severity: keyed === 0 ? "MAJOR" : "MINOR", where: structured.where[0] ?? (assessmentSections[0] ? sectionRef(field, assessmentSections[0]) : "assessment"),
        evidence: `${keyed} of ${totalQuestions} assessment prompts have an answer or scoring key`, issue: "Unkeyed items cannot be scored consistently or verified for correctness.",
        proposedCorrection: "Write a protected key or rubric for every item and verify each key independently." });
    }
    if (objectives.length > 1 && totalQuestions < objectives.length) {
      add({ area: "ASSESSMENT_VALIDITY", code: "OBJECTIVES_UNDER_ASSESSED", kind: "MECHANICAL", severity: "MINOR", where: "instruction.objectives",
        evidence: `${objectives.length} objectives, ${totalQuestions} assessment prompts`, issue: "Some objectives cannot have their own assessment evidence.",
        proposedCorrection: "Assess every objective at least once at the end of the lesson." });
    }
  }
  const exposedKey = [...answerKeySections, ...assessmentSections].find((section) => /\b(answer key|correct answer|answers?:)/i.test(`${section.heading}\n${section.text}`));
  if (exposedKey) {
    add({ area: "ASSESSMENT_VALIDITY", code: "ANSWER_KEY_IN_LEARNER_TEXT", kind: "MECHANICAL", severity: "MAJOR", where: sectionRef(field, exposedKey),
      evidence: excerpt(`${exposedKey.heading}: ${exposedKey.text}`, 140), issue: "Answers sit in the learner-facing text, so assessment evidence is not independent.",
      proposedCorrection: "Move keys to the protected reviewer/teacher projection; never deliver them to learners." });
  }

  // ── 11. Delayed retention ────────────────────────────────────────────────
  // The legacy content model has no delayed-retrieval construct; only an explicitly scheduled return counts.
  if (!/\b(in (one|two|three|a) weeks?|after (one|two|a) weeks?|next week'?s? (review|quiz|check)|delayed (check|review|quiz|retrieval))\b/i.test(allText)) {
    add({ area: "DELAYED_RETENTION", code: "NO_DELAYED_RETRIEVAL", kind: "MECHANICAL", severity: "MAJOR", where: "assessment",
      evidence: "no delayed or spaced retrieval task", issue: "Nothing checks whether learning lasts beyond the lesson.",
      proposedCorrection: "Add a retention blueprint: retrieval items for each mastery objective at ≥7 days (LM-ASM-3)." });
  }

  // ── 12. Transfer ─────────────────────────────────────────────────────────
  // "Energy transfer" or "real-world application" is not a transfer task; only an explicitly new context counts.
  if (!/\b(transfer (task|question|problem|challenge)|apply (it|this|what you (have )?learned) (to|in) a new|new (context|situation)|unfamiliar (context|situation|problem))\b/i.test(allText)) {
    add({ area: "TRANSFER", code: "NO_TRANSFER_TASK", kind: "MECHANICAL", severity: "MAJOR", where: "assessment",
      evidence: "no task marked as a new context, representation or genre", issue: "Learners are only tested in rehearsed contexts, so transfer is unknown.",
      proposedCorrection: "Add an unscaffolded transfer task in a context the lesson did not rehearse (GE-TRN-1)." });
  }

  // ── 13. Accessibility and offline ────────────────────────────────────────
  const imagesWithoutAlt = (text.match(/!\[\s*\]\(/g) ?? []).length;
  if (imagesWithoutAlt) {
    add({ area: "ACCESSIBILITY_OFFLINE", code: "IMAGE_WITHOUT_ALT_TEXT", kind: "MECHANICAL", severity: "MAJOR", where: `delivery.${field}`, evidence: `${imagesWithoutAlt} image(s) with empty alt text`,
      issue: "Screen-reader users miss the image's information.", proposedCorrection: "Write alt text that carries the instructional content of each image." });
  }
  const hero = snapshot.resources.heroImage as { metadata?: { alt?: unknown } } | null;
  if (hero && !hasContent(hero.metadata?.alt)) {
    add({ area: "ACCESSIBILITY_OFFLINE", code: "HERO_IMAGE_WITHOUT_ALT", kind: "MECHANICAL", severity: "MINOR", where: "resources.heroImage.metadata.alt", evidence: "hero image has no alt text",
      issue: "Decorative status or meaning of the hero image is unstated.", proposedCorrection: "Add alt text, or mark the image decorative." });
  }
  const labs = Array.isArray(snapshot.resources.labs) ? snapshot.resources.labs : [];
  if (labs.length && !/\b(offline|paper|without (the )?(lab|internet|device))\b/i.test(allText)) {
    add({ area: "ACCESSIBILITY_OFFLINE", code: "LAB_WITHOUT_OFFLINE_FALLBACK", kind: "MECHANICAL", severity: "MINOR", where: "resources.labs", evidence: `${labs.length} lab link(s), no offline or paper alternative`,
      issue: "Learners without a device or connection lose the lab's objective.", proposedCorrection: "Add an objective-preserving paper or text walkthrough fallback." });
  }
  const wideTable = text.split(/\r?\n/).find((line) => /^\|/.test(line) && (line.match(/\|/g) ?? []).length > 6);
  if (wideTable) {
    add({ area: "ACCESSIBILITY_OFFLINE", code: "WIDE_TABLE", kind: "MECHANICAL", severity: "MINOR", where: `delivery.${field}`, evidence: excerpt(wideTable, 120),
      issue: "Tables with more than five columns overflow at 390px and are hard to navigate by screen reader.", proposedCorrection: "Split or transpose the table; give it a caption." });
  }

  // ── 14. Liberian context and unsourced evidence ──────────────────────────
  const markers = liberianContextMarkers(allText);
  const claims = factualClaimIndicators(`${text}\n${instructionText}`);
  if (markers === 0) {
    add({ area: "LIBERIAN_CONTEXT_EVIDENCE", code: "NO_LIBERIAN_CONTEXT", kind: "MECHANICAL", severity: "MINOR", where: `delivery.${field}`, evidence: "no Liberian place, currency, food, language or institution named",
      issue: "No task applies the objective to a Liberian situation.", proposedCorrection: "Add at least one authentic Liberian application; label invented data as invented." });
  }
  for (const claim of claims.slice(0, 5)) {
    add({ area: "LIBERIAN_CONTEXT_EVIDENCE", code: `UNSOURCED_CLAIM:${claim.code}`, kind: "JUDGMENT_INDICATOR", severity: "MAJOR", where: `delivery.${field}`, evidence: `"${claim.excerpt}"`,
      issue: "A factual or statistical claim is stated without a source; it may be invented.",
      proposedCorrection: "Verify against a named, dated source and cite it, or remove it or label it as an invented example." });
  }

  // ── 15. MOE traceability ─────────────────────────────────────────────────
  const cell = resolveMoeCell(subject, grade, context.objectives);
  const claimsMoe = parseLegacyAlignmentClaims(snapshot.standards.moeAlignments, context.objectives);
  const resolved = claimsMoe.filter((claim) => claim.kind === "STRUCTURED_MOE_ID");
  const invented = claimsMoe.filter((claim) => claim.kind === "LIBERIALEARN_INVENTED_CODE");
  if (cell.relation === "NONE") {
    add({ area: "MOE_TRACEABILITY", code: "NO_MOE_SOURCE_FOR_SUBJECT", kind: "GOVERNANCE", severity: "BLOCKING", where: "identity.subject",
      evidence: cell.note, issue: "There is no verified MOE curriculum to trace this lesson's objectives to; its scope is LiberiaLearn-originated.",
      proposedCorrection: "A curriculum owner records a scope decision (adopt as LiberiaLearn enrichment with owned objectives, or retire). Until then: governance hold (Track D)." });
  } else if (cell.relation === "PROXY") {
    add({ area: "MOE_TRACEABILITY", code: "PROXY_SUBJECT_DECISION_REQUIRED", kind: "GOVERNANCE", severity: "MAJOR", where: "identity.subject",
      evidence: `${subject} → MOE ${cell.moeSubject} (${cell.objectiveCount} objectives at grade ${grade}). ${cell.note}`,
      issue: "Objectives can only be traced through a broader MOE subject (see evidence); that mapping is a curriculum-owner decision, not an MOE fact.",
      proposedCorrection: "Record the owner's decision to trace this subject through the named MOE subject before release; candidate work may proceed." });
  }
  if (cell.relation !== "NONE" && resolved.length === 0) {
    add({ area: "MOE_TRACEABILITY", code: invented.length ? "UNVERIFIED_ALIGNMENT_CODES" : "NO_MOE_MAPPING", kind: "MECHANICAL", severity: "MAJOR", where: "standards.moeAlignments",
      evidence: invented.length ? `${invented.length} code(s) not in the MOE structured source, e.g. ${invented[0].code}${invented[0].method ? ` (method: ${invented[0].method})` : ""}` : "no alignment claims",
      issue: invented.length ? "Alignment codes are LiberiaLearn-invented labels, not MOE objectives; they must not be presented as MOE requirements." : "No objective is traced to the MOE curriculum.",
      proposedCorrection: "Map each objective to a structured MOE objective id with source page, reviewed by a curriculum owner; lexical leads are attached to this audit." });
  }

  // ── 16. WAEC alignment ───────────────────────────────────────────────────
  const examinations = applicableExaminations(grade);
  if (examinations.length) {
    const tags = snapshot.standards.waecSyllabusTopics ?? [];
    add({ area: "WAEC_ALIGNMENT", code: tags.length ? "WAEC_TAGS_UNVERIFIED" : "NO_WAEC_BASELINE_MAPPING", kind: "GOVERNANCE", severity: "MAJOR", where: "standards.waecSyllabusTopics",
      evidence: tags.length ? `${tags.length} keyword tag(s) (${tags.slice(0, 3).join(", ")}); evidence ${WAEC_TAG_EVIDENCE}` : `${examinations.join("/")} applies at grade ${grade}; no mapping`,
      issue: "No verified WAEC syllabus source is held in the repository, so examination alignment cannot be stated beyond 'topic may be relevant'.",
      proposedCorrection: "Obtain and register the official WAEC syllabus for the subject, then map with stated specificity and NOT_CLAIMED status." });
  }

  // ── 17. Advanced enrichment ──────────────────────────────────────────────
  if (!byRole("EXTENSION").length && !hasContent(snapshot.instruction.extension)) {
    add({ area: "ADVANCED_ENRICHMENT", code: "NO_EXTENSION_PATH", kind: "MECHANICAL", severity: "MINOR", where: "instruction.extension", evidence: "no extension or challenge",
      issue: "Ready learners have nowhere to go beyond the objective.", proposedCorrection: "Add an optional, non-gating extension clearly labelled as beyond grade scope." });
  }

  // ── 18. Student Experience V3 compatibility ──────────────────────────────
  if (learnerWords > 0 && headed.length < 3) {
    add({ area: "STUDENT_EXPERIENCE_V3", code: "NO_SCENE_STRUCTURE", kind: "MECHANICAL", severity: learnerWords > 600 ? "MAJOR" : "MINOR", where: `delivery.${field}`,
      evidence: `${headed.length} heading(s) for ${learnerWords} words`, issue: "The text has no scene structure for slideshow pagination; it would render as one long slide.",
      proposedCorrection: "Restructure into scenes with one purpose each (V2 scene contract)." });
  }
  if (headed.length > 24) {
    add({ area: "STUDENT_EXPERIENCE_V3", code: "TOO_MANY_SCENES", kind: "MECHANICAL", severity: "MINOR", where: `delivery.${field}`, evidence: `${headed.length} sections`,
      issue: "The lesson would paginate into more scenes than one sitting supports.", proposedCorrection: "Consolidate or split into two lessons." });
  }
  if (/<\/?(div|span|table|br|img|script|style)\b/i.test(text)) {
    add({ area: "STUDENT_EXPERIENCE_V3", code: "RAW_HTML_IN_LEARNER_TEXT", kind: "MECHANICAL", severity: "MINOR", where: `delivery.${field}`, evidence: "raw HTML tags in markdown",
      issue: "Raw HTML bypasses the V3 renderer's typography and accessibility.", proposedCorrection: "Convert to markdown or structured scene fields." });
  }
  if (record.row.status.toUpperCase() === "REVOKED" || record.provenance?.lifecycleState === "REVOKED") {
    add({ area: "STUDENT_EXPERIENCE_V3", code: "REVOKED_CONTENT", kind: "GOVERNANCE", severity: "BLOCKING", where: "status", evidence: `status ${record.row.status}, lifecycle ${record.provenance?.lifecycleState}`,
      issue: "Revoked content cannot be modernized or redelivered without a governance decision.", proposedCorrection: "Confirm retirement; map dependants to a replacement through the legacy mapping plan." });
  }
  if (isDemoOrTestFixture(record.contentId, record.row.version)) {
    add({ area: "STUDENT_EXPERIENCE_V3", code: "DEMO_OR_TEST_FIXTURE_IN_CATALOG", kind: "GOVERNANCE", severity: "BLOCKING", where: "contentId",
      evidence: `${record.contentId} (version ${record.row.version}, status ${record.row.status})`,
      issue: "A demo or smoke-test lesson sits in the production catalog alongside curriculum content.",
      proposedCorrection: "A curriculum owner decides: retire from the learner catalog (keeping history rows resolvable) or keep as a labelled demo. It is not modernized as curriculum." });
  }
  if (record.row.teacherCreated || record.row.hasSchoolScope) {
    add({ area: "MOE_TRACEABILITY", code: "SCHOOL_OR_TEACHER_OWNED", kind: "GOVERNANCE", severity: "BLOCKING", where: "teacherCreated/schoolId",
      evidence: `teacherCreated=${record.row.teacherCreated}, schoolScoped=${record.row.hasSchoolScope}`,
      issue: "Teacher- or school-owned content cannot be rewritten by the national pipeline without its owner.", proposedCorrection: "Hold; offer the owner a modernized national alternative instead." });
  }

  // ── Assemble ─────────────────────────────────────────────────────────────
  const findings = drafts.map((draft, index) => Object.freeze({ id: `${record.contentId}#F${String(index + 1).padStart(2, "0")}`, ...draft }));
  const areas = AUDIT_AREAS.map((area) => {
    const own = findings.filter((finding) => finding.area === area);
    const blocking = own.some((finding) => finding.severity === "BLOCKING" || finding.severity === "MAJOR");
    const judgment = JUDGMENT_AREAS.has(area);
    let status: AreaStatus;
    if (area === "WAEC_ALIGNMENT" && !examinations.length) status = "NOT_APPLICABLE";
    else if (own.length === 0) status = judgment ? "AWAITING_INDEPENDENT_REVIEW" : "MET";
    else if (blocking) status = "NOT_MET";
    else status = judgment ? "AWAITING_INDEPENDENT_REVIEW" : "PARTIALLY_MET";
    return Object.freeze({ area, criteria: AREA_CRITERIA[area], status, basis: judgment ? "MECHANICAL_PLUS_JUDGMENT" as const : "MECHANICAL" as const, findingIds: Object.freeze(own.map((finding) => finding.id)) });
  });

  const governanceBlock = findings.some((finding) => finding.kind === "GOVERNANCE" && finding.severity === "BLOCKING");
  const qualityBlock = findings.some((finding) => finding.kind !== "GOVERNANCE" && finding.severity === "BLOCKING");
  const anyGap = findings.some((finding) => finding.severity !== "INFO");
  const mechanicalOutcome: LessonAudit["mechanicalOutcome"] = governanceBlock ? "BLOCKED_SOURCE_OR_AUTHORITY" : qualityBlock ? "REBUILD_REQUIRED" : anyGap ? "REVISE" : "PASS_MECHANICAL_CHECKS";
  const reviewOutcome: ReviewOutcome = mechanicalOutcome === "PASS_MECHANICAL_CHECKS" ? "AWAITING_INDEPENDENT_REVIEW" : mechanicalOutcome;

  const metrics: AuditMetrics = Object.freeze({
    primaryTextField: field, learnerWords, structuredWords, sections: headed.length,
    maxSectionWords: headed.reduce((max, section) => Math.max(max, section.words), 0), denseSections: dense.length, longParagraphs: longParagraphs.length,
    fkGrade: fk, boilerplateSentenceShare: Math.round(boilerplateShare * 1000) / 1000, objectives: objectives.length,
    workedExampleSections: worked.length, guidedPracticeSections: guided.length, independentPracticeSections: independent.length,
    assessmentQuestions: totalQuestions, keyedQuestions: keyed, arithmeticChecked: arithmeticCount, arithmeticErrors: arithmeticErrors.length,
    liberianContextMarkers: markers, factualClaimIndicators: claims.length, imagesWithoutAlt, alignmentClaims: claimsMoe.length,
    resolvedMoeIds: resolved.length, inventedAlignmentCodes: invented.length,
  });
  const leads = cell.relation === "NONE" ? [] : suggestMoeObjectives({ subject, grade, text: `${snapshot.identity.title}\n${objectives.join("\n")}` }, context.objectives);
  const body = {
    auditVersion: LIBRARY_AUDIT_VERSION, contentId: record.contentId, revisionId: record.revision.id, contentHash: record.revision.contentHash, grade, subject,
    mechanicalOutcome, judgmentStatus: "AWAITING_INDEPENDENT_REVIEW" as const, reviewOutcome,
    moeCell: Object.freeze({ relation: cell.relation, moeSubject: cell.moeSubject, objectiveCount: cell.objectiveCount }),
    moeObjectiveLeads: leads, examinations, areas: Object.freeze(areas), findings: Object.freeze(findings), metrics, isLearningEvidence: false as const,
  };
  const auditDigest = createHash("sha256").update(canonicalizeJson(body)).digest("hex");
  return Object.freeze({ ...body, auditDigest });
}
