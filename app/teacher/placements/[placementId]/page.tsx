"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { placementBandStyles, placementReviewStatusStyles } from "@/lib/placement";

type PlacementDetail = {
  id: string;
  createdAt: string;
  band: "foundational" | "developing" | "proficient" | "advanced";
  levelLabel: string;
  estimatedGrade: number;
  rawScore: number;
  totalQuestions: number;
  questions: Array<{
    questionId: string;
    question: string;
    options: string[];
    correctAnswer: number;
    explanation: string;
    difficulty: number;
    subject: string;
    strand: string;
    moeStandard: string | null;
    whyThisQuestion: string;
    commonMistake: string;
    hint: string;
  }> | null;
  answers: Array<{
    questionId: string;
    difficulty: number;
    correct: boolean;
    timeSpent: number;
    selectedAnswer: number;
  }> | null;
  aiAnalysis: {
    overallNarrative: string;
    strengths: string[];
    areasForGrowth: string[];
    teacherNote: string;
    confidenceExplanation: string;
    recommendedNextSteps: string[];
  } | null;
  teacherDecision: string | null;
  teacherGrade: number | null;
  teacherReason: string | null;
  reviewedAt: string | null;
  status: "pending" | "confirmed" | "overridden";
  student: {
    id: string;
    name: string;
    currentGrade: number | null;
    timeTakenSeconds: number;
  };
};

const REASON_OPTIONS = [
  "Student is stronger than test shows",
  "Student has learning difficulties not captured by this test",
  "Student recently transferred, grade known",
  "Test conditions were not ideal",
  "Other (explain below)",
];

