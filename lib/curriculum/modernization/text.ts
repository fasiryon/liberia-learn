/**
 * Deterministic text analysis for legacy lesson snapshots (CurriculumContentSnapshotV1).
 * Pure functions: no I/O, no AI. Every measure here is a mechanical indicator, not a judgment.
 */
import { createHash } from "crypto";

export type SnapshotV1 = Readonly<{
  identity: Readonly<{ title: string; description: string | null; grade: number; subject: string; contentType: string }>;
  delivery: Readonly<{ lessonFormat: string | null; body: string | null; bodyStandard: string | null; bodyBlock: string | null; legacyContent: string | null; lessonContent: string | null; estimatedMinutes: number | null }>;
  instruction: Readonly<Record<string, unknown>> & Readonly<{ objectives: readonly string[] }>;
  assessment: Readonly<Record<string, unknown>>;
  resources: Readonly<Record<string, unknown>>;
  standards: Readonly<{ moeAlignments: unknown; waecSyllabusTopics: readonly string[] }>;
}>;

export const PRIMARY_TEXT_FIELDS = ["body", "lessonContent", "bodyStandard", "legacyContent", "bodyBlock"] as const;
export type PrimaryTextField = (typeof PRIMARY_TEXT_FIELDS)[number];

/** The learner-facing text of record: the first populated delivery field, in the order the player resolves them. */
export function primaryText(snapshot: SnapshotV1): { field: PrimaryTextField | null; text: string } {
  for (const field of PRIMARY_TEXT_FIELDS) {
    const value = snapshot.delivery[field];
    if (typeof value === "string" && value.trim()) return { field, text: value };
  }
  return { field: null, text: "" };
}

export type SectionRole =
  | "HOOK" | "OBJECTIVES" | "PRIOR_KNOWLEDGE" | "CONCEPT" | "VOCABULARY" | "WORKED_EXAMPLE" | "ERROR_ANALYSIS"
  | "GUIDED_PRACTICE" | "INDEPENDENT_PRACTICE" | "DISCUSSION" | "ASSESSMENT" | "SUMMARY" | "EXTENSION"
  | "REMEDIATION" | "APPLICATION" | "GUARDIAN" | "TEACHER_NOTES" | "ANSWER_KEY" | "OTHER";

const ROLE_PATTERNS: readonly (readonly [SectionRole, RegExp])[] = [
  ["ANSWER_KEY", /answer key|\banswers?\s*(to|for|:)|^answers?$|^solutions?$|solutions? to (the )?(exit|quiz|assessment|practice)/i],
  ["OBJECTIVES", /objective/i],
  ["PRIOR_KNOWLEDGE", /prior knowledge|warm[- ]?up|activat|do now|recall/i],
  ["HOOK", /hook|opening|engage|introduction/i],
  ["VOCABULARY", /vocabulary|key (words|terms)/i],
  ["WORKED_EXAMPLE", /worked example|example\s*\d|demonstration|step[- ]by[- ]step|modell?ing|\bexample\b/i],
  ["ERROR_ANALYSIS", /error|mistake|misconception/i],
  ["GUIDED_PRACTICE", /guided practice|practice problem|we do/i],
  ["INDEPENDENT_PRACTICE", /independent practice|try this yourself|you do|on your own/i],
  ["ASSESSMENT", /assessment|exit ticket|check for understanding|checking for understanding|quiz|test yourself/i],
  ["DISCUSSION", /discussion|group|cross-curricular/i],
  ["SUMMARY", /takeaway|summary|conclusion|closing|wrap[- ]up|reflection/i],
  ["EXTENSION", /extension|challenge|enrichment/i],
  ["REMEDIATION", /remediation|support|reteach/i],
  ["APPLICATION", /real[- ]world|application|career|connection/i],
  ["GUARDIAN", /guardian|parent|home/i],
  ["TEACHER_NOTES", /teacher notes|additional teacher|materials|metadata/i],
  ["CONCEPT", /concept|instruction|explanation|key idea|main idea|lesson|content|learn/i],
];

