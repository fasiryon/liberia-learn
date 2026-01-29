// app/teacher/homework/new/NewHomeworkForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ClassOption = { id: string; name: string };

export default function NewHomeworkForm({ classes }: { classes: ClassOption[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = e.currentTarget;
    const formData = new FormData(form);

    const classId = formData.get("classId") as string;
    const title = formData.get("title") as string;
    const instructions = (formData.get("instructions") as string) || "";
    const dueAt = (formData.get("dueAt") as string) || "";
    const questionsRaw = (formData.get("questions") as string) || "";

    // Very simple question format: 1 question per line
    const questions = questionsRaw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((q, idx) => ({
        id: `q${idx + 1}`,
        prompt: q,
        type: "FR" as const,
        points: 5,
      }));

    try {
      const res = await fetch("/api/homework", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          title,
          instructions,
          dueAt: dueAt || null,
          questions,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to create homework");
      }

      // Go back to the homework list
      router.push("/teacher/homework");
      router.refresh();
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-200">
          Class
        </label>
        <select
          name="classId"
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50"
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-200">
          Title
        </label>
        <input
          name="title"
          required
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50"
          placeholder="Homework 1 – Fractions practice"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-200">
          Instructions
        </label>
        <textarea
          name="instructions"
          rows={3}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50"
          placeholder="Explain to students what to do..."
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-200">
          Questions (one per line)
        </label>
        <textarea
          name="questions"
          rows={6}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50"
          placeholder={`Example:
1) What is 3/4 + 1/2 ?
2) Explain in your own words what a fraction is.`}
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-200">
          Due date (optional)
        </label>
        <input
          type="date"
          name="dueAt"
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-emerald-400 disabled:opacity-60"
      >
        {submitting ? "Creating..." : "Create Homework"}
      </button>
    </form>
  );
}
