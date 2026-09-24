"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import WhatsAppShareButton from "@/components/student/WhatsAppShareButton";
import { saveOfflineQuizAttempt } from "@/lib/offline-quiz-attempts";
import { newClientAttemptId as newAttemptId } from "@/lib/offline/attemptId";
import { loadQuizDraft, removeQuizDraft, saveQuizDraft } from "@/lib/offline/quizDraft";

type LessonQuizQuestion = {
  id: string;
  question: string;
  options: string[];
};

type LessonQuizResult = {
  attemptId: string;
  score: number;
  scorePercent: number;
  correctCount: number;
  totalQuestions: number;
  explanations: Array<{
    questionId: string;
    question: string;
    explanation: string;
    correctIndex: number;
    selectedIndex: number | null;
    options: string[];
  }>;
  gapAnalysis: {
    missedConcepts: Array<{
      concept: string;
      explanation: string;
      rereadSuggestion: string;
    }>;
    closingMessage: string;
  } | null;
  gapAnalysisError: string | null;
  congratulatoryMessage: string | null;
  /** Saved offline: no score exists until the server reviews the attempt. */
  pendingReview?: boolean;
  certificates?: {
    lessonAwarded: boolean;
    subjectAwarded: boolean;
    lessonCertificateId?: string;
  };
};

type LessonQuiz = {
  quizId: string;
  questions: LessonQuizQuestion[];
};


