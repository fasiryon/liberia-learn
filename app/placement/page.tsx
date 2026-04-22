"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type PlacementBand = "foundational" | "developing" | "proficient" | "advanced";

type Question = {
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
};

type QuestionReview = Question & {
  questionId: string;
};

type Answer = {
  questionId: string;
  difficulty: number;
  correct: boolean;
  timeSpent: number;
  selectedAnswer: number;
};

type PlacementAnalysis = {
  overallNarrative: string;
  strengths: string[];
  areasForGrowth: string[];
  subjectBreakdown: Record<string, { score: number; label: string }>;
  teacherNote: string;
  confidenceExplanation: string;
  recommendedNextSteps: string[];
};

type PlacementResults = {
  recommendedGrade: number;
  band: PlacementBand;
  accuracyRate: number;
  weightedAccuracy: number;
  totalQuestions: number;
  correctAnswers: number;
  confidence: "high" | "medium" | "low";
  details: {
    averageDifficulty: number;
    difficultyRange: { min: number; max: number };
  };
  aiAnalysis: PlacementAnalysis;
};

const MAX_QUESTIONS = 10;

const bandLabelMap: Record<PlacementBand, string> = {
  foundational: "Foundational",
  developing: "Developing",
  proficient: "Proficient",
  advanced: "Advanced",
};

const bandStyles: Record<PlacementBand, { badge: string; panel: string; accent: string }> = {
  foundational: {
    badge: "bg-[var(--ll-yellow-soft)] text-[var(--ll-yellow)] border border-amber-400/30",
    panel: "border-amber-500/30 bg-[var(--ll-yellow-soft)]",
    accent: "text-[var(--ll-yellow)]",
  },
  developing: {
    badge: "bg-[var(--ll-silver-soft)] text-[var(--ll-silver)] border border-blue-400/30",
    panel: "border-blue-500/30 bg-[var(--ll-silver-soft)]",
    accent: "text-[var(--ll-silver)]",
  },
  proficient: {
    badge: "bg-green-500/15 text-green-200 border border-green-400/30",
    panel: "border-green-500/30 bg-green-500/10",
    accent: "text-green-300",
  },
  advanced: {
    badge: "bg-[var(--ll-yellow)]/15 text-[var(--ll-yellow)] border border-emerald-400/30",
    panel: "border-emerald-500/30 bg-[var(--ll-yellow)]/10",
    accent: "text-[var(--ll-yellow)]",
  },
};

function formatConfidence(confidence: PlacementResults["confidence"]) {
  return confidence.charAt(0).toUpperCase() + confidence.slice(1);
}

function getBandStyles(band: PlacementBand) {
  return bandStyles[band];
}

function getPlacementBand(rawScore: number, totalQuestions: number): PlacementBand {
  const scorePercent = totalQuestions > 0 ? (rawScore / totalQuestions) * 100 : 0;

  if (scorePercent <= 40) return "foundational";
  if (scorePercent <= 70) return "developing";
  if (scorePercent <= 85) return "proficient";
  return "advanced";
}

