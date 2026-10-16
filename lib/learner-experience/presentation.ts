import { sectionRole, type LessonBlock } from "./lessonText";

export type PresentationSource = { title: string; blocks: readonly LessonBlock[] };
export type PresentationFragment = {
  id: string;
  sourceIndex: number;
  blockIndex: number;
  block: LessonBlock;
  listStart?: number;
  continued?: boolean;
};
export type PresentationPage = { sourceIndex: number; fragments: PresentationFragment[]; height: number };

/** Rejoin a paragraph/item split for measurement when its pieces fit on the same page. */
export function groupPresentationFragments(fragments: readonly PresentationFragment[]): Array<PresentationFragment & { ids: string[] }> {
  const groups: Array<PresentationFragment & { ids: string[] }> = [];
  for (const fragment of fragments) {
    const previous = groups[groups.length - 1];
    if (previous && previous.sourceIndex === fragment.sourceIndex && previous.blockIndex === fragment.blockIndex && previous.listStart === fragment.listStart && "text" in previous.block && "text" in fragment.block) {
      previous.block = { ...previous.block, text: previous.block.text + fragment.block.text };
      previous.ids.push(fragment.id);
    } else if (previous && previous.sourceIndex === fragment.sourceIndex && previous.blockIndex === fragment.blockIndex && previous.listStart === fragment.listStart && previous.block.kind === "list" && fragment.block.kind === "list") {
      previous.block = { ...previous.block, items: [previous.block.items[0] + fragment.block.items[0]] };
      previous.ids.push(fragment.id);
    } else groups.push({ ...fragment, ids: [fragment.id] });
  }
  return groups;
}

export function presentationLayout(slide: PresentationSource, index: number) {
  if (/hook|story|introduction/i.test(slide.title)) return "story";
  if (/objective|goal/i.test(slide.title)) return "objectives";
  if (/discussion/i.test(slide.title)) return "discussion";
  const role = sectionRole(slide.title, index);
  if (role === "EXAMPLE") return "example";
  if (role === "PRACTICE") return "practice";
  if (slide.blocks.some(block => block.kind === "image" || block.kind === "table")) return "visual";
  if (slide.blocks.every(block => block.kind === "list")) return "list";
  return "explanation";
}

// Keep paragraphs, lists and source sections in order. Inline Markdown spans stay together where possible.
// Whitespace belongs to its fragment: concatenation recovers the exact input, including punctuation.
function splitText(text: string, limit: number): string[] {
  if (text.length <= limit) return [text];
  const tokens = text.match(/(?:\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\[[^\]]+\]\([^)]+\)|\S+)\s*/g) ?? [text];
  const parts: string[] = [];
  let part = text.slice(0, text.indexOf(tokens[0]));
  for (const token of tokens) {
    if (part && part.length + token.length > limit) {
      // Prefer a complete sentence. Only an oversized sentence needs a word-boundary continuation.
      const endings = [...part.matchAll(/[.!?]["'”’]*\s+/g)];
      const last = endings[endings.length - 1];
      const boundary = last ? last.index! + last[0].length : 0;
      const at = boundary >= limit / 2 ? boundary : part.length;
      parts.push(part.slice(0, at)); part = part.slice(at);
      if (part && part.length + token.length > limit) { parts.push(part); part = ""; }
    }
    part += token;
  }
  if (part) parts.push(part);
  return parts;
}

/** Presentation-only fragments. No source, assessment, authority or Read-mode data is mutated. */
export function presentationFragments(slides: readonly PresentationSource[], textLimit = 260): PresentationFragment[] {
  return slides.flatMap((slide, sourceIndex) => slide.blocks.flatMap((block, blockIndex) => {
    const pieces: Array<Pick<PresentationFragment, "block" | "listStart" | "continued">> = [];
    if ("text" in block) {
      splitText(block.text, textLimit).forEach(text => pieces.push({ block: { ...block, text } }));
    } else if (block.kind === "list") {
      block.items.forEach((item, index) => splitText(item, textLimit).forEach((text, part) => pieces.push({
        block: { ...block, items: [text] }, listStart: index + 1, continued: part > 0,
      })));
    } else if (block.kind === "table") {
      // Repeat the column headings as context on continuation pages; every source row appears once.
      if (!block.rows.length) pieces.push({ block });
      else block.rows.forEach(row => pieces.push({ block: { ...block, rows: [row] } }));
    } else pieces.push({ block });
    return pieces.map((piece, part) => ({ ...piece, sourceIndex, blockIndex, id: `${sourceIndex}:${blockIndex}:${part}` }));
  }));
}

/** Pack actual browser-measured heights, with room reserved for each source title and persistent controls. */
export function packPresentationFragments(fragments: readonly PresentationFragment[], heights: readonly number[], capacities: readonly number[], gap = 20): PresentationPage[] {
  const pages: PresentationPage[] = [];
  fragments.forEach((fragment, index) => {
    const height = Math.ceil(heights[index] ?? 0);
    let page = pages[pages.length - 1];
    // Never orphan an authored subheading at the bottom of a slide.
    const nextHeight = fragment.block.kind === "heading" && fragments[index + 1]?.sourceIndex === fragment.sourceIndex ? Math.ceil(heights[index + 1] ?? 0) + gap : 0;
    if (!page || page.sourceIndex !== fragment.sourceIndex || (page.fragments.length && page.height + gap + height + nextHeight > capacities[fragment.sourceIndex])) {
      page = { sourceIndex: fragment.sourceIndex, fragments: [], height: 0 };
      pages.push(page);
    }
    page.height += (page.fragments.length ? gap : 0) + height;
    page.fragments.push(fragment);
  });
  return pages;
}
