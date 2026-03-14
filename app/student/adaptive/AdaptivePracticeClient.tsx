"use client";

import { useEffect, useMemo, useState } from "react";

type Gap = {
  strand: string;
  subject: string;
  grade: number;
  averageScore: number;
  attemptCount: number;
  lastAttemptAt: string;
};

type PracticeQuestion = {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  hintText: string;
};

type PracticeSet = {
  strand: string;
  difficultyTier: string;
  questions: PracticeQuestion[];
  generatedAt: string;
};

type SubmissionResult = {
  score: number;
  passed: boolean;
  nextTier: string;
};

function inferTier(averageScore: number): string {
  if (averageScore < 0.4) return "remedial";
  if (averageScore < 0.7) return "standard";
  return "stretch";
}

function formatPercent(score: number): string {
  return `${Math.round(score * 100)}%`;
}

export default function AdaptivePracticeClient() {
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeGap, setActiveGap] = useState<Gap | null>(null);
  const [practice, setPractice] = useState<PracticeSet | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadGaps() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/student/adaptive/gaps", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Practice unavailable offline - gaps will load when reconnected");
        }
        const payload = await response.json();
        if (!cancelled) {
          setGaps(payload.gaps ?? []);
        }
      } catch (fetchError: any) {
        if (!cancelled) {
          setError(fetchError?.message ?? "Practice unavailable offline - gaps will load when reconnected");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadGaps().catch((loadError) => {
      console.error("[student.adaptive.loadGaps]", loadError);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const currentQuestion = useMemo(
    () => practice?.questions?.[questionIndex] ?? null,
    [practice, questionIndex]
  );

  async function startPractice(gap: Gap) {
    try {
      setError(null);
      setResult(null);
      setPractice(null);
      setAnswers([]);
      setQuestionIndex(0);
      setActiveGap(gap);

      const response = await fetch("/api/student/adaptive/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strandCode: gap.strand,
          difficultyTier: inferTier(gap.averageScore),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Practice unavailable offline - gaps will load when reconnected");
      }

      const payload = await response.json();
      setPractice(payload.practice ?? null);
    } catch (practiceError: any) {
      console.error("[student.adaptive.startPractice]", practiceError);
      setError(practiceError?.message ?? "Practice unavailable offline - gaps will load when reconnected");
    }
  }

  async function selectAnswer(optionIndex: number) {
    if (!practice || !currentQuestion) {
      return;
    }

    const nextAnswers = [...answers];
    nextAnswers[questionIndex] = optionIndex;
    setAnswers(nextAnswers);

    if (questionIndex < practice.questions.length - 1) {
      setQuestionIndex(questionIndex + 1);
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch("/api/student/adaptive/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strandCode: practice.strand,
          practiceSetId: crypto.randomUUID(),
          answers: nextAnswers,
          correctAnswers: practice.questions.map((question) => question.correctIndex),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Practice unavailable offline - gaps will load when reconnected");
      }

      const payload = await response.json();
      setResult(payload);
    } catch (submitError: any) {
      console.error("[student.adaptive.submit]", submitError);
      setError(submitError?.message ?? "Practice unavailable offline - gaps will load when reconnected");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Adaptive Learning</p>
          <h1 className="text-3xl font-bold">My Practice</h1>
          <p className="text-sm text-slate-400">
            Targeted practice for your weakest strands, updated from your latest results.
          </p>
        </header>

        {error && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-24 animate-pulse rounded-2xl bg-slate-900/70" />
            ))}
          </div>
        ) : practice && currentQuestion ? (
          <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  {activeGap?.subject} • {practice.difficultyTier}
                </p>
                <h2 className="text-xl font-semibold text-slate-100">{practice.strand}</h2>
              </div>
              <div className="rounded-full bg-slate-950/60 px-3 py-1 text-xs text-emerald-300">
                Question {questionIndex + 1} / {practice.questions.length}
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-lg text-slate-100">{currentQuestion.prompt}</p>
              <div className="grid gap-3">
                {currentQuestion.options.map((option, optionIndex) => (
                  <button
                    key={`${currentQuestion.id}-${optionIndex}`}
                    type="button"
                    onClick={() => selectAnswer(optionIndex)}
                    disabled={submitting}
                    className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-left text-sm hover:border-emerald-500/40 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {result && (
              <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
                Score {formatPercent(result.score)}. {result.passed ? "Passed" : "Needs more practice"}. Next tier:{" "}
                {result.nextTier}.
              </div>
            )}
          </section>
        ) : (
          <section className="grid gap-4 md:grid-cols-2">
            {gaps.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 text-sm text-slate-400">
                No active mastery gaps yet.
              </div>
            ) : (
              gaps.map((gap) => (
                <article key={`${gap.subject}-${gap.strand}`} className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
                  <p className="text-xs uppercase tracking-wide text-slate-400">{gap.subject}</p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-100">{gap.strand}</h2>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl bg-slate-950/60 p-3">
                      <p className="text-xs text-slate-500">Average score</p>
                      <p className="mt-1 text-lg font-semibold text-amber-300">{formatPercent(gap.averageScore)}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-950/60 p-3">
                      <p className="text-xs text-slate-500">Difficulty tier</p>
                      <p className="mt-1 text-lg font-semibold text-cyan-300">{inferTier(gap.averageScore)}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => startPractice(gap)}
                    className="mt-5 w-full rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-300"
                  >
                    Start Practice
                  </button>
                </article>
              ))
            )}
          </section>
        )}
      </div>
    </div>
  );
}