export default function TeacherPlacementReviewPage({ params }: { params: { placementId: string } }) {
  const [data, setData] = useState<PlacementDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [decision, setDecision] = useState<"confirm" | "override">("confirm");
  const [overrideGrade, setOverrideGrade] = useState<number>(1);
  const [overrideReason, setOverrideReason] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/teacher/placements/${params.placementId}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.placement) {
          throw new Error(payload?.error ?? "Failed to load placement");
        }
        if (!active) return;
        setData(payload.placement);
        setOverrideGrade(payload.placement.estimatedGrade);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [params.placementId]);

  const questionPairs = useMemo(() => {
    const questions = data?.questions ?? [];
    const answers = data?.answers ?? [];
    return questions.map((question) => ({
      question,
      answer: answers.find((entry) => entry.questionId === question.questionId) ?? null,
    }));
  }, [data]);

  async function submitReview() {
    if (!data) return;
    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/teacher/placements/${data.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          overrideGrade: decision === "override" ? overrideGrade : undefined,
          overrideReason: decision === "override" ? overrideReason : undefined,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to submit teacher review");
      }

      setData((current) =>
        current
          ? {
              ...current,
              status: decision === "confirm" ? "confirmed" : "overridden",
              teacherDecision: decision === "confirm" ? "confirmed" : "overridden",
              teacherGrade: decision === "override" ? overrideGrade : null,
              teacherReason: decision === "override" ? overrideReason.trim() : null,
              reviewedAt: payload?.placement?.reviewedAt ?? new Date().toISOString(),
              student: {
                ...current.student,
                currentGrade: payload?.finalGrade ?? current.student.currentGrade,
              },
            }
          : current
      );
      setSuccessMessage(
        decision === "confirm" ? "Placement confirmed." : `Placement overridden to Grade ${overrideGrade}.`
      );
    } catch (err: any) {
      setError(err?.message ?? "Failed to submit teacher review");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
        <div className="mx-auto max-w-6xl space-y-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-900/70" />
          ))}
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-200">
            {error ?? "Placement not found."}
          </div>
          <Link href="/teacher/placements" className="inline-flex rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800">
            Back to placements
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">Human Audit Review</p>
            <h1 className="text-3xl font-bold">{data.student.name}</h1>
            <p className="mt-1 text-sm text-slate-400">
              Placement taken on {new Date(data.createdAt).toLocaleDateString("en-LR")}
            </p>
          </div>
          <Link href="/teacher/placements" className="inline-flex rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800">
            Back to placements
          </Link>
        </div>

        {successMessage ? (
          <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-200">{successMessage}</div>
        ) : null}
        {error ? <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div> : null}

        <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
            <h2 className="text-lg font-semibold">Student info</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Current grade</p>
                <p className="mt-2 text-2xl font-bold">Grade {data.student.currentGrade ?? "—"}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Test date</p>
                <p className="mt-2 text-lg font-semibold">{new Date(data.createdAt).toLocaleDateString("en-LR")}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Time taken</p>
                <p className="mt-2 text-lg font-semibold">{Math.max(1, Math.round(data.student.timeTakenSeconds / 60))} min</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
            <h2 className="text-lg font-semibold">AI Recommendation</h2>
            <p className="mt-4 text-sm text-slate-400">Recommended grade</p>
            <p className="mt-2 text-5xl font-black text-emerald-300">Grade {data.estimatedGrade}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${placementBandStyles[data.band]}`}>
                {data.levelLabel}
              </span>
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${placementReviewStatusStyles[data.status]}`}>
                {data.status}
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-slate-400">
              {data.aiAnalysis?.confidenceExplanation ?? "No confidence explanation was saved for this placement."}
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
          <h2 className="text-lg font-semibold">AI Analysis</h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-200">
            {data.aiAnalysis?.overallNarrative ?? "No AI narrative available."}
          </p>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-green-300">Strengths</h3>
              <ul className="mt-3 space-y-2">
                {(data.aiAnalysis?.strengths ?? []).map((item) => (
                  <li key={item} className="rounded-2xl border border-green-500/20 bg-green-500/10 p-3 text-sm text-slate-100">{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-300">Areas for growth</h3>
              <ul className="mt-3 space-y-2">
                {(data.aiAnalysis?.areasForGrowth ?? []).map((item) => (
                  <li key={item} className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-3 text-sm text-slate-100">{item}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Teacher note</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-100">
              {data.aiAnalysis?.teacherNote ?? "No teacher note available."}
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
          <h2 className="text-lg font-semibold">Question by question</h2>
          <div className="mt-4 space-y-4">
            {questionPairs.map(({ question, answer }, index) => (
              <article key={question.questionId} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                <div className="mb-3 flex flex-wrap gap-2 text-xs uppercase tracking-wide text-slate-500">
                  <span>Question {index + 1}</span>
                  <span>Difficulty {question.difficulty}/5</span>
                  <span>{question.strand}</span>
                  {question.moeStandard ? <span>{question.moeStandard}</span> : null}
                </div>
                <h3 className="text-lg font-semibold text-slate-100">{question.question}</h3>
                <div className="mt-4 space-y-2">
                  {question.options.map((option, optionIndex) => {
                    const optionClass =
                      optionIndex === question.correctAnswer
                        ? "border-green-500/40 bg-green-500/15 text-green-100"
                        : optionIndex === answer?.selectedAnswer
                        ? "border-red-500/40 bg-red-500/15 text-red-100"
                        : "border-slate-800 bg-slate-900/70 text-slate-200";

                    return (
                      <div key={`${question.questionId}-${optionIndex}`} className={`rounded-xl border px-4 py-3 text-sm ${optionClass}`}>
                        <div className="flex items-start justify-between gap-3">
                          <span>
                            <span className="mr-2 font-semibold">{String.fromCharCode(65 + optionIndex)}.</span>
                            {option}
                          </span>
                          <span className="shrink-0 text-xs font-semibold uppercase tracking-wide">
                            {optionIndex === question.correctAnswer
                              ? "Correct"
                              : optionIndex === answer?.selectedAnswer
                              ? "Student answer"
                              : ""}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 grid gap-3 lg:grid-cols-3">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">AI explanation</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-100">{question.explanation}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Common mistake</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-100">{question.commonMistake}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Why this question</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-100">{question.whyThisQuestion}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
          <h2 className="text-lg font-semibold">Your Decision</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <label className="rounded-2xl border border-green-500/30 bg-green-500/10 p-4">
              <div className="flex items-start gap-3">
                <input type="radio" name="decision" checked={decision === "confirm"} onChange={() => setDecision("confirm")} className="mt-1" />
                <div>
                  <p className="font-semibold text-green-200">Confirm Grade {data.estimatedGrade} placement</p>
                  <p className="mt-1 text-sm text-slate-200">Accept the AI recommendation as the final placement.</p>
                </div>
              </div>
            </label>
            <label className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4">
              <div className="flex items-start gap-3">
                <input type="radio" name="decision" checked={decision === "override"} onChange={() => setDecision("override")} className="mt-1" />
                <div>
                  <p className="font-semibold text-blue-200">Override to different grade</p>
                  <p className="mt-1 text-sm text-slate-200">Record a different placement with a required reason.</p>
                </div>
              </div>
            </label>
          </div>

          {decision === "override" ? (
            <div className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-200">Grade selector</span>
                  <select
                    value={overrideGrade}
                    onChange={(event) => setOverrideGrade(Number(event.target.value))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100"
                  >
                    {Array.from({ length: 12 }).map((_, index) => (
                      <option key={index + 1} value={index + 1}>
                        Grade {index + 1}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="space-y-2">
                  <span className="text-sm font-semibold text-slate-200">Reason options</span>
                  <div className="flex flex-wrap gap-2">
                    {REASON_OPTIONS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setOverrideReason((current) => (current ? `${current}\n${option}` : option))}
                        className="rounded-full border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <label className="block">
                <span className="text-sm font-semibold text-slate-200">Reason for override</span>
                <textarea
                  value={overrideReason}
                  onChange={(event) => setOverrideReason(event.target.value)}
                  rows={5}
                  minLength={20}
                  className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
                  placeholder="Explain why your teacher judgment differs from the AI recommendation."
                />
              </label>
            </div>
          ) : null}

          <div className="mt-5">
            <button
              type="button"
              disabled={submitting || (decision === "override" && overrideReason.trim().length < 20)}
              onClick={submitReview}
              className="rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Saving..." : decision === "confirm" ? "Confirm Placement" : `Override to Grade ${overrideGrade}`}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
