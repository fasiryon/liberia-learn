/**
 * Interactive Learning V4 — safe mathematical notation for lesson text.
 *
 * Lesson text (legacy Markdown bodies, slide decks and authored teaching lessons) often carries TeX: sometimes
 * delimited (`$…$`, `$$…$$`, `\(…\)`, `\[…\]`), sometimes bare (`A = l \times w`), sometimes double-escaped by
 * a JSON round trip (`\\frac{1}{2}`). Before V4 the reader printed all of it literally. This module:
 *
 * 1. splits text into prose and math segments (`segmentMath`), recovering bare and double-escaped TeX and
 *    leaving currency such as `L$500` or `$5 and $10` alone;
 * 2. parses a TeX subset into a small tree (`parseTex`) that the MathML renderer draws as React elements, so
 *    there is no HTML injection, no download and nothing that fails offline;
 * 3. turns the tree into speech (`texToSpeech`) and plain text (`texToPlain`) for read-aloud, screen readers
 *    and text fallbacks.
 *
 * Unknown commands never show a backslash to a learner: they degrade to their name as text.
 */

export type MathNode =
  | Readonly<{ t: "row"; items: readonly MathNode[] }>
  | Readonly<{ t: "num"; v: string }>
  | Readonly<{ t: "id"; v: string }>
  | Readonly<{ t: "op"; v: string }>
  | Readonly<{ t: "text"; v: string }>
  | Readonly<{ t: "space" }>
  | Readonly<{ t: "frac"; n: MathNode; d: MathNode }>
  | Readonly<{ t: "sqrt"; body: MathNode; index?: MathNode }>
  | Readonly<{ t: "script"; base: MathNode; sub?: MathNode; sup?: MathNode }>;

export type MathSegment =
  | Readonly<{ kind: "text"; text: string }>
  | Readonly<{ kind: "math"; tex: string; display: boolean }>;

const SYMBOLS: Readonly<Record<string, { v: string; op: boolean }>> = {
  times: { v: "×", op: true }, div: { v: "÷", op: true }, cdot: { v: "·", op: true }, pm: { v: "±", op: true }, mp: { v: "∓", op: true },
  le: { v: "≤", op: true }, leq: { v: "≤", op: true }, ge: { v: "≥", op: true }, geq: { v: "≥", op: true }, ne: { v: "≠", op: true }, neq: { v: "≠", op: true },
  approx: { v: "≈", op: true }, sim: { v: "∼", op: true }, cong: { v: "≅", op: true }, equiv: { v: "≡", op: true }, lt: { v: "<", op: true }, gt: { v: ">", op: true },
  to: { v: "→", op: true }, rightarrow: { v: "→", op: true }, leftarrow: { v: "←", op: true }, Rightarrow: { v: "⇒", op: true }, implies: { v: "⇒", op: true },
  perp: { v: "⊥", op: true }, parallel: { v: "∥", op: true }, angle: { v: "∠", op: false }, triangle: { v: "△", op: false }, circ: { v: "°", op: false }, degree: { v: "°", op: false },
  cdots: { v: "⋯", op: false }, ldots: { v: "…", op: false }, dots: { v: "…", op: false }, infty: { v: "∞", op: false }, therefore: { v: "∴", op: true },
  pi: { v: "π", op: false }, theta: { v: "θ", op: false }, alpha: { v: "α", op: false }, beta: { v: "β", op: false }, gamma: { v: "γ", op: false }, delta: { v: "δ", op: false },
  Delta: { v: "Δ", op: false }, lambda: { v: "λ", op: false }, mu: { v: "μ", op: false }, sigma: { v: "σ", op: false }, Sigma: { v: "Σ", op: true }, omega: { v: "ω", op: false },
  "%": { v: "%", op: false }, "$": { v: "$", op: false }, "{": { v: "{", op: true }, "}": { v: "}", op: true }, "&": { v: "&", op: false }, "#": { v: "#", op: false },
};
const SPACES = new Set([" ", ",", ";", ":", "!", "quad", "qquad", "enspace", "thinspace"]);
const TEXT_COMMANDS = new Set(["text", "mathrm", "textrm", "textbf", "mathbf", "mbox", "operatorname", "textit", "mathit", "mathsf", "textsf"]);
const FRAC_COMMANDS = new Set(["frac", "dfrac", "tfrac", "cfrac"]);
const IGNORED = new Set(["left", "right", "big", "Big", "bigg", "Bigg", "displaystyle", "textstyle", "limits", "nolimits"]);
const OPERATOR_CHARS = "+-=<>×÷·±≤≥≠≈→/|()[]!,:;'";

