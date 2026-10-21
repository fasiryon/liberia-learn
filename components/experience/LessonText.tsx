import { Fragment, type ReactNode } from "react";
import { isSafeHref, isSafeImageSrc, type LessonBlock } from "@/lib/learner-experience/lessonText";
import { segmentMath, type MathSegment } from "@/lib/learner-experience/math/tex";
import { MathExpression } from "./MathText";

/**
 * Lesson text as React nodes (no HTML injection): **bold**, *emphasis*, `code` and safe links inline;
 * headings, paragraphs, lists, tables, images and quotes as blocks. Unsafe image sources show their
 * description instead of loading; nothing is fetched from an unknown origin. Mathematics (delimited, bare or
 * double-escaped TeX) is typeset as MathML (V4); it is cut out first so Markdown never splits an expression.
 */
const MATH_MARK = /\u0001(\d+)\u0001/;

function withMath(text: string, math: readonly Extract<MathSegment, { kind: "math" }>[]): ReactNode {
  if (!math.length || !MATH_MARK.test(text)) return text;
  return <>{text.split(/\u0001(\d+)\u0001/).map((part, index) => index % 2 === 1
    ? <MathExpression key={index} tex={math[Number(part)].tex} display={math[Number(part)].display} />
    : <Fragment key={index}>{part}</Fragment>)}</>;
}

export function InlineText({ text }: { text: string }) {
  const math: Extract<MathSegment, { kind: "math" }>[] = [];
  const segments = segmentMath(text ?? "");
  if (segments.some((segment) => segment.kind === "math")) text = segments.map((segment) => (segment.kind === "text" ? segment.text : `\u0001${math.push(segment) - 1}\u0001`)).join("");
  const parts = text.split(/(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|\*[^*\s][^*]*\*)/g).filter(Boolean);
  return <>{parts.map((part, index) => {
    if (/^(\*\*|__).+(\*\*|__)$/.test(part)) return <strong key={index}>{withMath(part.slice(2, -2), math)}</strong>;
    if (/^`.+`$/.test(part)) return <code key={index}>{part.slice(1, -1)}</code>;
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (link) return isSafeHref(link[2]) ? <a key={index} href={link[2]} rel="noopener noreferrer">{withMath(link[1], math)}</a> : <Fragment key={index}>{withMath(link[1], math)}</Fragment>;
    if (/^\*[^*\s][^*]*\*$/.test(part)) return <em key={index}>{withMath(part.slice(1, -1), math)}</em>;
    return <Fragment key={index}>{withMath(part, math)}</Fragment>;
  })}</>;
}

export function LessonTable({ block, caption }: { block: Extract<LessonBlock, { kind: "table" }>; caption?: string }) {
  return <div className="ll3-table-wrap" role="region" aria-label={caption ?? "Table"} tabIndex={0}>
    <table className="ll3-table">
      {caption && <caption className="sr-only">{caption}</caption>}
      <thead><tr>{block.header.map((cell, index) => <th key={index} scope="col"><InlineText text={cell} /></th>)}</tr></thead>
      <tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, index) => <td key={index}><InlineText text={cell} /></td>)}</tr>)}</tbody>
    </table>
  </div>;
}

export function LessonImage({ block }: { block: Extract<LessonBlock, { kind: "image" }> }) {
  if (!isSafeImageSrc(block.src)) return block.alt ? <p className="ll3-muted"><span className="font-semibold">Picture: </span>{block.alt}</p> : null;
  // eslint-disable-next-line @next/next/no-img-element
  return <figure className="ll3-figure"><img src={block.src} alt={block.alt} loading="lazy" />{block.alt && <figcaption>{block.alt}</figcaption>}</figure>;
}

export function LessonBlockView({ block, headingOffset = 0 }: { block: LessonBlock; headingOffset?: 0 | 1 }): ReactNode {
  switch (block.kind) {
    case "heading": return (block.level + headingOffset) <= 2 ? <h2><InlineText text={block.text} /></h2> : <h3><InlineText text={block.text} /></h3>;
    case "paragraph": return <p><InlineText text={block.text} /></p>;
    case "list": { const List = block.ordered ? "ol" : "ul"; return <List>{block.items.map((item, index) => <li key={index}><InlineText text={item} /></li>)}</List>; }
    case "table": return <LessonTable block={block} />;
    case "image": return <LessonImage block={block} />;
    case "quote": return <blockquote><InlineText text={block.text} /></blockquote>;
  }
}

export function LessonBlocks({ blocks, headingOffset }: { blocks: readonly LessonBlock[]; headingOffset?: 0 | 1 }) {
  return <>{blocks.map((block, index) => <LessonBlockView key={index} block={block} headingOffset={headingOffset} />)}</>;
}
