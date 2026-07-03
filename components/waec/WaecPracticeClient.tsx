"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Clock3, ChevronLeft, CheckCircle2, XCircle, Loader2, GraduationCap } from "lucide-react";

type ClientQuestion = { id: string; topicId: string; topicName: string; prompt: string; options: string[] };
type Session = { subjectId: string; subjectName: string; questions: ClientQuestion[] };
type Result = {
  score: number; correct: number; total: number;
  topics: { topicId: string; topicName: string; correct: number; total: number }[];
  review: { id: string; prompt: string; options: string[]; correctIndex: number; chosen: number | null; explanation: string | null }[];
};

function fmt(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function WaecPracticeClient({ slug, subjectName }: { slug: string; subjectName: string }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [idx, setIdx] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/student/waec/${slug}/practice`, { cache: "no-store" })
      .then(async (r) => (r.ok ? r.json() : Promise.reject(await r.json().catch(() => ({})))))
      .then((s: Session) => { if (active) setSession(s); })
      .catch((e) => { if (active) setLoadError(e?.error ?? "Could not load practice questions."); });
    return () => { active = false; };
  }, [slug]);

  useEffect(() => {
    if (session && !result) {
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [session, result]);

  const total = session?.questions.length ?? 0;
  const answeredCount = Object.keys(answers).length;
  const targetSeconds = total * 90; // ~90s/question, WAEC-like pacing

  const submit = useCallback(async () => {
    if (!session) return;
    setSubmitting(true);
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      const res = await fetch(`/api/student/waec/${slug}/practice`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: session.questions.map((q) => ({ id: q.id, chosen: answers[q.id] ?? null })) }),
      });
      setResult(await res.json());
    } catch { setLoadError("Could not submit. Please try again."); }
    finally { setSubmitting(false); }
  }, [session, answers, slug]);

  if (loadError) {
    return (
      <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-6 text-center">
        <p className="text-sm text-[var(--ll-text-muted)]">{loadError}</p>
        <Link href={`/student/waec/${slug}`} className="mt-3 inline-block text-xs text-[var(--ll-yellow)]">← Back to {subjectName}</Link>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-10 text-sm text-[var(--ll-text-muted)]">
        <Loader2 className="h-4 w-4 animate-spin" /> Preparing WAEC-style questions…
      </div>
    );
  }

  if (result) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-[var(--ll-yellow)]/30 bg-[var(--ll-surface)] p-6 text-center">
          <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">Practice score</p>
          <p className="mt-1 text-4xl font-bold text-[var(--ll-text)]">{result.score}%</p>
          <p className="mt-1 text-sm text-[var(--ll-text-muted)]">{result.correct} of {result.total} correct · {fmt(seconds)}</p>
        </div>

        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
          <h3 className="mb-2 text-sm font-semibold text-[var(--ll-text)]">By topic</h3>
          <div className="flex flex-col gap-2">
            {result.topics.map((t) => (
              <div key={t.topicId} className="flex items-center justify-between text-sm">
                <span className="text-[var(--ll-text-muted)]">{t.topicName}</span>
                <span className="text-[var(--ll-text)]">{t.correct}/{t.total}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
          <h3 className="mb-3 text-sm font-semibold text-[var(--ll-text)]">Review</h3>
          <div className="flex flex-col gap-4">
            {result.review.map((q, i) => (
              <div key={q.id} className="text-sm">
                <p className="font-medium text-[var(--ll-text)]">{i + 1}. {q.prompt}</p>
                <div className="mt-2 flex flex-col gap-1">
                  {q.options.map((opt, oi) => {
                    const isCorrect = oi === q.correctIndex;
                    const isChosen = oi === q.chosen;
                    return (
                      <div key={oi} className={`flex items-center gap-2 rounded-md px-2 py-1 text-xs ${isCorrect ? "bg-emerald-500/10 text-emerald-300" : isChosen ? "bg-red-500/10 text-red-300" : "text-[var(--ll-text-muted)]"}`}>
                        {isCorrect ? <CheckCircle2 className="h-3.5 w-3.5" /> : isChosen ? <XCircle className="h-3.5 w-3.5" /> : <span className="h-3.5 w-3.5" />}
                        {opt}
                      </div>
                    );
                  })}
                </div>
                {q.explanation && <p className="mt-1 text-xs text-[var(--ll-text-faint)]">{q.explanation}</p>}
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <Link href={`/student/waec/${slug}`} className="rounded-lg border border-[var(--ll-border)] px-4 py-2 text-sm text-[var(--ll-text)]">Back to {subjectName}</Link>
          <button onClick={() => { setResult(null); setAnswers({}); setIdx(0); setSeconds(0); setSession(null); setLoadError(null); location.reload(); }} className="rounded-lg bg-[var(--ll-yellow)] px-4 py-2 text-sm font-semibold text-[var(--ll-text-faint)]">New session</button>
        </div>
      </div>
    );
  }

  const q = session.questions[idx];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--ll-text-muted)]">
          <GraduationCap className="h-4 w-4 text-[var(--ll-yellow)]" /> {subjectName} · Question {idx + 1} of {total}
        </span>
        <span className={`inline-flex items-center gap-1 text-xs ${seconds > targetSeconds ? "text-red-400" : "text-[var(--ll-text-muted)]"}`}>
          <Clock3 className="h-3.5 w-3.5" /> {fmt(seconds)}
        </span>
      </div>

      <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--ll-surface-muted)]">
        <div className="h-full rounded-full bg-[var(--ll-yellow)]" style={{ width: `${((idx + 1) / total) * 100}%` }} />
      </div>

      <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-5">
        <p className="text-[11px] uppercase tracking-wide text-[var(--ll-text-faint)]">{q.topicName}</p>
        <p className="mt-1 text-sm font-medium text-[var(--ll-text)]">{q.prompt}</p>
        <div className="mt-4 flex flex-col gap-2">
          {q.options.map((opt, oi) => {
            const chosen = answers[q.id] === oi;
            return (
              <button
                key={oi}
                onClick={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                className={`rounded-lg border px-3 py-2.5 text-left text-sm transition ${chosen ? "border-[var(--ll-yellow)] bg-[var(--ll-yellow)]/10 text-[var(--ll-text)]" : "border-[var(--ll-border)] text-[var(--ll-text-muted)] hover:border-[var(--ll-text-faint)]"}`}
              >
                <span className="mr-2 font-semibold text-[var(--ll-text-faint)]">{String.fromCharCode(65 + oi)}.</span>{opt}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0} className="rounded-lg border border-[var(--ll-border)] px-3 py-2 text-sm text-[var(--ll-text)] disabled:opacity-40">Previous</button>
        {idx < total - 1 ? (
          <button onClick={() => setIdx((i) => Math.min(total - 1, i + 1))} className="rounded-lg bg-[var(--ll-surface-muted)] px-4 py-2 text-sm font-medium text-[var(--ll-text)]">Next</button>
        ) : (
          <button onClick={submit} disabled={submitting || answeredCount === 0} className="inline-flex items-center gap-2 rounded-lg bg-[var(--ll-yellow)] px-4 py-2 text-sm font-semibold text-[var(--ll-text-faint)] disabled:opacity-50">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Submit ({answeredCount}/{total})
          </button>
        )}
      </div>
    </div>
  );
}
