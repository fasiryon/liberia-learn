// LL Code 1 (llcode/1.0.0): behaviour and adversarial security fixtures for the restricted teaching interpreter.
// Every hostile program must end as a bounded SYNTAX / RUNTIME / LIMIT result: never a hang, a host crash, a host
// object, or any access to globals, prototypes, the network or the file system.
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { LLCODE_LIMITS, runLLCode } from "@/lib/learner-experience/stem/llcode";

const run = (src: string, opts?: Parameters<typeof runLLCode>[1]) => runLLCode(src.replace(/^\n/, ""), opts);

describe("LL Code behaviour", () => {
  it("counts water-loss readings above a threshold (the G7 P5 shape)", () => {
    const r = run(`
readings = [12, 30, 7, 30, 41]
count = 0
for r in readings:
    if r >= 30:
        count += 1
print("days at or above 30:", count)
`);
    expect(r).toMatchObject({ ok: true, output: ["days at or above 30: 3"] });
  });

  it("is deterministic and traces line and variables for stepping", () => {
    const src = "total = 0\nfor i in range(1, 4):\n    total = total + i\nprint(total)\n";
    const a = runLLCode(src, { trace: true }), b = runLLCode(src, { trace: true });
    expect(a).toEqual(b);
    expect(a.output).toEqual(["6"]);
    expect(a.trace.filter((t) => t.line === 3).map((t) => t.vars.total)).toEqual(["0", "1", "3"]);
  });

  it("supports functions, while, break/continue, lists and text", () => {
    const r = run(`
def double(x):
    return x * 2
xs = []
n = 0
while True:
    n += 1
    if n % 2 == 0:
        continue
    if n > 7:
        break
    xs.append(double(n))
print(xs, len(xs), sum(xs), max(xs), min(xs))
print("ab" * 3, str(5) + "!", int("42") + 1, xs[-1], abs(-3))
`);
    expect(r.ok).toBe(true);
    expect(r.output).toEqual(["[2, 6, 10, 14] 4 32 14 2", "ababab 5! 43 14 3"]);
  });

  it("uses floor division and Python-style modulo", () => {
    expect(run("print(-7 // 2, -7 % 2, 7 // -2)").output).toEqual(["-4 1 -4"]);
  });

  it("reads provided inputs only", () => {
    expect(run("a = int(input())\nprint(a * a)", { inputs: ["9"] }).output).toEqual(["81"]);
    expect(run("input()").error).toMatchObject({ kind: "RUNTIME" });
  });

  it("explains learner mistakes in plain language with a line number", () => {
    expect(run("x = 1\nprint(y)").error).toEqual({ kind: "RUNTIME", line: 2, message: '"y" has no value yet.' });
    expect(run("print(5 / 2)").error).toMatchObject({ kind: "SYNTAX", message: "Use // for whole-number division." });
    expect(run("if x == 1\n    print(1)").error).toMatchObject({ kind: "SYNTAX", line: 1 });
    expect(run("xs = [1]\nprint(xs[3])").error).toMatchObject({ kind: "RUNTIME", line: 2 });
    expect(run("print(1 / 0)").error?.kind).toBe("SYNTAX");
    expect(run("print(1 // 0)").error).toMatchObject({ kind: "RUNTIME", message: "You cannot divide by zero." });
  });
});

