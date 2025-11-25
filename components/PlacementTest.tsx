// components/PlacementTest.tsx
"use client";

import { useState } from "react";

type Track = "ELEMENTARY" | "MIDDLE" | "HIGH";

type Question = {
  id: string;
  text: string;
  options: string[];
  answer: string; // exact option value
  difficulty: number; // 1..3
};

const ELEMENTARY_QUESTIONS: Question[] = [
  {
    id: "e1",
    text: "What is 3 + 4?",
    options: ["5", "6", "7", "9"],
    answer: "7",
    difficulty: 1,
  },
  {
    id: "e2",
    text: "Which number is bigger?",
    options: ["12", "9", "7", "5"],
    answer: "12",
    difficulty: 1,
  },
  {
    id: "e3",
    text: "What is 9 - 3?",
    options: ["5", "6", "7", "9"],
    answer: "6",
    difficulty: 1,
  },
  {
    id: "e4",
    text: "What is half of 10?",
    options: ["2", "3", "4", "5"],
    answer: "5",
    difficulty: 2,
  },
  {
    id: "e5",
    text: "Which fraction is larger?",
    options: ["1/2", "1/4", "1/8", "1/10"],
    answer: "1/2",
    difficulty: 2,
  },
  {
    id: "e6",
    text: "What is 6 × 4?",
    options: ["20", "22", "24", "26"],
    answer: "24",
    difficulty: 2,
  },
  {
    id: "e7",
    text: "Solve: 35 + 27",
    options: ["62", "52", "57", "64"],
    answer: "62",
    difficulty: 3,
  },
  {
    id: "e8",
    text: "What is 81 ÷ 9?",
    options: ["7", "8", "9", "10"],
    answer: "9",
    difficulty: 3,
  },
  {
    id: "e9",
    text: "Which is the smallest number?",
    options: ["0.4", "0.09", "0.15", "0.5"],
    answer: "0.09",
    difficulty: 3,
  },
  {
    id: "e10",
    text: "A bag has 24 candies shared equally among 6 children. How many each?",
    options: ["3", "4", "5", "6"],
    answer: "4",
    difficulty: 3,
  },
];

const MIDDLE_QUESTIONS: Question[] = [
  {
    id: "m1",
    text: "What is 3/4 + 1/2?",
    options: ["1", "1 1/4", "1 1/2", "2"],
    answer: "1 1/4",
    difficulty: 1,
  },
  {
    id: "m2",
    text: "Solve: 7 × 8",
    options: ["54", "56", "58", "64"],
    answer: "56",
    difficulty: 1,
  },
  {
    id: "m3",
    text: "What is 25% of 80?",
    options: ["15", "18", "20", "25"],
    answer: "20",
    difficulty: 2,
  },
  {
    id: "m4",
    text: "Solve for x: 3x = 27",
    options: ["6", "7", "8", "9"],
    answer: "9",
    difficulty: 2,
  },
  {
    id: "m5",
    text: "Which is equivalent to 0.75?",
    options: ["1/2", "2/3", "3/4", "4/5"],
    answer: "3/4",
    difficulty: 2,
  },
  {
    id: "m6",
    text: "The area of a rectangle is 48. If the length is 8, what is the width?",
    options: ["4", "5", "6", "8"],
    answer: "6",
    difficulty: 3,
  },
  {
    id: "m7",
    text: "Solve: 2(x + 3) = 16",
    options: ["4", "5", "6", "7"],
    answer: "5",
    difficulty: 3,
  },
  {
    id: "m8",
    text: "What is 1.2 × 0.5?",
    options: ["0.5", "0.6", "0.7", "0.8"],
    answer: "0.6",
    difficulty: 3,
  },
];

