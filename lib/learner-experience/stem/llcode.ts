/**
 * LL Code 1: the restricted teaching language behind CODE_TRACE and CODE_RUNNER (teaching-blocks/1.2.0 DRAFT).
 *
 * A small Python-like subset, parsed to an AST and interpreted here. Learner text is never handed to the host:
 * no eval, no Function, no imports, no member access on host objects, no globals beyond the builtins listed below.
 * Environments are Maps, so names like __proto__ or constructor are plain keys. Every AST step and every allocation
 * is charged against published budgets BEFORE it happens; integers are bounded; output and the debug trace are capped.
 * Deterministic: the same source and inputs always produce the same result. Pure module: no DOM, no Node APIs.
 *
 * Language: integers, strings, True/False, lists; = += -= *=; + - * // % == != < <= > >= and or not; if/elif/else,
 * while, for x in range(...) / list / string, break, continue, pass, def/return; xs[i], xs[i] = v, xs.append(v);
 * builtins print len range str int abs min max sum input. Division "/" is not part of the language (use //).
 */

export const LLCODE_VERSION = "llcode/1.0.0";
/**
 * Published device budgets (adopted by CoS as CODE_EXECUTION_SAFETY_V1). Blocks may lower, never raise, them.
 * Memory ceiling: a list holds at most 1,000 values, a text at most 1,000 characters, and one run may allocate at most
 * 100,000 values in total. The total is cumulative (every list item, list copy and text character ever created), so
 * live memory can never exceed it.
 */
export const LLCODE_LIMITS = Object.freeze({ sourceChars: 10_000, astNodes: 2_000, steps: 200_000, callDepth: 32, listLength: 1_000, stringLength: 1_000,
  allocatedCells: 100_000, outputLines: 200, outputBytes: 16_384, traceEntries: 2_000, maxInteger: 1_000_000_000_000, timeoutMs: 2_000 });
export type LLCodeLimits = { readonly [K in keyof typeof LLCODE_LIMITS]: number };

export type LLValue = number | string | boolean | null | LLList | LLFunc;
export class LLList { constructor(public items: LLValue[]) {} }
export class LLFunc { constructor(public name: string, public params: string[], public body: Stmt[], public line: number) {} }
export type TraceEntry = Readonly<{ step: number; line: number; vars: Readonly<Record<string, string>>; output: number }>;
export type LLCodeError = Readonly<{ kind: "SYNTAX" | "RUNTIME" | "LIMIT"; line: number | null; message: string }>;
export type LLCodeResult = Readonly<{ version: typeof LLCODE_VERSION; ok: boolean; output: readonly string[]; error: LLCodeError | null; steps: number; trace: readonly TraceEntry[]; traceTruncated: boolean }>;

// ---------- tokens ----------
type Tok = { k: "num" | "str" | "name" | "op" | "nl" | "indent" | "dedent" | "eof"; v: string; line: number };
const KEYWORDS = new Set(["if", "elif", "else", "while", "for", "in", "def", "return", "break", "continue", "pass", "and", "or", "not", "True", "False", "None"]);
class Fail extends Error { constructor(public kind: LLCodeError["kind"], public line: number | null, message: string) { super(message); } }

