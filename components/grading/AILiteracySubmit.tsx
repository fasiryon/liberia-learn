"use client";
/**
 * components/grading/AILiteracySubmit.tsx  — NR-14D Phase 4
 *
 * UI for AI literacy exercises — 4 types, all essay-style student responses.
 * Submits via submitWithQueue for offline-safety (NR-14A pattern).
 * Shows rubric breakdown as feedback, NOT a hard grade.
 */

import { useState, useCallback } from "react";

export type AILiteracyExerciseType =
  | "prompt_engineering"
  | "bias_detection"
  | "ethics_scenario"
  | "output_critique";

type RubricResult = {
  score: number;
  comment: string;
};

type GradeResult = {
  score: number;
  breakdown: Record<string, RubricResult>;
  feedback: string;
};

type Props = {
  lessonId: string;
  exerciseId: string;
  promptId: string;
  title: string;
  type: AILiteracyExerciseType;
  scenario: string;
  studentPromptInstruction: string | null;
  rubricCriteria: Array<{ key: string; label: string; weight: number }>;
};

const TYPE_LABELS: Record<AILiteracyExerciseType, string> = {
  prompt_engineering: "Prompt Engineering",
  bias_detection: "Bias Detection",
  ethics_scenario: "Ethics Scenario",
  output_critique: "Output Critique",
};

const TYPE_COLORS: Record<AILiteracyExerciseType, string> = {
  prompt_engineering: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  bias_detection: "border-orange-500/30 bg-orange-500/10 text-orange-400",
  ethics_scenario: "border-purple-500/30 bg-purple-500/10 text-purple-400",
  output_critique: "border-teal-500/30 bg-teal-500/10 text-teal-400",
};

export function AILiteracySubmit({
  lessonId,
  exerciseId,
  promptId,
  title,
  type,
  scenario,
  studentPromptInstruction,
  rubricCriteria,
}: Props) {
  const [response, setResponse] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wordCount = response.trim().split(/\s+/).filter(Boolean).length;
  const typeLabel = TYPE_LABELS[type];
  const typeColor = TYPE_COLORS[type];

  const handleSubmit = useCallback(async () => {
    if (response.trim().length < 20 || submitting) return;
    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/grading/ai-literacy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId,
          exerciseId,
          promptId,
          exerciseType: type,
          studentResponse: response,
          clientSubmissionId: crypto.randomUUID(),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "unknown error" }));
        if (res.status === 429) {
          setError("You have reached the submission limit for this hour. Try again later.");
        } else {
          setError(err.error ?? "Submission failed — please try again.");
        }
        return;
      }

      const data = await res.json();
      if (data && typeof data === "object" && "score" in data) {
        setResult(data as GradeResult);
      }
    } catch {
      setError("Could not connect to the grader. Check your internet connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }, [lessonId, exerciseId, promptId, type, response, submitting]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className={`rounded-xl border p-4 ${typeColor}`}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest">{typeLabel}</span>
          <span className="text-xs opacity-60">AI Literacy</span>
        </div>
        <h3 className="mt-2 text-base font-semibold text-[var(--ll-text)]">{title}</h3>
      </div>

      {/* Scenario */}
      <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--ll-text-muted)]">
          Read carefully
        </p>
        <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[var(--ll-text)]">
          {scenario}
        </div>
      </div>

      {/* Instruction */}
      {studentPromptInstruction && (
        <div className="rounded-xl border border-[var(--ll-yellow)]/30 bg-[var(--ll-yellow-soft)] p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--ll-yellow)]">
            Your task
          </p>
          <p className="mt-2 text-sm leading-7 text-[var(--ll-text)]">{studentPromptInstruction}</p>
        </div>
      )}

      {/* Rubric preview */}
      <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--ll-text-muted)]">
          How you&apos;ll be graded
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {rubricCriteria.map((c) => (
            <span
              key={c.key}
              className="rounded-full border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 px-3 py-1 text-xs text-[var(--ll-text-muted)]"
            >
              {c.label} {Math.round(c.weight * 100)}%
            </span>
          ))}
        </div>
      </div>

      {/* Response area */}
      {!result ? (
        <>
          <textarea
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder="Write your response here. Take your time — there is no single right answer for most of these exercises. Think through your reasoning."
            rows={6}
            disabled={submitting}
            className="w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 px-4 py-3 text-sm leading-7 text-[var(--ll-text)] outline-none focus:border-[var(--ll-yellow)] focus:ring-1 focus:ring-[var(--ll-yellow)]/60 disabled:opacity-60"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--ll-text-muted)]">
              {wordCount} {wordCount === 1 ? "word" : "words"} · aim for at least 30
            </span>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || wordCount < 5}
              className="rounded-xl bg-[var(--ll-yellow-soft)] px-5 py-2.5 text-sm font-semibold text-[var(--ll-yellow)] disabled:opacity-40"
            >
              {submitting ? "Submitting…" : "Submit for feedback"}
            </button>
          </div>
          {error && (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-400">
              {error}
            </p>
          )}
        </>
      ) : (
        /* Feedback display */
        <div className="space-y-4">
          {/* Overall score */}
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
              Feedback (advisory)
            </p>
            <p className="mt-2 text-sm leading-7 text-[var(--ll-text)]">{result.feedback}</p>
            <p className="mt-3 text-xs text-[var(--ll-text-muted)]">
              Overall: {Math.round(result.score * 100)}% · This is a suggested grade — your teacher may review it.
            </p>
          </div>

          {/* Per-criterion breakdown */}
          <div className="space-y-2">
            {rubricCriteria.map((c) => {
              const r = result.breakdown[c.key];
              if (!r) return null;
              return (
                <div
                  key={c.key}
                  className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--ll-text)]">{c.label}</span>
                    <span className="text-xs text-[var(--ll-text-muted)]">
                      {Math.round(r.score * 100)}%
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--ll-text-muted)]">{r.comment}</p>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => { setResult(null); setResponse(""); }}
            className="text-xs text-[var(--ll-text-muted)] underline"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