type Token = Readonly<{ k: "cmd" | "char" | "open" | "close" | "sup" | "sub" | "space"; v: string }>;

/** `\\frac` (a JSON double escape) becomes `\frac`; a real line break `\\` between rows is kept. */
export function unescapeTex(source: string): string {
  return source.replace(/\\\\(?=[A-Za-z])/g, "\\");
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (char === "\\") {
      const name = /^[A-Za-z]+/.exec(source.slice(index + 1));
      if (name) { tokens.push({ k: "cmd", v: name[0] }); index += name[0].length; continue; }
      const next = source[index + 1];
      if (next === undefined) continue;
      if (next === "\\") { tokens.push({ k: "space", v: "\\\\" }); index++; continue; }
      tokens.push({ k: "cmd", v: next }); index++; continue;
    }
    if (char === "{") { tokens.push({ k: "open", v: char }); continue; }
    if (char === "}") { tokens.push({ k: "close", v: char }); continue; }
    if (char === "^") { tokens.push({ k: "sup", v: char }); continue; }
    if (char === "_") { tokens.push({ k: "sub", v: char }); continue; }
    if (/\s/.test(char)) { tokens.push({ k: "space", v: " " }); continue; }
    tokens.push({ k: "char", v: char });
  }
  return tokens;
}

/** Text inside `\text{…}` up to its matching brace, with nested braces kept as written. */
function readRawGroup(tokens: readonly Token[], start: number): { text: string; end: number } {
  if (tokens[start]?.k !== "open") return { text: tokens[start]?.v ?? "", end: start + 1 };
  let depth = 0, text = "";
  for (let index = start; index < tokens.length; index++) {
    const token = tokens[index];
    if (token.k === "open") { depth++; if (depth > 1) text += "{"; continue; }
    if (token.k === "close") { depth--; if (depth === 0) return { text, end: index + 1 }; text += "}"; continue; }
    text += token.k === "cmd" ? (SYMBOLS[token.v]?.v ?? token.v) : token.k === "space" && token.v === "\\\\" ? " " : token.v;
  }
  return { text, end: tokens.length };
}

class Parser {
  private index = 0;
  constructor(private readonly tokens: readonly Token[]) {}

  parse(): MathNode { return this.row(false); }

  private row(inGroup: boolean): MathNode {
    const items: MathNode[] = [];
    while (this.index < this.tokens.length) {
      const token = this.tokens[this.index];
      if (token.k === "close") { if (inGroup) { this.index++; break; } this.index++; continue; }
      const atom = this.atom();
      if (!atom) continue;
      items.push(this.scripts(atom));
    }
    const merged = mergeNumbers(items);
    return merged.length === 1 ? merged[0] : { t: "row", items: merged };
  }

  /** One argument: a braced group, or the next single atom (`\frac12`, `x^2`). */
  private argument(): MathNode {
    while (this.tokens[this.index]?.k === "space") this.index++;
    const token = this.tokens[this.index];
    if (!token) return { t: "row", items: [] };
    if (token.k === "open") { this.index++; return this.row(true); }
    if (token.k === "char" && /[0-9]/.test(token.v)) { this.index++; return { t: "num", v: token.v }; }
    return this.atom() ?? { t: "row", items: [] };
  }

