"use client";

import { useMemo, useState } from "react";

type LessonQuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
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
};

type LessonQuiz = {
  quizId: string;
  questions: LessonQuizQuestion[];
};

export function LessonQuizPanel({
  lessonId,
  lessonStatus,
}: {
  lessonId: string;
  lessonStatus: "not_started" | "in_progress" | "completed";
}) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<LessonQuiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<LessonQuizResult | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);

  const allAnswered = useMemo(() => {
    if (!quiz) {
      return false;
    }
    return quiz.questions.every((question) => Number.isInteger(answers[question.id]));
  }, [answers, quiz]);

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
      setStartedAt(new Date().toISOString());
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

    try {
      setSubmitting(true);
      setError(null);
      const response = await fetch(`/api/student/lessons/${lessonId}/quiz/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizId: quiz.quizId,
          startedAt,
          questions: quiz.questions,
          answers: quiz.questions.map((question) => ({
            questionId: question.id,
            selectedIndex: answers[question.id],
          })),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to submit quiz.");
      }
      setResult(payload);
    } catch (submitError: any) {
      setError(submitError?.message ?? "Failed to submit quiz.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
            Adaptive Assessment
          </p>
          <h2 className="mt-1 text-lg font-semibold text-white">Test Yourself</h2>
          <p className="mt-2 text-sm text-slate-300">
            Generate a 5-question quiz from this lesson and see what to review next.
          </p>
        </div>
        <button
          type="button"
          onClick={handleGenerateQuiz}
          disabled={loading || lessonStatus === "not_started"}
          className="min-h-12 rounded-full bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          {loading ? "Building Quiz..." : "Test Yourself"}
        </button>
      </div>

      {lessonStatus === "not_started" ? (
        <p className="mt-4 text-sm text-slate-400">
          Start reading the lesson before generating your quiz.
        </p>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {error}
        </div>
      ) : null}

      {quiz ? (
        <div className="mt-5 space-y-4">
          {quiz.questions.map((question, index) => (
            <article
              key={question.id}
              className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Question {index + 1}
              </p>
              <p className="mt-2 text-base leading-7 text-slate-50">{question.question}</p>
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
                      onClick={() =>
                        setAnswers((current) => ({
                          ...current,
                          [question.id]: optionIndex,
                        }))
                      }
                      className={`min-h-12 rounded-2xl border px-4 py-3 text-left text-sm leading-6 transition-colors ${
                        showReview
                          ? isCorrect
                            ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
                            : isIncorrectSelection
                              ? "border-red-400/40 bg-red-500/10 text-red-100"
                              : "border-slate-800 bg-slate-900 text-slate-200"
                          : selected
                            ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-100"
                            : "border-slate-800 bg-slate-900 text-slate-200 hover:border-cyan-400/30"
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
              {result ? (
                <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-slate-100">
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
              className="min-h-12 w-full rounded-full bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              {submitting ? "Checking Answers..." : "Submit Quiz"}
            </button>
          ) : null}
        </div>
      ) : null}

      {result ? (
        <div className="mt-5 space-y-4">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-sm text-slate-100">
            Score {result.scorePercent}% ({result.correctCount}/{result.totalQuestions} correct)
          </div>

          {result.congratulatoryMessage ? (
            <div className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-4 text-sm text-cyan-100">
              {result.congratulatoryMessage}
            </div>
          ) : null}

          {result.gapAnalysis ? (
            <article className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-300">
                What To Review
              </h3>
              <div className="mt-3 space-y-3 text-sm text-slate-100">
                {result.gapAnalysis.missedConcepts.map((concept, index) => (
                  <div
                    key={`${concept.concept}-${index}`}
                    className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3"
                  >
                    <p className="font-semibold text-white">{concept.concept}</p>
                    <p className="mt-2 leading-6">{concept.explanation}</p>
                    <p className="mt-2 text-cyan-200">{concept.rereadSuggestion}</p>
                  </div>
                ))}
                <p className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 leading-6">
                  {result.gapAnalysis.closingMessage}
                </p>
              </div>
            </article>
          ) : null}

          {result.gapAnalysisError ? (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm text-amber-100">
              {result.gapAnalysisError}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
