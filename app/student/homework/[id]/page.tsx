// app/student/homework/[id]/page.tsx
// NR-14A: wired to submitWithQueue — works offline, replays on reconnect.
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { submitWithQueue } from "@/lib/offline/submitWithQueue";

interface Homework {
  id: string;
  title: string;
  description: string;
  questions: string[];
}

type SubmitStatus =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "submitted"; score?: number; feedback?: string }
  | { kind: "queued" }
  | { kind: "error"; message: string };

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
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>({ kind: "idle" });

  // Fetch homework details
  useEffect(() => {
    async function loadHW() {
      try {
        const res = await fetch(`/api/homework/${homeworkId}`);
        if (!res.ok) throw new Error("Failed to load homework");
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
    setSubmitStatus({ kind: "submitting" });

    try {
      // submitWithQueue tries the network first; queues to IndexedDB if offline
      // or if the request fails (5xx). The clientSubmissionId UUID it generates
      // makes replay safe — the server returns the existing record on a duplicate.
      const result = await submitWithQueue({
        type: "homework",
        endpoint: "/api/homework/submit",
        body: { homeworkId, answers },
        dedupeKey: `homework:${homeworkId}`,
      });

      if (result.status === "submitted") {
        const data = result.data as { ok?: boolean; submission?: unknown; score?: number; feedback?: string };
        setSubmitStatus({
          kind: "submitted",
          score: data?.score,
          feedback: data?.feedback,
        });
      } else {
        // Queued for later sync
        setSubmitStatus({ kind: "queued" });
      }
    } catch (err) {
      console.error(err);
      setSubmitStatus({
        kind: "error",
        message: "There was a problem submitting your homework. Please try again.",
      });
    }
  }

  // ── Loading / not-found states ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)] p-6">
        <p>Loading homework…</p>
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

  // ── Submitted / queued result banner ──────────────────────────────────────

  const isSubmitted = submitStatus.kind === "submitted" || submitStatus.kind === "queued";

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] p-6 text-[var(--ll-text)]">
      <div className="max-w-3xl mx-auto space-y-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center rounded-full border border-[var(--ll-border)] px-4 py-2 text-sm text-[var(--ll-text)] hover:bg-[var(--ll-surface)] transition-colors"
        >
          ← Back to class list
        </button>

        <h1 className="text-2xl font-bold">{homework.title}</h1>

        <p className="text-[var(--ll-text)] whitespace-pre-wrap">{homework.description}</p>

        {/* Questions */}
        <div className="space-y-6 mt-6">
          {homework.questions.map((q, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-4"
            >
              <p className="font-medium text-[var(--ll-text)] mb-2">Question {idx + 1}</p>
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
                disabled={isSubmitted}
                className="mt-3 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-3 text-sm text-[var(--ll-text)] focus:border-emerald-400 focus:ring-emerald-400 disabled:opacity-60"
                placeholder="Type your answer…"
                rows={4}
              />
            </div>
          ))}
        </div>

        {/* Submit button */}
        {!isSubmitted && (
          <button
            onClick={submitHomework}
            disabled={submitStatus.kind === "submitting"}
            className="rounded-xl bg-[var(--ll-yellow)] px-5 py-2 text-[var(--ll-text-faint)] font-semibold hover:bg-[var(--ll-yellow-soft)] disabled:opacity-40"
          >
            {submitStatus.kind === "submitting" ? "Submitting…" : "Submit homework"}
          </button>
        )}

        {/* Result banners */}
        {submitStatus.kind === "submitted" && (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <p className="text-emerald-400 font-semibold">Submitted ✓</p>
            {submitStatus.score !== undefined && (
              <p className="text-[var(--ll-text)] text-sm mt-1">
                Score: {submitStatus.score}/100
              </p>
            )}
            {submitStatus.feedback && (
              <p className="text-[var(--ll-text)] text-sm mt-2 whitespace-pre-wrap">
                {submitStatus.feedback}
              </p>
            )}
          </div>
        )}

        {submitStatus.kind === "queued" && (
          <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4">
            <p className="text-amber-400 font-semibold">Saved offline ✓</p>
            <p className="text-[var(--ll-text)] text-sm mt-1">
              Your answers have been saved. They will be submitted automatically when you&apos;re back online.
            </p>
          </div>
        )}

        {submitStatus.kind === "error" && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
            <p className="text-red-400 text-sm">{submitStatus.message}</p>
          </div>
        )}
      </div>
    </main>
  );
}