  private scripts(base: MathNode): MathNode {
    let sub: MathNode | undefined, sup: MathNode | undefined;
    for (;;) {
      const token = this.tokens[this.index];
      if (token?.k === "sup" && !sup) { this.index++; sup = this.argument(); continue; }
      if (token?.k === "sub" && !sub) { this.index++; sub = this.argument(); continue; }
      if (token?.k === "char" && token.v === "'" ) { this.index++; sup = { t: "op", v: "′" }; continue; }
      break;
    }
    return sub || sup ? { t: "script", base, sub, sup } : base;
  }

  private atom(): MathNode | null {
    const token = this.tokens[this.index++];
    if (!token) return null;
    switch (token.k) {
      case "space": return token.v === "\\\\" ? { t: "space" } : null;
      case "open": return this.row(true);
      case "sup": case "sub": return this.scripts({ t: "row", items: [] }) && null;
      case "char": {
        if (/[0-9.]/.test(token.v)) return { t: "num", v: token.v };
        if (/[A-Za-z]/.test(token.v)) return { t: "id", v: token.v };
        if (token.v === "*") return { t: "op", v: "×" };
        if (token.v === "-") return { t: "op", v: "−" };
        if (token.v === "&") return null;
        return OPERATOR_CHARS.includes(token.v) ? { t: "op", v: token.v } : { t: "text", v: token.v };
      }
      case "cmd": {
        const name = token.v;
        if (FRAC_COMMANDS.has(name)) { const n = this.argument(); const d = this.argument(); return { t: "frac", n, d }; }
        if (name === "sqrt") {
          let index: MathNode | undefined;
          if (this.tokens[this.index]?.k === "char" && this.tokens[this.index].v === "[") {
            const parts: MathNode[] = [];
            this.index++;
            while (this.index < this.tokens.length && !(this.tokens[this.index].k === "char" && this.tokens[this.index].v === "]")) { const atom = this.atom(); if (atom) parts.push(atom); }
            this.index++;
            index = parts.length === 1 ? parts[0] : { t: "row", items: parts };
          }
          return { t: "sqrt", body: this.argument(), index };
        }
        if (TEXT_COMMANDS.has(name)) { const raw = readRawGroup(this.tokens, this.index); this.index = raw.end; return { t: "text", v: raw.text }; }
        if (name === "begin" || name === "end") { readRawGroup(this.tokens, this.index); this.index = readRawGroup(this.tokens, this.index).end; return null; }
        if (name === "overline" || name === "underline" || name === "hat" || name === "vec" || name === "bar") return this.argument();
        if (IGNORED.has(name)) return null;
        if (SPACES.has(name)) return { t: "space" };
        const symbol = SYMBOLS[name];
        if (symbol) return symbol.op ? { t: "op", v: symbol.v } : { t: "id", v: symbol.v };
        // Unknown command: its name as text, never a backslash.
        return { t: "text", v: name };
      }
      default: return null;
    }
  }
}

/** Consecutive digits (with a decimal point or thousands separators) become one number. */
function mergeNumbers(items: MathNode[]): MathNode[] {
  const merged: MathNode[] = [];
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    const previous = merged[merged.length - 1];
    if (item.t === "num" && previous?.t === "num") { merged[merged.length - 1] = { t: "num", v: previous.v + item.v }; continue; }
    // 4,050 is a number; (3, 4) is a list.
    if (item.t === "op" && item.v === "," && previous?.t === "num" && /^\d{1,3}$/.test(previous.v.split(",").pop() ?? "") && items.slice(index + 1, index + 4).every((next) => next.t === "num" && /^\d$/.test(next.v)) && items[index + 4]?.t !== "num") {
      merged[merged.length - 1] = { t: "num", v: `${previous.v},` };
      continue;
    }
    merged.push(item);
  }
  return merged;
}

export function parseTex(source: string): MathNode {
  return new Parser(tokenize(unescapeTex(source))).parse();
}

