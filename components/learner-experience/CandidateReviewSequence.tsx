"use client";

import { useEffect, useRef, useState } from "react";
import { LessonPlayerV2, type LessonPlayerV2Props } from "./LessonPlayerV2";
import { SceneText } from "./SceneViews";
import type { candidateDiagnostic, diagnosticRequestSchema, reviewDiagnosticResult } from "@/lib/learner-experience/candidateReview";
import type { z } from "zod";

type Diagnostic = NonNullable<ReturnType<typeof candidateDiagnostic>>;
type Result = NonNullable<ReturnType<typeof reviewDiagnosticResult>>;
type Responses = z.infer<typeof diagnosticRequestSchema>["responses"];

/** Synthetic review only. Session progress confers no authority and is pinned to package bytes. */
export function CandidateReviewSequence(props: LessonPlayerV2Props & { diagnostic: Diagnostic }) {
  const [phase, setPhase] = useState<"DIAGNOSTIC" | "REMEDIATION" | "INSTRUCTION">("DIAGNOSTIC");
  const [responses, setResponses] = useState<Responses>({});
  const [result, setResult] = useState<Result | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const storageKey = `review-sequence:${props.diagnostic.packageHash}`;
  useEffect(() => { try { if (sessionStorage.getItem(storageKey) === "INSTRUCTION") setPhase("INSTRUCTION"); } catch { /* A blocked session store restarts the diagnostic safely. */ } }, [storageKey]);
  useEffect(() => { heading.current?.focus(); }, [phase]);
  const beginInstruction = () => {
    try { sessionStorage.setItem(storageKey, "INSTRUCTION"); } catch { /* Memory-only review remains usable. */ }
    setPhase("INSTRUCTION");
  };
  const selectedOption = (id: string) => { const response = responses[id]; return response?.kind === "SINGLE_SELECT" ? response.optionId : null; };
  if (phase === "INSTRUCTION") return <LessonPlayerV2 {...props} />;
  return <main id="main-content" className="mx-auto min-h-screen max-w-3xl px-4 py-8" data-review-phase={phase}>
    <p className="mb-3 text-sm">Reviewer-only synthetic session. No official grades, mastery writes or production release.</p>
    <h1 tabIndex={-1} ref={heading} className="text-2xl font-semibold">{phase === "DIAGNOSTIC" ? "Diagnostic" : "Remediation"}: {props.experience.title}</h1>
    {phase === "DIAGNOSTIC" ? <form className="mt-6 space-y-6" onSubmit={async event => {
      event.preventDefault(); setPending(true); setError("");
      try {
        const response = await fetch(`/lab-review/experience/${props.experience.id}/diagnostic`, { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify({ packageHash: props.diagnostic.packageHash, responses }) });
        if (!response.ok) throw new Error("Diagnostic unavailable. Check your responses and reviewer access, then retry.");
        const value: Result = await response.json();
        if (value.packageHash !== props.diagnostic.packageHash || !["REMEDIATION", "INSTRUCTION"].includes(value.phase)) throw new Error("The candidate changed. Reload this review.");
        setResult(value);
        if (value.phase === "INSTRUCTION") beginInstruction(); else setPhase("REMEDIATION");
      } catch (failure) { setError(failure instanceof Error ? failure.message : "Diagnostic unavailable."); }
      finally { setPending(false); }
    }}>
      <p>Answer each prerequisite question. The server uses this draft diagnostic to select review support. It saves no student record.</p>
      {props.diagnostic.items.map(item => <fieldset key={item.itemId} className="rounded-xl border p-4">
        <legend className="px-1 font-semibold">{item.prompt}</legend>
        {item.itemType === "SINGLE_SELECT" ? item.options.map(option => <label key={option.optionId} className="flex min-h-12 items-center gap-3 py-2"><input required type="radio" name={item.itemId} value={option.optionId} checked={selectedOption(item.itemId) === option.optionId} onChange={() => setResponses(previous => ({ ...previous, [item.itemId]: { kind: "SINGLE_SELECT", optionId: option.optionId } }))} />{option.text}</label>) : <label className="mt-3 block">Your numeric response{item.expectedUnit ? ` (${item.expectedUnit})` : ""}<input required maxLength={64} inputMode="decimal" className="mt-2 block min-h-12 w-full rounded border bg-transparent px-3" name={item.itemId} onChange={event => setResponses(previous => ({ ...previous, [item.itemId]: { kind: "NUMERIC", value: event.target.value, unit: item.expectedUnit } }))} /></label>}
      </fieldset>)}
      <p role="alert">{error}</p>
      <button disabled={pending} type="submit" className="min-h-12 rounded-xl border px-6 py-3 font-semibold">{pending ? "Checking prerequisite support..." : "Continue"}</button>
    </form> : <section className="mt-6 space-y-5" aria-label="Prerequisite support">
      <p>The diagnostic selected prerequisite support. Review the authored worksheet before continuing.</p>
      <h2 className="text-xl font-semibold">{result?.remediation?.title}</h2>
      {result?.remediation?.prerequisites.map(text => <p key={text}>{text}</p>)}
      {result?.remediation?.sections.map((section, index) => <section key={index}><h3 className="text-lg font-semibold">{section.heading}</h3><SceneText text={section.text} /></section>)}
      <button type="button" onClick={beginInstruction} className="min-h-12 rounded-xl border px-6 py-3 font-semibold">Continue to instruction</button>
    </section>}
  </main>;
}
