// app/student/homework/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Homework {
  id: string;
  title: string;
  description: string;
  questions: string[];
}

export default function StudentHomeworkTake({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const homeworkId = params.id;

  const [homework, setHomework] = useState<Homework | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Fetch homework
  useEffect(() => {
    async function loadHW() {
      try {
        const res = await fetch(`/api/homework/${homeworkId}`);
        if (!res.ok) {
          throw new Error("Failed to load homework");
        }
        const data = await res.json();
        setHomework(data);
        setAnswers(data.questions.map(() => ""));
      } catch (err) {
        console.error(err);
        setHomework(null);
      } finally {
        setLoading(false);
      }
    }

    loadHW();
  }, [homeworkId]);

  async function submitHomework() {
    if (!homework) return;

    setSubmitting(true);

    try {
      const res = await fetch(`/api/homework/${homeworkId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });

      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error(err);
      setResult({
        score: 0,
        feedback: "There was an error submitting your homework.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)] p-6">
        <p>Loading homework...</p>
      </div>
    );
  }

  if (!homework) {
    return (
      <main className="min-h-screen bg-[var(--ll-bg)] p-6 text-[var(--ll-text)]">
        <div className="max-w-3xl mx-auto space-y-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center rounded-full border border-[var(--ll-border)] px-4 py-2 text-sm text-[var(--ll-text)] hover:bg-[var(--ll-surface)] transition-colors"
          >
            ← Back to class list
          </button>

          <p className="text-red-500">Homework not found.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] p-6 text-[var(--ll-text)]">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* 🔙 Back button FIXED */}
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center rounded-full border border-[var(--ll-border)] px-4 py-2 text-sm text-[var(--ll-text)] hover:bg-[var(--ll-surface)] transition-colors"
        >
          ← Back to class list
        </button>

        <h1 className="text-2xl font-bold">{homework.title}</h1>

        <p className="text-[var(--ll-text)] whitespace-pre-wrap">
          {homework.description}
        </p>

        <div className="space-y-6 mt-6">
          {homework.questions.map((q, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-4"
            >
              <p className="font-medium text-[var(--ll-text)] mb-2">
                Question {idx + 1}
              </p>

              <p className="text-[var(--ll-text)] text-sm whitespace-pre-wrap">{q}</p>

              <textarea
                value={answers[idx]}
                onChange={(e) =>
                  setAnswers((prev) => {
                    const updated = [...prev];
                    updated[idx] = e.target.value;
                    return updated;
                  })
                }
                className="mt-3 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-3 text-sm text-[var(--ll-text)] focus:border-emerald-400 focus:ring-emerald-400"
                placeholder="Type your answer..."
                rows={4}
              />
            </div>
          ))}
        </div>

        <button
          onClick={submitHomework}
          disabled={submitting}
          className="rounded-xl bg-[var(--ll-yellow)] px-5 py-2 text-[var(--ll-text-faint)] font-semibold hover:bg-[var(--ll-yellow-soft)] disabled:opacity-40"
        >
          {submitting ? "Submitting..." : "Submit homework"}
        </button>

        {result && (
          <div className="mt-6 rounded-xl border border-emerald-500/30 bg-[var(--ll-yellow)]/10 p-4">
            <p className="text-[var(--ll-yellow)] font-semibold">
              Score: {result.score}/100
            </p>
            <p className="text-[var(--ll-text)] text-sm whitespace-pre-wrap mt-2">
              {result.feedback}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