function tokenize(source: string): Tok[] {
  const out: Tok[] = [], indents = [0];
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  lines.forEach((raw, i) => {
    const line = i + 1;
    if (/\t/.test(raw.match(/^\s*/)![0])) throw new Fail("SYNTAX", line, "Use spaces, not tabs, to indent.");
    const body = raw.replace(/^ +/, "");
    if (!body.trim() || body.trim().startsWith("#")) return;
    const indent = raw.length - body.length;
    if (indent > indents[indents.length - 1]) { indents.push(indent); out.push({ k: "indent", v: "", line }); }
    while (indent < indents[indents.length - 1]) { indents.pop(); out.push({ k: "dedent", v: "", line }); }
    if (indent !== indents[indents.length - 1]) throw new Fail("SYNTAX", line, "This line's indentation does not match any block above it.");
    let j = 0;
    while (j < body.length) {
      const c = body[j];
      if (c === " ") { j++; continue; }
      if (c === "#") break;
      if (/[0-9]/.test(c)) { let e = j; while (e < body.length && /[0-9]/.test(body[e])) e++; if (/[A-Za-z_.]/.test(body[e] ?? "")) throw new Fail("SYNTAX", line, "Only whole numbers are used in this language."); out.push({ k: "num", v: body.slice(j, e), line }); j = e; continue; }
      if (/[A-Za-z_]/.test(c)) { let e = j; while (e < body.length && /[A-Za-z0-9_]/.test(body[e])) e++; out.push({ k: "name", v: body.slice(j, e), line }); j = e; continue; }
      if (c === '"' || c === "'") {
        let e = j + 1, s = "";
        for (; e < body.length && body[e] !== c; e++) {
          if (body[e] === "\\") { const n = body[++e]; s += n === "n" ? "\n" : n === "\\" || n === '"' || n === "'" ? n : (() => { throw new Fail("SYNTAX", line, "Unknown escape in text."); })(); }
          else s += body[e];
        }
        if (e >= body.length) throw new Fail("SYNTAX", line, "This text is missing its closing quote.");
        out.push({ k: "str", v: s, line }); j = e + 1; continue;
      }
      const two = body.slice(j, j + 2);
      if (["==", "!=", "<=", ">=", "//", "+=", "-=", "*="].includes(two)) { out.push({ k: "op", v: two, line }); j += 2; continue; }
      if ("+-*%<>=()[],:.".includes(c)) { out.push({ k: "op", v: c, line }); j++; continue; }
      if (c === "/") throw new Fail("SYNTAX", line, "Use // for whole-number division.");
      throw new Fail("SYNTAX", line, `The character "${c}" is not part of this language.`);
    }
    out.push({ k: "nl", v: "", line });
  });
  while (indents.length > 1) { indents.pop(); out.push({ k: "dedent", v: "", line: lines.length }); }
  out.push({ k: "eof", v: "", line: lines.length });
  return out;
}

// ---------- AST ----------
type Expr =
  | { t: "num"; v: number; line: number } | { t: "str"; v: string; line: number } | { t: "bool"; v: boolean; line: number } | { t: "none"; line: number }
  | { t: "name"; name: string; line: number } | { t: "list"; items: Expr[]; line: number }
  | { t: "bin"; op: string; a: Expr; b: Expr; line: number } | { t: "not"; a: Expr; line: number } | { t: "neg"; a: Expr; line: number }
  | { t: "call"; name: string; args: Expr[]; line: number } | { t: "index"; target: Expr; index: Expr; line: number } | { t: "append"; target: Expr; value: Expr; line: number };
type Stmt =
  | { t: "expr"; e: Expr; line: number } | { t: "assign"; name: string; op: string; e: Expr; line: number } | { t: "setindex"; target: Expr; index: Expr; e: Expr; line: number }
  | { t: "if"; branches: Array<{ cond: Expr; body: Stmt[] }>; orelse: Stmt[] | null; line: number } | { t: "while"; cond: Expr; body: Stmt[]; line: number }
  | { t: "for"; name: string; iter: Expr; body: Stmt[]; line: number } | { t: "def"; name: string; params: string[]; body: Stmt[]; line: number }
  | { t: "return"; e: Expr | null; line: number } | { t: "break" | "continue" | "pass"; line: number };

const BUILTINS = new Set(["print", "len", "range", "str", "int", "abs", "min", "max", "sum", "input"]);
const identifier = (name: string, line: number) => {
  if (KEYWORDS.has(name)) throw new Fail("SYNTAX", line, `"${name}" is a keyword and cannot be used as a name.`);
  if (name.startsWith("__")) throw new Fail("SYNTAX", line, "Names may not start with two underscores.");
  return name;
};

