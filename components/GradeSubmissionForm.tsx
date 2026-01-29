// components/GradeSubmissionForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  submissionId: string;
  initialScore: number | null;
  initialNotes: string | null;
};

export function GradeSubmissionForm({
  submissionId,
  initialScore,
  initialNotes,
}: Props) {
  const router = useRouter();
  const [score, setScore] = useState(
    initialScore !== null ? String(initialScore) : ""
  );
  const [notes, setNotes] = useState(initialNotes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const numericScore = Number(score);
    if (Number.isNaN(numericScore) || numericScore < 0 || numericScore > 100) {
      setError("Score must be a number between 0 and 100.");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/homework/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId,
          teacherScore: numericScore,
          teacherNotes: notes.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save grade");
      }

      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to save grade");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex items-center gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Score (%)</label>
          <input
            type="number"
            min={0}
            max={100}
            value={score}
            onChange={(e) => setScore(e.target.value)}
            className="w-24 rounded-lg bg-slate-950 border border-slate-700 px-2 py-1 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
            required
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="mt-5 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving
            ? "Saving..."
            : initialScore !== null
            ? "Update grade"
            : "Save grade"}
        </button>
      </div>

      <div>
        <label className="block text-xs text-slate-400 mb-1">
          Teacher notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 min-h-[70px]"
          placeholder="Short feedback for the student..."
        />
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </form>
  );
}
