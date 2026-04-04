"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

export type PersistedExamSession = {
  answers: number[];
  currentIndex: number;
  startedAt: string | null;
};

export function parsePersistedExamSession(raw: string): PersistedExamSession | null {
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedExamSession>;
    return {
      answers: Array.isArray(parsed.answers)
        ? parsed.answers.filter((value): value is number => typeof value === "number")
        : [],
      currentIndex:
        typeof parsed.currentIndex === "number" && parsed.currentIndex >= 0
          ? parsed.currentIndex
          : 0,
      startedAt: typeof parsed.startedAt === "string" ? parsed.startedAt : null,
    };
  } catch {
    return null;
  }
}

export function persistExamSession(
  storage: Pick<Storage, "setItem">,
  key: string,
  session: PersistedExamSession
) {
  storage.setItem(key, JSON.stringify(session));
}

export function clearExamSession(
  storage: Pick<Storage, "removeItem">,
  key: string
) {
  storage.removeItem(key);
}

export default function StudentExamSessionClient({ examId }: { examId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<StartPayload | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitPayload | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  const flagsRef = useRef<Set<string>>(new Set());
  const restoredSessionRef = useRef<PersistedExamSession | null>(null);
  const sessionKey = useMemo(() => `exam_session_${examId}`, [examId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.sessionStorage.getItem(sessionKey);
    if (!saved) return;

    const restored = parsePersistedExamSession(saved);
    if (restored) {
      restoredSessionRef.current = restored;
      setAnswers(restored.answers);
      setCurrentIndex(restored.currentIndex);
      setStartedAt(restored.startedAt);
    } else {
      clearExamSession(window.sessionStorage, sessionKey);
    }
  }, [sessionKey]);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/student/exams/${examId}/start`, { method: "POST" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to start exam");
        if (cancelled) return;

        const restored = restoredSessionRef.current;
        const restoredAnswers =
          restored?.answers?.length === data.questions.length ? restored.answers : null;
        const restoredIndex =
          restoredAnswers && typeof restored.currentIndex === "number"
            ? Math.min(restored.currentIndex, Math.max(data.questions.length - 1, 0))
            : 0;
        const resolvedStartedAt = restored?.startedAt ?? new Date().toISOString();
        const elapsedSeconds = Math.max(
          0,
          Math.floor((Date.now() - new Date(resolvedStartedAt).getTime()) / 1000)
        );

        setSession(data);
        setAnswers(
          restoredAnswers ?? Array.from({ length: data.questions.length }, () => -1)
        );
        setCurrentIndex(restoredIndex);
        setStartedAt(resolvedStartedAt);
        setRemainingSeconds(Math.max((data.timeLimit ?? 60) * 60 - elapsedSeconds, 0));
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [examId]);

  useEffect(() => {
    if (typeof window === "undefined" || !startedAt || result) return;
    persistExamSession(window.sessionStorage, sessionKey, {
      answers,
      currentIndex,
      startedAt,
    });
  }, [answers, currentIndex, startedAt, result, sessionKey]);

  const clearPersistedSession = useCallback(() => {
    if (typeof window === "undefined") return;
    clearExamSession(window.sessionStorage, sessionKey);
  }, [sessionKey]);

  const submitExam = useCallback(async () => {
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
      clearPersistedSession();
    } catch (err: any) {
      console.error("[STUDENT_EXAM_SUBMIT] Failed", err);
      setError(err.message ?? "Failed to submit exam");
    } finally {
      setSubmitting(false);
    }
  }, [answers, clearPersistedSession, examId, result, session, submitting]);

  useEffect(() => {
    if (!session || result) return;
    if (remainingSeconds <= 0) {
      clearPersistedSession();
      void submitExam();
      return;
    }

    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          clearPersistedSession();
          void submitExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [clearPersistedSession, remainingSeconds, result, session, submitExam]);

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
  const selectedAnswer = question ? answers[currentIndex] : -1;

  if (loading) {
    return (
      <main className="ll-page min-h-screen px-4 py-8 text-slate-50">
        <div className="ll-shell max-w-4xl rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          Starting exam...
        </div>
      </main>
    );
  }

  if (error && !session && !result) {
    return (
      <main className="ll-page min-h-screen px-4 py-8 text-slate-50">
        <div className="ll-shell max-w-4xl rounded-3xl border border-red-500/20 bg-red-500/10 p-6">
          {error}
        </div>
      </main>
    );
  }

  if (result) {
    return (
      <main className="ll-page min-h-screen px-4 py-8 text-slate-50">
        <div className="ll-shell max-w-3xl rounded-3xl border border-white/10 bg-slate-900/70 p-8 space-y-4">
          <h1 className="text-3xl font-semibold">{result.passed ? "Exam Passed" : "Exam Submitted"}</h1>
          <p className="text-lg text-slate-100">Score: {scorePct}%</p>
          <p className={`text-sm ${result.passed ? "text-emerald-200" : "text-amber-200"}`}>
            {result.passed
              ? "You earned a certification."
              : "You did not reach the passing score this time."}
          </p>
          {result.certCode ? (
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-slate-100">
              Certificate code: <span className="font-semibold text-emerald-100">{result.certCode}</span>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Link
              href="/student/exams"
              className="inline-flex min-h-11 min-w-11 items-center rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-100"
            >
              Back to Exams
            </Link>
            <Link
              href="/student/certifications"
              className="inline-flex min-h-11 min-w-11 items-center rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950"
            >
              View Certifications
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="ll-page min-h-screen px-4 py-8 text-slate-50">
      <div className="ll-shell max-w-4xl space-y-6">
        <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Exam Session</p>
              <h1 className="mt-2 text-2xl font-semibold text-white">{session?.title}</h1>
            </div>
            <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-100">
              <p className="text-xs uppercase tracking-[0.2em] text-amber-200">Time left</p>
              <p className="mt-1 text-lg font-semibold">{minutes}:{seconds.toString().padStart(2, "0")}</p>
            </div>
          </div>
          <div className="mt-4 h-2 rounded-full bg-white/10">
            <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-3 text-sm text-slate-200">
            Question {currentIndex + 1} of {session?.questions.length}
          </p>
        </div>

        {error ? (
          <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        {question ? (
          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/55 p-4">
              <p className="text-lg font-medium leading-8 text-slate-50">{question.prompt}</p>
            </div>
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
                  className={`w-full rounded-2xl border px-4 py-4 text-left text-base leading-7 ${
                    selectedAnswer === optionIndex
                      ? "border-emerald-300 bg-emerald-500/15 text-emerald-50 ring-2 ring-emerald-300/60"
                      : "border-white/10 bg-white/5 text-slate-100"
                  }`}
                  style={{ minHeight: "52px" }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span>{option}</span>
                    {selectedAnswer === optionIndex ? (
                      <span className="rounded-full bg-emerald-300 px-2 py-1 text-xs font-semibold text-slate-950">
                        Selected
                      </span>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-slate-200">
              {selectedAnswer >= 0 ? "Answer selected. Review once more, then continue." : "Choose one answer before moving on."}
            </div>
            <div className="flex flex-wrap justify-between gap-3">
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="ll-touch-target rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-100 disabled:opacity-40"
              >
                Previous
              </button>
              <div className="flex gap-3">
                {currentIndex < (session?.questions.length ?? 0) - 1 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentIndex((prev) =>
                        Math.min((session?.questions.length ?? 1) - 1, prev + 1)
                      )
                    }
                    className="ll-touch-target rounded-2xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950"
                  >
                    Next
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={!canSubmit || submitting}
                  onClick={() => setConfirmingSubmit(true)}
                  className="ll-touch-target rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Submit Exam"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      {confirmingSubmit ? (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-slate-950/80 px-4 py-6 sm:items-center">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <h2 className="text-xl font-semibold text-white">Submit exam?</h2>
            <p className="mt-3 text-sm leading-7 text-slate-200">
              You are about to submit your answers for grading. Check that every question is complete before you continue.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirmingSubmit(false)}
                className="ll-touch-target rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-100"
              >
                Review answers
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmingSubmit(false);
                  void submitExam();
                }}
                className="ll-touch-target rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950"
              >
                Confirm submit
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