function parse(tokens: Tok[], limits: LLCodeLimits): Stmt[] {
  let p = 0, nodes = 0;
  const node = <T>(n: T): T => { if (++nodes > limits.astNodes) throw new Fail("LIMIT", null, `This program is too long (more than ${limits.astNodes} parts).`); return n; };
  const peek = () => tokens[p], next = () => tokens[p++];
  const is = (k: Tok["k"], v?: string) => tokens[p].k === k && (v === undefined || tokens[p].v === v);
  const expect = (k: Tok["k"], v?: string, what?: string) => { if (!is(k, v)) throw new Fail("SYNTAX", peek().line, `Expected ${what ?? v ?? k} here.`); return next(); };
  const kw = (v: string) => is("name", v);

  function block(): Stmt[] {
    expect("op", ":"); expect("nl", undefined, "a new line after ':'"); expect("indent", undefined, "an indented block");
    const body: Stmt[] = [];
    while (!is("dedent") && !is("eof")) body.push(statement());
    if (is("dedent")) next();
    return body;
  }
  function statement(): Stmt {
    const line = peek().line;
    if (kw("if")) {
      next(); const branches = [{ cond: expr(), body: block() }];
      while (kw("elif")) { next(); branches.push({ cond: expr(), body: block() }); }
      const orelse = kw("else") ? (next(), block()) : null;
      return node({ t: "if", branches, orelse, line });
    }
    if (kw("while")) { next(); const cond = expr(); return node({ t: "while", cond, body: block(), line }); }
    if (kw("for")) { next(); const name = identifier(expect("name", undefined, "a loop variable").v, line); if (!kw("in")) throw new Fail("SYNTAX", line, "Expected 'in' after the loop variable."); next(); const iter = expr(); return node({ t: "for", name, iter, body: block(), line }); }
    if (kw("def")) {
      next(); const name = identifier(expect("name", undefined, "a function name").v, line);
      if (BUILTINS.has(name)) throw new Fail("SYNTAX", line, `"${name}" is a built-in name.`);
      expect("op", "("); const params: string[] = [];
      while (!is("op", ")")) { params.push(identifier(expect("name", undefined, "a parameter name").v, line)); if (!is("op", ")")) expect("op", ","); }
      next(); return node({ t: "def", name, params, body: block(), line });
    }
    const s = simple(line);
    if (!is("eof")) expect("nl", undefined, "the end of the line");
    return s;
  }
  function simple(line: number): Stmt {
    if (kw("pass") || kw("break") || kw("continue")) return node({ t: next().v as "pass" | "break" | "continue", line });
    if (kw("return")) { next(); return node({ t: "return", e: is("nl") || is("eof") ? null : expr(), line }); }
    const target = expr();
    if (is("op", "=") || is("op", "+=") || is("op", "-=") || is("op", "*=")) {
      const op = next().v, e = expr();
      if (target.t === "name") { if (BUILTINS.has(target.name)) throw new Fail("SYNTAX", line, `"${target.name}" is a built-in name.`); return node({ t: "assign", name: target.name, op, e, line }); }
      if (target.t === "index" && op === "=") return node({ t: "setindex", target: target.target, index: target.index, e, line });
      throw new Fail("SYNTAX", line, "You can only assign to a name or a list item.");
    }
    return node({ t: "expr", e: target, line });
  }
  const binary = (sub: () => Expr, ops: string[], kwOps = false) => (): Expr => {
    let a = sub();
    while (kwOps ? ops.some((o) => kw(o)) : ops.some((o) => is("op", o))) { const t = next(); a = node({ t: "bin", op: t.v, a, b: sub(), line: t.line }); }
    return a;
  };
  function unaryNot(): Expr { if (kw("not")) { const line = next().line; return node({ t: "not", a: unaryNot(), line }); } return comparison(); }
  function comparison(): Expr {
    const a = additive();
    if (["==", "!=", "<", "<=", ">", ">="].some((o) => is("op", o))) { const t = next(); const b = additive();
      if (["==", "!=", "<", "<=", ">", ">="].some((o) => is("op", o))) throw new Fail("SYNTAX", t.line, "Compare two things at a time; join comparisons with 'and'.");
      return node({ t: "bin", op: t.v, a, b, line: t.line }); }
    return a;
  }
  function unaryMinus(): Expr { if (is("op", "-")) { const line = next().line; return node({ t: "neg", a: unaryMinus(), line }); } return postfix(); }
  function postfix(): Expr {
    let e = atom();
    for (;;) {
      if (is("op", "[")) { const line = next().line; const index = expr(); expect("op", "]"); e = node({ t: "index", target: e, index, line }); continue; }
      if (is("op", ".")) {
        const line = next().line, member = expect("name", undefined, "a method name").v;
        if (member !== "append") throw new Fail("SYNTAX", line, `".${member}" is not available. Lists support .append(value).`);
        expect("op", "("); const value = expr(); expect("op", ")"); e = node({ t: "append", target: e, value, line }); continue;
      }
      return e;
    }
  }
  function atom(): Expr {
    const t = next(), line = t.line;
    if (t.k === "num") { const v = Number(t.v); if (!Number.isSafeInteger(v) || Math.abs(v) > limits.maxInteger) throw new Fail("LIMIT", line, "This number is too large."); return node({ t: "num", v, line }); }
    if (t.k === "str") { if (t.v.length > limits.stringLength) throw new Fail("LIMIT", line, "This text is too long."); return node({ t: "str", v: t.v, line }); }
    if (t.k === "name") {
      if (t.v === "True" || t.v === "False") return node({ t: "bool", v: t.v === "True", line });
      if (t.v === "None") return node({ t: "none", line });
      const name = identifier(t.v, line);
      if (is("op", "(")) { next(); const args: Expr[] = []; while (!is("op", ")")) { args.push(expr()); if (!is("op", ")")) expect("op", ","); } next(); return node({ t: "call", name, args, line }); }
      return node({ t: "name", name, line });
    }
    if (t.k === "op" && t.v === "(") { const e = expr(); expect("op", ")"); return e; }
    if (t.k === "op" && t.v === "[") { const items: Expr[] = []; while (!is("op", "]")) { items.push(expr()); if (!is("op", "]")) expect("op", ","); } next(); return node({ t: "list", items, line }); }
    throw new Fail("SYNTAX", line, t.k === "nl" || t.k === "eof" ? "This line ends too early." : `Unexpected "${t.v}".`);
  }
  const multiplicative = binary(unaryMinus, ["*", "//", "%"]);
  const additive = binary(multiplicative, ["+", "-"]);
  const andExpr = binary(unaryNot, ["and"], true);
  const expr = binary(andExpr, ["or"], true);
  const program: Stmt[] = [];
  while (!is("eof")) { if (is("indent")) throw new Fail("SYNTAX", peek().line, "This line is indented but is not inside a block."); program.push(statement()); }
  return program;
}

