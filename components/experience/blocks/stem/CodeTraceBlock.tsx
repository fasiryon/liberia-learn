"use client";

/**
 * CODE_TRACE and CODE_RUNNER (teaching-blocks/1.2.0 DRAFT), field shapes from T2's proposed contract
 * (lib/content-factory/v4/stemBlockContracts.ts on feat/content-factory-schoolday). The language literal is the
 * interpreter version, "llcode/1.0.0" (CoS ruling), run in a one-shot worker with a learner Stop control; never on the server.
 * CODE_TRACE: predict the output, then step through with the watched variables. CODE_RUNNER: edit the starter and run
 * the visible tests. Source, output and errors render as text, never markup. Formative only: nothing is scored,
 * saved or recorded. Visible tests are learner-visible by design; they are not protected assessment keys.
 */
import "./stem.css";
import { useMemo, useRef, useState } from "react";
import { startInWorker } from "@/lib/learner-experience/stem/runInWorker";
import type { z } from "zod";
import type { LLCodeLimits, LLCodeResult, LLPresetValue } from "@/lib/learner-experience/stem/llcode";
import type { BLOCK_SCHEMAS_1_2 } from "@/lib/learner-experience/teaching/registry-1.2";

type Presets = Readonly<Record<string, LLPresetValue>>;
/** Field shapes are the canonical teaching-blocks/1.2.0 schemas; the renderer cannot drift from the registry. */
export type CodeTraceData = z.infer<typeof BLOCK_SCHEMAS_1_2.CODE_TRACE>;
export type CodeRunnerData = z.infer<typeof BLOCK_SCHEMAS_1_2.CODE_RUNNER>;
export type CodeRunnerLimits = CodeRunnerData["limits"];

/** Block limits use the interpreter's own names and only tighten it (runLLCode clamps every value to LLCODE_LIMITS). */
export function toInterpreterLimits(l: CodeRunnerLimits): Partial<LLCodeLimits> {
  return { ...l };
}
const stdout = (r: LLCodeResult) => r.output.join("\n");
const sameStdout = (actual: string, expected: string) => actual.replace(/\n+$/, "") === expected.replace(/\n+$/, "");

function useRunner(source: string, limits?: Partial<LLCodeLimits>) {
  const stopRef = useRef<(() => void) | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (presets: Presets, trace: boolean) => {
    setBusy(true);
    const handle = startInWorker(source, { presets, limits, trace });
    stopRef.current = handle.stop;
    try { return await handle.result; } finally { stopRef.current = null; setBusy(false); }
  };
  return { busy, run, stop: () => stopRef.current?.() };
}

function Listing({ lines, current }: { lines: readonly string[]; current: number | null }) {
  return <ol className="ll8-listing" aria-label="Program">{lines.map((text, i) =>
    <li key={i} aria-current={current === i + 1 ? "step" : undefined} data-line={i + 1}><span className="ll8-ln" aria-hidden="true">{i + 1}</span><code>{text || " "}</code></li>)}
  </ol>;
}

export function CodeTraceBlock({ block }: { block: CodeTraceData }) {
  const lines = useMemo(() => block.program.replace(/\r\n?/g, "\n").split("\n"), [block.program]);
  const { busy, run, stop } = useRunner(block.program);
  const [result, setResult] = useState<LLCodeResult | null>(null);
  const [at, setAt] = useState(-1);
  const [prediction, setPrediction] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const steps = result ? result.trace.slice(0, block.maxTraceSteps) : [];
  const entry = at >= 0 ? steps[Math.min(at, steps.length - 1)] ?? null : null;
  const id = `ct-${block.id}`;
  const ensure = async () => { if (result) return result; const r = await run(block.inputs, true); setResult(r); return r; };
  const moveTo = (i: number, r: LLCodeResult) => {
    const list = r.trace.slice(0, block.maxTraceSteps), clamped = Math.max(0, Math.min(i, list.length - 1)), e = list[clamped];
    setAt(clamped);
    setAnnounce(e ? `${e.line ? `Line ${e.line}` : "Finished"}. ${block.watch.map((n) => `${n} is ${e.vars[n] ?? "not set yet"}`).join(", ")}.` : "");
  };
  const check = async () => {
    const r = await ensure();
    if (!r.ok) { setFeedback(`The program stops with an error before it prints everything: ${r.error?.message}`); return; }
    const said = prediction.trim().split(/\n+/).map((s) => s.trim()).filter(Boolean), first = r.output.findIndex((l, i) => said[i] !== l);
    setFeedback(first === -1 && said.length === r.output.length ? "Your prediction matches the output. Step through to check the reason for each line."
      : `Your prediction differs ${first === -1 ? "in length" : `at output line ${first + 1}`}. Step through and watch the variables to see why.`);
  };
  const shown = result ? (entry ? result.output.slice(0, entry.output) : result.output) : [];
  return (
    <section className="ll8-code" aria-labelledby={`${id}-title`} data-block-type="CODE_TRACE">
      <h3 id={`${id}-title`} className="ll8-title">Trace the program</h3>
      <p>{block.prompt}</p>
      {Object.keys(block.inputs).length > 0 && <p className="ll8-muted">Starting values: {Object.entries(block.inputs).map(([k, v]) => `${k} = ${Array.isArray(v) ? `[${v.join(", ")}]` : String(v)}`).join("; ")}</p>}
      <Listing lines={lines} current={entry?.line ?? null} />
      <div className="ll8-predict">
        <label className="ll8-field"><span>{block.predictPrompt ?? "Before you run it: what will it print? One line per output line."}</span>
          <textarea value={prediction} onChange={(e) => setPrediction(e.target.value)} rows={3} /></label>
        <button type="button" className="ll3-btn" onClick={() => void check()} disabled={busy || !prediction.trim()}>Check my prediction</button>
        {feedback && <p role="status" className="ll8-feedback">{feedback}</p>}
      </div>
      <div className="ll8-controls">
        <button type="button" className="ll3-btn" disabled={busy || at <= 0} onClick={() => result && moveTo(at - 1, result)}>Back a step</button>
        <button type="button" className="ll3-btn" data-primary="" disabled={busy || (result !== null && at >= steps.length - 1)} onClick={async () => moveTo(at + 1, await ensure())}>Step</button>
        <button type="button" className="ll3-btn" disabled={busy} onClick={async () => { const r = await ensure(); moveTo(r.trace.length, r); }}>Go to the last step</button>
        {busy && <button type="button" className="ll3-btn" data-code-stop onClick={() => { stop(); setAnnounce("Stopped."); }}>Stop</button>}
        <button type="button" className="ll3-btn" disabled={busy} onClick={() => { setResult(null); setAt(-1); setFeedback(null); setAnnounce("Reset."); }}>Reset</button>
      </div>
      {result && <div className="ll8-state">
        {entry && <table className="ll8-vars"><caption>{entry.line ? `About to run line ${entry.line}` : "After the last line"}</caption>
          <thead><tr><th scope="col">Variable</th><th scope="col">Value</th></tr></thead>
          <tbody>{block.watch.map((n) => <tr key={n}><th scope="row"><code>{n}</code></th><td><code>{entry.vars[n] ?? "—"}</code></td></tr>)}</tbody></table>}
        <div><p className="ll8-label">Output</p><pre className="ll8-output" data-code-output>{shown.join("\n") || " "}</pre></div>
        {result.error && <p role="alert" className="ll8-error">{result.error.line ? `Line ${result.error.line}: ` : ""}{result.error.message}</p>}
        {result.trace.length > block.maxTraceSteps && <p className="ll8-muted">Only the first {block.maxTraceSteps} steps are shown.</p>}
      </div>}
      <p className="ll8-sr" aria-live="polite">{announce}</p>
    </section>
  );
}

