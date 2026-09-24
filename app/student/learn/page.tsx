"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

const FractionVisualizer = dynamic(() => import("@/components/toolkit/tools/FractionVisualizer"));
const NumberLine = dynamic(() => import("@/components/toolkit/tools/NumberLine"));

type Action = {
  available: true;
  decisionId: string;
  sessionId: string;
  releaseId: string;
  releaseIdentity: string;
  learnerStateRevision: string;
  grade: number;
  subject: string;
  conceptLabel?: string;
  action: { kind: "DIAGNOSTIC" | "PRACTICE"; reason: string };
  item: { id: string; version: string; prompt: string; options: string[] };
  toolPolicy: { allowed: string[]; prohibited: string[] };
  lessonHref: string | null;
};
type LearnerState = { mastery: { level: string; observedScore: number | null }; confidence: { level: string } };
const cacheKey = "governed-learning-action-v2";

// Storage can be absent or throw (private mode, shared devices); the cache is
// only a read-only convenience and never an evidence channel.
function cache(op: "get" | "set" | "remove", value?: string): string | null {
  try {
    if (op === "get") return localStorage.getItem(cacheKey);
    if (op === "set") localStorage.setItem(cacheKey, value ?? "");
    else localStorage.removeItem(cacheKey);
  } catch { /* Unavailable storage leaves the online flow intact. */ }
  return null;
}

export default function GovernedLearningPage() {
  const [action, setAction] = useState<Action | null>(null);
  const [offline, setOffline] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<{ correct: boolean; learnerState: LearnerState;
    support?: { hint: string | null; workedExample: string | null } } | null>(null);
  const [tool, setTool] = useState<string | null>(null);
  const [toolsUsed, setToolsUsed] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/student/learning-authority/next-action", { cache: "no-store" });
      if (!response.ok) throw new Error("Your learning action is unavailable. Please try again.");
      const data = await response.json();
      if (!data.available) { setAction(null); return; }
      setAction(data as Action);
      setOffline(false);
      setSelected(null);
      setResult(null);
      setTool(null);
      setToolsUsed([]);
      cache("set", JSON.stringify(data));
    } catch {
      const cached = cache("get");
      if (cached) {
        try {
          const data = JSON.parse(cached) as Action;
          if (data.available && data.releaseId && data.releaseIdentity && Array.isArray(data.item?.options)) setAction(data);
        } catch { /* Invalid cache is never an action. */ }
      }
      setOffline(true);
      setError("The learning service is unavailable. You can review your last saved activity; reconnect to submit and receive an updated action.");
    } finally { setBusy(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function submit() {
    if (!action || selected === null || offline) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/student/learning-authority/next-action", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisionId: action.decisionId, sessionId: action.sessionId,
          itemId: action.item.id, itemVersion: action.item.version, answerIndex: selected, toolsUsed }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(response.status === 409 ? "This attempt was already saved or the action changed. Get your next action to continue." :
        response.status === 400 ? "This activity expired. Refresh to continue." : "Your answer was not saved. Please try again.");
      setResult(data);
      cache("remove");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not submit your answer."); }
    finally { setBusy(false); }
  }

  return <main className="mx-auto max-w-3xl space-y-5 px-4 py-6 text-[var(--ll-text)]">
    <Link href="/student/today" className="text-sm underline">← Today</Link>
    <header><p className="text-sm text-[var(--ll-text-muted)]">Your next learning action</p>
      <h1 className="text-2xl font-bold">{action?.conceptLabel ?? "Learning activity"}</h1></header>
    {error && <p role="status" className="rounded-lg border border-amber-400 p-3 text-sm">{error}</p>}
    {!action && !busy && <p>No published governed activity is available for your grade yet. Your teacher can guide your next lesson.</p>}
    {action && <section className={`space-y-5 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 sm:p-6 ${action.grade <= 3 ? "text-lg" : "text-base"}`}>
      <div><p className="text-sm font-semibold">{action.subject.replaceAll("_", " ")} · Grade {action.grade} · {action.action.kind === "DIAGNOSTIC" ? "Check your understanding" : "Practice"}</p>
        <p className="mt-2 text-sm text-[var(--ll-text-muted)]">{action.action.reason}</p></div>
      {action.lessonHref && !result && <Link href={action.lessonHref} className="inline-flex min-h-11 items-center rounded-lg border border-[var(--ll-border)] px-4 text-sm underline">Read the lesson, then return here</Link>}
      <fieldset disabled={busy || !!result || offline} className="space-y-3">
        <legend className="mb-3 text-lg font-semibold">{action.item.prompt}</legend>
        {action.item.options.map((option, index) => <label key={index} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-[var(--ll-border)] p-3 text-base">
          <input type="radio" name="answer" checked={selected === index} onChange={() => setSelected(index)} className="h-5 w-5" />{option}
        </label>)}
      </fieldset>
      {!result && <button type="button" disabled={busy || offline || selected === null} onClick={submit}
        className="min-h-12 w-full rounded-lg bg-[var(--ll-accent)] px-5 py-3 font-semibold text-[var(--ll-bg)] disabled:opacity-50 sm:w-auto">Submit answer</button>}
      {result && <div role="status" className="space-y-3 rounded-lg border border-[var(--ll-border)] p-4">
        <p className="font-semibold">{result.correct ? "Correct. Well done." : "Keep learning. Your answer is saved."}</p>
        <p className="text-sm">Understanding: {result.learnerState.mastery.level.replaceAll("_", " ").toLowerCase()} · Evidence confidence: {result.learnerState.confidence.level.toLowerCase()}</p>
        <p className="text-sm">This reflects your learning evidence, not a school grade.</p>
        {result.support?.hint && <p className="text-sm"><strong>Hint:</strong> {result.support.hint}</p>}
        {result.support?.workedExample && <p className="text-sm"><strong>Worked example:</strong> {result.support.workedExample}</p>}
        <button type="button" onClick={() => void load()} className="min-h-12 rounded-lg bg-[var(--ll-accent)] px-5 font-semibold text-[var(--ll-bg)]">Get next action</button>
        <Link href="/student/ai-tutor" className="ml-3 inline-block min-h-12 py-3 text-sm underline">Ask the tutor for help</Link>
      </div>}
      {action.toolPolicy.allowed.length > 0 && <div className="space-y-2 border-t border-[var(--ll-border)] pt-4">
        <h2 className="font-semibold">Tools allowed for this activity</h2>
        <div className="flex flex-wrap gap-2">{action.toolPolicy.allowed.map((key) => <button key={key} type="button" onClick={() => { setTool(tool === key ? null : key); if (!result) setToolsUsed((used) => used.includes(key) ? used : [...used, key]); }}
          className="min-h-11 rounded-lg border border-[var(--ll-border)] px-4 text-sm" aria-expanded={tool === key}>{key.replaceAll("_", " ")}</button>)}</div>
        {tool === "fraction_strips" && <FractionVisualizer onClose={() => setTool(null)} />}
        {tool === "number_line" && <NumberLine onClose={() => setTool(null)} />}
      </div>}
    </section>}
    {offline && <button type="button" onClick={() => void load()} className="min-h-11 rounded-lg border px-4">Reconnect and resume</button>}
  </main>;
}
