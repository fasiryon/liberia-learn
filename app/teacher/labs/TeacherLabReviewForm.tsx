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
    <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl border border-white/10 bg-slate-900/70 p-6">
      <h2 className="text-lg font-semibold text-slate-100">Teacher Review</h2>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-200">Teacher score (0-100)</span>
        <input
          type="number"
          min={0}
          max={100}
          value={score}
          onChange={(event) => setScore(Number(event.target.value))}
          className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-200">Teacher feedback</span>
        <textarea
          rows={5}
          value={teacherFeedback}
          onChange={(event) => setTeacherFeedback(event.target.value)}
          className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
        />
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Submitting Review..." : "Submit Review"}
      </button>

      {status ? (
        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-sm text-slate-300">
          {status}
        </div>
      ) : null}
    </form>
  );
}