export default function PlacementTestPage() {
  const [testStarted, setTestStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [completedQuestions, setCompletedQuestions] = useState<QuestionReview[]>([]);
  const [currentDifficulty, setCurrentDifficulty] = useState(3);
  const [loadingStage, setLoadingStage] = useState<"question" | "results" | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [results, setResults] = useState<PlacementResults | null>(null);
  const [startTime, setStartTime] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showReveal, setShowReveal] = useState(false);
  const [showAllQuestions, setShowAllQuestions] = useState(false);

  useEffect(() => {
    if (!results) return;
    setShowReveal(true);
    const timer = window.setTimeout(() => setShowReveal(false), 2000);
    return () => window.clearTimeout(timer);
  }, [results]);

  const reviewQuestions = useMemo(
    () => completedQuestions.map((question, index) => ({ question, answer: answers[index] })),
    [answers, completedQuestions]
  );

  const startTest = () => {
    setTestStarted(true);
    setQuestionNumber(1);
    setAnswers([]);
    setCompletedQuestions([]);
    setCurrentDifficulty(3);
    setCurrentQuestion(null);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setResults(null);
    setShowAllQuestions(false);
    setErrorMessage(null);
    void generateQuestion(3);
  };

  const generateQuestion = async (difficulty: number) => {
    setLoadingStage("question");
    setSelectedAnswer(null);
    setShowExplanation(false);
    setErrorMessage(null);
    setStartTime(Date.now());

    try {
      const res = await fetch("/api/placement/generate-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          difficulty,
          subject: "mathematics",
          previousAnswers: answers,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof payload?.error === "string" ? payload.error : "Failed to generate question");
      }

      setCurrentQuestion(payload as Question);
    } catch (error: any) {
      setErrorMessage(error?.message ?? "Failed to generate a placement question.");
    } finally {
      setLoadingStage(null);
    }
  };

  const submitAnswer = () => {
    if (selectedAnswer === null || !currentQuestion) return;

    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    const isCorrect = selectedAnswer === currentQuestion.correctAnswer;
    const questionId = `q${questionNumber}`;

    setAnswers((prev) => [
      ...prev,
      {
        questionId,
        difficulty: currentQuestion.difficulty,
        correct: isCorrect,
        timeSpent,
        selectedAnswer,
      },
    ]);
    setCompletedQuestions((prev) => [...prev, { ...currentQuestion, questionId }]);
    setShowExplanation(true);

    let nextDifficulty = currentDifficulty;
    if (isCorrect && currentDifficulty < 5) nextDifficulty += 1;
    if (!isCorrect && currentDifficulty > 1) nextDifficulty -= 1;
    setCurrentDifficulty(nextDifficulty);
  };

  const calculateResults = async (finalAnswers: Answer[], finalQuestions: QuestionReview[]) => {
    setLoadingStage("results");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/placement/calculate-grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: finalAnswers,
          questions: finalQuestions.map((question) => ({
            question: question.question,
            options: question.options,
            difficulty: question.difficulty,
            strand: question.strand,
          })),
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof payload?.error === "string" ? payload.error : "Failed to calculate placement results");
      }

      const calculatedResults = payload as PlacementResults;
      const derivedBand = getPlacementBand(calculatedResults.correctAnswers, calculatedResults.totalQuestions);
      const saveRes = await fetch("/api/student/placement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          band: derivedBand,
          levelLabel: bandLabelMap[derivedBand],
          estimatedGrade: calculatedResults.recommendedGrade,
          rawScore: calculatedResults.correctAnswers,
          totalQuestions: calculatedResults.totalQuestions,
          details: calculatedResults.details,
          questions: finalQuestions.map((question) => ({
            questionId: question.questionId,
            question: question.question,
            options: question.options,
            correctAnswer: question.correctAnswer,
            explanation: question.explanation,
            difficulty: question.difficulty,
            subject: question.subject,
            strand: question.strand,
            moeStandard: question.moeStandard,
            whyThisQuestion: question.whyThisQuestion,
            commonMistake: question.commonMistake,
            hint: question.hint,
          })),
          answers: finalAnswers.map((answer) => ({
            questionId: answer.questionId,
            difficulty: answer.difficulty,
            correct: answer.correct,
            timeSpent: answer.timeSpent,
            selectedAnswer: answer.selectedAnswer,
          })),
          aiAnalysis: calculatedResults.aiAnalysis,
        }),
      });

      const savePayload = await saveRes.json().catch(() => ({}));
      if (!saveRes.ok) {
        throw new Error(typeof savePayload?.error === "string" ? savePayload.error : "Failed to save placement results");
      }

      setResults({
        ...calculatedResults,
        band: derivedBand,
      });
    } catch (error: any) {
      setErrorMessage(error?.message ?? "Failed to calculate placement results.");
    } finally {
      setLoadingStage(null);
    }
  };

  const nextQuestion = async () => {
    if (questionNumber >= MAX_QUESTIONS) {
      await calculateResults(answers, completedQuestions);
      return;
    }

    setQuestionNumber((prev) => prev + 1);
    await generateQuestion(currentDifficulty);
  };

  if (!testStarted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--ll-bg)] px-4 text-[var(--ll-text)]">
        <div className="w-full max-w-2xl">
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-xl bg-[var(--ll-yellow)] text-2xl font-black text-[var(--ll-text-faint)]">
              L
            </div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--ll-yellow)]">
              LIBERIALEARN · PLACEMENT
            </p>
            <h1 className="mb-3 text-3xl font-bold">Grade placement check</h1>
            <p className="text-[var(--ll-text-muted)]">
              We use a short adaptive mathematics test to recommend the best starting grade for you.
            </p>
          </div>

          <div className="mb-6 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--ll-text-muted)]">Current Placement</h2>
            <p className="mb-2 text-lg">
              Recommended grade: <span className="font-bold">Not set yet</span>
            </p>
            <p className="text-sm text-[var(--ll-text-muted)]">
              You have not taken a placement test yet. Start the assessment to receive an AI-supported recommendation.
            </p>
          </div>

          <div className="mb-6 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--ll-text-muted)]">Start Test</h2>
            <p className="mb-4 text-[var(--ll-text)]">
              The test adapts to your answers, takes around 10 questions, and gives your teacher a detailed review.
            </p>
            <button
              onClick={startTest}
              className="w-full rounded-xl bg-[var(--ll-yellow)] px-6 py-3 font-semibold text-[var(--ll-text-faint)] transition-colors hover:bg-[var(--ll-yellow-soft)]"
            >
              Start AI Placement Test
            </button>
          </div>

          <Link href="/" className="block text-center text-sm text-[var(--ll-text-muted)] hover:text-[var(--ll-yellow)]">
            ← Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  if (results) {
    const styles = getBandStyles(results.band);

    if (showReveal) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-[var(--ll-bg)] px-4 text-[var(--ll-text)]">
          <div className={`w-full max-w-2xl rounded-xl border p-10 text-center shadow-none ${styles.panel}`}>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-[var(--ll-text)]">Placement Result</p>
            <h1 className={`mb-4 text-4xl font-black sm:text-5xl ${styles.accent}`}>
              Grade {results.recommendedGrade} recommended
            </h1>
            <div className={`mx-auto mb-5 inline-flex rounded-full px-4 py-2 text-sm font-semibold ${styles.badge}`}>
              {bandLabelMap[results.band]}
            </div>
            <p className="mx-auto max-w-xl text-base leading-relaxed text-[var(--ll-text)]">
              {results.aiAnalysis.overallNarrative}
            </p>
          </div>
        </main>
      );
    }

    return (
      <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
        <div className="mx-auto w-full max-w-5xl space-y-6">
          <div className="text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--ll-yellow)]">Placement Complete</p>
            <h1 className="text-3xl font-bold">Your placement results</h1>
            <p className="mt-2 text-[var(--ll-text-muted)]">Review the recommendation, the reasoning, and what happens next.</p>
          </div>

          <section className={`rounded-xl border p-6 sm:p-8 ${styles.panel}`}>
            <h2 className="mb-5 text-lg font-semibold">Your Result</h2>
            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <div>
                <p className="text-sm text-[var(--ll-text)]">Grade recommendation</p>
                <p className={`mt-2 text-5xl font-black ${styles.accent}`}>Grade {results.recommendedGrade}</p>
                <div className={`mt-3 inline-flex rounded-full px-4 py-2 text-sm font-semibold ${styles.badge}`}>
                  {bandLabelMap[results.band]}
                </div>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[var(--ll-text)]">
                  {results.aiAnalysis.overallNarrative}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-4">
                  <p className="text-xs uppercase tracking-wide text-[var(--ll-text-muted)]">Accuracy</p>
                  <p className="mt-1 text-2xl font-bold">
                    {results.correctAnswers}/{results.totalQuestions} correct
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-4">
                  <p className="text-xs uppercase tracking-wide text-[var(--ll-text-muted)]">Weighted score</p>
                  <p className="mt-1 text-2xl font-bold">{results.weightedAccuracy}%</p>
                </div>
                <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-4 sm:col-span-2 lg:col-span-1">
                  <p className="text-xs uppercase tracking-wide text-[var(--ll-text-muted)]">Confidence</p>
                  <p className="mt-1 text-2xl font-bold">{formatConfidence(results.confidence)}</p>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--ll-text)]">
                    {results.aiAnalysis.confidenceExplanation}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-6">
            <h2 className="mb-4 text-lg font-semibold">What you did well</h2>
            {results.aiAnalysis.strengths.length === 0 ? (
              <p className="text-sm text-[var(--ll-text-muted)]">No strengths were recorded for this attempt.</p>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {results.aiAnalysis.strengths.map((strength) => (
                  <li key={strength} className="rounded-xl border border-green-500/20 bg-green-500/10 p-4 text-sm text-[var(--ll-text)]">
                    {strength}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-6">
            <h2 className="mb-4 text-lg font-semibold">Areas to grow</h2>
            {results.aiAnalysis.areasForGrowth.length === 0 ? (
              <p className="text-sm text-[var(--ll-text-muted)]">No growth areas were recorded for this attempt.</p>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {results.aiAnalysis.areasForGrowth.map((area) => (
                  <li key={area} className="rounded-xl border border-blue-500/20 bg-[var(--ll-silver-soft)] p-4 text-sm text-[var(--ll-text)]">
                    {area}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Question by question review</h2>
                <p className="text-sm text-[var(--ll-text-muted)]">The first three are expanded. You can show the rest below.</p>
              </div>
              {reviewQuestions.length > 3 ? (
                <button
                  onClick={() => setShowAllQuestions((prev) => !prev)}
                  className="rounded-xl border border-[var(--ll-border)] px-4 py-2 text-sm font-semibold text-[var(--ll-text)] hover:border-[var(--ll-border)]"
                >
                  {showAllQuestions ? "Show fewer questions" : "Show all questions"}
                </button>
              ) : null}
            </div>

            <div className="space-y-4">
              {reviewQuestions
                .filter((_, index) => index < 3 || showAllQuestions)
                .map(({ question, answer }, index) => {
                  const selectedIndex = answer?.selectedAnswer ?? null;
                  const isCorrect = answer?.correct ?? false;

                  return (
                    <article key={question.questionId} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-5">
                      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-[var(--ll-text-muted)]">
                        <span>Question {index + 1}</span>
                        <span>Difficulty {question.difficulty}/5</span>
                        <span>{question.strand}</span>
                        {question.moeStandard ? <span>{question.moeStandard}</span> : null}
                      </div>
                      <h3 className="text-lg font-semibold text-[var(--ll-text)]">{question.question}</h3>
                      <div className="mt-4 space-y-2">
                        {question.options.map((option, optionIndex) => {
                          const optionStyles =
                            optionIndex === question.correctAnswer
                              ? "border-green-500/40 bg-green-500/15 text-green-100"
                              : optionIndex === selectedIndex && !isCorrect
                              ? "border-red-500/40 bg-red-500/15 text-red-100"
                              : "border-[var(--ll-border)] bg-[var(--ll-bg)]/70 text-[var(--ll-text)]";

                          return (
                            <div key={`${question.questionId}-${optionIndex}`} className={`rounded-xl border px-4 py-3 text-sm ${optionStyles}`}>
                              <div className="flex items-start justify-between gap-3">
                                <span>
                                  <span className="mr-2 font-semibold">{String.fromCharCode(65 + optionIndex)}.</span>
                                  {option}
                                </span>
                                <span className="shrink-0 text-xs font-semibold uppercase tracking-wide">
                                  {optionIndex === question.correctAnswer
                                    ? "Correct"
                                    : optionIndex === selectedIndex
                                    ? "Your answer"
                                    : ""}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-4">
                          <p className="text-xs uppercase tracking-wide text-[var(--ll-text-muted)]">AI explanation</p>
                          <p className="mt-2 text-sm leading-relaxed text-[var(--ll-text)]">{question.explanation}</p>
                        </div>
                        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-4">
                          <p className="text-xs uppercase tracking-wide text-[var(--ll-text-muted)]">Common mistake</p>
                          <p className="mt-2 text-sm leading-relaxed text-[var(--ll-text)]">{question.commonMistake}</p>
                        </div>
                      </div>
                    </article>
                  );
                })}
            </div>
          </section>

          <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-6">
            <h2 className="mb-4 text-lg font-semibold">Next steps</h2>
            <ul className="space-y-3">
              {results.aiAnalysis.recommendedNextSteps.map((step) => (
                <li key={step} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-4 text-sm text-[var(--ll-text)]">
                  {step}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-[var(--ll-text)]">
              Your teacher will review these results and confirm your grade placement.
            </p>
          </section>

          <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-6">
            <h2 className="mb-4 text-lg font-semibold">What happens next</h2>
            <p className="text-sm leading-relaxed text-[var(--ll-text)]">
              Your teacher at your school will review your AI placement and either confirm it or adjust it based on what they know about you.
              You will be notified when your placement is confirmed.
            </p>
          </section>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/"
              className="w-full rounded-xl bg-[var(--ll-surface)] px-6 py-3 text-center font-semibold transition-colors hover:bg-[var(--ll-surface-muted)]"
            >
              Return to dashboard
            </Link>
            <button
              onClick={startTest}
              className="w-full rounded-xl bg-[var(--ll-yellow)] px-6 py-3 font-semibold text-[var(--ll-text-faint)] transition-colors hover:bg-[var(--ll-yellow-soft)]"
            >
              Retake placement test
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--ll-bg)] px-4 text-[var(--ll-text)]">
      <div className="w-full max-w-3xl">
        <div className="mb-8">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm text-[var(--ll-text-muted)]">
              Question {questionNumber} of {MAX_QUESTIONS}
            </p>
            <p className="text-sm text-[var(--ll-text-muted)]">Difficulty: {currentDifficulty}/5</p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--ll-surface)]">
            <div
              className="h-full bg-[var(--ll-yellow)] transition-all duration-300"
              style={{ width: `${(questionNumber / MAX_QUESTIONS) * 100}%` }}
            />
          </div>
        </div>

        {errorMessage ? (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-5">
            <h2 className="text-lg font-semibold text-red-200">Something went wrong</h2>
            <p className="mt-2 text-sm text-red-100">{errorMessage}</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() =>
                  loadingStage === "results" ? calculateResults(answers, completedQuestions) : generateQuestion(currentDifficulty)
                }
                className="rounded-xl bg-red-500 px-4 py-2 font-semibold text-[var(--ll-text)] hover:bg-red-400"
              >
                Try again
              </button>
              <button
                onClick={startTest}
                className="rounded-xl border border-[var(--ll-border)] px-4 py-2 font-semibold text-[var(--ll-text)] hover:border-[var(--ll-border)]"
              >
                Restart test
              </button>
            </div>
          </div>
        ) : null}

        {loadingStage === "question" ? (
          <div className="py-16 text-center">
            <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-emerald-500 border-r-transparent" />
            <p className="text-[var(--ll-text-muted)]">Generating your next question...</p>
          </div>
        ) : loadingStage === "results" ? (
          <div className="py-16 text-center">
            <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-emerald-500 border-r-transparent" />
            <p className="text-[var(--ll-text-muted)]">Analyzing your results and preparing the review...</p>
          </div>
        ) : currentQuestion ? (
          <>
            <div className="mb-6 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-6">
              <div className="mb-4 flex flex-wrap gap-2 text-xs uppercase tracking-wide text-[var(--ll-text-muted)]">
                <span>{currentQuestion.strand}</span>
                {currentQuestion.moeStandard ? <span>{currentQuestion.moeStandard}</span> : null}
                <span>Hint available after you answer</span>
              </div>
              <p className="text-xl font-semibold">{currentQuestion.question}</p>
              <div className="mt-6 space-y-3">
                {currentQuestion.options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => !showExplanation && setSelectedAnswer(index)}
                    disabled={showExplanation}
                    className={`w-full rounded-xl border-2 px-4 py-3 text-left transition-all ${
                      showExplanation
                        ? index === currentQuestion.correctAnswer
                          ? "border-emerald-500 bg-[var(--ll-yellow)]/20"
                          : index === selectedAnswer
                          ? "border-red-500 bg-red-500/20"
                          : "border-[var(--ll-border)] bg-[var(--ll-bg)]/50"
                        : selectedAnswer === index
                        ? "border-emerald-500 bg-[var(--ll-yellow)]/10"
                        : "border-[var(--ll-border)] bg-[var(--ll-bg)]/50 hover:border-[var(--ll-border)]"
                    } ${showExplanation ? "cursor-not-allowed" : ""}`}
                  >
                    <span className="mr-2 font-semibold">{String.fromCharCode(65 + index)}.</span>
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {showExplanation ? (
              <div className="mb-6 space-y-4">
                <div
                  className={`rounded-xl border p-6 ${
                    selectedAnswer === currentQuestion.correctAnswer
                      ? "border-emerald-500/30 bg-[var(--ll-yellow)]/10"
                      : "border-red-500/30 bg-red-500/10"
                  }`}
                >
                  <p className="mb-2 font-semibold">
                    {selectedAnswer === currentQuestion.correctAnswer ? "Correct" : "Incorrect"}
                  </p>
                  <p className="text-sm text-[var(--ll-text)]">{currentQuestion.explanation}</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-[var(--ll-text-muted)]">Common mistake</p>
                    <p className="mt-2 text-sm text-[var(--ll-text)]">{currentQuestion.commonMistake}</p>
                  </div>
                  <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-[var(--ll-text-muted)]">Hint</p>
                    <p className="mt-2 text-sm text-[var(--ll-text)]">{currentQuestion.hint}</p>
                  </div>
                </div>
              </div>
            ) : null}

            {!showExplanation ? (
              <button
                onClick={submitAnswer}
                disabled={selectedAnswer === null}
                className="w-full rounded-xl bg-[var(--ll-yellow)] px-6 py-3 font-semibold text-[var(--ll-text-faint)] transition-colors hover:bg-[var(--ll-yellow-soft)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Submit answer
              </button>
            ) : (
              <button
                onClick={nextQuestion}
                className="w-full rounded-xl bg-[var(--ll-silver-soft)] px-6 py-3 font-semibold text-[var(--ll-text)] transition-colors hover:bg-[var(--ll-silver-soft)]"
              >
                {questionNumber >= MAX_QUESTIONS ? "View results" : "Next question →"}
              </button>
            )}
          </>
        ) : (
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-8 text-center">
            <h2 className="text-lg font-semibold">No question loaded</h2>
            <p className="mt-2 text-sm text-[var(--ll-text-muted)]">Start the assessment again to continue.</p>
            <button
              onClick={startTest}
              className="mt-4 rounded-xl bg-[var(--ll-yellow)] px-6 py-3 font-semibold text-[var(--ll-text-faint)] transition-colors hover:bg-[var(--ll-yellow-soft)]"
            >
              Restart test
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
