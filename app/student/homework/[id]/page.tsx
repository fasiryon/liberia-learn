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
      <div className="min-h-screen bg-slate-950 text-slate-50 p-6">
        <p>Loading homework...</p>
      </div>
    );
  }

  if (!homework) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-slate-50">
        <div className="max-w-3xl mx-auto space-y-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 transition-colors"
          >
            ← Back to class list
          </button>

          <p className="text-red-500">Homework not found.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-50">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* 🔙 Back button FIXED */}
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 transition-colors"
        >
          ← Back to class list
        </button>

        <h1 className="text-2xl font-bold">{homework.title}</h1>

        <p className="text-slate-300 whitespace-pre-wrap">
          {homework.description}
        </p>

        <div className="space-y-6 mt-6">
          {homework.questions.map((q, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-slate-800 bg-slate-900/70 p-4"
            >
              <p className="font-medium text-slate-100 mb-2">
                Question {idx + 1}
              </p>

              <p className="text-slate-300 text-sm whitespace-pre-wrap">{q}</p>

              <textarea
                value={answers[idx]}
                onChange={(e) =>
                  setAnswers((prev) => {
                    const updated = [...prev];
                    updated[idx] = e.target.value;
                    return updated;
                  })
                }
                className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-sm text-slate-100 focus:border-emerald-400 focus:ring-emerald-400"
                placeholder="Type your answer..."
                rows={4}
              />
            </div>
          ))}
        </div>

        <button
          onClick={submitHomework}
          disabled={submitting}
          className="rounded-xl bg-emerald-500 px-5 py-2 text-slate-900 font-semibold hover:bg-emerald-400 disabled:opacity-40"
        >
          {submitting ? "Submitting..." : "Submit homework"}
        </button>

        {result && (
          <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <p className="text-emerald-300 font-semibold">
              Score: {result.score}/100
            </p>
            <p className="text-slate-300 text-sm whitespace-pre-wrap mt-2">
              {result.feedback}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
