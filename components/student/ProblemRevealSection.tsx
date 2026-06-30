"use client";

import { useReducer, useState } from "react";
import { renderSimpleMarkdown } from "@/lib/lessons";

export type ProblemSet = {
  id: string;
  sectionId: string;
  label: string | null;
  studentPrompt: string;
  workingSpace: string | null;
};

// ── Reveal state machine (pure, unit-tested) ──────────────────────────────
// Per problem set: confirming = the "show the answer?" prompt is open;
// revealed = the answer has been confirmed/fetched at least once this session;
// visible = the answer is currently shown. Once revealed, the student can
// freely toggle visibility (hide/show) without re-confirming.

export type RevealState = {
  confirming: boolean;
  revealed: boolean;
  visible: boolean;
};

export type RevealAction =
  | { type: "requestReveal" }
  | { type: "cancel" }
  | { type: "confirm" }
  | { type: "hide" }
  | { type: "show" };

export const initialRevealState: RevealState = {
  confirming: false,
  revealed: false,
  visible: false,
};

export function revealReducer(state: RevealState, action: RevealAction): RevealState {
  switch (action.type) {
    case "requestReveal":
      return { ...state, confirming: true };
    case "cancel":
      return { ...state, confirming: false };
    case "confirm":
      return { confirming: false, revealed: true, visible: true };
    case "hide":
      return { ...state, visible: false };
    case "show":
      // No confirmation: the student has already revealed this answer.
      return { ...state, visible: true };
    default:
      return state;
  }
}

function ProblemReveal({
  lessonId,
  problemSet,
}: {
  lessonId: string;
  problemSet: ProblemSet;
}) {
  const [state, dispatch] = useReducer(revealReducer, initialRevealState);
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      const res = await fetch(`/api/student/work/${lessonId}/problem-answer/${problemSet.id}`);
      const data = res.ok ? await res.json().catch(() => null) : null;
      setAnswer(data?.answerKey ?? null);
    } catch {
      setAnswer(null);
    } finally {
      dispatch({ type: "confirm" });
      setLoading(false);
    }
  }

  return (
    <article className="rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
      {problemSet.label ? (
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--ll-text-muted)]">
          {problemSet.label}
        </p>
      ) : null}
      <div
        className="prose prose-invert max-w-none text-sm prose-p:text-[var(--ll-text)] prose-li:text-[var(--ll-text)]"
        dangerouslySetInnerHTML={{ __html: renderSimpleMarkdown(problemSet.studentPrompt) }}
      />
      {problemSet.workingSpace ? (
        <p className="mt-3 text-xs italic text-[var(--ll-text-faint)]">{problemSet.workingSpace}</p>
      ) : null}

      {/* Confirmation prompt before the first reveal */}
      {state.confirming ? (
        <div className="mt-4 rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-3">
          <p className="text-sm text-[var(--ll-text)]">
            Show the answer? Try the problem yourself first — it helps you learn more.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={handleConfirm}
              className="rounded-lg bg-[var(--ll-yellow-soft)] px-4 py-2 text-sm font-semibold text-[var(--ll-yellow)] disabled:opacity-50"
            >
              {loading ? "Loading…" : "Show answer"}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => dispatch({ type: "cancel" })}
              className="rounded-lg border border-[var(--ll-border)] px-4 py-2 text-sm font-medium text-[var(--ll-text-muted)] hover:text-[var(--ll-text)] disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : state.revealed && state.visible ? (
        <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">Answer</p>
            <button
              type="button"
              onClick={() => dispatch({ type: "hide" })}
              className="rounded-lg border border-[var(--ll-border)] px-3 py-1 text-xs font-medium text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]"
            >
              Hide
            </button>
          </div>
          {answer ? (
            <div
              className="mt-1 prose prose-invert max-w-none text-sm prose-p:text-[var(--ll-text)] prose-li:text-[var(--ll-text)]"
              dangerouslySetInnerHTML={{ __html: renderSimpleMarkdown(answer) }}
            />
          ) : (
            <p className="mt-1 text-sm text-[var(--ll-text-muted)]">Check your work with your teacher.</p>
          )}
        </div>
      ) : state.revealed && !state.visible ? (
        <button
          type="button"
          onClick={() => dispatch({ type: "show" })}
          className="mt-4 rounded-lg border border-[var(--ll-border)] px-4 py-2 text-sm font-medium text-[var(--ll-text-muted)] hover:border-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]"
        >
          Show answer
        </button>
      ) : (
        <button
          type="button"
          onClick={() => dispatch({ type: "requestReveal" })}
          className="mt-4 rounded-lg border border-[var(--ll-border)] px-4 py-2 text-sm font-medium text-[var(--ll-text-muted)] hover:border-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]"
        >
          Reveal answer
        </button>
      )}
    </article>
  );
}

export function ProblemRevealSection({
  lessonId,
  problemSets,
}: {
  lessonId: string;
  problemSets: ProblemSet[] | undefined;
}) {
  if (!problemSets || problemSets.length === 0) return null;

  return (
    <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-5 sm:p-7">
      <h2 className="text-lg font-semibold text-[var(--ll-text)]">Practice Problems</h2>
      <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
        Work through each problem, then reveal the answer to check your work. You can hide it again
        anytime.
      </p>
      <div className="mt-4 space-y-5">
        {problemSets.map((ps) => (
          <ProblemReveal key={ps.id} lessonId={lessonId} problemSet={ps} />
        ))}
      </div>
    </section>
  );
}
