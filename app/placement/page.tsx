// app/placement/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";

interface Question {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: number;
}

interface Answer {
  questionId: string;
  difficulty: number;
  correct: boolean;
  timeSpent: number;
}

export default function PlacementTestPage() {
  const [testStarted, setTestStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [currentDifficulty, setCurrentDifficulty] = useState(3);
  const [loading, setLoading] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [testComplete, setTestComplete] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [startTime, setStartTime] = useState<number>(0);

  const MAX_QUESTIONS = 10;

  const startTest = () => {
    setTestStarted(true);
    setQuestionNumber(1);
    setAnswers([]);
    setTestComplete(false);
    setResults(null);
    generateQuestion(currentDifficulty);
  };

  const generateQuestion = async (difficulty: number) => {
    setLoading(true);
    setSelectedAnswer(null);
    setShowExplanation(false);
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

      if (!res.ok) {
        throw new Error("Failed to generate question");
      }

      const question: Question = await res.json();
      setCurrentQuestion(question);
    } catch (error) {
      console.error("Error generating question:", error);
      alert("Failed to generate question. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = () => {
    if (selectedAnswer === null || !currentQuestion) return;

    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    const isCorrect = selectedAnswer === currentQuestion.correctAnswer;

    const newAnswer: Answer = {
      questionId: `q${questionNumber}`,
      difficulty: currentQuestion.difficulty,
      correct: isCorrect,
      timeSpent,
    };

    setAnswers((prev) => [...prev, newAnswer]);
    setShowExplanation(true);

    // Adaptive difficulty
    let newDifficulty = currentDifficulty;
    if (isCorrect && currentDifficulty < 5) {
      newDifficulty = currentDifficulty + 1;
    } else if (!isCorrect && currentDifficulty > 1) {
      newDifficulty = currentDifficulty - 1;
    }
    setCurrentDifficulty(newDifficulty);
  };

  const calculateResults = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/placement/calculate-grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });

      if (!res.ok) throw new Error("Failed to calculate results");

      const data = await res.json();
      setResults(data);
      setTestComplete(true);
    } catch (error) {
      console.error("Error calculating results:", error);
      alert("Failed to calculate results. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const nextQuestion = async () => {
    if (questionNumber >= MAX_QUESTIONS) {
      await calculateResults();
    } else {
      setQuestionNumber((prev) => prev + 1);
      await generateQuestion(currentDifficulty);
    }
  };

  // ───────────────── Initial screen ─────────────────
  if (!testStarted) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-8">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500 text-2xl font-black text-slate-950 mb-4">
              L
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300 mb-2">
              LIBERIALEARN · PLACEMENT
            </p>
            <h1 className="text-3xl font-bold mb-3">Grade placement check</h1>
            <p className="text-slate-400">
              We use a short adaptive test to recommend the best starting grade
              for you.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 mb-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3">
              Current Placement
            </h2>
            <p className="text-lg mb-2">
              Recommended grade: <span className="font-bold">Not set yet</span>
            </p>
            <p className="text-sm text-slate-400">
              You haven't taken a placement test yet. Click the button below to
              start your adaptive test.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 mb-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3">
              Start Test
            </h2>
            <p className="text-slate-300 mb-4">
              We'll begin with easier questions and adjust difficulty based on
              your answers. It takes about 10 questions.
            </p>
            <button
              onClick={startTest}
              className="w-full rounded-xl bg-emerald-500 px-6 py-3 font-semibold text-slate-950 hover:bg-emerald-400 transition-colors"
            >
              Start AI Placement Test
            </button>
          </div>

          <Link
            href="/"
            className="block text-center text-sm text-slate-400 hover:text-emerald-300"
          >
            ← Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  // ───────────────── Results screen ─────────────────
  if (testComplete && results) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-8">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500 text-2xl font-black text-slate-950 mb-4">
              ✓
            </div>
            <h1 className="text-3xl font-bold mb-3">Test complete!</h1>
            <p className="text-slate-400">
              Here are your personalized placement results.
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-8 mb-6 text-center">
            <p className="text-sm text-emerald-300 mb-2">
              Recommended starting grade
            </p>
            <p className="text-6xl font-bold text-emerald-300 mb-3">
              Grade {results.recommendedGrade}
            </p>
            <p className="text-sm text-slate-400">
              Confidence: {results.confidence}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 text-center">
              <p className="text-xs text-slate-400 mb-1">Accuracy</p>
              <p className="text-2xl font-bold text-cyan-300">
                {results.accuracyRate}%
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 text-center">
              <p className="text-xs text-slate-400 mb-1">Questions</p>
              <p className="text-2xl font-bold text-blue-300">
                {results.correctAnswers}/{results.totalQuestions}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 mb-6 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Weighted accuracy:</span>
              <span className="font-semibold">
                {results.weightedAccuracy}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Average difficulty:</span>
              <span className="font-semibold">
                {results.details.averageDifficulty.toFixed(1)}/5
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Difficulty range:</span>
              <span className="font-semibold">
                {results.details.difficultyRange.min} -{" "}
                {results.details.difficultyRange.max}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <Link
              href="/"
              className="block w-full text-center rounded-xl bg-slate-800 px-6 py-3 font-semibold hover:bg-slate-700 transition-colors"
            >
              Return to dashboard
            </Link>
            <button
              onClick={startTest}
              className="block w-full text-center rounded-xl bg-emerald-500 px-6 py-3 font-semibold text-slate-950 hover:bg-emerald-400 transition-colors"
            >
              Retake placement test
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ───────────────── Question screen ─────────────────
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-400">
              Question {questionNumber} of {MAX_QUESTIONS}
            </p>
            <p className="text-sm text-slate-400">
              Difficulty: {currentDifficulty}/5
            </p>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${(questionNumber / MAX_QUESTIONS) * 100}%` }}
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-emerald-500 border-r-transparent mb-4" />
            <p className="text-slate-400">Generating next question...</p>
          </div>
        ) : currentQuestion ? (
          <>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 mb-6">
              <p className="text-xl font-semibold mb-6">
                {currentQuestion.question}
              </p>

              <div className="space-y-3">
                {currentQuestion.options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() =>
                      !showExplanation && setSelectedAnswer(index)
                    }
                    disabled={showExplanation}
                    className={`w-full text-left rounded-xl border-2 px-4 py-3 transition-all ${
                      showExplanation
                        ? index === currentQuestion.correctAnswer
                          ? "border-emerald-500 bg-emerald-500/20"
                          : index === selectedAnswer
                          ? "border-red-500 bg-red-500/20"
                          : "border-slate-800 bg-slate-900/50"
                        : selectedAnswer === index
                        ? "border-emerald-500 bg-emerald-500/10"
                        : "border-slate-700 hover:border-slate-600 bg-slate-900/50"
                    } ${showExplanation ? "cursor-not-allowed" : ""}`}
                  >
                    <span className="font-semibold mr-2">
                      {String.fromCharCode(65 + index)}.
                    </span>
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {showExplanation && (
              <div
                className={`rounded-2xl border p-6 mb-6 ${
                  selectedAnswer === currentQuestion.correctAnswer
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : "border-red-500/30 bg-red-500/10"
                }`}
              >
                <p className="font-semibold mb-2">
                  {selectedAnswer === currentQuestion.correctAnswer
                    ? "✓ Correct!"
                    : "✗ Incorrect"}
                </p>
                <p className="text-sm text-slate-300">
                  {currentQuestion.explanation}
                </p>
              </div>
            )}

            {!showExplanation ? (
              <button
                onClick={submitAnswer}
                disabled={selectedAnswer === null}
                className="w-full rounded-xl bg-emerald-500 px-6 py-3 font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Submit answer
              </button>
            ) : (
              <button
                onClick={nextQuestion}
                className="w-full rounded-xl bg-blue-500 px-6 py-3 font-semibold text-white hover:bg-blue-400 transition-colors"
              >
                {questionNumber >= MAX_QUESTIONS
                  ? "View results"
                  : "Next question →"}
              </button>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-slate-400">
              Something went wrong. Please refresh the page.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