const HIGH_QUESTIONS: Question[] = [
  {
    id: "h1",
    text: "Solve: 2x + 5 = 17",
    options: ["4", "5", "6", "7"],
    answer: "6",
    difficulty: 1,
  },
  {
    id: "h2",
    text: "Simplify: (x + 2)(x - 2)",
    options: ["x^2 + 4", "x^2 - 4", "x^2 - 2", "x^2 + 2"],
    answer: "x^2 - 4",
    difficulty: 1,
  },
  {
    id: "h3",
    text: "The line y = 2x + 1 has slope:",
    options: ["1", "2", "1/2", "0"],
    answer: "2",
    difficulty: 2,
  },
  {
    id: "h4",
    text: "Solve: x^2 = 81 (positive solution)",
    options: ["7", "8", "9", "10"],
    answer: "9",
    difficulty: 2,
  },
  {
    id: "h5",
    text: "What is 30% of 250?",
    options: ["50", "60", "70", "75"],
    answer: "75",
    difficulty: 2,
  },
  {
    id: "h6",
    text: "Solve: 3(x - 4) = 9",
    options: ["3", "4", "5", "6"],
    answer: "7",
    difficulty: 3,
  },
  {
    id: "h7",
    text: "Simplify: 5x - 2x + 7",
    options: ["3x + 7", "7x - 2", "5x + 5", "2x + 7"],
    answer: "3x + 7",
    difficulty: 3,
  },
  {
    id: "h8",
    text: "If a line is perpendicular to y = 2x, its slope is:",
    options: ["-1/2", "2", "-2", "1/2"],
    answer: "-1/2",
    difficulty: 3,
  },
];

const TRACK_CONFIG: Record<Track, Question[]> = {
  ELEMENTARY: ELEMENTARY_QUESTIONS,
  MIDDLE: MIDDLE_QUESTIONS,
  HIGH: HIGH_QUESTIONS,
};

function pickNextQuestion(
  pool: Question[],
  usedIds: Set<string>,
  targetDifficulty: number
): Question | null {
  const candidates = pool.filter(
    (q) => !usedIds.has(q.id) && q.difficulty === targetDifficulty
  );
  if (candidates.length === 0) {
    const remaining = pool.filter((q) => !usedIds.has(q.id));
    if (remaining.length === 0) return null;
    return remaining[0];
  }
  return candidates[0];
}

function mapScoreToGrade(track: Track, scorePercent: number): number {
  if (track === "ELEMENTARY") {
    if (scorePercent < 30) return 1;
    if (scorePercent < 50) return 2;
    if (scorePercent < 70) return 3;
    if (scorePercent < 85) return 4;
    return 5;
  }
  if (track === "MIDDLE") {
    if (scorePercent < 30) return 6;
    if (scorePercent < 50) return 6;
    if (scorePercent < 70) return 7;
    if (scorePercent < 85) return 8;
    return 8;
  }
  // HIGH
  if (scorePercent < 30) return 9;
  if (scorePercent < 50) return 9;
  if (scorePercent < 70) return 10;
  if (scorePercent < 85) return 11;
  return 12;
}

