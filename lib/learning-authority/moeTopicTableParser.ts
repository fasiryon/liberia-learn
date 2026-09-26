/**
 * Deterministic MOE topic-table parser (moe-topic-table-v1).
 *
 * The Liberia MOE curriculum PDFs are laid out as one table per topic:
 *
 *   SEMESTER / GRADE / PERIOD / [UNIT] / TOPIC
 *   OUTCOMES | OBJECTIVES | CONTENTS | ACTIVITIES | MATERIALS/RESOURCES | COMPETENCIES/ASSESSMENTS
 *
 * The decoded page text (see moeArchiveParser.ts) emits each table cell in
 * column order, and a topic that overflows continues on the next page with
 * its numbered lists resuming (e.g. objective 9 then activity 5). This parser
 * uses those structural cues, never keyword guessing on single lines:
 *
 *   - a page with GRADE + PERIOD + TOPIC starts a topic block;
 *   - outcomes run until "Upon completion of this topic ... :";
 *   - numbered lists are assigned to columns by numbering continuity;
 *   - "Guide learners to" opens activities; materials cues and
 *     "EXPECTED COMPETENCIES" / "ASSESSMENT STRATEGIES" close them;
 *   - on continuation pages a number is assigned to the column that expects
 *     it next; ambiguous or unnumbered text is kept as unassigned review text.
 *
 * Output is review-only structure. It never asserts MOE approval.
 */
import type { ExtractionConfidence, TextQualityFlag } from "./structuredCurriculumAuthority";

export const MOE_TOPIC_TABLE_PARSER = "moe-topic-table-v1";

export type ParsedEntry = {
  ordinal: number;
  text: string;
  page: number;
  confidence: ExtractionConfidence;
  flags: TextQualityFlag[];
};

export type ParsedTopicBlock = {
  blockIndex: number;
  grade: number | null;
  semester: number | null;
  period: number | null;
  unit: string | null;
  topic: string;
  pages: number[];
  outcomes: ParsedEntry[];
  objectives: ParsedEntry[];
  contents: ParsedEntry[];
  activities: ParsedEntry[];
  materials: ParsedEntry[];
  competencies: ParsedEntry[];
  assessments: ParsedEntry[];
  unassigned: { page: number; text: string }[];
  letterSpaced: boolean;
};

export type ParsePageInput = { page: number; rawText: string };

export type ParsedMember = {
  blocks: ParsedTopicBlock[];
  frontMatterPages: number[];
  pagesWithoutText: number[];
};

const BULLET_CHARS = /[•▪●➢✓§]/g;

/** Regex source for a keyword that tolerates PDF letter-spacing ("OB JEC TIVE S"). */
function kw(word: string): string {
  return word.split("").map((ch) => (ch === " " ? "\\s+" : ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))).join("\\s?");
}

/** Joins decoded PDF lines into one string, repairing split words and hyphenation. */
export function normalizePageText(rawText: string, pageNumber?: number): string {
  const lines = rawText.replace(/\r/g, "\n").split("\n").map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  let out = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const next = lines[i + 1];
    if (!out) { out = line; continue; }
    const prevEndsWord = /[A-Za-z]$/.test(out);
    // "U" + "nderstand" -> "Understand" (drop-cap split by the PDF writer).
    if (/ [A-Z]$|^[A-Z]$/.test(" " + out.slice(-2)) && /^[A-Z]$/.test(out.split(" ").pop() ?? "") && /^[a-z]/.test(line)) {
      out += line;
      continue;
    }
    // "multi" + "-" + "step" -> "multi-step"; a lone "-" before a capital is a bullet.
    if (line === "-" && prevEndsWord && next && /^[a-z]/.test(next)) {
      out += "-" + next;
      i++;
      continue;
    }
    out += " " + line;
  }
  return out
    .replace(BULLET_CHARS, " • ")
    .replace(pageHeader(pageNumber), "")
    .replace(/\s+/g, " ")
    .trim();
}

/** "Page 43" / "Pag e 7 3" running header; digits must spell this page's number. */
function pageHeader(pageNumber?: number): RegExp {
  const digits = pageNumber === undefined ? "\\d{1,3}" : String(pageNumber).split("").join("\\s?");
  return new RegExp(`^\\s*P\\s?a\\s?g\\s?e\\s*${digits}(?!\\d)\\s*`, "i");
}

const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8 };

