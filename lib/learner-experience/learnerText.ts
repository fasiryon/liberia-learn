/**
 * The one rule for answer- and teacher-bearing sections in learner text (Codex merge-gate P1-B).
 *
 * Every learner-visible string, native or legacy, top-level or nested in a collection, goes through
 * this module. A section opened by an answer/teacher heading ("## Expected Response", "1. ## Answer
 * Key", "### Teacher notes") or an answer label line ("**Expected Answer:** 6", "Answer: 6") is
 * restricted. Learner headings that merely use the words ("Answer the questions below", "Solutions
 * to pollution") and ordinary prose are kept.
 */

const LEGACY_TEACHER_ONLY_HEADINGS = new Set([
  "answer guide",
  "assessment alignment",
  "evidence record",
  "extension branch",
  "lesson study notes",
  "metadata",
  "remediation branch",
  "teacher checkpoints",
  "teacher explanation",
  "teacher guidance",
  "teacher notes",
  "teacher planning record",
  "teacher talk",
]);

const ANSWER_LABEL = String.raw`(?:(?:expected|model|sample|suggested|correct|possible|teachers?'?)\s+)?(?:answers?|responses?|solutions?|worked\s+solutions?|answer\s+key|answer\s+guide|mark(?:ing)?\s+schemes?|marking\s+guide)(?:\s+(?:key|guide|and\s+explanations?|with\s+explanations?))?`;
/** Every label that opens restricted material on its own: answer labels plus teacher and scoring labels. */
const RESTRICTED_LABEL = String.raw`(?:${ANSWER_LABEL}|teachers?'?\s+(?:notes?|guide|guidance|explanation|talk|checkpoints?)|facilitator\s+(?:notes?|guide)|scoring\s+(?:guide|rubric|key)|rubric)`;
const ANSWER_HEADING = new RegExp(String.raw`^${ANSWER_LABEL}$`, "i");
const TEACHER_OR_ANSWER_HEADING = /\b(answer key|answer guide|answers to|expected (answers?|responses?)|correct answers?|model answers?|sample answers?|suggested answers?|worked solutions?|mark(ing)? schemes?|marking guide|scoring guide|rubric|scoring|teacher|facilitator)\b/i;
/** List, numbering or lettering prefixes ("1. ", "1) ", "A. ", "a) ", "- ", "* ") that must not hide a heading or label. */
const LIST_PREFIX = String.raw`(?:\s*(?:\d+[.)]|[A-Za-z][.)]|[-*+])\s+)*`;
/** A Markdown heading at any level, also when it was numbered into a list ("1. ## Expected Answer"). */
const HEADING_LINE = new RegExp(String.raw`^${LIST_PREFIX}\s*(#{1,6})\s+(.+?)\s*$`);
const EMPHASIS = String.raw`(?:\*\*|__|\*|_)?`;
/** A line that starts with a restricted label and a colon ("**Expected Response:** 3/4", "1) Answer: 6"). */
const LABEL_WITH_COLON = new RegExp(String.raw`^${LIST_PREFIX}\s*${EMPHASIS}\s*${RESTRICTED_LABEL}\s*${EMPHASIS}\s*:\s*${EMPHASIS}`, "i");
/** A line that is only a restricted label ("A. Expected Answer", "- Teacher Notes", "**Solution**"). */
const BARE_LABEL_LINE = new RegExp(String.raw`^${LIST_PREFIX}\s*${EMPHASIS}\s*${RESTRICTED_LABEL}\s*${EMPHASIS}\s*[:.]?\s*$`, "i");