export function PlacementTest({ studentId }: { studentId: string }) {
  const [track, setTrack] = useState<Track | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [usedIds, setUsedIds] = useState<Set<string>>(new Set());
  const [answers, setAnswers] = useState<
    { questionId: string; selected: string; correct: boolean }[]
  >([]);
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [difficulty, setDifficulty] = useState<number>(2);
  const [step, setStep] = useState<"choose" | "exam" | "result">("choose");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    grade: number;
    score: number;
    track: Track;
  } | null>(null);
  const TOTAL_QUESTIONS = 10;

  const startTrack = (t: Track) => {
    const pool = TRACK_CONFIG[t];
    const first = pickNextQuestion(pool, new Set(), 2) ?? pool[0];
    setTrack(t);
    setCurrentQuestion(first);
    setUsedIds(new Set([first.id]));
    setAnswers([]);
    setSelectedOption("");
    setDifficulty(2);
    setStep("exam");
  };

  const handleNext = () => {
    if (!track || !currentQuestion || !selectedOption) return;

    const correct = selectedOption === currentQuestion.answer;

    const newAnswers = [
      ...answers,
      {
        questionId: currentQuestion.id,
        selected: selectedOption,
        correct,
      },
    ];
    setAnswers(newAnswers);
    setSelectedOption("");

    let newDifficulty = difficulty;
    if (correct && difficulty < 3) newDifficulty += 1;
    if (!correct && difficulty > 1) newDifficulty -= 1;
    setDifficulty(newDifficulty);

    const pool = TRACK_CONFIG[track];
    const newUsed = new Set(usedIds);
    newUsed.add(currentQuestion.id);
    setUsedIds(newUsed);

    if (newAnswers.length >= TOTAL_QUESTIONS) {
      finishTest(track, newAnswers, pool);
      return;
    }

    const nextQ = pickNextQuestion(pool, newUsed, newDifficulty);
    if (!nextQ) {
      finishTest(track, newAnswers, pool);
      return;
    }
    setCurrentQuestion(nextQ);
  };

  const finishTest = async (
    t: Track,
    answersList: { questionId: string; selected: string; correct: boolean }[],
    pool: Question[]
  ) => {
    const correctCount = answersList.filter((a) => a.correct).length;
    const scorePercent = Math.round(
      (correctCount / Math.max(answersList.length, 1)) * 100
    );
    const grade = mapScoreToGrade(t, scorePercent);

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/student/placement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          track: t,
          score: scorePercent,
          grade,
          answers: answersList,
          questions: pool,
        }),
      });

      if (!res.ok) {
        console.error("Placement API failed", await res.text());
      }
    } catch (err) {
      console.error("Placement API error", err);
    } finally {
      setIsSubmitting(false);
      setResult({ grade, score: scorePercent, track: t });
      setStep("result");
    }
  };

  if (step === "choose") {
    return (
      <section className="space-y-3">
        <p className="text-xs text-slate-400">
          Choose your current level. If you are not sure, start with Elementary.
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          <button
            onClick={() => startTrack("ELEMENTARY")}
            className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-left text-sm hover:border-emerald-500"
          >
            <p className="font-semibold text-slate-100">Elementary</p>
            <p className="text-xs text-slate-400">Covers Grade 1–5 topics.</p>
          </button>
          <button
            onClick={() => startTrack("MIDDLE")}
            className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-left text-sm hover:border-emerald-500"
          >
            <p className="font-semibold text-slate-100">Middle school</p>
            <p className="text-xs text-slate-400">Covers Grade 6–8 topics.</p>
          </button>
          <button
            onClick={() => startTrack("HIGH")}
            className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-left text-sm hover:border-emerald-500"
          >
            <p className="font-semibold text-slate-100">High school</p>
            <p className="text-xs text-slate-400">Covers Grade 9–12 topics.</p>
          </button>
        </div>
      </section>
    );
  }

  if (step === "exam" && track && currentQuestion) {
    const questionNumber = answers.length + 1;
    return (
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">
            {track === "ELEMENTARY"
              ? "Elementary level"
              : track === "MIDDLE"
              ? "Middle school level"
              : "High school level"}
          </p>
          <p className="text-xs text-slate-400">
            Question {questionNumber} of {TOTAL_QUESTIONS}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <p className="text-sm font-medium text-slate-100 mb-3">
            {currentQuestion.text}
          </p>
          <div className="space-y-2">
            {currentQuestion.options.map((opt) => (
              <label
                key={opt}
                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                  selectedOption === opt
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-slate-700 bg-slate-950/70 hover:border-slate-500"
                }`}
              >
                <input
                  type="radio"
                  name="option"
                  value={opt}
                  checked={selectedOption === opt}
                  onChange={(e) => setSelectedOption(e.target.value)}
                  className="h-3 w-3"
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleNext}
          disabled={!selectedOption}
          className="rounded-full bg-emerald-500 px-6 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
        >
          {questionNumber === TOTAL_QUESTIONS ? "Finish test" : "Next question"}
        </button>
      </section>
    );
  }

  if (step === "result" && result) {
    return (
      <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
        <p className="text-xs uppercase tracking-wide text-emerald-300">
          Placement result
        </p>
        <p className="text-lg font-semibold text-slate-50">
          Recommended starting grade:{" "}
          <span className="text-emerald-300">Grade {result.grade}</span>
        </p>
        <p className="text-sm text-slate-300">
          You scored <span className="font-semibold">{result.score}%</span> on
          the{" "}
          {result.track === "ELEMENTARY"
            ? "Elementary"
            : result.track === "MIDDLE"
            ? "Middle school"
            : "High school"}{" "}
          placement test.
        </p>
        <p className="text-xs text-slate-400">
          Your teachers and the system can use this result to place you into the
          right class. You can re-take the test later if needed.
        </p>

        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => {
            setStep("choose");
            setResult(null);
            setTrack(null);
            setCurrentQuestion(null);
            setUsedIds(new Set());
            setAnswers([]);
          }}
          className="rounded-full border border-slate-700 px-5 py-2 text-xs text-slate-200 hover:bg-slate-900"
        >
          Take again
        </button>
      </section>
    );
  }

  return null;
}