function parsePeriod(raw: string | undefined): number | null {
  if (!raw) return null;
  const token = raw.replace(/\s/g, "").toUpperCase();
  if (/^1+$/.test(token) && token.length <= 3) return token.length; // "111" is a mis-typed "III"
  if (ROMAN[token]) return ROMAN[token]!;
  const n = Number.parseInt(token, 10);
  return Number.isFinite(n) && n >= 1 && n <= 8 ? n : null;
}

const HEADER_GRADE = new RegExp(`${kw("GRADE")}\\s*:?\\s*(\\d{1,2})(?!\\d)`, "i");
const HEADER_PERIOD = new RegExp(`${kw("PERIOD")}\\s*:?\\s*([IVX1]{1,4}|\\d)\\b`, "i");
const HEADER_SEMESTER = new RegExp(`${kw("SEMESTER")}\\s*:?\\s*(${kw("ONE")}|${kw("TWO")}|1|2)`, "i");
const HEADER_TOPIC = new RegExp(`${kw("TOPIC")}(?:\\s?S)?\\s*:?\\s*(.+?)\\s*(?=(?:${kw("LEARNING")}\\s+)?${kw("OUT")}\\s?${kw("COMES")}|${kw("OBJECTIVES")})`, "i");
const HEADER_UNIT = /\bUNIT\s*([IVX]+|\d+)\b/i;
const COLUMN_HEAD_END = new RegExp(`${kw("ASSESSMENT")}(?:\\s?S)?\\b`, "i");
const OUTCOME_END = /(upon\s+(?:the\s+)?complet\s?ion\s+of\s+(?:this|the)\s+(?:topic|lesson|unit|period)[^:]*:|at\s+the\s+end\s+of\s+(?:this|the)\s+(?:topic|lesson|unit|period)[^:]*:)/i;
const ACTIVITY_START = /guide\s+(?:the\s+)?learners?\s+to\s*:?|inclusive\s+and\s+different\s?iate\w*\s+learning\s*:?/i;
const GUIDE_LEARNERS = /guide\s+(?:the\s+)?learners?\s+to\s*:?/i;
const MATERIALS_START = /\b(?:[A-C]\.\s*)?primary\s+(?:school\s+)?text\s*:?|\blinks\s*:|\btext\s?books?\s*:|\bmaterials?\s*:|\bresources?\s*:|\breferences?\s*:|\bspecimens?\s*:|\bcharts?\s+(?:on|of|showing)\b/i;
const COMPETENCIES_START = new RegExp(`${kw("EXPECTED")}\\s+${kw("COMPETENC")}\\w*\\s*:?`, "i");
const ASSESSMENT_START = new RegExp(`${kw("ASSESSMENT")}\\s+${kw("STRATEGIES")}\\s*:?`, "i");
const ASSESSMENT_VOCAB = /^(?:attendances?|oral\s+(?:questions?(?:\s+and\s+answers?)?|presentations?)|class\s+assignments?(?:\s+and\s+participation)?|participation|observations?|assignments?|research|quiz(?:zes)?|tests?|exams?|examinations?|homework|project(?:s|\s+work)?|peer\s+assessment|role\s+play[^•-]*|demonstrations?|group\s+work|presentations?|portfolio|practical(?:s|\s+work)?|class\s+work|classwork|written\s+(?:test|work|exercise)s?)$/i;

const NUMBER_MARKER = /(?:^|\s)(\d{1,2})\s?\.(?=\s)(?!\s+\d)/g;

type Segment = { n: number | null; text: string };

/** Splits text on "n." list markers; text before the first marker has n = null. */
function splitNumbered(text: string): Segment[] {
  const marks: { n: number; start: number; end: number }[] = [];
  for (const match of text.matchAll(NUMBER_MARKER)) {
    const n = Number.parseInt(match[1]!, 10);
    if (n < 1 || n > 40) continue;
    const start = (match.index ?? 0) + (match[0].startsWith(" ") ? 1 : 0);
    marks.push({ n, start, end: (match.index ?? 0) + match[0].length });
  }
  const segments: Segment[] = [];
  const lead = text.slice(0, marks[0]?.start ?? text.length).trim();
  if (lead) segments.push({ n: null, text: lead });
  marks.forEach((mark, index) => {
    segments.push({ n: mark.n, text: text.slice(mark.end, marks[index + 1]?.start ?? text.length).trim() });
  });
  return segments;
}