describe("LL Code adversarial fixtures", () => {
  const limited = (r: ReturnType<typeof runLLCode>, kind = "LIMIT") => { expect(r.ok).toBe(false); expect(r.error?.kind).toBe(kind); };

  it("stops infinite loops at the step budget", () => {
    const r = run("while True:\n    pass");
    limited(r);
    expect(r.steps).toBe(LLCODE_LIMITS.steps + 1);
  });
  it("stops runaway recursion at the call depth", () => limited(run("def f(n):\n    return f(n + 1)\nf(0)")));
  it("caps lists, text, range, repetition and aggregate allocation before allocating", () => {
    limited(run("xs = []\nwhile True:\n    xs.append(1)"));
    limited(run("s = 'a'\nwhile True:\n    s = s + s"));
    limited(run("print(range(10000000000))"));
    limited(run("print('x' * 100000000)"));
    limited(run("print([0] * 100000000)"));
    limited(run("t = 0\nwhile True:\n    xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]\n    ys = xs + xs"));
  });
  it("bounds integers instead of overflowing", () => {
    limited(run("n = 2\nwhile True:\n    n = n * n"));
    limited(run("print(99999999999999999999)"));
  });
  it("caps output lines and bytes", () => {
    const r = run("while True:\n    print('flood')");
    limited(r);
    expect(r.output.length).toBe(LLCODE_LIMITS.outputLines);
  });
  it("caps source size and AST size", () => {
    limited(run("x = 1\n".repeat(3000)));
    limited(run(`x = ${Array.from({ length: 1200 }, () => "1").join(" + ")}`));
  });
  it("has no prototype, constructor or host escape", () => {
    expect(run("__proto__ = 1").error?.kind).toBe("SYNTAX");
    expect(run("x = []\nx.constructor").error?.kind).toBe("SYNTAX");
    expect(run("print(constructor)").error).toMatchObject({ kind: "RUNTIME", message: '"constructor" has no value yet.' });
    expect(run("toString = 5\nprint(toString)").output).toEqual(["5"]);
    expect(run("hasOwnProperty = 1\nvalueOf = 2\nprint(hasOwnProperty + valueOf)").output).toEqual(["3"]);
    expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined();
  });
  it("cannot name any host capability", () => {
    for (const src of ["fetch('http://example.com')", "eval('1')", "Function('return 1')", "globalThis", "process", "require('fs')", "import os", "window.location", "self.postMessage(1)", "open('x')", "__import__('os')"]) {
      const r = run(src);
      expect(r.ok, src).toBe(false);
      expect(["SYNTAX", "RUNTIME"]).toContain(r.error?.kind);
    }
  });
  it("renders hostile text as text, never markup, and never throws", () => {
    const r = run(`print("<img src=x onerror=alert(1)>")`);
    expect(r.output).toEqual(["<img src=x onerror=alert(1)>"]);
    for (const junk of ["\u0000", "'''", "((((((((((", "def", "for in in in:", ")".repeat(50), "x =", "\t\tx = 1"]) expect(() => run(junk)).not.toThrow();
  });
  it("lets a block tighten a budget but never loosen it", () => {
    limited(run("for i in range(50):\n    pass", { limits: { steps: 20 } }));
    expect(run("for i in range(500):\n    pass", { limits: { steps: 10_000_000 } }).ok).toBe(true);
    limited(run("while True:\n    pass", { limits: { steps: 10_000_000 } }));
  });
});