export function sectionRole(heading: string): SectionRole {
  const clean = heading.replace(/^#+\s*/, "").replace(/^\d+[.)]\s*/, "");
  for (const [role, pattern] of ROLE_PATTERNS) if (pattern.test(clean)) return role;
  return "OTHER";
}

export type Section = Readonly<{ index: number; heading: string; level: number; role: SectionRole; text: string; words: number; line: number }>;

export const wordCount = (text: string) => (text.match(/[A-Za-z0-9À-ɏ'’]+/g) ?? []).length;

/** Splits markdown into heading-delimited sections. Text before the first heading becomes a level-0 PREAMBLE. */
export function splitSections(markdown: string): readonly Section[] {
  const lines = markdown.split(/\r?\n/);
  const out: Section[] = [];
  let heading = "(preamble)";
  let level = 0;
  let start = 0;
  let buffer: string[] = [];
  const flush = () => {
    const text = buffer.join("\n").trim();
    if (text || level > 0) out.push({ index: out.length, heading, level, role: level === 0 ? "OTHER" : sectionRole(heading), text, words: wordCount(text), line: start + 1 });
  };
  lines.forEach((line, index) => {
    const match = /^(#{1,4})\s+(.*)$/.exec(line);
    if (match) {
      flush();
      heading = match[2].trim();
      level = match[1].length;
      start = index;
      buffer = [];
    } else buffer.push(line);
  });
  flush();
  return Object.freeze(out);
}

export const paragraphs = (text: string) => text.split(/\n\s*\n/).map((part) => part.trim()).filter((part) => part && !/^(\||[-*]\s|\d+[.)]\s)/.test(part));

/** Sentences of prose: headings and table rows are dropped, list markers stripped, then each block split on terminal punctuation. */
export const sentences = (text: string) =>
  text.split(/\n\s*\n|\n(?=\s*(?:#|[-*]\s|\d+[.)]\s|\|))/)
    .map((block) => block.split(/\r?\n/).filter((line) => !/^\s*(#|\|)/.test(line)).map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s+/, "")).join(" "))
    .flatMap((block) => block.replace(/\s+/g, " ").split(/(?<=[.!?])\s+(?=[A-Z"“‘(*])/))
    .map((sentence) => sentence.trim())
    .filter((sentence) => wordCount(sentence) >= 3);

function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const groups = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "").match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups?.length ?? 1);
}

/** Flesch-Kincaid grade level over prose (lists and tables excluded). An indicator, not a readability verdict. */
export function fleschKincaidGrade(text: string): number | null {
  const prose = text.split(/\r?\n/).filter((line) => !/^\s*(\||#|[-*]\s|\d+[.)]\s)/.test(line)).join(" ");
  const sents = sentences(prose);
  const words: string[] = prose.match(/[A-Za-z']+/g) ?? [];
  if (sents.length < 3 || words.length < 60) return null;
  const syl = words.reduce((sum, word) => sum + syllables(word), 0);
  return Math.round((0.39 * (words.length / sents.length) + 11.8 * (syl / words.length) - 15.59) * 10) / 10;
}

export const normalizeSentence = (sentence: string) => sentence.toLowerCase().replace(/[^a-z ]+/g, " ").replace(/\s+/g, " ").trim();
export const sentenceKey = (sentence: string) => createHash("sha1").update(normalizeSentence(sentence)).digest("hex").slice(0, 16);

const SUBJECT_WORDS = new Set("math mathematics maths science english literacy reading writing civics social studies history computer computing engineering technology grade".split(" "));

/**
 * Template-skeleton key: the sentence with the lesson's own topic words (from its title) and subject
 * names removed. Generator templates that only substitute the topic ("Model one complete math example
 * connected to <topic>, naming each step clearly") collapse to the same skeleton across lessons.
 */
export function skeletonKey(sentence: string, topicWords: ReadonlySet<string>): string {
  const skeleton = normalizeSentence(sentence).split(" ").filter((word) => !topicWords.has(word) && !SUBJECT_WORDS.has(word)).join(" ");
  return createHash("sha1").update(skeleton).digest("hex").slice(0, 16);
}

export const topicWords = (title: string) => new Set(normalizeSentence(title).split(" ").filter((word) => word.length > 2));

/** Learner-visible serialization defects such as "[object Object]" or "undefined" placeholders. */
export const serializationArtifacts = (text: string) => (text.match(/\[object Object\]|\bundefined\b(?=\s*[\n,.;]|$)|\bNaN\b|\{\{\s*\w+\s*\}\}/g) ?? []).length;

/** Collects the text of a structured instruction/assessment value (strings, arrays, objects) for counting. */
export function flattenText(value: unknown, depth = 0): string {
  if (depth > 6 || value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return "";
  if (Array.isArray(value)) return value.map((entry) => flattenText(entry, depth + 1)).join("\n");
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).map((entry) => flattenText(entry, depth + 1)).join("\n");
  return "";
}

export const hasContent = (value: unknown) => flattenText(value).trim().length > 0;

// ─── Arithmetic verification ────────────────────────────────────────────────

export type ArithmeticCheck = Readonly<{ expression: string; stated: number; computed: number; correct: boolean; index: number }>;

const NUM = String.raw`(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?`;
// The look-behind skips operands inside compound expressions ("3 + 4 × 2 = 11"), where precedence matters.
const ARITH = new RegExp(String.raw`(?<![\w.,/$-])(?<![+\-−×x*÷/^(]\s*)${NUM}\s*([+×÷*]|\s[-−x]\s)\s*${NUM}\s*=\s*(-?)${NUM}(?![\w.,]*\d)(?!\s*[%/])(?!\s*[+\-−×x*÷^(])`, "g");

const toNumber = (whole: string, fraction?: string) => Number(`${whole.replace(/,/g, "")}${fraction ? `.${fraction}` : ""}`);

/**
 * Verifies simple binary arithmetic stated in the text ("12 + 7 = 19", "3 × 4 = 12", "1,200 − 450 = 750").
 * Only the unambiguous form "number operator number = number" is checked; anything else is left alone.
 */
export function checkArithmetic(text: string): readonly ArithmeticCheck[] {
  const out: ArithmeticCheck[] = [];
  for (const match of text.matchAll(ARITH)) {
    const [expression, aw, af, rawOp, bw, bf, negative, cw, cf] = match;
    const a = toNumber(aw, af);
    const b = toNumber(bw, bf);
    const stated = (negative ? -1 : 1) * toNumber(cw, cf);
    const op = rawOp.trim();
    let computed: number;
    if (op === "+") computed = a + b;
    else if (op === "-" || op === "−") computed = a - b;
    else if (op === "×" || op === "*" || op === "x") computed = a * b;
    else if (op === "÷") { if (b === 0) continue; computed = a / b; }
    else continue;
    // Division results are commonly stated rounded; accept the stated precision.
    const decimals = (cf ?? "").length;
    const tolerance = op === "÷" ? 0.5 * 10 ** -decimals + 1e-9 : 1e-9;
    out.push({ expression: expression.trim(), stated, computed: Math.round(computed * 1e6) / 1e6, correct: Math.abs(computed - stated) <= tolerance, index: match.index ?? 0 });
  }
  return Object.freeze(out);
}

// ─── Subject lexicon (mislabel indicator) ───────────────────────────────────

const LEXICON: Readonly<Record<string, readonly string[]>> = Object.freeze({
  MATH: ["equation", "fraction", "multiply", "multiplication", "divide", "division", "addition", "subtract", "subtraction", "sum", "product", "quotient", "numerator", "denominator", "decimal", "percent", "angle", "triangle", "perimeter", "area", "algebra", "variable", "graph", "integer", "ratio", "geometry", "digit", "place value", "calculate"],
  SCIENCE: ["energy", "force", "cell", "organism", "experiment", "hypothesis", "matter", "plant", "animal", "photosynthesis", "atom", "molecule", "ecosystem", "magnet", "electric", "circuit", "gravity", "temperature", "chemical", "biology", "physics", "observation", "habitat", "nutrient", "solar"],
  LANGUAGE: ["sentence", "noun", "verb", "adjective", "adverb", "paragraph", "essay", "grammar", "punctuation", "conjunction", "pronoun", "vocabulary", "spelling", "reading", "comprehension", "story", "character", "poem", "author", "phonics", "syllable", "prefix", "suffix", "narrative"],
  SOCIAL: ["government", "citizen", "constitution", "election", "community", "president", "legislature", "rights", "history", "county", "culture", "map", "trade", "economy", "democracy", "law", "leader", "independence", "civic", "settlement", "population", "tribe"],
  COMPUTING: ["computer", "algorithm", "program", "code", "coding", "data", "software", "hardware", "internet", "binary", "loop", "debug", "keyboard", "digital", "network", "spreadsheet", "variable"],
  ENGINEERING: ["design", "engineer", "build", "prototype", "material", "structure", "bridge", "machine", "lever", "pulley", "tool", "measure", "test", "constraint", "model"],
});

export const SUBJECT_FAMILY: Readonly<Record<string, string>> = Object.freeze({
  MATH: "MATH", SCIENCE: "SCIENCE", ENGLISH: "LANGUAGE", LITERACY: "LANGUAGE", CIVICS: "SOCIAL", SOCIAL_STUDIES: "SOCIAL", HISTORY: "SOCIAL",
  COMPUTER_SCIENCE: "COMPUTING", ENGINEERING: "ENGINEERING", ENGINEERING_FOUNDATIONS: "ENGINEERING",
});

export function subjectScores(text: string): Readonly<Record<string, number>> {
  const lower = ` ${text.toLowerCase().replace(/[^a-z ]+/g, " ")} `;
  const scores: Record<string, number> = {};
  for (const [family, words] of Object.entries(LEXICON)) {
    let n = 0;
    for (const word of words) {
      let at = lower.indexOf(` ${word}`);
      while (at !== -1) { n += 1; at = lower.indexOf(` ${word}`, at + word.length + 1); }
    }
    scores[family] = n;
  }
  return Object.freeze(scores);
}

// ─── Context and claims ──────────────────────────────────────────────────────

const LIBERIA_MARKERS = /\b(liberia|liberian|monrovia|montserrado|nimba|bong|lofa|grand bassa|grand gedeh|grand kru|margibi|maryland|sinoe|river ?cess|river ?gee|gbarpolu|bomi|cape mount|buchanan|gbarnga|harper|zwedru|voinjama|kakata|ganta|robertsport|st\.? paul river|mesurado|l\$|lrd|\d+\s?ld\b|liberian dollars?|cassava|palm oil|fufu|dumboy|lappa|kpelle|bassa|vai|kru|gola|mano|gio|loma|krahn|grebo|mandingo)\b/gi;

export const liberianContextMarkers = (text: string) => (text.match(LIBERIA_MARKERS) ?? []).length;

const CLAIM_PATTERNS: readonly (readonly [string, RegExp])[] = [
  ["CITED_STUDY_OR_REPORT", /\b(according to|studies (show|have shown|suggest)|research (shows|has shown|suggests|indicates)|a (recent )?(study|survey|report) (by|from|found|showed))\b/i],
  ["STATISTIC_ABOUT_LIBERIA", /\b\d{1,3}(\.\d+)?\s?(%|percent)\b[^.]{0,80}\b(liberia|liberians|monrovia|county|counties|population|people|students|children|farmers)\b|\b(liberia|liberians|population)\b[^.]{0,80}\b\d{1,3}(\.\d+)?\s?(%|percent)\b/i],
  ["INSTITUTIONAL_ATTRIBUTION", /\b(ministry of (education|health|agriculture)|world bank|unicef|unesco|government of liberia|liberia institute of statistics|lisgis)\b[^.]{0,60}\b(reports?|reported|says|said|found|estimates?|announced|data)\b/i],
  ["DATED_STATISTIC", /\b(in|since|by) (19|20)\d{2},?[^.]{0,60}\b\d[\d,.]*\s?(%|percent|people|students|tons|metric|million|thousand|dollars)\b/i],
];

export type ClaimIndicator = Readonly<{ code: string; excerpt: string }>;

/** Factual-claim indicators that a human must verify or remove; not a finding that the claim is false. */
export function factualClaimIndicators(text: string): readonly ClaimIndicator[] {
  const out: ClaimIndicator[] = [];
  for (const sentence of sentences(text)) {
    for (const [code, pattern] of CLAIM_PATTERNS) {
      if (pattern.test(sentence)) { out.push({ code, excerpt: excerpt(sentence) }); break; }
    }
  }
  return Object.freeze(out);
}

export const excerpt = (text: string, max = 160) => {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

export const questionCount = (text: string) => (text.match(/\?(\s|$)/g) ?? []).length;
export const numberedItems = (text: string) => (text.match(/^\s*(\d+[.)]|[-*]|[A-Da-d][.)])\s+\S/gm) ?? []).length;