const SPOKEN: Readonly<Record<string, string>> = {
  "×": "times", "÷": "divided by", "·": "times", "=": "equals", "+": "plus", "−": "minus", "±": "plus or minus", "<": "is less than", ">": "is greater than",
  "≤": "is less than or equal to", "≥": "is greater than or equal to", "≠": "is not equal to", "≈": "is approximately", "→": "to", "⇒": "so", "/": "over",
  "°": "degrees", "π": "pi", "θ": "theta", "⊥": "is perpendicular to", "∥": "is parallel to", "∠": "angle", "△": "triangle", "%": "percent", "∴": "therefore", "′": "prime",
};
const ORDINAL_DENOMINATOR: Readonly<Record<string, [string, string]>> = {
  "2": ["half", "halves"], "3": ["third", "thirds"], "4": ["quarter", "quarters"], "5": ["fifth", "fifths"], "6": ["sixth", "sixths"], "7": ["seventh", "sevenths"],
  "8": ["eighth", "eighths"], "9": ["ninth", "ninths"], "10": ["tenth", "tenths"], "12": ["twelfth", "twelfths"], "100": ["hundredth", "hundredths"],
};
const UNIT_WORDS: Readonly<Record<string, string>> = { m: "metres", cm: "centimetres", mm: "millimetres", km: "kilometres", g: "grams", kg: "kilograms", s: "seconds", L: "litres", mL: "millilitres" };

function joinSpeech(parts: readonly string[]): string {
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

/** How the expression is read aloud, e.g. `A_{\text{triangle}} = \frac12 bh` → "A triangle equals one half b h". */
export function texToSpeech(node: MathNode): string {
  switch (node.t) {
    case "row": return joinSpeech(node.items.map(texToSpeech));
    case "num": return node.v.replace(/,/g, "");
    case "id": return SPOKEN[node.v] ?? node.v;
    case "op": return SPOKEN[node.v] ?? (node.v === "(" || node.v === ")" || node.v === "," ? "" : node.v);
    case "text": return UNIT_WORDS[node.v.trim()] ?? node.v.trim();
    case "space": return "";
    case "frac": {
      if (node.n.t === "num" && node.d.t === "num" && ORDINAL_DENOMINATOR[node.d.v]) {
        const [one, many] = ORDINAL_DENOMINATOR[node.d.v];
        return node.n.v === "1" ? `one ${one}` : `${node.n.v} ${many}`;
      }
      return `${texToSpeech(node.n)} over ${texToSpeech(node.d)}`;
    }
    case "sqrt": return node.index ? `the ${texToSpeech(node.index)} root of ${texToSpeech(node.body)}` : `the square root of ${texToSpeech(node.body)}`;
    case "script": {
      const base = texToSpeech(node.base);
      const sub = node.sub ? texToSpeech(node.sub) : "";
      const unit = node.base.t === "text" && node.sup?.t === "num" && UNIT_WORDS[node.base.v.trim()];
      if (unit && node.sup?.t === "num") return node.sup.v === "2" ? `square ${UNIT_WORDS[node.base.v.trim()]}` : node.sup.v === "3" ? `cubic ${UNIT_WORDS[node.base.v.trim()]}` : `${base} to the power ${node.sup.v}`;
      const sup = !node.sup ? "" : node.sup.t === "num" && node.sup.v === "2" ? "squared" : node.sup.t === "num" && node.sup.v === "3" ? "cubed" : node.sup.t === "op" ? texToSpeech(node.sup) : `to the power of ${texToSpeech(node.sup)}`;
      return joinSpeech([base, sub, sup]);
    }
  }
}

const SUPERSCRIPT: Readonly<Record<string, string>> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "−": "⁻" };

