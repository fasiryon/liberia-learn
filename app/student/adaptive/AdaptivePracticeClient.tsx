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
          setError(
            fetchError?.message ?? "Practice unavailable offline - gaps will load when reconnected"
          );
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
        throw new Error(
          payload?.error ?? "Practice unavailable offline - gaps will load when reconnected"
        );
      }

      const payload = await response.json();
      setPractice(payload.practice ?? null);
    } catch (practiceError: any) {
      console.error("[student.adaptive.startPractice]", practiceError);
      setError(
        practiceError?.message ?? "Practice unavailable offline - gaps will load when reconnected"
      );
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
        throw new Error(
          payload?.error ?? "Practice unavailable offline - gaps will load when reconnected"
        );
      }

      const payload = await response.json();
      setResult(payload);
    } catch (submitError: any) {
      console.error("[student.adaptive.submit]", submitError);
      setError(
        submitError?.message ?? "Practice unavailable offline - gaps will load when reconnected"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="ll-page min-h-screen px-4 py-8 text-[var(--ll-text)]">
      <div className="ll-shell max-w-4xl space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ll-yellow)]">
            Adaptive Learning
          </p>
          <h1 className="text-3xl font-bold">My Practice</h1>
          <p className="max-w-2xl text-base leading-7 text-[var(--ll-text)]">
            Targeted practice for your weakest strands, updated from your latest results.
          </p>
        </header>

        {error && (
          <div className="rounded-xl border border-amber-500/30 bg-[var(--ll-yellow-soft)] px-4 py-3 text-sm text-[var(--ll-yellow)]">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-24 animate-pulse rounded-xl bg-[var(--ll-bg)]/70" />
            ))}
          </div>
        ) : practice && currentQuestion ? (
          <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5 sm:p-6">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--ll-text)]">
                  {activeGap?.subject} - {practice.difficultyTier}
                </p>
                <h2 className="text-xl font-semibold text-[var(--ll-text)]">{practice.strand}</h2>
              </div>
              <div className="rounded-full bg-[var(--ll-bg)]/60 px-3 py-1 text-xs text-[var(--ll-yellow)]">
                Question {questionIndex + 1} / {practice.questions.length}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/55 p-4">
                <p className="text-xl leading-8 text-[var(--ll-text)]">{currentQuestion.prompt}</p>
              </div>
              <div className="grid gap-3">
                {currentQuestion.options.map((option, optionIndex) => (
                  <button
                    key={`${currentQuestion.id}-${optionIndex}`}
                    type="button"
                    onClick={() => selectAnswer(optionIndex)}
                    disabled={submitting}
                    className="w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 px-4 py-4 text-left text-base leading-7 text-[var(--ll-text)] hover:border-emerald-500/40 hover:bg-[var(--ll-bg)] disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ minHeight: "52px" }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {result && (
              <div className="mt-6 rounded-xl border border-emerald-500/30 bg-[var(--ll-yellow)]/10 px-4 py-3 text-sm text-[var(--ll-text)]">
                Score {formatPercent(result.score)}.{" "}
                {result.passed ? "Passed" : "Needs more practice"}. Next tier: {result.nextTier}.
              </div>
            )}
          </section>
        ) : (
          <section className="grid gap-4 md:grid-cols-2">
            {gaps.length === 0 ? (
              <div className="ll-empty rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6 text-sm text-[var(--ll-text)]">
                No active mastery gaps yet.
              </div>
            ) : (
              gaps.map((gap) => (
                <article
                  key={`${gap.subject}-${gap.strand}`}
                  className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6"
                >
                  <p className="text-xs uppercase tracking-wide text-[var(--ll-text)]">{gap.subject}</p>
                  <h2 className="mt-2 text-xl font-semibold text-[var(--ll-text)]">{gap.strand}</h2>
                  <p className="mt-2 text-sm leading-7 text-[var(--ll-text)]">
                    This strand needs extra support. Start with a short practice set and close the gap before your next exam.
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-[var(--ll-bg)]/60 p-3">
                      <p className="text-xs text-[var(--ll-text)]">Average score</p>
                      <p className="mt-1 text-lg font-semibold text-[var(--ll-yellow)]">
                        {formatPercent(gap.averageScore)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-[var(--ll-bg)]/60 p-3">
                      <p className="text-xs text-[var(--ll-text)]">Difficulty tier</p>
                      <p className="mt-1 text-lg font-semibold text-[var(--ll-silver)]">
                        {inferTier(gap.averageScore)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => startPractice(gap)}
                    className="ll-touch-target mt-5 w-full rounded-xl bg-[var(--ll-yellow-soft)] px-4 py-3 text-sm font-semibold text-[var(--ll-text-faint)] hover:bg-[var(--ll-yellow-soft)]"
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
