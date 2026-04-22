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
    <main className="ll-page min-h-screen px-4 py-8 text-[var(--ll-text)]">
      <div className="ll-shell max-w-4xl space-y-6">
        <Link href="/dashboard" className="text-sm text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
          &larr; Back to Dashboard
        </Link>
        <div>
          <h1 className="text-3xl font-semibold">My Exams</h1>
          <p className="mt-2 text-sm text-[var(--ll-text-muted)]">Published exams available for your grade.</p>
        </div>

        {loading ? <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6 text-sm text-[var(--ll-text-muted)]">Loading exams...</div> : null}
        {error ? <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-200">{error}</div> : null}
        {!loading && !error && exams.length === 0 ? (
          <div className="ll-empty rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-8 text-center text-sm text-[var(--ll-text-muted)]">
            No published exams are available yet.
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          {exams.map((exam) => (
            <div key={exam.id} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
              <h2 className="text-lg font-semibold">{exam.title}</h2>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--ll-text)]">
                <span className="rounded-full border border-emerald-400/30 bg-[var(--ll-yellow)]/10 px-3 py-1">Grade {exam.grade}</span>
                <span className="rounded-full border border-cyan-400/30 bg-[var(--ll-silver-soft)] px-3 py-1">{exam.subject}</span>
                <span className="rounded-full border border-[var(--ll-border)] bg-white/5 px-3 py-1">{exam.questionCount} questions</span>
                <span className="rounded-full border border-[var(--ll-border)] bg-white/5 px-3 py-1">{exam.timeLimit} min</span>
              </div>
              <Link
                href={`/student/exams/${exam.id}`}
                className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[var(--ll-yellow)] px-4 py-2 text-sm font-semibold text-[var(--ll-text-faint)] hover:bg-[var(--ll-yellow-soft)]"
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
