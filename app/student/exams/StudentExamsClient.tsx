"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ExamItem = {
  id: string;
  title: string;
  subject: string;
  grade: number;
  questionCount: number;
  timeLimit: number;
};

export default function StudentExamsClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exams, setExams] = useState<ExamItem[]>([]);

  useEffect(() => {
    fetch("/api/student/exams", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load exams");
        setExams(data.exams ?? []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="ll-page min-h-screen px-4 py-8 text-slate-50">
      <div className="ll-shell max-w-4xl space-y-6">
        <Link href="/dashboard" className="text-sm text-emerald-300 hover:text-emerald-200">
          &larr; Back to Dashboard
        </Link>
        <div>
          <h1 className="text-3xl font-semibold">My Exams</h1>
          <p className="mt-2 text-sm text-slate-400">Published exams available for your grade.</p>
        </div>

        {loading ? <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 text-sm text-slate-400">Loading exams...</div> : null}
        {error ? <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-200">{error}</div> : null}
        {!loading && !error && exams.length === 0 ? (
          <div className="ll-empty rounded-3xl border border-white/10 bg-slate-900/70 p-8 text-center text-sm text-slate-400">
            No published exams are available yet.
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          {exams.map((exam) => (
            <div key={exam.id} className="rounded-3xl border border-white/10 bg-slate-900/70 p-5">
              <h2 className="text-lg font-semibold">{exam.title}</h2>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1">Grade {exam.grade}</span>
                <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1">{exam.subject}</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{exam.questionCount} questions</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{exam.timeLimit} min</span>
              </div>
              <Link
                href={`/student/exams/${exam.id}`}
                className="mt-5 inline-flex min-h-11 items-center rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
              >
                Start Exam
              </Link>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