function clean(text: string): string {
  return text.replace(/\s+/g, " ").replace(/\s+([.,;:])/g, "$1").replace(/^[•\-–:;,.\s]+|[•\-–\s]+$/g, "").trim();
}

/** Cuts an item's tail where another column's text starts. */
function cutTail(text: string): { head: string; tail: string; certain: boolean } {
  const cues = [
    text.indexOf(" • "),
    text.search(ACTIVITY_START),
    text.search(/\.\s+(?=\S)/) >= 0 ? text.search(/\.\s+(?=\S)/) + 1 : -1,
    text.search(/;\s+(?:and\s+)?(?=[A-Z])/) >= 0 ? text.search(/;\s+(?:and\s+)?(?=[A-Z])/) + 1 : -1,
  ].filter((index) => index > 0);
  if (!cues.length) {
    const boundary = cutAtColumnBoundary(text);
    return boundary.tail ? { ...boundary, certain: false } : { head: text, tail: "", certain: text.length <= 160 };
  }
  const at = Math.min(...cues);
  return { head: text.slice(0, at), tail: text.slice(at), certain: true };
}

/**
 * With no punctuation to separate columns, a lowercase word followed by a
 * Capitalised word ("... and migration Place value ...") is where the next
 * column's first cell begins. Used only when no stronger cue exists.
 */
function cutAtColumnBoundary(text: string): { head: string; tail: string } {
  const match = text.match(/[a-z0-9)]\s+(?=[A-Z][a-z])/);
  if (!match || match.index === undefined || match.index < 12) return { head: text, tail: "" };
  const at = match.index + 1;
  return { head: text.slice(0, at), tail: text.slice(at).trim() };
}

function splitBullets(text: string): string[] {
  return text.split(/\s•\s|(?:^|\s)-\s(?=[A-Z])/).map(clean).filter((part) => part.length > 1);
}

function entry(ordinal: number, text: string, page: number, confidence: ExtractionConfidence, flags: TextQualityFlag[] = []): ParsedEntry {
  return { ordinal, text: clean(text), page, confidence, flags };
}

export function isLetterSpaced(text: string): boolean {
  const tokens = text.split(" ").filter((token) => /^[A-Za-z]+$/.test(token));
  if (tokens.length < 40) return false;
  const short = tokens.filter((token) => token.length <= 2 && !/^(a|I|an|to|of|in|on|is|at|by|or|as|be|we|it|do|if|no|so|up|us|my|he|me|am)$/i.test(token)).length;
  return short / tokens.length > 0.18;
}

type Header = { grade: number | null; semester: number | null; period: number | null; unit: string | null; topic: string; bodyStart: number };

function parseHeader(text: string): Header | null {
  const grade = text.match(HEADER_GRADE);
  const period = text.match(HEADER_PERIOD);
  const topic = text.match(HEADER_TOPIC);
  if (!grade || !topic || (grade.index ?? 0) > 250) return null;
  const semesterMatch = text.match(HEADER_SEMESTER);
  const semesterToken = semesterMatch?.[1]?.replace(/\s/g, "").toUpperCase();
  const topicText = clean(topic[1]!.replace(/^S\s*:\s*/i, "")).replace(/\s*:\s*$/, "");
  const unit = text.slice(0, (topic.index ?? 0) + topic[0].length).match(HEADER_UNIT)?.[1] ?? null;
  const afterTopic = (topic.index ?? 0) + topic[0].length;
  const colEnd = text.slice(afterTopic).search(COLUMN_HEAD_END);
  const bodyStart = colEnd >= 0 && colEnd < 260
    ? afterTopic + colEnd + (text.slice(afterTopic + colEnd).match(COLUMN_HEAD_END)?.[0].length ?? 0)
    : afterTopic;
  return {
    grade: Number.parseInt(grade[1]!, 10),
    semester: semesterToken === "ONE" || semesterToken === "1" ? 1 : semesterToken === "TWO" || semesterToken === "2" ? 2 : null,
    period: parsePeriod(period?.[1]),
    unit,
    topic: topicText.replace(/\bUNIT\s*([IVX]+|\d+)\b\s*:?/i, "").trim() || topicText,
    bodyStart,
  };
}

/** Column order of numbered lists on a topic page. */
type ListColumn = "objectives" | "contents" | "activities";