/** Readable plain text, e.g. for a text-only fallback: `\frac{3}{4}` → "3/4", `\text{m}^2` → "m²". */
export function texToPlain(node: MathNode): string {
  switch (node.t) {
    case "row": return node.items.map((item, index) => {
      const text = texToPlain(item);
      const spaced = item.t === "op" && !["(", ")", ",", "′", "/"].includes(item.v);
      // A unit after a number keeps its space: "4050 m²".
      const unitLike = item.t === "text" || (item.t === "script" && item.base.t === "text");
      return spaced ? ` ${text} ` : unitLike && index > 0 && (node.items[index - 1].t === "num" || node.items[index - 1].t === "space") ? ` ${text}` : text;
    }).join("").replace(/ {2,}/g, " ").trim();
    case "num": case "id": case "op": case "text": return node.v;
    case "space": return " ";
    case "frac": { const wrap = (part: MathNode) => (part.t === "row" ? `(${texToPlain(part)})` : texToPlain(part)); return `${wrap(node.n)}/${wrap(node.d)}`; }
    case "sqrt": return `√(${texToPlain(node.body)})`;
    case "script": {
      const sup = node.sup ? texToPlain(node.sup) : "";
      const superscript = [...sup].every((char) => SUPERSCRIPT[char]) ? [...sup].map((char) => SUPERSCRIPT[char]).join("") : sup ? `^(${sup})` : "";
      return `${texToPlain(node.base)}${node.sub ? `_${texToPlain(node.sub)}` : ""}${superscript}`;
    }
  }
}

// ── Segmenting lesson text ────────────────────────────────────────────────

const DELIMITED = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|(?<![A-Za-z0-9\\$])\$(?=\S)([^$\n]*?\S)\$(?![0-9A-Za-z])/g;
const COMMAND = /\\[A-Za-z]+/;
const SCRIPT_TOKEN = /^[A-Za-z0-9)\]}]+[\^_](\{[^{}]*\}|[A-Za-z0-9]+)/;

function looksLikeMath(content: string): boolean {
  // `$…$` around ordinary words (a price list) is not math; TeX syntax, digits with operators or a single symbol are.
  return COMMAND.test(content) || /[\^_{}=]/.test(content) || /^[A-Za-z]$/.test(content.trim()) || /\d\s*[+\-×*/]\s*\d/.test(content);
}

/** Whitespace-separated words, keeping `\text{square metres}` together (spaces inside braces do not split). */
function words(text: string): string[] {
  const out: string[] = [];
  let depth = 0, current = "";
  for (const char of text) {
    if (char === "{") depth++;
    if (char === "}") depth = Math.max(0, depth - 1);
    if (/\s/.test(char) && depth === 0) { if (current) out.push(current); out.push(char); current = ""; continue; }
    current += char;
  }
  if (current) out.push(current);
  return out;
}

const isSpace = (word: string) => /^\s$/.test(word);
const strong = (word: string) => COMMAND.test(word) || SCRIPT_TOKEN.test(word);
const weak = (word: string) => /^[=+\-−×÷<>≤≥≠≈*/]$/.test(word) || /^\(?[0-9][0-9,.]*\)?$/.test(word) || /^[A-Za-z]$/.test(word) || (/^[0-9A-Za-z()+\-*/=.,]+$/.test(word) && /[0-9]/.test(word) && /[()+\-*/=]/.test(word));

/**
 * Bare TeX inside prose (`The area is A = l \times w.`): a run of words around a TeX command or script,
 * extended over neighbouring numbers, single-letter variables and operators. Trailing sentence punctuation
 * stays prose.
 */