// ---------- evaluation ----------
class Signal { constructor(public kind: "break" | "continue" | "return", public value: LLValue = null) {} }
const typeName = (v: LLValue) => v === null ? "None" : typeof v === "number" ? "number" : typeof v === "string" ? "text" : typeof v === "boolean" ? "True/False" : v instanceof LLList ? "list" : "function";

const scalar = (v: Exclude<LLValue, LLList>) => v === null ? "None" : typeof v === "boolean" ? (v ? "True" : "False") : typeof v === "number" || typeof v === "string" ? String(v) : `<function ${v.name}>`;

/**
 * Budget-aware, cycle-safe formatting (LLCODE-FMT). Never builds more than `cap` characters: it stops writing the
 * moment the cap is reached and reports `truncated`. Every value it visits calls `visit()` (the interpreter charges
 * these to the step budget) and at most `maxVisits` values are visited. A list that contains itself, directly or
 * through another list, prints as [...]; shared sublists are visited again but every visit is counted.
 */
export function format(v: LLValue, cap: number, options: { visit?: () => void; maxVisits?: number } = {}): { text: string; truncated: boolean } {
  let out = "", truncated = false, visits = 0;
  const maxVisits = options.maxVisits ?? Number.POSITIVE_INFINITY;
  const path = new Set<LLList>();
  const push = (piece: string) => {
    if (out.length + piece.length <= cap) { out += piece; return true; }
    out += piece.slice(0, Math.max(0, cap - out.length)); truncated = true; return false;
  };
  const walk = (x: LLValue, depth: number, inList: boolean): boolean => {
    if (++visits > maxVisits) { truncated = true; return false; }
    options.visit?.();
    if (!(x instanceof LLList)) return push(inList && typeof x === "string" ? `'${x}'` : scalar(x));
    if (path.has(x) || depth > 3) return push("[...]");
    path.add(x);
    if (!push("[")) return false;
    for (let i = 0; i < x.items.length; i++) if ((i > 0 && !push(", ")) || !walk(x.items[i], depth + 1, true)) return false;
    path.delete(x);
    return push("]");
  };
  walk(v, 0, false);
  return { text: out, truncated };
}

/** Short display form for messages outside a run (at most 200 characters and 400 visits). */
export function show(v: LLValue): string {
  const r = format(v, 200, { maxVisits: 400 });
  return r.truncated ? `${r.text}...` : r.text;
}

/** Named starting values (the 1.2.0 block `inputs` record): whole numbers, text, True/False, None, or a list of those. */
export type LLPresetValue = number | string | boolean | null | ReadonlyArray<number | string | boolean | null>;

