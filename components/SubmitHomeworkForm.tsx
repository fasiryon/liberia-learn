// components/SubmitHomeworkForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SubmitHomeworkForm({
  homeworkId,
  studentId,
  questions,
}: {
  homeworkId: string;
  studentId: string;
  questions: any[];
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<string[]>(
    Array(questions.length).fill("")
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Simple front-end validation: at least one non-empty answer
    const hasAnyAnswer = answers.some((a) => a.trim().length > 0);
    if (!hasAnyAnswer) {
      setError("Please answer at least one question before submitting.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/homework/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          homeworkId,
          studentId,
          answers,
        }),
      });

      if (!res.ok) {
        let message = "Failed to submit";
        try {
          const data = await res.json();
          if (data?.error) message = data.error;
        } catch {
          // ignore JSON parse error
        }
        throw new Error(message);
      }

      // Refresh page to show submission + status
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Questions
        </h2>

        <div className="space-y-4">
          {questions.map((q, i) => (
            <div key={i} className="rounded-xl bg-slate-950/80 p-4">
              <label className="mb-2 block text-sm font-medium">
                {i + 1}. {typeof q === "string" ? q : q?.text ?? "(Untitled question)"}
              </label>
              <textarea
                value={answers[i]}
                onChange={(e) => {
                  const newAnswers = [...answers];
                  newAnswers[i] = e.target.value;
                  setAnswers(newAnswers);
                }}
                className="w-full min-h-[100px] rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                placeholder="Type your answer here..."
              />
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-emerald-500 px-6 py-3 font-semibold text-slate-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Submitting..." : "Submit Homework"}
      </button>
    </form>
  );
}