export function CodeRunnerBlock({ block }: { block: CodeRunnerData }) {
  const [source, setSource] = useState(block.starter);
  const limits = useMemo(() => toInterpreterLimits(block.limits), [block.limits]);
  const { busy, run, stop } = useRunner(source, limits);
  const [last, setLast] = useState<LLCodeResult | null>(null);
  const [tests, setTests] = useState<Array<{ id: string; label: string; pass: boolean; detail: string }> | null>(null);
  const [announce, setAnnounce] = useState("");
  const id = `cr-${block.id}`;
  const runTests = async () => {
    const out = [];
    for (const t of block.visibleTests) {
      const r = await run(t.inputs, false);
      setLast(r);
      if (r.error?.message === "You stopped the program.") { out.push({ id: t.id, label: t.label, pass: false, detail: "stopped" }); break; }
      out.push({ id: t.id, label: t.label, pass: r.ok && sameStdout(stdout(r), t.expectedStdout),
        detail: r.ok ? `printed ${JSON.stringify(stdout(r))}, expected ${JSON.stringify(t.expectedStdout)}` : `error${r.error?.line ? ` on line ${r.error.line}` : ""}: ${r.error?.message}` });
    }
    setTests(out);
    setAnnounce(`${out.filter((t) => t.pass).length} of ${block.visibleTests.length} tests pass.`);
  };
  return (
    <section className="ll8-code" aria-labelledby={`${id}-title`} data-block-type="CODE_RUNNER">
      <h3 id={`${id}-title`} className="ll8-title">{block.title}</h3>
      <p>{block.prompt}</p>
      <label className="ll8-field"><span>Program (you can edit it)</span>
        <textarea className="ll8-editor" value={source} spellCheck={false} rows={Math.min(18, source.split("\n").length + 2)} aria-describedby={`${id}-lang`}
          onChange={(e) => { setSource(e.target.value); setTests(null); setLast(null); }} /></label>
      <p id={`${id}-lang`} className="ll8-muted">Whole numbers, text, lists, if, while, for, def. Runs on this device only, with time and size limits.</p>
      <div className="ll8-controls">
        <button type="button" className="ll3-btn" data-primary="" disabled={busy} onClick={() => void runTests()}>Run the tests</button>
        {busy && <button type="button" className="ll3-btn" data-code-stop onClick={() => { stop(); setAnnounce("Stopped."); }}>Stop</button>}
        <button type="button" className="ll3-btn" disabled={busy} onClick={() => { setSource(block.starter); setTests(null); setLast(null); setAnnounce("Program reset."); }}>Reset</button>
      </div>
      {last && <div><p className="ll8-label">Output of the last run</p><pre className="ll8-output" data-code-output>{stdout(last) || " "}</pre>
        {last.error && <p role="alert" className="ll8-error">{last.error.line ? `Line ${last.error.line}: ` : ""}{last.error.message}</p>}</div>}
      {tests && <ul className="ll8-tests" aria-label="Test results">{tests.map((t) => <li key={t.id} data-pass={t.pass ? "" : undefined}><strong>{t.pass ? "Pass" : "Not yet"}</strong>: {t.label}. <span className="ll8-muted">{t.detail}</span></li>)}</ul>}
      <p className="ll8-sr" aria-live="polite">{announce}</p>
    </section>
  );
}