export function LessonQuizPanel({
  lessonId,
  lessonStatus,
  contentId,
  contentVersion,
  contentHash,
}: {
  lessonId: string;
  lessonStatus: "not_started" | "in_progress" | "completed";
  contentId?: string;
  contentVersion?: string | null;
  contentHash?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<LessonQuiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<LessonQuizResult | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  // One ID per attempt, persisted with the draft. The online submit and the
  // offline outbox both use it, so a lost response followed by an offline
  // save (or a retry after restart) cannot record the attempt twice.
  const [attemptId, setAttemptId] = useState<string | null>(null);

  const allAnswered = useMemo(() => {
    if (!quiz) {
      return false;
    }
    return quiz.questions.every((question) => Number.isInteger(answers[question.id]));
  }, [answers, quiz]);

  useEffect(() => {
    void loadQuizDraft<LessonQuiz & { answers?: Record<string, number>; startedAt?: string; attemptId?: string }>(lessonId).then((draft) => {
      if (!draft || !Array.isArray(draft.questions)) return;
      setQuiz({ quizId: draft.quizId, questions: draft.questions });
      setAnswers(draft.answers ?? {});
      setStartedAt(draft.startedAt ?? null);
      // A draft saved before attempt IDs existed gets one now, persisted
      // immediately so a reopened page resubmits under the same ID.
      const restoredAttemptId = draft.attemptId ?? newAttemptId();
      setAttemptId(restoredAttemptId);
      if (!draft.attemptId) void saveQuizDraft(lessonId, { ...draft, attemptId: restoredAttemptId }).catch(() => {});
    }).catch(() => {});
  }, [lessonId]);

  async function handleGenerateQuiz() {
    try {
      setLoading(true);
      setError(null);
      setResult(null);
      const response = await fetch(`/api/student/lessons/${lessonId}/quiz`, {
        method: "POST",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to generate quiz.");
      }
      setQuiz(payload);
      setAnswers({});
      const nextStartedAt = new Date().toISOString();
      const nextAttemptId = newAttemptId();
      setStartedAt(nextStartedAt);
      setAttemptId(nextAttemptId);
      void saveQuizDraft(lessonId, { ...payload, answers: {}, startedAt: nextStartedAt, attemptId: nextAttemptId }).catch(() => {});
    } catch (quizError: any) {
      setError(quizError?.message ?? "Failed to generate quiz.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitQuiz() {
    if (!quiz) {
      return;
    }

    const currentAttemptId = attemptId ?? newAttemptId();
    if (!attemptId) setAttemptId(currentAttemptId);

    async function saveOfflineAttempt() {
      const submittedAt = new Date().toISOString();
      await saveOfflineQuizAttempt({
        id: currentAttemptId,
        contentId: contentId ?? lessonId,
        quizId: quiz.quizId,
        answers,
        submittedAt,
        contentVersion,
        contentHash,
      });
      await removeQuizDraft(lessonId).catch(() => {});
      // No local score: the device never grades. The attempt is evidence
      // for server-side review once it syncs.
      setResult({
        attemptId: currentAttemptId,
        score: 0,
        scorePercent: 0,
        correctCount: 0,
        totalQuestions: quiz.questions.length,
        explanations: [],
        gapAnalysis: null,
        gapAnalysisError: null,
        congratulatoryMessage: null,
        pendingReview: true,
      });
    }

    try {
      setSubmitting(true);
      setError(null);
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await saveOfflineAttempt();
        return;
      }
      let response: Response;
      try {
        response = await fetch(`/api/student/lessons/${lessonId}/quiz/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quizId: quiz.quizId,
            clientAttemptId: currentAttemptId,
            startedAt,
            answers: quiz.questions.map((question) => ({
              questionId: question.id,
              selectedIndex: answers[question.id],
            })),
          }),
        });
      } catch {
        // Connection dropped (including "lie-fi" where the browser still
        // reports online). The shared attempt ID makes this safe even if the
        // server received the request before the connection failed.
        await saveOfflineAttempt();
        return;
      }
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to submit quiz.");
      }
      setResult(payload);
      await removeQuizDraft(lessonId).catch(() => {});
    } catch (submitError: any) {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        try {
          await saveOfflineAttempt();
          return;
        } catch {
          setError("Your device could not save this attempt. Keep this page open and try again.");
        }
      } else {
        setError(submitError?.message ?? "Failed to submit quiz.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-5 sm:p-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ll-silver)]">
            Adaptive Assessment
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--ll-text)]">Test Yourself</h2>
          <p className="mt-2 text-sm text-[var(--ll-text)]">
            Generate a 5-question quiz from this lesson and see what to review next.
          </p>
        </div>
        <button
          type="button"
          onClick={handleGenerateQuiz}
          disabled={loading || lessonStatus === "not_started"}
          className="min-h-12 rounded-full bg-[var(--ll-silver-soft)] px-5 py-3 text-sm font-semibold text-[var(--ll-text-faint)] transition-colors hover:bg-[var(--ll-silver-soft)] disabled:cursor-not-allowed disabled:bg-[var(--ll-surface-muted)] disabled:text-[var(--ll-text-muted)]"
        >
          {loading ? "Building Quiz..." : "Test Yourself"}
        </button>
      </div>

      {lessonStatus === "not_started" ? (
        <p className="mt-4 text-sm text-[var(--ll-text-muted)]">
          Start reading the lesson before generating your quiz.
        </p>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-[var(--ll-yellow-soft)] px-4 py-3 text-sm text-[var(--ll-yellow)]">
          {error}
        </div>
      ) : null}

      {quiz ? (
        <div className="mt-5 space-y-4">
          {quiz.questions.map((question, index) => (
            <article
              key={question.id}
              className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-4"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ll-text-muted)]">
                Question {index + 1}
              </p>
              <p className="mt-2 text-base leading-7 text-[var(--ll-text)]">{question.question}</p>
              <div className="mt-4 grid gap-3">
                {question.options.map((option, optionIndex) => {
                  const selected = answers[question.id] === optionIndex;
                  const answerResult = result?.explanations.find(
                    (entry) => entry.questionId === question.id
                  );
                  const showReview = Boolean(result);
                  const isCorrect = answerResult?.correctIndex === optionIndex;
                  const isIncorrectSelection =
                    answerResult?.selectedIndex === optionIndex &&
                    answerResult.selectedIndex !== answerResult.correctIndex;

                  return (
                    <button
                      key={`${question.id}-${optionIndex}`}
                      type="button"
                      disabled={Boolean(result)}
                      onClick={() => {
                        const nextAnswers = {
                          ...answers,
                          [question.id]: optionIndex,
                        };
                        setAnswers(nextAnswers);
                        const draftAttemptId = attemptId ?? newAttemptId();
                        if (!attemptId) setAttemptId(draftAttemptId);
                        // Every draft write keeps the attempt ID; dropping it would let a
                        // reopened page resubmit under a new ID and duplicate evidence.
                        void saveQuizDraft(lessonId, { ...quiz, answers: nextAnswers, startedAt, attemptId: draftAttemptId }).catch(() => {});
                      }}
                      className={`min-h-12 rounded-xl border px-4 py-3 text-left text-sm leading-6 transition-colors ${
                        showReview
                          ? isCorrect
                            ? "border-emerald-400/40 bg-[var(--ll-yellow)]/10 text-[var(--ll-yellow)]"
                            : isIncorrectSelection
                              ? "border-red-400/40 bg-red-500/10 text-red-100"
                              : "border-[var(--ll-border)] bg-[var(--ll-bg)] text-[var(--ll-text)]"
                          : selected
                            ? "border-cyan-400/40 bg-[var(--ll-silver-soft)] text-[var(--ll-silver)]"
                            : "border-[var(--ll-border)] bg-[var(--ll-bg)] text-[var(--ll-text)] hover:border-cyan-400/30"
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
              {result ? (
                <div className="mt-4 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 px-4 py-3 text-sm text-[var(--ll-text)]">
                  {
                    result.explanations.find((entry) => entry.questionId === question.id)
                      ?.explanation
                  }
                </div>
              ) : null}
            </article>
          ))}

          {!result ? (
            <button
              type="button"
              onClick={handleSubmitQuiz}
              disabled={submitting || !allAnswered}
              className="min-h-12 w-full rounded-full bg-[var(--ll-yellow-soft)] px-5 py-3 text-sm font-semibold text-[var(--ll-text-faint)] transition-colors hover:bg-[var(--ll-yellow-soft)] disabled:cursor-not-allowed disabled:bg-[var(--ll-surface-muted)] disabled:text-[var(--ll-text-muted)]"
            >
              {submitting ? "Checking Answers..." : "Submit Quiz"}
            </button>
          ) : null}
        </div>
      ) : null}

      {result ? (
        <div className="mt-5 space-y-4">
          {result.pendingReview ? (
            <div role="status" className="rounded-xl border border-amber-500/30 bg-[var(--ll-yellow-soft)] px-4 py-4 text-sm text-[var(--ll-text)]">
              Your answers are saved on this device. They have not been scored yet. They will be sent and checked when you are back online.
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-500/30 bg-[var(--ll-yellow)]/10 px-4 py-4 text-sm text-[var(--ll-text)]">
              Score {result.scorePercent}% ({result.correctCount}/{result.totalQuestions} correct)
            </div>
          )}

          {result.congratulatoryMessage ? (
            <div className="rounded-xl border border-cyan-400/30 bg-[var(--ll-silver-soft)] px-4 py-4 text-sm text-[var(--ll-silver)]">
              {result.congratulatoryMessage}
            </div>
          ) : null}

          {result.certificates?.lessonAwarded || result.certificates?.subjectAwarded ? (
            <div className="rounded-xl border border-emerald-400/30 bg-[var(--ll-yellow)]/10 px-4 py-4 text-sm text-[var(--ll-yellow)]">
              <p className="font-semibold text-[var(--ll-text)]">Certificate awarded</p>
              <p className="mt-2 leading-6">
                {result.certificates.lessonAwarded && result.certificates.subjectAwarded
                  ? "You earned both a lesson certificate and a subject certificate."
                  : result.certificates.lessonAwarded
                    ? "You earned a lesson certificate for this lesson."
                    : "You earned a subject certificate."}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Link
                  href="/student/certificates"
                  className="text-sm font-semibold text-[var(--ll-yellow)] underline underline-offset-4"
                >
                  View certificates
                </Link>
                {result.certificates.lessonCertificateId ? (
                  <WhatsAppShareButton certificateId={result.certificates.lessonCertificateId} />
                ) : null}
              </div>
            </div>
          ) : null}

          {result.gapAnalysis ? (
            <article className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 px-4 py-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--ll-silver)]">
                What To Review
              </h3>
              <div className="mt-3 space-y-3 text-sm text-[var(--ll-text)]">
                {result.gapAnalysis.missedConcepts.map((concept, index) => (
                  <div
                    key={`${concept.concept}-${index}`}
                    className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 px-4 py-3"
                  >
                    <p className="font-semibold text-[var(--ll-text)]">{concept.concept}</p>
                    <p className="mt-2 leading-6">{concept.explanation}</p>
                    <p className="mt-2 text-[var(--ll-silver)]">{concept.rereadSuggestion}</p>
                  </div>
                ))}
                <p className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 px-4 py-3 leading-6">
                  {result.gapAnalysis.closingMessage}
                </p>
              </div>
            </article>
          ) : null}

          {result.gapAnalysisError ? (
            <div className="rounded-xl border border-amber-500/30 bg-[var(--ll-yellow-soft)] px-4 py-4 text-sm text-[var(--ll-yellow)]">
              {result.gapAnalysisError}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
