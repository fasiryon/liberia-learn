# Code Execution Safety V1 (student coding prototype)

CoS contract, 2026-10-23, implementing founder decision 1.

**Approved as a prototype design only.** It is subject to an independent security review. Web Worker isolation alone is **not** sufficient. No student may run code until every acceptance test below passes and the review is recorded.

Scope: every block that executes learner or lesson code: `CODE_RUNNER`, `BLOCK_PROGRAM`, `CODE_TRACE` and `GRID_ROBOT_PROGRAM`. `CODE_TRACE` is included because T1's TRACE mode runs `llcode` in a worker (`T2-LANGUAGE-AND-LOADER-ACK.md`). A trace that only shows a precomputed table, with no execution, would be outside the gate.

## Required design

1. **A constrained, deterministic instructional interpreter.** It implements a written language subset: integers, strings, booleans, lists, `if`, bounded `for`/`while`, functions and `print`. The grammar is specified, and every program is parsed before it runs. The interpreter is a tree-walker or bytecode VM written for this purpose. It never evaluates learner text as JavaScript: no `eval`, no `Function`, no `import()`, no `setTimeout(string)`, no `WebAssembly` compiled from learner input.
2. **No ambient capability.**
   - Learner programs reach only interpreter built-ins.
   - There is no access to the network (`fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `importScripts`, `sendBeacon`), storage (`localStorage`, `IndexedDB`, cookies, cache), DOM, clipboard, timers, device or sensitive browser APIs.
   - The worker scope has these removed **and** the interpreter never exposes them. That is two layers, not one.
3. **Deterministic.** The same program and inputs always give the same output and trace. There is no randomness source; seeded randomness only if a later lesson needs it, and that needs its own review.
4. **Explicit limits**, each enforced inside the interpreter and charged **before** allocation, not only by the page. These are the limits published by T1's `llcode/1.0.0` prototype (`f914a0ab9`, memory ceiling `2587ee5f8`, on `feat/v4-school-day`), adopted 2026-10-23 as the single contract and still subject to the independent security review. A block may tighten a limit, never loosen it.

   | Limit | Value |
   | --- | --- |
   | Source | 10,000 characters, 2,000 AST nodes |
   | Call depth | 32 |
   | Steps | 200,000 |
   | Wall clock | 2 s; the page terminates the worker |
   | Output | 200 lines, 16 KiB |
   | Memory | List ≤ 1,000 values; text ≤ 1,000 characters; ≤ 100,000 allocated cells per run (cumulative, so live memory cannot exceed it); integers ≤ 10^12; trace ≤ 2,000 entries (T1 `2587ee5f8`, `LLCODE_LIMITS`) |

5. **Termination controls.** A learner Stop button, plus automatic termination when any limit is hit. Each ends with a plain-language message and never freezes the tab. A new worker is used per run and terminated after it.
6. **No server execution.** No endpoint receives code to run. Tests are visible tests that run on the client; hidden tests never enter the learner projection.
7. **Formative only.** No grade, mastery, completion or record writes.

## Acceptance tests (adversarial; all must pass)

| # | Test |
| --- | --- |
| A1 | Infinite loop, infinite recursion and exponential recursion all stop at their limit with the friendly message; the page stays responsive |
| A2 | Huge allocation (list or string doubling) stops at the memory cap |
| A3 | Output flood stops at the output cap |
| A4 | Programs that try `eval`, `Function`, `constructor`, `__proto__`, `prototype`, `globalThis`, `self`, `import`, `fetch` or `postMessage` as names or strings cannot reach any host object (parser or runtime error) |
| A5 | Prototype-pollution strings in identifiers, keys and string values leave `Object.prototype` and the interpreter's own state unchanged |
| A6 | A CSP/network test proves the worker cannot open any connection; a fuzzed program corpus (≥ 10,000 generated programs) produces no network request, no exception escaping the interpreter, and no limit overrun |
| A7 | Determinism: a fixed corpus runs twice with byte-identical outputs and traces |
| A8 | Accessibility: keyboard-only editing, screen-reader-announced output and errors, 400% zoom, 320 px width |
| A9 | Offline: runs with no connection after first load, with the interpreter cached in the app shell |

## Release evidence

A lesson that uses `CODE_RUNNER`, `BLOCK_PROGRAM`, `CODE_TRACE` or `GRID_ROBOT_PROGRAM` cannot reach PREVIEW_ELIGIBLE until:

- `curriculum/program/stem-v1/source/release-evidence.json` records `codeExecutionSafety: "PASS"` for its package hash;
- the record references the independent security review and the A1-A9 results.

The CoS simulation enforces this (`scripts/cos-stem/lib/simulate.cjs`). The review must be independent of the implementer.
