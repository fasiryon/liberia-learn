"use client";

import { useEffect, useState } from "react";
import { InteractiveButton } from "@/components/ui/InteractiveButton";
import { learnTarget, readError, subjectName } from "@/components/student/learn/learnPresentation";
import type { UnitSequence } from "@/lib/student/unitSequence";

const STATUS: Record<string, string> = { completed: "Completed", current: "Up next in this unit", upcoming: "Upcoming" };

type State = { kind: "loading" } | { kind: "ready"; sequence: UnitSequence } | { kind: "error" | "restricted" | "signed-out" | "unavailable"; message: string };

function validSequence(data: any): data is UnitSequence {
  return !!data && typeof data.unitId === "string" && typeof data.unitName === "string" && typeof data.subject === "string" && Number.isInteger(data.grade) &&
    Array.isArray(data.lessons) && data.lessons.every((lesson: any) => lesson && typeof lesson.contentId === "string" && typeof lesson.title === "string" &&
      ["completed", "current", "upcoming"].includes(lesson.status) && typeof lesson.locked === "boolean" && typeof lesson.href === "string") &&
    Number.isInteger(data.completedCount) && Number.isInteger(data.totalCount);
}

/** Unit lesson sequence as the server computed it, including its locks. */
export default function UnitOverviewClient({ unitId }: { unitId: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });
    fetch(`/api/student/units/${encodeURIComponent(unitId)}`, { cache: "no-store" })
      .then(async (res) => {
        if (!active) return;
        if (res.status === 404) return setState({ kind: "unavailable", message: "This unit isn't available. It may have changed or isn't part of your classes." });
        if (!res.ok) { const failure = readError(res.status); return setState({ kind: failure.state === "ready" || failure.state === "loading" ? "error" : failure.state, message: failure.error ?? "This unit could not load." }); }
        const data: unknown = await res.json();
        setState(validSequence(data) ? { kind: "ready", sequence: data } : { kind: "error", message: "This unit could not be read. Try again." });
      })
      .catch(() => { if (active) setState({ kind: "error", message: "This unit could not load. Check your connection and try again." }); });
    return () => { active = false; };
  }, [unitId, attempt]);

  const sequence = state.kind === "ready" ? state.sequence : null;
  return <main className="pdv2-today pdv2-learn" aria-labelledby="unit-heading">
    <header className="pdv2-topbar"><div>
      <InteractiveButton href="/student/learn">← Back to Learn</InteractiveButton>
      <p className="pdv2-eyebrow pdv2-learn-crumb">{sequence ? `Learn · ${subjectName(sequence.subject)} · Grade ${sequence.grade} · Unit` : "Learn · Unit"}</p>
      <h1 id="unit-heading">{sequence?.unitName ?? (state.kind === "loading" ? "Loading unit…" : "Unit unavailable")}</h1>
      {sequence && <p>{sequence.completedCount} of {sequence.totalCount} lessons completed. Completing lessons is not the same as mastering them.</p>}
    </div></header>

    <div className="pdv2-plan" aria-busy={state.kind === "loading"}>
      {state.kind === "loading" && <p role="status">Loading the lessons in this unit…</p>}
      {state.kind !== "loading" && state.kind !== "ready" && <div role="status" className="pdv2-learn-notice">
        <p><span className="pdv2-badge pdv2-badge-warn">{state.kind === "restricted" ? "Restricted" : state.kind === "signed-out" ? "Signed out" : "Unavailable"}</span> {state.message}</p>
        {state.kind === "error" && <InteractiveButton primary onClick={() => setAttempt((n) => n + 1)}>Try again</InteractiveButton>}
        {state.kind === "signed-out" && <InteractiveButton primary href="/login">Sign in →</InteractiveButton>}
      </div>}
      {sequence && sequence.lessons.length === 0 && <p className="pdv2-learn-empty">This unit has no lessons yet.</p>}
      {sequence && sequence.lessons.length > 0 && <>
        <h2 className="pdv2-subhead">Lessons in order</h2>
        <ol className="pdv2-plan-list pdv2-learn-steps">{sequence.lessons.map((lesson, index) => {
          const status = lesson.locked ? "Locked · finish earlier lessons first" : STATUS[lesson.status];
          return <li key={lesson.contentId} data-status={lesson.locked ? "locked" : lesson.status} aria-current={lesson.status === "current" && !lesson.locked ? "step" : undefined}>
            <span className="pdv2-step-marker" aria-hidden="true">{lesson.status === "completed" ? "✓" : lesson.locked ? "🔒" : index + 1}</span>
            <div><p className="pdv2-meta">Lesson {index + 1}{lesson.lessonType ? ` · ${lesson.lessonType}` : ""}</p><p className="pdv2-row-title">{lesson.title}</p><p className="pdv2-step-status">{status}</p></div>
            {lesson.locked ? <span className="pdv2-learn-locked">Locked</span>
              : learnTarget(lesson.href) ? <InteractiveButton primary={lesson.status === "current"} href={lesson.href} aria-label={`${lesson.status === "completed" ? "Review" : "Open"} lesson ${index + 1}: ${lesson.title}`}>{lesson.status === "completed" ? "Review" : "Open"} →</InteractiveButton>
              : <span className="pdv2-learn-locked">Link unavailable</span>}
          </li>;
        })}</ol>
      </>}
    </div>
  </main>;
}