function normalizeHeading(heading: string): string {
  return heading
    .replace(/[*_`]/g, "")
    .replace(/^(?:(?:part|step|section|question)\s+)?(?:\d+|[ivx]+)[.):-]?\s+/i, "")
    .replace(/[\s:.!?-]+$/g, "")
    .trim()
    .toLowerCase();
}

function isRestrictedHeading(heading: string): boolean {
  const normalized = normalizeHeading(heading);
  return LEGACY_TEACHER_ONLY_HEADINGS.has(normalized) || ANSWER_HEADING.test(normalized) || TEACHER_OR_ANSWER_HEADING.test(normalized);
}

/** A bold-only line ("**Practice**", "__Wrap up__") or a horizontal rule: a section marker that is not a heading. */
const SECTION_MARKER_LINE = /^\s*(?:(?:\*\*|__)[^*_\n]+(?:\*\*|__)\s*:?\s*|(?:-{3,}|\*{3,}|_{3,}))\s*$/;

/**
 * A structural section boundary: a Markdown heading, a bold-only section marker or a horizontal rule.
 * Blank lines, wrapped paragraphs and list items (answers are often numbered lists) are not boundaries.
 */
function isSectionBoundary(line: string): boolean {
  return HEADING_LINE.test(line) || (SECTION_MARKER_LINE.test(line) && !BARE_LABEL_LINE.test(line));
}

/** Whether learner content (not blank, not a boundary) follows `index` before the next boundary. */
function contentFollows(lines: readonly string[], index: number): boolean {
  for (let next = index + 1; next < lines.length; next++) {
    if (isSectionBoundary(lines[next])) return false;
    if (lines[next].trim()) return true;
  }
  return false;
}

function scan(value: string): { kept: string; restricted: boolean } {
  const lines = value.split(/\r?\n/);
  // Heading-opened restricted section: skipped until a heading at the same or a higher level.
  let excludedLevel: number | null = null;
  // Label-opened restricted block ("Expected Answer", "**Expected Response:**"): skipped until the next
  // structural section boundary. Whitespace never ends it, so a blank line cannot reopen its contents.
  let inAnswerBlock = false;
  let restricted = false;
  const kept: string[] = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const match = line.match(HEADING_LINE);
    if (match) {
      inAnswerBlock = false;
      const level = match[1].length;
      if (excludedLevel !== null && level <= excludedLevel) excludedLevel = null;
      if (excludedLevel === null && isRestrictedHeading(match[2])) excludedLevel = level;
    }
    if (excludedLevel !== null) { restricted = true; continue; }
    if (inAnswerBlock) {
      if (isSectionBoundary(line)) inAnswerBlock = false;
      else {
        if (line.trim()) restricted = true;
        continue;
      }
    }
    // A label on its own line opens a block when learner content follows it, even after blank lines.
    // A label with nothing under it is ordinary text (a one-word option such as "Solution").
    if (!match && BARE_LABEL_LINE.test(line) && contentFollows(lines, index)) {
      restricted = true;
      inAnswerBlock = true;
      continue;
    }
    if (!match && LABEL_WITH_COLON.test(line)) {
      restricted = true;
      if (!line.replace(LABEL_WITH_COLON, "").trim()) inAnswerBlock = true;
      continue;
    }
    kept.push(line);
  }
  return { kept: kept.join("\n").replace(/\n{3,}/g, "\n\n").trim(), restricted };
}

/** Learner text with every restricted section removed; safe instructional text is preserved. */
export function stripRestrictedLearnerSections(value: string): string {
  return scan(value).kept;
}

/** Whether the text contains any answer- or teacher-bearing section or answer label. */
export function hasRestrictedLearnerSection(value: string): boolean {
  return scan(value).restricted;
}

/**
 * Apply the rule to every string in a learner projection. Array positions are preserved (option
 * lists stay aligned with their item); learner item lists are already filtered entry by entry where
 * they are built. Keys listed in `skip` are left as they are (an already-verified native experience).
 */
export function stripRestrictedLearnerText<T>(value: T, skip: ReadonlySet<string> = new Set()): T {
  if (typeof value === "string") return stripRestrictedLearnerSections(value) as T;
  if (Array.isArray(value)) return value.map((entry) => stripRestrictedLearnerText(entry, skip)) as T;
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [
    key,
    skip.has(key) ? child : stripRestrictedLearnerText(child, skip),
  ])) as T;
}

/** Path of the first learner string that carries a restricted section, or null. */
export function findRestrictedLearnerText(value: unknown, path = "$"): string | null {
  if (typeof value === "string") return hasRestrictedLearnerSection(value) ? path : null;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      const found = findRestrictedLearnerText(value[index], `${path}[${index}]`);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== "object") return null;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const found = findRestrictedLearnerText(child, `${path}.${key}`);
    if (found) return found;
  }
  return null;
}