describe("source-level guarantees", () => {
  it("the interpreter never calls host eval, Function or dynamic import", () => {
    const code = fs.readFileSync("lib/learner-experience/stem/llcode.ts", "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    expect(code).not.toMatch(/\beval\s*\(|new\s+Function\s*\(|\bFunction\s*\(|import\s*\(|require\s*\(|globalThis|\bwindow\b|\bdocument\b/);
  });
  it("the worker removes network and loader capabilities and runs one program", () => {
    const worker = fs.readFileSync("lib/learner-experience/stem/llcode.worker.ts", "utf8");
    for (const name of ["fetch", "XMLHttpRequest", "WebSocket", "importScripts"]) expect(worker).toContain(`"${name}"`);
    expect(worker).toContain("if (used) return;");
  });
});

// CoS CODE_EXECUTION_SAFETY_V1 acceptance tests that run without a browser. A6's network/CSP half, A8 and A9 need
// the real browser and stay open until that run is recorded.
describe("CODE_EXECUTION_SAFETY_V1 A1, A2, A5, A6 (corpus), A7", () => {
  it("A1: exponential recursion stops at its limit", () => {
    const fib = (n: number) => run(`def fib(n):\n    if n < 2:\n        return n\n    return fib(n - 1) + fib(n - 2)\nprint(fib(${n}))`);
    // Deep: stops at the call depth. Shallow but exponential: stops at the step budget.
    expect(fib(40).error).toMatchObject({ kind: "LIMIT", message: "Too many function calls inside each other." });
    const wide = fib(25);
    expect(wide.error).toMatchObject({ kind: "LIMIT", message: "The program ran too many steps. Check for a loop that never stops." });
    expect(wide.steps).toBe(LLCODE_LIMITS.steps + 1);
    expect(fib(10).output).toEqual(["55"]);
  });
  it("A2: the memory ceiling is explicit and enforced", () => {
    expect(LLCODE_LIMITS).toMatchObject({ listLength: 1_000, stringLength: 1_000, allocatedCells: 100_000 });
    const doubling = run("xs = [1]\nwhile True:\n    xs = xs + xs");
    expect(doubling.error).toMatchObject({ kind: "LIMIT", message: "A list grew too long." });
    const churn = run("n = 0\nwhile n < 100000:\n    xs = [0] * 900\n    n += 1");
    expect(churn.error).toMatchObject({ kind: "LIMIT", message: "The program made too much data." });
  });
  it("A5: prototype-pollution strings in names, keys and values leave host state unchanged", () => {
    const before = Object.getOwnPropertyNames(Object.prototype).sort().join(",");
    for (const src of ["constructor = 1\nprototype = 2\nprint(constructor + prototype)", 'x = ["__proto__", "constructor", "prototype"]\nprint(x)',
      'k = "__proto__"\nd = [k]\nd[0] = "polluted"\nprint(d[0])', 'print("constructor" + "." + "prototype")', "toString = valueOf = 1"]) runLLCode(src);
    expect(Object.getOwnPropertyNames(Object.prototype).sort().join(",")).toBe(before);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(run("constructor = 1\nprototype = 2\nprint(constructor + prototype)").output).toEqual(["3"]);
  });

  // Seeded generator: well-formed programs from grammar fragments plus hostile names, values and broken syntax.
  const corpus = (() => {
    let seed = 0x5eed1e;
    const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
    const names = ["x", "y", "total", "xs", "i", "constructor", "__proto__", "prototype", "globalThis", "eval", "fetch", "self", "import", "print", "len"];
    const atoms = () => [String(rnd(2000) - 1000), `"${["a", "<b>", "__proto__", "\n", "x" + rnd(9)][rnd(5)]}"`, "True", "False", "[1, 2, 3]", names[rnd(names.length)], "range(5)", "len(xs)"][rnd(8)];
    const expr = (d = 0): string => d > 2 || rnd(3) === 0 ? atoms() : `${expr(d + 1)} ${["+", "-", "*", "//", "%", "==", "<", "and", "or"][rnd(9)]} ${expr(d + 1)}`;
    const stmt = (indent: string, d = 0): string => {
      const pick = rnd(d > 1 ? 4 : 9);
      if (pick === 0) return `${indent}${names[rnd(names.length)]} = ${expr()}`;
      if (pick === 1) return `${indent}print(${expr()})`;
      if (pick === 2) return `${indent}xs = [${expr()}, ${expr()}]`;
      if (pick === 3) return `${indent}${["pass", "x += 1", "xs.append(" + expr() + ")", "xs[0] = 1", "eval('1')", "fetch('/')", "x.constructor", "import os", "for in in:"][rnd(9)]}`;
      if (pick === 4) return `${indent}if ${expr()}:\n${stmt(indent + "    ", d + 1)}\n${indent}else:\n${stmt(indent + "    ", d + 1)}`;
      if (pick === 5) return `${indent}for i in ${["range(" + rnd(50) + ")", "xs", '"abc"', expr()][rnd(4)]}:\n${stmt(indent + "    ", d + 1)}`;
      if (pick === 6) return `${indent}while ${expr()}:\n${stmt(indent + "    ", d + 1)}`;
      if (pick === 7) return `${indent}def f(a):\n${indent}    return f(a) if a else a\n${indent}print(f(1))`;
      return `${indent}def g(a):\n${indent}    return a * a\n${indent}print(g(${expr()}))`;
    };
    return Array.from({ length: 10_000 }, () => ["x = 1", "xs = []", ...Array.from({ length: 1 + rnd(6) }, () => stmt(""))].join("\n"));
  })();
  const limits = { steps: 5_000 }; // tighten-only: keeps the 10k corpus fast; overrun is checked against the applied limit

  it("A6 (corpus): 10,000 generated programs never throw, never overrun a limit and never reach the host", () => {
    const before = Object.getOwnPropertyNames(Object.prototype).sort().join(",");
    const kinds = { ok: 0, SYNTAX: 0, RUNTIME: 0, LIMIT: 0 } as Record<string, number>;
    for (const src of corpus) {
      const r = runLLCode(src, { limits, trace: true });
      kinds[r.ok ? "ok" : r.error!.kind]++;
      expect(r.steps).toBeLessThanOrEqual(limits.steps + 1);
      expect(r.output.length).toBeLessThanOrEqual(LLCODE_LIMITS.outputLines);
      expect(r.output.reduce((n, l) => n + l.length + 1, 0)).toBeLessThanOrEqual(LLCODE_LIMITS.outputBytes);
      expect(r.trace.length).toBeLessThanOrEqual(LLCODE_LIMITS.traceEntries);
    }
    expect(Object.getOwnPropertyNames(Object.prototype).sort().join(",")).toBe(before);
    // The corpus must exercise real execution, not only syntax errors.
    expect(kinds.ok).toBeGreaterThan(1_000);
    expect(kinds.RUNTIME + kinds.LIMIT).toBeGreaterThan(500);
  }, 120_000);

  it("A7: the corpus runs twice with byte-identical outputs and traces", () => {
    const once = (src: string) => JSON.stringify(runLLCode(src, { limits, trace: true }));
    for (const src of corpus.slice(0, 2_000)) expect(once(src)).toBe(once(src));
  }, 120_000);
});

// LLCODE-FMT (T2-LLCODE-FORMATTING-REVIEW-FINDING): formatting and equality are budgeted and cycle-safe.
describe("LLCODE-FMT: bounded, cycle-safe formatting and equality", () => {
  const probe = "a = [0] * 20\nb = [a] * 20\nc = [b] * 20\nprint(c)"; // T2's probe: 60 stored cells, 24,840 characters unbounded
  it("T2's shared-list probe stops at the output budget with bounded work", () => {
    const r = runLLCode(probe, { limits: { outputBytes: 32 } });
    expect(r.error).toMatchObject({ kind: "LIMIT", message: "The program printed too much." });
    expect(r.output).toEqual([]);
    expect(r.steps).toBeLessThan(200); // visits are charged and stop at the cap, not after 8,000+ values
    const full = runLLCode(probe); // default 16 KiB still refuses rather than building 24,840 characters
    expect(full.error?.kind).toBe("LIMIT");
  });
  it("the formatter's work is proportional to its cap, never to the shared structure", async () => {
    const { format, LLList } = await import("@/lib/learner-experience/stem/llcode");
    const a = new LLList(Array(20).fill(0)), b = new LLList(Array(20).fill(a)), c = new LLList(Array(20).fill(b));
    for (const cap of [0, 1, 10, 50, 500]) {
      let visits = 0;
      const r = format(c, cap, { visit: () => { visits++; } });
      expect(r.text.length).toBeLessThanOrEqual(cap);
      expect(r.truncated).toBe(true);
      expect(visits).toBeLessThanOrEqual(cap + 2);
    }
    expect(format(c, 10, { maxVisits: 3 }).truncated).toBe(true);
  });
  it("cyclic lists print, convert and compare without recursing forever", () => {
    expect(run("xs = [1]\nxs.append(xs)\nprint(xs)\nprint(str(xs))\nprint(len(str(xs)))").output).toEqual(["[1, [...]]", "[1, [...]]", "10"]);
    expect(run("a = [1]\na.append(a)\nb = [1]\nb.append(b)\nprint(a == b, a == a, a != [1])").output).toEqual(["True True True"]);
    const deep = run("a = []\nb = [a]\na.append(b)\nprint(a)");
    expect(deep.ok).toBe(true);
    expect(deep.output[0]).toContain("[...]");
  });
  it("str() refuses to build text beyond the text limit", () => {
    expect(runLLCode(probe.replace("print(c)", "s = str(c)")).error).toMatchObject({ kind: "LIMIT", message: "Some text grew too long." });
  });
  it("list equality is charged to the step budget, one step per compared pair", () => {
    const one = run("a = [0] * 900\nb = [0] * 900\nsame = a == b\nprint(same)");
    const none = run("a = [0] * 900\nb = [0] * 900\nsame = True\nprint(same)");
    expect(one.output).toEqual(["True"]);
    expect(one.steps - none.steps).toBeGreaterThanOrEqual(900);
    expect(run("a = [0] * 900\nb = [0] * 900\nsame = a == b", { limits: { steps: 300 } }).error?.kind).toBe("LIMIT");
  });
  it("trace snapshots stay short and never change how a program runs", () => {
    const src = probe.replace("print(c)", "x = 1\nx = x + 1");
    const traced = runLLCode(src, { trace: true }), plain = runLLCode(src);
    expect(traced.steps).toBe(plain.steps);
    expect(traced.ok).toBe(true);
    for (const entry of traced.trace) for (const value of Object.values(entry.vars)) expect(value.length).toBeLessThanOrEqual(80);
  });
});