class BlockBuilder {
  readonly block: ParsedTopicBlock;
  private next: Record<ListColumn, number> = { objectives: 1, contents: 1, activities: 1 };
  private contentsNumbered = false;

  constructor(index: number, header: Header, page: number, letterSpaced: boolean) {
    this.block = {
      blockIndex: index, grade: header.grade, semester: header.semester, period: header.period, unit: header.unit,
      topic: header.topic, pages: [page], outcomes: [], objectives: [], contents: [], activities: [], materials: [],
      competencies: [], assessments: [], unassigned: [], letterSpaced,
    };
  }

  private push(column: ListColumn, text: string, page: number, confidence: ExtractionConfidence, flags: TextQualityFlag[] = []) {
    const value = clean(text);
    if (!value) return;
    const list = this.block[column];
    list.push(entry(list.length + 1, value, page, confidence, this.block.letterSpaced ? [...flags, "LETTER_SPACING_ARTIFACTS"] : flags));
  }

  private tailSections(text: string, page: number, confidence: ExtractionConfidence) {
    // text holds materials -> competencies -> assessments, in that order.
    const compAt = text.search(COMPETENCIES_START);
    const assessAt = text.search(ASSESSMENT_START);
    const materialsText = text.slice(0, compAt >= 0 ? compAt : assessAt >= 0 ? assessAt : text.length);
    const compText = compAt >= 0 ? text.slice(compAt, assessAt > compAt ? assessAt : text.length).replace(COMPETENCIES_START, "") : "";
    const assessText = assessAt >= 0 ? text.slice(assessAt).replace(ASSESSMENT_START, "") : "";
    for (const part of splitMaterials(materialsText)) this.block.materials.push(entry(this.block.materials.length + 1, part, page, confidence));
    for (const part of splitBullets(compText)) this.block.competencies.push(entry(this.block.competencies.length + 1, part, page, confidence));
    for (const part of assessmentParts(assessText)) this.block.assessments.push(entry(this.block.assessments.length + 1, part, page, confidence));
  }

  /** Parses the body of the page that carries the topic header. */
  parseHeaderBody(body: string, page: number) {
    const outcomeEnd = body.match(OUTCOME_END);
    let rest = body;
    if (outcomeEnd) {
      const outcomeText = body.slice(0, outcomeEnd.index).replace(/^learn\w*\s+(?:are|is|will\s+be)\s+able\s+to\s*:?/i, "");
      const outcomeParts = splitNumbered(outcomeText.replace(/learn\w*\s+(?:are|is|will\s+be)\s+able\s+to\s*:?/gi, " • "))
        .flatMap((segment) => splitBullets(segment.text));
      for (const part of outcomeParts) {
        this.block.outcomes.push(entry(this.block.outcomes.length + 1, part, page, "MEDIUM"));
      }
      rest = body.slice((outcomeEnd.index ?? 0) + outcomeEnd[0].length);
    } else {
      this.block.unassigned.push({ page, text: clean(body.slice(0, 400)) });
    }

    // Split at the activities cue: everything before is objectives + contents.
    const actCue = rest.search(ACTIVITY_START);
    const beforeActivities = actCue >= 0 ? rest.slice(0, actCue) : rest;
    let afterActivitiesCue = actCue >= 0 ? rest.slice(actCue) : "";
    const guide = afterActivitiesCue.match(GUIDE_LEARNERS);
    if (guide) afterActivitiesCue = afterActivitiesCue.slice((guide.index ?? 0) + guide[0].length);
    else afterActivitiesCue = afterActivitiesCue.replace(ACTIVITY_START, "");

    this.parseObjectivesAndContents(beforeActivities, page);
    if (actCue >= 0) this.parseActivitiesAndTail(afterActivitiesCue, page);
  }

