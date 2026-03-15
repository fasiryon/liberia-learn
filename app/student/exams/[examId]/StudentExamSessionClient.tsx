"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type Question = {
  id: string;
  prompt: string;
  options: string[];
  explanation: string;
  moeCode: string;
  points: number;
};

type StartPayload = {
  attemptId: string;
  questions: Question[];
  timeLimit: number;
  title: string;
};

type SubmitPayload = {
  score: number;
  passed: boolean;
  certCode?: string;
};

export default function StudentExamSessionClient({ examId }: { examId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<StartPayload | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitPayload | null>(null);
  const flagsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    fetch(`/api/student/exams/${examId}/start`, { method: "POST" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to start exam");
        setSession(data);
        setAnswers(Array.from({ length: data.questions.length }, () => -1));
        setRemainingSeconds((data.timeLimit ?? 60) * 60);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [examId]);

  async function submitExam() {
    if (!session || submitting || result) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/student/exams/${examId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId: session.attemptId,
          answers: answers.map((answer) => (answer < 0 ? 0 : answer)),
          flags: Array.from(flagsRef.current),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to submit exam");
      setResult(data);
    } catch (err: any) {
      console.error("[STUDENT_EXAM_SUBMIT] Failed", err);
      setError(err.message ?? "Failed to submit exam");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (!session || result) return;
    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          void submitExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [session, result]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        flagsRef.current.add("tab_switch");
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const question = session?.questions[currentIndex] ?? null;
  const progress = session ? ((currentIndex + 1) / session.questions.length) * 100 : 0;
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const scorePct = result ? Math.round(result.score * 100) : null;
  const canSubmit = useMemo(() => answers.every((answer) => answer >= 0), [answers]);

  if (loading) {
    return <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50"><div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-slate-900/70 p-6">Starting exam...</div></main>;
  }

  if (error && !session && !result) {
    return <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50"><div className="mx-auto max-w-4xl rounded-3xl border border-red-500/20 bg-red-500/10 p-6">{error}</div></main>;
  }

  if (result) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
        <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-slate-900/70 p-8 space-y-4">
          <h1 className="text-3xl font-semibold">{result.passed ? "Exam Passed" : "Exam Submitted"}</h1>
          <p className="text-lg text-slate-200">Score: {scorePct}%</p>
          <p className={`text-sm ${result.passed ? "text-emerald-300" : "text-amber-300"}`}>{result.passed ? "You earned a certification." : "You did not reach the passing score this time."}</p>
          {result.certCode ? <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm">Certificate code: <span className="font-semibold text-emerald-200">{result.certCode}</span></div> : null}
          <div className="flex gap-3">
            <Link href="/student/exams" className="rounded-2xl border border-white/10 px-4 py-2 text-sm">Back to Exams</Link>
            <Link href="/student/certifications" className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950">View Certifications</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Exam Session</p>
              <h1 className="mt-2 text-2xl font-semibold">{session?.title}</h1>
            </div>
            <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
              Time left: {minutes}:{seconds.toString().padStart(2, "0")}
            </div>
          </div>
          <div className="mt-4 h-2 rounded-full bg-white/10">
            <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-3 text-sm text-slate-400">Question {currentIndex + 1} of {session?.questions.length}</p>
        </div>

        {error ? <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">{error}</div> : null}

        {question ? (
          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 space-y-4">
            <p className="text-lg font-medium">{question.prompt}</p>
            <div className="space-y-3">
              {question.options.map((option, optionIndex) => (
                <button
                  key={optionIndex}
                  type="button"
                  onClick={() => {
                    setAnswers((prev) => {
                      const next = [...prev];
                      next[currentIndex] = optionIndex;
                      return next;
                    });
                  }}
                  className={`w-full rounded-2xl border px-4 py-3 text-left text-sm ${
                    answers[currentIndex] === optionIndex
                      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
                      : "border-white/10 bg-white/5 text-slate-200"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap justify-between gap-3">
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="rounded-2xl border border-white/10 px-4 py-2 text-sm disabled:opacity-40"
              >
                Previous
              </button>
              <div className="flex gap-3">
                {currentIndex < (session?.questions.length ?? 0) - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentIndex((prev) => Math.min((session?.questions.length ?? 1) - 1, prev + 1))}
                    className="rounded-2xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950"
                  >
                    Next
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={!canSubmit || submitting}
                  onClick={() => void submitExam()}
                  className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Submit Exam"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