function bareSegments(text: string): MathSegment[] {
  if (!COMMAND.test(text) && !/[A-Za-z0-9)][\^_][{A-Za-z0-9]/.test(text)) return text ? [{ kind: "text", text }] : [];
  const list = words(text);
  const inMath = list.map((word) => !isSpace(word) && strong(word));
  for (let index = 0; index < list.length; index++) {
    if (!inMath[index]) continue;
    for (const direction of [-1, 1] as const) {
      let cursor = index + direction;
      let inward = list[index];
      while (cursor >= 0 && cursor < list.length) {
        if (isSpace(list[cursor])) { cursor += direction; continue; }
        const word = list[cursor].replace(direction === 1 ? /[.,;:!?]+$/ : /^$/, "");
        if (inMath[cursor] || !weak(word)) break;
        // "a", "A" and "I" are usually English words unless an operator sits next to them inside the formula
        // ("A = l \times w") or beyond them ("2 \times a").
        if (/^[aAI]$/.test(word)) {
          let beyond = cursor + direction;
          while (beyond >= 0 && beyond < list.length && isSpace(list[beyond])) beyond += direction;
          const operator = /^[=+\-−×÷<>*/]$/;
          if (!operator.test(inward) && !(beyond >= 0 && beyond < list.length && operator.test(list[beyond]))) break;
        }
        inMath[cursor] = true;
        inward = word;
        if (word !== list[cursor]) break; // the word ended a sentence
        cursor += direction;
      }
    }
  }
  const segments: MathSegment[] = [];
  const push = (segment: MathSegment) => {
    const last = segments[segments.length - 1];
    if (segment.kind === "text" && last?.kind === "text") segments[segments.length - 1] = { kind: "text", text: last.text + segment.text };
    else segments.push(segment);
  };
  for (let index = 0; index < list.length;) {
    if (!inMath[index]) { push({ kind: "text", text: list[index] }); index++; continue; }
    let end = index;
    while (end + 1 < list.length && (inMath[end + 1] || (isSpace(list[end + 1]) && inMath[end + 2]))) end++;
    let tex = list.slice(index, end + 1).join("");
    const trailing = /[.,;:!?]+$/.exec(tex)?.[0] ?? "";
    if (trailing && !/\\[A-Za-z]+$/.test(tex.slice(0, -trailing.length) + "x")) tex = tex.slice(0, -trailing.length);
    push({ kind: "math", tex, display: false });
    if (trailing && tex.length < list.slice(index, end + 1).join("").length) push({ kind: "text", text: trailing });
    index = end + 1;
  }
  return segments;
}

/** Prose and math segments of one piece of lesson text, in order. Text without math is one text segment. */
export function segmentMath(input: string): MathSegment[] {
  const text = unescapeTex(input ?? "");
  const segments: MathSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(DELIMITED)) {
    const [whole, display, bracket, paren, inline] = match;
    if (inline !== undefined && !looksLikeMath(inline)) continue;
    if (match.index! > last) segments.push(...bareSegments(text.slice(last, match.index)));
    const tex = (display ?? bracket ?? paren ?? inline).trim();
    // Display math with row breaks becomes one display line per row.
    if (display !== undefined || bracket !== undefined) for (const rowTex of tex.replace(/\\begin\{[a-z*]+\}|\\end\{[a-z*]+\}/g, "").split(/\\\\/).map((row) => row.trim()).filter(Boolean)) segments.push({ kind: "math", tex: rowTex, display: true });
    else segments.push({ kind: "math", tex, display: false });
    last = match.index! + whole.length;
  }
  if (last < text.length) segments.push(...bareSegments(text.slice(last)));
  return segments.length ? segments : [{ kind: "text", text: "" }];
}

export function hasMath(text: string): boolean {
  return segmentMath(text).some((segment) => segment.kind === "math");
}

/** Lesson text with every math segment replaced by its spoken form (for read-aloud and screen-reader text). */
export function speakMathText(text: string): string {
  return segmentMath(text).map((segment) => (segment.kind === "text" ? segment.text : ` ${texToSpeech(parseTex(segment.tex))} `)).join("").replace(/\s+/g, " ").trim();
}

/** Lesson text with every math segment as readable plain text (e.g. "A = l × w"). */
export function plainMathText(text: string): string {
  return segmentMath(text).map((segment) => (segment.kind === "text" ? segment.text : texToPlain(parseTex(segment.tex)))).join("");
}