export function runLLCode(source: string, options: { inputs?: readonly string[]; presets?: Readonly<Record<string, LLPresetValue>>; limits?: Partial<LLCodeLimits>; trace?: boolean } = {}): LLCodeResult {
  // A block may tighten a budget, never loosen it.
  const limits = { ...LLCODE_LIMITS } as { -readonly [K in keyof LLCodeLimits]: number };
  for (const [k, v] of Object.entries(options.limits ?? {})) if (k in limits && typeof v === "number" && v >= 0) limits[k as keyof LLCodeLimits] = Math.min(limits[k as keyof LLCodeLimits], v);
  const output: string[] = [], trace: TraceEntry[] = [];
  let steps = 0, cells = 0, outBytes = 0, depth = 0, traceTruncated = false;
  const inputs = [...(options.inputs ?? [])];
  const globals = new Map<string, LLValue>();
  const finish = (error: LLCodeError | null): LLCodeResult => ({ version: LLCODE_VERSION, ok: !error, output, error, steps, trace, traceTruncated });
  if (typeof source !== "string") return finish({ kind: "SYNTAX", line: null, message: "No program." });
  if (source.length > limits.sourceChars) return finish({ kind: "LIMIT", line: null, message: `This program is longer than ${limits.sourceChars} characters.` });

  const step = (line: number) => { if (++steps > limits.steps) throw new Fail("LIMIT", line, "The program ran too many steps. Check for a loop that never stops."); };
  const allocate = (n: number, line: number) => { cells += n; if (cells > limits.allocatedCells) throw new Fail("LIMIT", line, "The program made too much data."); };
  const int = (v: number, line: number) => { if (!Number.isSafeInteger(v) || Math.abs(v) > limits.maxInteger) throw new Fail("LIMIT", line, "A number grew too large."); return v; };
  const text = (s: string, line: number) => { if (s.length > limits.stringLength) throw new Fail("LIMIT", line, "Some text grew too long."); return s; };
  const list = (items: LLValue[], line: number) => { if (items.length > limits.listLength) throw new Fail("LIMIT", line, "A list grew too long."); return new LLList(items); };
  const num = (v: LLValue, line: number, what: string): number => { if (typeof v !== "number") throw new Fail("RUNTIME", line, `${what} needs a number, not ${typeName(v)}.`); return v; };
  const truthy = (v: LLValue) => v !== null && v !== false && v !== 0 && v !== "" && !(v instanceof LLList && v.items.length === 0);
  // List equality charges a step per compared pair and is cycle-safe: a pair already being compared is assumed equal.
  const equal = (a: LLValue, b: LLValue, line: number, open = new Map<LLList, Set<LLList>>()): boolean => {
    step(line);
    if (!(a instanceof LLList) || !(b instanceof LLList)) return a === b;
    if (a === b) return true;
    if (a.items.length !== b.items.length) return false;
    const seen = open.get(a) ?? new Set<LLList>();
    if (seen.has(b)) return true;
    seen.add(b); open.set(a, seen);
    for (let i = 0; i < a.items.length; i++) if (!equal(a.items[i], b.items[i], line, open)) return false;
    return true;
  };
  /** Text of a value under a character cap, charged to the step budget; LIMIT when it would not fit. */
  const render = (v: LLValue, cap: number, line: number, message: string) => {
    const r = format(v, cap, { visit: () => step(line) });
    if (r.truncated) throw new Fail("LIMIT", line, message);
    return r.text;
  };
  const snapshot = (scope: Map<string, LLValue>) => { const vars: Record<string, string> = Object.create(null); let n = 0;
    for (const [k, v] of scope) { if (v instanceof LLFunc) continue; if (++n > 24) break;
      // Trace snapshots are bounded (80 characters, 200 visits) and never charged: tracing must not change a run.
      const r = format(v, 80, { maxVisits: 200 }); vars[k] = r.truncated ? `${r.text.slice(0, 77)}...` : r.text; }
    return vars; };
  const record = (line: number, scope: Map<string, LLValue>) => {
    if (!options.trace) return;
    if (trace.length >= limits.traceEntries) { traceTruncated = true; return; }
    trace.push({ step: steps, line, vars: snapshot(scope), output: output.length });
  };
  const emit = (s: string, line: number) => {
    outBytes += s.length + 1;
    if (output.length >= limits.outputLines || outBytes > limits.outputBytes) throw new Fail("LIMIT", line, "The program printed too much.");
    output.push(s);
  };
  const lookup = (name: string, scope: Map<string, LLValue>, line: number): LLValue => {
    if (scope.has(name)) return scope.get(name)!;
    if (globals.has(name)) return globals.get(name)!;
    throw new Fail("RUNTIME", line, BUILTINS.has(name) ? `${name} must be called, like ${name}(...).` : `"${name}" has no value yet.`);
  };
  const indexOf = (container: LLValue, i: LLValue, line: number) => {
    if (!(container instanceof LLList) && typeof container !== "string") throw new Fail("RUNTIME", line, `Only lists and text can be indexed, not ${typeName(container)}.`);
    const n = num(i, line, "An index"), len = container instanceof LLList ? container.items.length : container.length, at = n < 0 ? len + n : n;
    if (at < 0 || at >= len) throw new Fail("RUNTIME", line, `Index ${n} is outside the ${container instanceof LLList ? "list" : "text"} (length ${len}).`);
    return at;
  };

  function binop(op: string, a: LLValue, b: LLValue, line: number): LLValue {
    switch (op) {
      case "+":
        if (typeof a === "number" && typeof b === "number") return int(a + b, line);
        if (typeof a === "string" && typeof b === "string") { if (a.length + b.length > limits.stringLength) throw new Fail("LIMIT", line, "Some text grew too long."); allocate(a.length + b.length, line); return a + b; }
        if (a instanceof LLList && b instanceof LLList) { if (a.items.length + b.items.length > limits.listLength) throw new Fail("LIMIT", line, "A list grew too long."); allocate(a.items.length + b.items.length, line); return new LLList([...a.items, ...b.items]); }
        throw new Fail("RUNTIME", line, `Cannot add ${typeName(a)} and ${typeName(b)}.`);
      case "*": {
        if (typeof a === "number" && typeof b === "number") return int(a * b, line);
        const [seq, times] = typeof a === "number" ? [b, a] : [a, b];
        if (typeof times === "number" && (typeof seq === "string" || seq instanceof LLList)) {
          const count = Math.max(0, times), size = (typeof seq === "string" ? seq.length : seq.items.length) * count;
          if (size > (typeof seq === "string" ? limits.stringLength : limits.listLength)) throw new Fail("LIMIT", line, typeof seq === "string" ? "Some text grew too long." : "A list grew too long.");
          allocate(size, line);
          return typeof seq === "string" ? seq.repeat(count) : new LLList(Array.from({ length: count }, () => seq.items).flat());
        }
        throw new Fail("RUNTIME", line, `Cannot multiply ${typeName(a)} by ${typeName(b)}.`);
      }
      case "-": return int(num(a, line, "Subtraction") - num(b, line, "Subtraction"), line);
      case "//": case "%": {
        const x = num(a, line, "Division"), y = num(b, line, "Division");
        if (y === 0) throw new Fail("RUNTIME", line, "You cannot divide by zero.");
        const q = Math.floor(x / y);
        return op === "//" ? int(q, line) : int(x - q * y, line);
      }
      case "==": return equal(a, b, line);
      case "!=": return !equal(a, b, line);
      case "<": case "<=": case ">": case ">=": {
        if (!((typeof a === "number" && typeof b === "number") || (typeof a === "string" && typeof b === "string"))) throw new Fail("RUNTIME", line, `Cannot compare ${typeName(a)} with ${typeName(b)}.`);
        return op === "<" ? a < b : op === "<=" ? a <= b : op === ">" ? a > b : a >= b;
      }
    }
    throw new Fail("RUNTIME", line, `Unknown operator ${op}.`);
  }

  function call(name: string, args: LLValue[], line: number, scope: Map<string, LLValue>): LLValue {
    switch (name) {
      case "print": {
        // Format within what output may still hold, so an oversized value is never built.
        const room = Math.max(0, limits.outputBytes - outBytes - 1), parts: string[] = [];
        let used = 0;
        for (const a of args) { const t = render(a, Math.max(0, room - used - parts.length), line, "The program printed too much."); parts.push(t); used += t.length; }
        emit(parts.join(" "), line); return null;
      }
      case "len": { const [v] = args; if (args.length !== 1 || !(typeof v === "string" || v instanceof LLList)) throw new Fail("RUNTIME", line, "len(...) needs one list or text."); return v instanceof LLList ? v.items.length : v.length; }
      case "range": {
        if (args.length < 1 || args.length > 3) throw new Fail("RUNTIME", line, "range needs 1, 2 or 3 numbers.");
        const [a, b, c] = args.map((x) => num(x, line, "range"));
        const [start, stop, by] = args.length === 1 ? [0, a, 1] : [a, b, args.length === 3 ? c : 1];
        if (by === 0) throw new Fail("RUNTIME", line, "range cannot step by 0.");
        const count = Math.max(0, Math.ceil((stop - start) / by));
        if (count > limits.listLength) throw new Fail("LIMIT", line, `range is limited to ${limits.listLength} numbers here.`);
        allocate(count, line);
        return new LLList(Array.from({ length: count }, (_, i) => start + i * by));
      }
      case "str": { if (args.length !== 1) throw new Fail("RUNTIME", line, "str(...) needs one value."); const s = render(args[0], limits.stringLength, line, "Some text grew too long."); allocate(s.length, line); return s; }
      case "int": {
        const [v] = args;
        if (typeof v === "number") return v;
        if (typeof v === "boolean") return v ? 1 : 0;
        if (typeof v === "string" && /^\s*-?\d+\s*$/.test(v)) return int(Number(v.trim()), line);
        throw new Fail("RUNTIME", line, `int(...) cannot turn ${show(v ?? null)} into a whole number.`);
      }
      case "abs": return Math.abs(num(args[0] ?? null, line, "abs"));
      case "min": case "max": case "sum": {
        const values = args.length === 1 && args[0] instanceof LLList ? args[0].items : args;
        const nums = values.map((x) => num(x, line, name));
        if (!nums.length) return name === "sum" ? 0 : (() => { throw new Fail("RUNTIME", line, `${name} needs at least one number.`); })();
        return name === "sum" ? int(nums.reduce((s, x) => s + x, 0), line) : name === "min" ? Math.min(...nums) : Math.max(...nums);
      }
      case "input": { if (!inputs.length) throw new Fail("RUNTIME", line, "The program asked for more input than was given."); return text(inputs.shift()!, line); }
    }
    const fn = lookup(name, scope, line);
    if (!(fn instanceof LLFunc)) throw new Fail("RUNTIME", line, `"${name}" is not a function.`);
    if (args.length !== fn.params.length) throw new Fail("RUNTIME", line, `${fn.name} needs ${fn.params.length} value${fn.params.length === 1 ? "" : "s"}, got ${args.length}.`);
    if (++depth > limits.callDepth) throw new Fail("LIMIT", line, "Too many function calls inside each other.");
    const local = new Map<string, LLValue>(fn.params.map((p, i) => [p, args[i]]));
    try { run(fn.body, local); return null; }
    catch (s) { if (s instanceof Signal && s.kind === "return") return s.value; if (s instanceof Signal) throw new Fail("RUNTIME", line, `"${s.kind}" must be inside a loop.`); throw s; }
    finally { depth--; }
  }

  function evaluate(e: Expr, scope: Map<string, LLValue>): LLValue {
    step(e.line);
    switch (e.t) {
      case "num": return e.v; case "str": return e.v; case "bool": return e.v; case "none": return null;
      case "name": return lookup(e.name, scope, e.line);
      case "list": { if (e.items.length > limits.listLength) throw new Fail("LIMIT", e.line, "A list grew too long."); allocate(e.items.length, e.line); return list(e.items.map((x) => evaluate(x, scope)), e.line); }
      case "neg": return int(-num(evaluate(e.a, scope), e.line, "A minus sign"), e.line);
      case "not": return !truthy(evaluate(e.a, scope));
      case "bin":
        if (e.op === "and") { const a = evaluate(e.a, scope); return truthy(a) ? evaluate(e.b, scope) : a; }
        if (e.op === "or") { const a = evaluate(e.a, scope); return truthy(a) ? a : evaluate(e.b, scope); }
        return binop(e.op, evaluate(e.a, scope), evaluate(e.b, scope), e.line);
      case "index": { const c = evaluate(e.target, scope), at = indexOf(c, evaluate(e.index, scope), e.line); return c instanceof LLList ? c.items[at] : (c as string)[at]; }
      case "append": {
        const c = evaluate(e.target, scope);
        if (!(c instanceof LLList)) throw new Fail("RUNTIME", e.line, `.append works on lists, not ${typeName(c)}.`);
        if (c.items.length + 1 > limits.listLength) throw new Fail("LIMIT", e.line, "A list grew too long.");
        allocate(1, e.line); c.items.push(evaluate(e.value, scope)); return null;
      }
      case "call": return call(e.name, e.args.map((a) => evaluate(a, scope)), e.line, scope);
    }
  }

  function run(body: Stmt[], scope: Map<string, LLValue>) {
    for (const s of body) {
      step(s.line); record(s.line, scope);
      switch (s.t) {
        case "expr": evaluate(s.e, scope); break;
        case "assign": {
          const v = evaluate(s.e, scope);
          scope.set(s.name, s.op === "=" ? v : binop(s.op[0], lookup(s.name, scope, s.line), v, s.line));
          break;
        }
        case "setindex": { const c = evaluate(s.target, scope); if (!(c instanceof LLList)) throw new Fail("RUNTIME", s.line, "Only list items can be changed."); c.items[indexOf(c, evaluate(s.index, scope), s.line)] = evaluate(s.e, scope); break; }
        case "if": { const hit = s.branches.find((b) => truthy(evaluate(b.cond, scope))); if (hit) run(hit.body, scope); else if (s.orelse) run(s.orelse, scope); break; }
        case "while":
          while (truthy(evaluate(s.cond, scope))) { try { run(s.body, scope); } catch (sig) { if (sig instanceof Signal && sig.kind === "break") break; if (sig instanceof Signal && sig.kind === "continue") continue; throw sig; } }
          break;
        case "for": {
          const it = evaluate(s.iter, scope);
          const items = it instanceof LLList ? [...it.items] : typeof it === "string" ? [...it] : (() => { throw new Fail("RUNTIME", s.line, `Cannot loop over ${typeName(it)}.`); })();
          for (const item of items) {
            step(s.line); scope.set(s.name, item);
            try { run(s.body, scope); } catch (sig) { if (sig instanceof Signal && sig.kind === "break") break; if (sig instanceof Signal && sig.kind === "continue") continue; throw sig; }
          }
          break;
        }
        case "def": scope.set(s.name, new LLFunc(s.name, s.params, s.body, s.line)); break;
        case "return": if (depth === 0) throw new Fail("RUNTIME", s.line, "return must be inside a function."); throw new Signal("return", s.e ? evaluate(s.e, scope) : null);
        case "break": case "continue": throw new Signal(s.t);
        case "pass": break;
      }
    }
  }

  try {
    // Presets become globals under the same name rules and budgets as program values.
    for (const [name, value] of Object.entries(options.presets ?? {})) {
      // Same rule as the contract's `variable`: letters first, and never a host identifier.
      if (!/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(name) || BUILTINS.has(name) || ["constructor", "prototype", "__proto__"].includes(name)) throw new Fail("SYNTAX", null, `"${name}" cannot be used as a starting value name.`);
      identifier(name, 0);
      const one = (v: unknown): LLValue => {
        if (v === null) return null;
        if (typeof v === "boolean") return v;
        if (typeof v === "number") { if (!Number.isInteger(v)) throw new Fail("RUNTIME", null, `Starting value ${name} must be a whole number.`); return int(v, 0); }
        if (typeof v === "string") { allocate(v.length, 0); return text(v, 0); }
        throw new Fail("RUNTIME", null, `Starting value ${name} has an unsupported type.`);
      };
      if (Array.isArray(value)) { allocate(value.length, 0); globals.set(name, list(value.map(one), 0)); }
      else globals.set(name, one(value));
    }
    const program = parse(tokenize(source), limits);
    try { run(program, globals); }
    catch (s) { if (s instanceof Signal) throw new Fail("RUNTIME", null, `"${s.kind}" must be inside a ${s.kind === "return" ? "function" : "loop"}.`); throw s; }
    record(0, globals);
    return finish(null);
  } catch (e) {
    if (e instanceof Fail) return finish({ kind: e.kind, line: e.line, message: e.message });
    // JS engine limits (deep recursion in the host) end the run as a LIMIT, never as a crash.
    return finish({ kind: "LIMIT", line: null, message: "The program stopped because it was too complex to run." });
  }
}
