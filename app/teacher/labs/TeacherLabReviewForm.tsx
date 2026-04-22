"use client";

import { useState } from "react";

export function TeacherLabReviewForm({
  sessionId,
  initialScore,
  initialFeedback,
}: {
  sessionId: string;
  initialScore: number | null;
  initialFeedback: string | null;
}) {
  const [score, setScore] = useState(initialScore ?? 0);
  const [teacherFeedback, setTeacherFeedback] = useState(initialFeedback ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setStatus(null);

    try {
      const response = await fetch(`/api/teacher/labs/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score, teacherFeedback }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Unable to save review.");
      }

      setStatus("Review submitted.");
    } catch (error: any) {
      setStatus(error?.message ?? "Unable to save review.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
      <h2 className="text-lg font-semibold text-[var(--ll-text)]">Teacher Review</h2>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-[var(--ll-text)]">Teacher score (0-100)</span>
        <input
          type="number"
          min={0}
          max={100}
          value={score}
          onChange={(event) => setScore(Number(event.target.value))}
          className="w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm text-[var(--ll-text)]"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-[var(--ll-text)]">Teacher feedback</span>
        <textarea
          rows={5}
          value={teacherFeedback}
          onChange={(event) => setTeacherFeedback(event.target.value)}
          className="w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm text-[var(--ll-text)]"
        />
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-xl bg-[var(--ll-yellow)] px-5 py-3 text-sm font-semibold text-[var(--ll-text-faint)] hover:bg-[var(--ll-yellow-soft)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Submitting Review..." : "Submit Review"}
      </button>

      {status ? (
        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-3 text-sm text-[var(--ll-text)]">
          {status}
        </div>
      ) : null}
    </form>
  );
}
