/**
 * Student Experience V3: structured presentation of LEGACY lesson text (Markdown bodies and slide decks).
 *
 * This only re-presents what the lesson already says: headings, paragraphs, lists, tables and images in
 * their authored order. It never invents scenes, examples, visuals or questions, never reads answer keys,
 * and never upgrades a legacy lesson into a native Lesson Experience. HTML bodies (teacher-created) are
 * not parsed here; callers render them through the existing sanitizer.
 */

export type Inline = string;

export type LessonBlock =
  | { kind: "heading"; level: 2 | 3; text: Inline }
  | { kind: "paragraph"; text: Inline }
  | { kind: "list"; ordered: boolean; items: Inline[] }
  | { kind: "table"; header: Inline[]; rows: Inline[][] }
  | { kind: "image"; src: string; alt: string }
  | { kind: "quote"; text: Inline };

export type LessonSection = { id: string; title: string; blocks: LessonBlock[]; authoredHeading?: boolean };

/** What a section is for, read only from its authored heading. Unknown headings are plain "Learn". */
export type SectionRole = "INTRODUCTION" | "LEARN" | "EXAMPLE" | "PRACTICE" | "REVIEW";

export const SECTION_ROLE_LABEL: Record<SectionRole, string> = {
  INTRODUCTION: "Introduction",
  LEARN: "Learn",
  EXAMPLE: "Worked example",
  PRACTICE: "Your turn",
  REVIEW: "Review",
};

const TABLE_DIVIDER = /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?$/;

function cells(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

/** Same-origin paths and https only; anything else is described by its alt text instead. */
export function isSafeImageSrc(src: string): boolean {
  return (src.startsWith("/") && !src.startsWith("//")) || /^https:\/\/[^\s"'<>]+$/i.test(src);
}

export function isSafeHref(href: string): boolean {
  return (href.startsWith("/") && !href.startsWith("//")) || /^https?:\/\/[^\s"'<>]+$/i.test(href);
}

/** Markdown (the subset legacy lessons use) to ordered blocks. Unknown syntax stays as paragraph text. */
export function parseLessonBlocks(markdown: string): LessonBlock[] {
  const lines = (markdown ?? "").replace(/\r\n?/g, "\n").split("\n");
  const blocks: LessonBlock[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    const text = paragraph.join(" ").replace(/\s+/g, " ").trim();
    if (text) blocks.push({ kind: "paragraph", text });
    paragraph = [];
  };
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed) { flush(); continue; }
    const heading = /^(#{1,4})\s+(.+?)\s*#*\s*$/.exec(trimmed);
    if (heading) {
      flush();
      blocks.push({ kind: "heading", level: heading[1].length <= 2 ? 2 : 3, text: heading[2] });
      continue;
    }
    const image = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/.exec(trimmed);
    if (image) { flush(); blocks.push({ kind: "image", alt: image[1], src: image[2] }); continue; }
    if (trimmed.startsWith("|") && index + 1 < lines.length && TABLE_DIVIDER.test(lines[index + 1].trim())) {
      flush();
      const header = cells(trimmed);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].trim().startsWith("|")) { rows.push(cells(lines[index])); index++; }
      index--;
      blocks.push({ kind: "table", header, rows: rows.map((row) => header.map((_, column) => row[column] ?? "")) });
      continue;
    }
    const bullet = /^[-*+]\s+(.*)$/.exec(trimmed);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(trimmed);
    if (bullet || numbered) {
      flush();
      const ordered = Boolean(numbered);
      const items: string[] = [];
      while (index < lines.length) {
        const current = lines[index].trim();
        const match = ordered ? /^\d+[.)]\s+(.*)$/.exec(current) : /^[-*+]\s+(.*)$/.exec(current);
        if (match) { items.push(match[1]); index++; continue; }
        // A wrapped continuation line belongs to the previous item.
        if (current && items.length && /^\s{2,}\S/.test(lines[index])) { items[items.length - 1] += ` ${current}`; index++; continue; }
        break;
      }
      index--;
      blocks.push({ kind: "list", ordered, items });
      continue;
    }
    if (trimmed.startsWith("> ")) { flush(); blocks.push({ kind: "quote", text: trimmed.slice(2) }); continue; }
    paragraph.push(trimmed);
  }
  flush();
  return blocks;
}

