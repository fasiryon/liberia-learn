"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { InteractiveButton } from "@/components/ui/InteractiveButton";
import { useStudentIdentity } from "@/components/student/StudentShellV2";
import { ageBand, subjectName, validGovernedAction, type GovernedLearningAction } from "./learnPresentation";

const FractionVisualizer = dynamic(() => import("@/components/toolkit/tools/FractionVisualizer"));
const NumberLine = dynamic(() => import("@/components/toolkit/tools/NumberLine"));

type LearnerState = { mastery: { level: string; observedScore: number | null }; confidence: { level: string } };
type Result = { correct: boolean; learnerState: LearnerState; support?: { hint: string | null; workedExample: string | null } };
type Status =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "none" }
  | { kind: "no-valid-resource" }
  | { kind: "signed-out" }
  | { kind: "restricted" }
  | { kind: "error"; message: string };

const legacyCacheKey = "governed-learning-action-v2";

// Storage can be absent or throw (private mode, shared devices); the cache is a
// read-only convenience partitioned per learner and never an evidence channel.
function cache(key: string | null, op: "get" | "set" | "remove", value?: string): string | null {
  try {
    localStorage.removeItem(legacyCacheKey);
    if (!key) return null;
    if (op === "get") return localStorage.getItem(key);
    if (op === "set") localStorage.setItem(key, value ?? "");
    else localStorage.removeItem(key);
  } catch { /* Unavailable storage leaves the online flow intact. */ }
  return null;
}

/**
 * The existing governed DIAGNOSTIC/PRACTICE activity, unchanged in authority:
 * the server chooses the action and item, the learner answers it here, and
 * submission carries the exact decision/session/item identity it was issued.
 */