  private parseObjectivesAndContents(text: string, page: number) {
    const segments = splitNumbered(text);
    let column: "objectives" | "contents" = "objectives";
    // Some tables bullet the objectives instead of numbering them. Then the
    // text before any number holds the bulleted objectives, and the last
    // bullet runs straight into the contents column.
    const lead = segments[0]?.n === null ? segments[0] : null;
    if (lead && / • /.test(` ${lead.text} `)) {
      const bullets = splitBullets(lead.text);
      bullets.forEach((bullet, index) => {
        if (index < bullets.length - 1) { this.push("objectives", bullet, page, "HIGH"); return; }
        const { head, tail } = cutAtColumnBoundary(bullet);
        this.push("objectives", head, page, "MEDIUM", ["TAIL_BOUNDARY_UNCERTAIN"]);
        if (tail) this.pushContent(tail, page, "LOW");
      });
      this.next.objectives = bullets.length + 1;
      column = "contents";
      segments.shift();
    }
    for (const segment of segments) {
      if (segment.n === null) {
        // Preamble before objective 1 is the "learners will:" tail; ignore empty noise.
        if (clean(segment.text).length > 3) this.block.unassigned.push({ page, text: clean(segment.text) });
        continue;
      }
      if (column === "objectives" && segment.n === this.next.objectives) {
        // Inside the list the next marker bounds the objective. The last
        // objective runs into the contents column, so its tail must be cut.
        const { head, tail, certain } = cutTail(segment.text);
        const nextSegment = segments[segments.indexOf(segment) + 1];
        const continuesList = nextSegment?.n === this.next.objectives + 1;
        if (continuesList && !segment.text.includes(" • ")) {
          this.push("objectives", segment.text, page, "HIGH");
        } else {
          this.push("objectives", head, page, certain ? "HIGH" : "MEDIUM", certain ? [] : ["TAIL_BOUNDARY_UNCERTAIN"]);
          if (tail.trim()) for (const part of splitBullets(tail)) this.pushContent(part, page, "MEDIUM");
        }
        this.next.objectives += 1;
        continue;
      }
      if (segment.n === 1 || (column === "contents" && segment.n === this.next.contents)) {
        column = "contents";
        this.contentsNumbered = true;
        const parts = splitBullets(segment.text);
        if (parts.length) {
          this.pushContent(parts[0]!, page, "MEDIUM");
          for (const extra of parts.slice(1)) this.pushContent(extra, page, "MEDIUM");
        }
        this.next.contents = segment.n + 1;
        continue;
      }
      this.block.unassigned.push({ page, text: `${segment.n}. ${clean(segment.text)}` });
    }
  }

  private pushContent(text: string, page: number, confidence: ExtractionConfidence) {
    const value = clean(text);
    if (!value || value.length < 2) return;
    this.block.contents.push(entry(this.block.contents.length + 1, value, page, confidence, this.block.letterSpaced ? ["LETTER_SPACING_ARTIFACTS"] : []));
  }

  private parseActivitiesAndTail(text: string, page: number) {
    const materialsAt = firstMaterialsCue(text);
    const activityText = materialsAt >= 0 ? text.slice(0, materialsAt) : text;
    const tailText = materialsAt >= 0 ? text.slice(materialsAt) : "";
    const segments = splitNumbered(activityText);
    for (const segment of segments) {
      if (segment.n === null) {
        for (const part of splitBullets(segment.text)) {
          if (/^(?:individual\s+seat\s+work|learning\s*:)/i.test(part)) continue; // differentiation boilerplate
          this.push("activities", part, page, "MEDIUM");
        }
        continue;
      }
      if (segment.n === this.next.activities) {
        this.push("activities", segment.text, page, "HIGH");
        this.next.activities += 1;
      } else {
        this.block.unassigned.push({ page, text: `${segment.n}. ${clean(segment.text)}` });
      }
    }
    if (tailText) this.tailSections(tailText, page, "MEDIUM");
    else {
      // No materials cue: competencies/assessments may still be present.
      const compAt = text.search(COMPETENCIES_START);
      const assessAt = text.search(ASSESSMENT_START);
      const cut = [compAt, assessAt].filter((index) => index >= 0);
      if (cut.length) this.tailSections(text.slice(Math.min(...cut)), page, "MEDIUM");
    }
  }

