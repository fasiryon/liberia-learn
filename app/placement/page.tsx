"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

// Server-authoritative placement: the server issues each item, keeps the
// answer key, scores the response, and derives the result. This page only
// renders items and sends the selected option index.

type PublicItem = {
  id: string;
  sequence: number;
  itemVersion: string;
  prompt: string;
  options: string[];
  subject: string;
  strand: string;
};

// The answer key never reaches the learner, even after answering.
type RespondedItem = PublicItem & {
  selectedIndex: number;
  isCorrect: boolean;
};

type SessionState = {
  sessionId: string;
  status: string;
  totalItems: number;
  answeredCount: number;
  currentItem: PublicItem | null;
  readyToComplete: boolean;
  placementId: string | null;
};

type CompletedResult = {
  placementId: string;
  correctAnswers: number;
  totalQuestions: number;
  levelLabel: string;
};

function newOperationId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `op-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

async function call<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(payload?.error ?? "Something went wrong. Please try again."), {
      code: payload?.code,
      status: response.status,
    });
  }
  return payload as T;
}

export default function PlacementPage() {
  const [session, setSession] = useState<SessionState | null>(null);
  const [item, setItem] = useState<PublicItem | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<RespondedItem | null>(null);
  const [result, setResult] = useState<CompletedResult | null>(null);
  const [busy, setBusy] = useState<"start" | "item" | "answer" | "finish" | null>("start");
  const [error, setError] = useState<string | null>(null);
  // One operation id per item attempt, reused on retry so a lost response
  // never records a second answer.
  const operationRef = useRef<{ itemId: string; id: string } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const loadNextItem = useCallback(async (sessionId: string) => {
    setBusy("item");
    setError(null);
    try {
      const { item: next } = await call<{ item: PublicItem }>(`/api/student/placement/sessions/${sessionId}/items`);
      setItem(next);
      setSelected(null);
      setFeedback(null);
      requestAnimationFrame(() => headingRef.current?.focus());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }, []);

  const start = useCallback(async () => {
    setBusy("start");
    setError(null);
    try {
      const state = await call<SessionState>("/api/student/placement/sessions");
      setSession(state);
      if (state.readyToComplete) {
        setItem(null);
      } else if (state.currentItem) {
        setItem(state.currentItem);
      } else {
        await loadNextItem(state.sessionId);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy((current) => (current === "start" ? null : current));
    }
  }, [loadNextItem]);

  useEffect(() => {
    void start();
  }, [start]);

  async function submitAnswer() {
    if (!session || !item || selected === null) return;
    if (!operationRef.current || operationRef.current.itemId !== item.id) {
      operationRef.current = { itemId: item.id, id: newOperationId() };
    }
    setBusy("answer");
    setError(null);
    try {
      const response = await call<{ item: RespondedItem; answeredCount: number; readyToComplete: boolean }>(
        `/api/student/placement/sessions/${session.sessionId}/responses`,
        { itemId: item.id, itemVersion: item.itemVersion, selectedIndex: selected, operationId: operationRef.current.id }
      );
      setFeedback(response.item);
      setSession({ ...session, answeredCount: response.answeredCount, readyToComplete: response.readyToComplete });
    } catch (err: any) {
      if (err.code === "session_expired") {
        setSession(null);
        setItem(null);
      }
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function finish() {
    if (!session) return;
    setBusy("finish");
    setError(null);
    try {
      const completed = await call<CompletedResult>(`/api/student/placement/sessions/${session.sessionId}/complete`);
      setResult(completed);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  const total = session?.totalItems ?? 10;
  const answered = session?.answeredCount ?? 0;

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ll-yellow)]">LiberiaLearn</p>
          <h1 className="mt-2 text-2xl font-semibold">Grade placement assessment</h1>
          {!result && (
            <div className="mt-4" aria-live="polite">
              <p className="text-sm text-[var(--ll-text-muted)]">
                {answered} of {total} answered
              </p>
              <div
                className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--ll-surface-muted)]"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={answered}
                aria-label="Placement progress"
              >
                <div className="h-full rounded-full bg-[var(--ll-yellow)]" style={{ width: `${(answered / total) * 100}%` }} />
              </div>
            </div>
          )}
        </header>

        {error && (
          <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => (session && !item && !session.readyToComplete ? loadNextItem(session.sessionId) : start())}
              className="mt-3 min-h-11 rounded-lg border border-red-400/40 px-4 text-sm"
            >
              Try again
            </button>
          </div>
        )}

        {result ? (
          <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-6">
            <h2 className="text-xl font-semibold">Assessment finished</h2>
            <p className="mt-3 text-sm text-[var(--ll-text-muted)]">
              You answered {result.correctAnswers} of {result.totalQuestions} correctly ({result.levelLabel}).
            </p>
            <p className="mt-3 text-sm text-[var(--ll-text)]">
              Your teacher will review your result, and your school will confirm your grade placement. Your grade does
              not change until then.
            </p>
            <Link href="/student/today" className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-[var(--ll-yellow)] px-5 text-sm font-semibold text-[var(--ll-bg)]">
              Back to today
            </Link>
          </section>
        ) : session?.readyToComplete && (!item || feedback) ? (
          <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-6">
            <h2 className="text-lg font-semibold">All questions answered</h2>
            <p className="mt-2 text-sm text-[var(--ll-text-muted)]">Submit to finish your placement assessment.</p>
            <button
              type="button"
              onClick={finish}
              disabled={busy !== null}
              aria-busy={busy === "finish"}
              className="mt-4 min-h-11 rounded-lg bg-[var(--ll-yellow)] px-5 text-sm font-semibold text-[var(--ll-bg)] disabled:opacity-60"
            >
              {busy === "finish" ? "Finishing..." : "Finish assessment"}
            </button>
          </section>
        ) : item ? (
          <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-6">
            <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">
              Question {item.sequence} of {total}
            </p>
            <h2 ref={headingRef} tabIndex={-1} className="mt-2 text-lg font-semibold outline-none">
              {item.prompt}
            </h2>
            <fieldset className="mt-4 space-y-2" disabled={feedback !== null || busy === "answer"}>
              <legend className="sr-only">Choose one answer</legend>
              {item.options.map((option, index) => {
                const chosen = selected === index;
                const showCorrect = feedback && chosen && feedback.isCorrect;
                const showWrong = feedback && chosen && !feedback.isCorrect;
                return (
                  <label
                    key={index}
                    className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-4 py-2 text-sm ${
                      showCorrect
                        ? "border-emerald-500/60 bg-emerald-500/10"
                        : showWrong
                          ? "border-red-500/60 bg-red-500/10"
                          : chosen
                            ? "border-[var(--ll-yellow)] bg-[var(--ll-yellow-soft)]"
                            : "border-[var(--ll-border)]"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`placement-${item.id}`}
                      value={index}
                      checked={chosen}
                      onChange={() => setSelected(index)}
                      className="h-4 w-4"
                    />
                    <span>{option}</span>
                  </label>
                );
              })}
            </fieldset>

            {feedback ? (
              <div className="mt-4 space-y-3" aria-live="polite">
                <p className="text-sm font-semibold">{feedback.isCorrect ? "Correct." : "Not quite."}</p>
                {!session?.readyToComplete && (
                  <button
                    type="button"
                    onClick={() => session && loadNextItem(session.sessionId)}
                    disabled={busy !== null}
                    className="min-h-11 rounded-lg bg-[var(--ll-yellow)] px-5 text-sm font-semibold text-[var(--ll-bg)] disabled:opacity-60"
                  >
                    {busy === "item" ? "Loading..." : "Next question"}
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={submitAnswer}
                disabled={selected === null || busy !== null}
                aria-busy={busy === "answer"}
                className="mt-4 min-h-11 rounded-lg bg-[var(--ll-yellow)] px-5 text-sm font-semibold text-[var(--ll-bg)] disabled:opacity-60"
              >
                {busy === "answer" ? "Saving..." : "Submit answer"}
              </button>
            )}
          </section>
        ) : (
          <div aria-busy="true" aria-label="Loading placement" className="h-48 animate-pulse rounded-xl bg-[var(--ll-surface)]" />
        )}
      </div>
    </main>
  );
}