export function GovernedActivity() {
  const identity = useStudentIdentity();
  const young = ageBand(identity.grade) === "young";
  const key = identity.userId && identity.schoolId ? `${legacyCacheKey}:${identity.schoolId}:${identity.userId}` : null;
  const [action, setAction] = useState<GovernedLearningAction | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [cached, setCached] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [tool, setTool] = useState<string | null>(null);
  const [toolsUsed, setToolsUsed] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setSubmitError(null);
    setStatus({ kind: "loading" });
    const reset = () => { setSelected(null); setResult(null); setTool(null); setToolsUsed([]); };
    try {
      const response = await fetch("/api/student/learning-authority/next-action", { cache: "no-store" });
      if (response.status === 401 || response.status === 403 || response.status === 404) {
        setAction(null); setCached(false); reset();
        setStatus(response.status === 401 ? { kind: "signed-out" } : response.status === 403 ? { kind: "restricted" } : { kind: "error", message: "Your learning activity is not available right now." });
        return;
      }
      if (!response.ok) throw new Error("unavailable");
      const data = await response.json();
      if (data?.available === false) {
        setAction(null); setCached(false); reset(); cache(key, "remove");
        setStatus(data.status === "NO_VALID_RESOURCE" ? { kind: "no-valid-resource" } : { kind: "none" });
        return;
      }
      if (!validGovernedAction(data)) throw new Error("malformed");
      setAction(data); setCached(false); reset(); setStatus({ kind: "ready" });
      cache(key, "set", JSON.stringify(data));
    } catch {
      // Network or server failure only: show the learner's own last activity
      // read-only, never as something that can be submitted.
      let saved: GovernedLearningAction | null = null;
      try { const raw = cache(key, "get"); const parsed = raw ? JSON.parse(raw) : null; saved = validGovernedAction(parsed) ? parsed : null; } catch { saved = null; }
      setAction(saved); setCached(saved != null); reset();
      setStatus({ kind: "error", message: saved
        ? "The learning service can't be reached. This is your last saved activity to review; reconnect to answer it."
        : "The learning service can't be reached, so your activity could not load." });
    } finally { setBusy(false); }
  }, [key]);

  useEffect(() => { void load(); }, [load]);

  async function submit() {
    if (!action || selected === null || cached) return;
    setBusy(true);
    setSubmitError(null);
    try {
      const response = await fetch("/api/student/learning-authority/next-action", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisionId: action.decisionId, sessionId: action.sessionId,
          itemId: action.item.id, itemVersion: action.item.version, answerIndex: selected, toolsUsed }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(response.status === 409 ? "This attempt was already saved or the activity changed. Get your next activity to continue." :
        response.status === 400 ? "This activity expired. Get your next activity to continue." : "Your answer was not saved. Please try again.");
      setResult(data);
      cache(key, "remove");
      requestAnimationFrame(() => resultRef.current?.focus());
    } catch (cause) { setSubmitError(cause instanceof Error && cause.message ? cause.message : "Your answer was not saved. Please try again."); }
    finally { setBusy(false); }
  }

  const heading = action?.conceptLabel ?? (action ? `${subjectName(action.subject)} activity` : status.kind === "loading" ? "Finding your learning activity…" : status.kind === "none" ? "No activity is ready right now" : "Your learning activity is unavailable");
  const kindLabel = action?.action.kind === "DIAGNOSTIC" ? (young ? "Show what you know" : "Check your understanding") : "Practice";

  return <section className="pdv2-hero pdv2-learn-current" aria-labelledby="current-learning-heading" aria-busy={status.kind === "loading"} data-state={action ? (cached ? "cached" : "ready") : status.kind}>
    <div className="pdv2-learn-current-main">
      <p className="pdv2-eyebrow">Current learning</p>
      <h2 id="current-learning-heading">{heading}</h2>
      {status.kind === "loading" && <p role="status">Loading your learning activity…</p>}
      {status.kind === "none" && <p>Your school has no ready activity for you here yet. Pick a unit or lesson from your learning path below, or ask your teacher.</p>}
      {status.kind === "no-valid-resource" && <p>Your next activity can&apos;t be shown right now. Ask your teacher for your next step. Your assigned work is listed below.</p>}
      {status.kind === "signed-out" && <><p>Sign in again to see your learning activity.</p><div className="pdv2-hero-actions"><InteractiveButton primary href="/login">Sign in →</InteractiveButton></div></>}
      {status.kind === "restricted" && <p>This activity isn&apos;t available for your account. Ask your teacher.</p>}
      {status.kind === "error" && <p role="status" className="pdv2-learn-notice"><span className="pdv2-badge pdv2-badge-warn">{cached ? "Last saved · read-only" : "Unavailable"}</span> {status.message}</p>}
      {status.kind === "error" && <div className="pdv2-hero-actions"><InteractiveButton primary={!action} onClick={() => void load()} disabled={busy}>{busy ? "Checking…" : action ? "Reconnect and resume" : "Try again"}</InteractiveButton></div>}

      {action && <div className={`pdv2-learn-task ${young ? "pdv2-learn-task-young" : ""}`}>
        <p className="pdv2-meta">{subjectName(action.subject)} · Grade {action.grade} · {kindLabel}</p>
        <p>{action.action.reason}</p>
        {action.lessonHref && !result && <p><InteractiveButton href={action.lessonHref}>{young ? "Read the lesson" : "Read the lesson, then come back"} →</InteractiveButton></p>}
        <fieldset disabled={busy || !!result || cached} className="pdv2-learn-options">
          <legend>{action.item.prompt}</legend>
          {action.item.options.map((option, index) => <label key={index} className="pdv2-learn-option">
            <input type="radio" name="governed-answer" checked={selected === index} onChange={() => setSelected(index)} />
            <span>{option}</span>
          </label>)}
        </fieldset>
        {submitError && <p role="alert" className="pdv2-error">{submitError}</p>}
        {!result && <div className="pdv2-hero-actions">
          <InteractiveButton primary onClick={submit} disabled={busy || cached || selected === null} aria-busy={busy}>{busy ? "Saving…" : young ? "Check answer" : "Submit answer"}</InteractiveButton>
          {cached && <p className="pdv2-meta">Answering needs a connection. Nothing is saved on this device.</p>}
          {!cached && selected === null && <p className="pdv2-meta">Choose an answer first.</p>}
        </div>}
        {result && <div role="status" tabIndex={-1} ref={resultRef} className="pdv2-learn-result">
          <p className="pdv2-learn-result-title">{result.correct ? "✓ Correct. Well done." : "Answer saved. Keep learning."}</p>
          <p>Understanding: {result.learnerState.mastery.level.replaceAll("_", " ").toLowerCase()} · Evidence confidence: {result.learnerState.confidence.level.toLowerCase()}</p>
          <p className="pdv2-meta">This shows your learning evidence. It is not a school grade.</p>
          {result.support?.hint && <p><strong>Hint:</strong> {result.support.hint}</p>}
          {result.support?.workedExample && <p><strong>Worked example:</strong> {result.support.workedExample}</p>}
          <div className="pdv2-hero-actions">
            <InteractiveButton primary onClick={() => void load()} disabled={busy}>{young ? "Next" : "Get next activity"} →</InteractiveButton>
            <InteractiveButton href="/student/ai-tutor">Ask for help →</InteractiveButton>
          </div>
        </div>}
        {action.toolPolicy.allowed.length > 0 && <div className="pdv2-learn-tools">
          <h3>Tools you can use</h3>
          <div className="pdv2-support-actions">{action.toolPolicy.allowed.map((toolKey) => <InteractiveButton key={toolKey} aria-expanded={tool === toolKey}
            onClick={() => { setTool(tool === toolKey ? null : toolKey); if (!result) setToolsUsed((used) => used.includes(toolKey) ? used : [...used, toolKey]); }}>
            {toolKey.replaceAll("_", " ")}</InteractiveButton>)}</div>
          {tool === "fraction_strips" && <FractionVisualizer onClose={() => setTool(null)} />}
          {tool === "number_line" && <NumberLine onClose={() => setTool(null)} />}
        </div>}
      </div>}
    </div>
  </section>;
}