function slug(text: string, used: Set<string>): string {
  const base = text.toLowerCase().replace(/\*\*|__|`/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "section";
  let id = base;
  for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
  used.add(id);
  return id;
}

/**
 * Sections at authored headings. Text before the first heading becomes an "Introduction" section only when
 * it exists; nothing is added when the lesson has no headings beyond one section titled with the lesson.
 */
export function splitLessonSections(blocks: readonly LessonBlock[], fallbackTitle: string): LessonSection[] {
  const used = new Set<string>();
  const sections: LessonSection[] = [];
  let current: LessonSection | null = null;
  for (const block of blocks) {
    if (block.kind === "heading" && block.level === 2) {
      current = { id: slug(block.text, used), title: block.text, blocks: [], authoredHeading: true };
      sections.push(current);
      continue;
    }
    if (!current) {
      current = { id: slug(blocks.some((b) => b.kind === "heading" && b.level === 2) ? "introduction" : fallbackTitle, used), title: blocks.some((b) => b.kind === "heading" && b.level === 2) ? "Introduction" : fallbackTitle, blocks: [] };
      sections.push(current);
    }
    current.blocks.push(block);
  }
  return sections.filter((section) => section.blocks.length > 0);
}

export function sectionRole(title: string, position: number): SectionRole {
  if (/(worked|example|let'?s solve|sample problem)/i.test(title)) return "EXAMPLE";
  if (/(try|practi[cs]e|exercise|activity|your turn|check your|question)/i.test(title)) return "PRACTICE";
  if (/(takeaway|summary|review|remember|key (idea|point)|conclusion|recap)/i.test(title)) return "REVIEW";
  if (position === 0 || /(introduction|overview|warm[- ]?up|getting started)/i.test(title)) return "INTRODUCTION";
  return "LEARN";
}

/**
 * Teaching-scene parts of one section, all taken from its own blocks: the first paragraph leads, a bullet
 * list becomes teaching points, a numbered list becomes steps, tables and images become the visual, and
 * everything else stays in authored order as supporting text.
 */
export function teachingParts(blocks: readonly LessonBlock[]) {
  const lead = blocks.find((block): block is Extract<LessonBlock, { kind: "paragraph" }> => block.kind === "paragraph") ?? null;
  const points = blocks.find((block): block is Extract<LessonBlock, { kind: "list" }> => block.kind === "list" && !block.ordered) ?? null;
  const steps = blocks.find((block): block is Extract<LessonBlock, { kind: "list" }> => block.kind === "list" && block.ordered) ?? null;
  const visuals = blocks.filter((block): block is Extract<LessonBlock, { kind: "table" | "image" }> => block.kind === "table" || block.kind === "image");
  const rest = blocks.filter((block) => block !== lead && block !== points && block !== steps && !visuals.includes(block as never));
  return { lead, points, steps, visuals, rest };
}

export function plainText(blocks: readonly LessonBlock[]): string {
  return blocks.map((block) => block.kind === "list" ? block.items.join(" ") : block.kind === "table" ? [block.header, ...block.rows].flat().join(" ") : block.kind === "image" ? block.alt : block.text).join(" ").replace(/\*\*|__|`/g, "");
}

export function readingMinutes(blocks: readonly LessonBlock[]): number {
  const words = plainText(blocks).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 180));
}

/** A legacy slide's own blocks, without a heading that only repeats the slide title. */
export function slideBlocks(title: string, markdown: string): LessonBlock[] {
  const normalized = title.trim().toLowerCase();
  return parseLessonBlocks(markdown).filter((block) => !(block.kind === "heading" && block.text.trim().toLowerCase() === normalized));
}

/** Who a legacy section was written for, read only from its authored heading. */
export type SectionAudience = "LEARNER" | "TEACHER" | "FAMILY";

const TEACHER_HEADING = /^(teacher\b|additional teacher notes|remediation( support)?$|materials and activity notes|materials$|teaching notes)/i;
const FAMILY_HEADING = /(guardian|family|home and guardian|parent)/i;

export function sectionAudience(title: string): SectionAudience {
  const clean = title.replace(/\*\*|__|`/g, "").trim();
  if (FAMILY_HEADING.test(clean)) return "FAMILY";
  if (TEACHER_HEADING.test(clean)) return "TEACHER";
  return "LEARNER";
}

export const AUDIENCE_LABEL: Record<Exclude<SectionAudience, "LEARNER">, string> = {
  TEACHER: "Notes for your teacher",
  FAMILY: "For your family",
};

/**
 * A paragraph that starts with its own short authored label ("Worked Example 1: …", "Guardian support: …")
 * split into label and text, so the label can be shown as a heading. Nothing is added or reworded.
 */
export function labelledParagraph(text: string): { label: string; text: string } | null {
  const match = /^(?:\*\*)?([A-Z][A-Za-z0-9'’ -]{2,40}?)(?:\*\*)?:\s+(.{12,})$/s.exec(text.trim());
  if (!match) return null;
  const label = match[1].trim();
  if (label.split(/\s+/).length > 6) return null;
  return { label, text: match[2].trim() };
}

/**
 * Whole numbers from 10,000 to 9,999,999 written in the lesson's own text (with or without thousands
 * commas), in order of appearance, for an optional place-value tool. Shorter numbers and anything in a
 * decimal or fraction are ignored. Four-digit values only count when written with a comma (so years are not
 * mistaken for quantities).
 */
export function numbersInBlocks(blocks: readonly LessonBlock[], limit = 4): number[] {
  const found: number[] = [];
  const text = plainText(blocks);
  const pattern = /(?<![\d.,/])(\d{1,3}(?:,\d{3})+|\d{5,7})(?![\d/]|[.,]\d)/g;
  for (const match of text.matchAll(pattern)) {
    const value = Number(match[1].replace(/,/g, ""));
    const commaFour = match[1].includes(",") && value >= 1000;
    if ((value >= 10_000 || commaFour) && value <= 9_999_999 && !found.includes(value)) found.push(value);
    if (found.length >= limit) break;
  }
  return found;
}