  /** Parses a page that continues the current topic block. */
  parseContinuation(text: string, page: number) {
    this.block.pages.push(page);
    const tailAt = [text.search(COMPETENCIES_START), text.search(ASSESSMENT_START)].filter((index) => index >= 0);
    const mainText = tailAt.length ? text.slice(0, Math.min(...tailAt)) : text;
    if (tailAt.length) this.tailSections(text.slice(Math.min(...tailAt)), page, "MEDIUM");

    const segments = splitNumbered(mainText);
    for (const segment of segments) {
      const [assessmentTail, rest] = splitTrailingAssessments(segment.text);
      if (segment.n === null) {
        if (clean(rest)) this.block.unassigned.push({ page, text: clean(rest) });
      } else {
        const candidates = (["objectives", "contents", "activities"] as const).filter((column) =>
          this.next[column] === segment.n && (column !== "contents" || this.contentsNumbered));
        if (!candidates.length) {
          this.block.unassigned.push({ page, text: `${segment.n}. ${clean(rest)}` });
        } else {
          const column = candidates[0]!;
          const flags: TextQualityFlag[] = ["CONTINUATION_PAGE_ASSIGNMENT", ...(candidates.length > 1 ? ["AMBIGUOUS_COLUMN_ASSIGNMENT" as const] : [])];
          const { head, tail } = column === "objectives" ? cutTail(rest) : { head: rest, tail: "" };
          const materialsAt = column === "activities" ? firstMaterialsCue(head) : -1;
          const itemText = materialsAt >= 0 ? head.slice(0, materialsAt) : head;
          if (column === "contents") this.pushContent(itemText, page, candidates.length > 1 ? "LOW" : "MEDIUM");
          else this.push(column, itemText, page, candidates.length > 1 ? "LOW" : "MEDIUM", flags);
          this.next[column] += 1;
          if (materialsAt >= 0) this.tailSections(head.slice(materialsAt), page, "LOW");
          if (clean(tail)) this.block.unassigned.push({ page, text: clean(tail) });
        }
      }
      for (const part of assessmentTail) this.block.assessments.push(entry(this.block.assessments.length + 1, part, page, "MEDIUM", ["CONTINUATION_PAGE_ASSIGNMENT"]));
    }
  }
}

function firstMaterialsCue(text: string): number {
  const at = text.search(MATERIALS_START);
  const comp = text.search(COMPETENCIES_START);
  const assess = text.search(ASSESSMENT_START);
  const candidates = [at, comp, assess].filter((index) => index >= 0);
  return candidates.length ? Math.min(...candidates) : -1;
}

function splitMaterials(text: string): string[] {
  return text
    .replace(/\blinks\s*:\s*/i, " • ")
    .split(/\s•\s|\s(?=www\.)|\s(?=[A-C]\.\s)/)
    .map(clean)
    .filter((part) => part.length > 2 && !/^(?:materials?|resources?)\s*\/?$/i.test(part));
}

function assessmentParts(text: string): string[] {
  const parts = text
    .replace(/^(?:that\s+)?can\s+be\s+used\s+to\s+check\s+competen\w*\.?\s*(?:select\s+relevant\s+options\s*:)?/i, "")
    .split(/\s*[-–•]\s+/)
    .map(clean)
    .filter((part) => part.length > 2);
  return parts;
}

/** Peels trailing "- Quiz - Test - Exams" style assessment bullets off a segment. */
function splitTrailingAssessments(text: string): [string[], string] {
  const pieces = text.split(/\s[-–]\s(?=[A-Z])/);
  const found: string[] = [];
  while (pieces.length > 1 && ASSESSMENT_VOCAB.test(clean(pieces[pieces.length - 1]!))) found.unshift(clean(pieces.pop()!));
  if (pieces.length === 1) {
    const lone = clean(pieces[0]!.replace(/^[-–]\s*/, ""));
    if (ASSESSMENT_VOCAB.test(lone) && found.length) { found.unshift(lone); return [found, ""]; }
  }
  return [found, pieces.join(" - ")];
}

/** Parses all pages of one MOE PDF member into topic blocks. */
export function parseMoeTopicTables(pages: readonly ParsePageInput[]): ParsedMember {
  const blocks: ParsedTopicBlock[] = [];
  const frontMatterPages: number[] = [];
  const pagesWithoutText: number[] = [];
  let current: BlockBuilder | null = null;
  for (const page of [...pages].sort((a, b) => a.page - b.page)) {
    const text = normalizePageText(page.rawText ?? "", page.page);
    if (text.replace(/[^A-Za-z]/g, "").length < 4) { pagesWithoutText.push(page.page); continue; }
    const header = parseHeader(text);
    if (header) {
      current = new BlockBuilder(blocks.length, header, page.page, isLetterSpaced(text));
      blocks.push(current.block);
      current.parseHeaderBody(text.slice(header.bodyStart), page.page);
    } else if (current) {
      current.parseContinuation(text, page.page);
    } else {
      frontMatterPages.push(page.page);
    }
  }
  return { blocks, frontMatterPages, pagesWithoutText };
}
