import { Fragment, type ReactNode } from "react";
import { parseTex, segmentMath, texToPlain, texToSpeech, type MathNode } from "@/lib/learner-experience/math/tex";

/**
 * Interactive Learning V4 — mathematical notation as native MathML, built as React elements (no HTML
 * injection, no web fonts, nothing downloaded, works offline). Screen readers get the spoken form; browsers
 * without MathML get a readable plain-text fallback through CSS (see `.ll5-math` in lesson.css).
 */
function node(value: MathNode, key?: number | string): ReactNode {
  switch (value.t) {
    // A unit after a number keeps a thin space ("60 m²", not "60m²").
    case "row": return <mrow key={key}>{value.items.flatMap((item, index) => {
      const unitLike = item.t === "text" || (item.t === "script" && item.base.t === "text");
      const gap = unitLike && index > 0 && value.items[index - 1].t === "num";
      return gap ? [<mspace key={`${index}-gap`} width="0.25em" />, node(item, index)] : [node(item, index)];
    })}</mrow>;
    case "num": return <mn key={key}>{value.v}</mn>;
    case "id": return <mi key={key}>{value.v}</mi>;
    case "op": return <mo key={key}>{value.v}</mo>;
    case "text": return <mtext key={key}>{value.v.trim()}</mtext>;
    case "space": return <mspace key={key} width="0.3em" />;
    case "frac": return <mfrac key={key}>{node(value.n)}{node(value.d)}</mfrac>;
    case "sqrt": return value.index ? <mroot key={key}>{node(value.body)}{node(value.index)}</mroot> : <msqrt key={key}>{node(value.body)}</msqrt>;
    case "script": {
      const base = node(value.base);
      if (value.sub && value.sup) return <msubsup key={key}>{base}{node(value.sub)}{node(value.sup)}</msubsup>;
      if (value.sub) return <msub key={key}>{base}{node(value.sub)}</msub>;
      return <msup key={key}>{base}{node(value.sup!)}</msup>;
    }
  }
}

/** A top-level chain `a = b = c` as `a`, `= b`, `= c`; null when there is no chain to break. */
function equalityChain(tree: MathNode): MathNode[][] | null {
  if (tree.t !== "row") return null;
  const parts: MathNode[][] = [[]];
  for (const item of tree.items) { if (item.t === "op" && item.v === "=" && parts.at(-1)!.length) parts.push([]); parts.at(-1)!.push(item); }
  return parts.length > 2 ? parts : null;
}

/**
 * One TeX expression. `display` centres it on its own line at a larger size. MathML does not line-break, so a long
 * displayed chain of equalities wraps between its `=` steps (one spoken expression, visually split pieces).
 */
export function MathExpression({ tex, display = false }: { tex: string; display?: boolean }) {
  const tree = parseTex(tex);
  const speech = texToSpeech(tree);
  const chain = display ? equalityChain(tree) : null;
  if (chain) return <span className="ll5-math ll5-math-chain" data-display="" role="math" aria-label={speech}>
    {chain.map((items, index) => <math key={index} display="inline" aria-hidden="true">{node({ t: "row", items })}</math>)}
    <span className="ll5-math-fallback" aria-hidden="true">{texToPlain(tree)}</span>
  </span>;
  return <span className="ll5-math" data-display={display ? "" : undefined}>
    <math display={display ? "block" : "inline"} aria-label={speech} role="math">{node(tree)}</math>
    <span className="ll5-math-fallback" aria-hidden="true">{texToPlain(tree)}</span>
  </span>;
}

/** Prose with math: delimited, bare or double-escaped TeX becomes MathML; everything else stays text. */
export function MathText({ text }: { text: string }) {
  return <>{segmentMath(text).map((segment, index) => segment.kind === "text"
    ? <Fragment key={index}>{segment.text}</Fragment>
    : <MathExpression key={index} tex={segment.tex} display={segment.display} />)}</>;
}
