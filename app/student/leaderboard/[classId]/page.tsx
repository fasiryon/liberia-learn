"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type LeaderboardEntry = {
  studentId: string;
  firstName: string;
  score: number;
  lessonsCompleted: number;
  quizAvg: number;
  rank: number;
};

type LeaderboardData = {
  classId: string;
  weekStart: string;
  entries: LeaderboardEntry[];
  currentStudentId: string;
};

const MEDALS = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage({ params }: { params: { classId: string } }) {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [optingOut, setOptingOut] = useState(false);

  useEffect(() => {
    fetch(`/api/student/leaderboard/${params.classId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d as LeaderboardData);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [params.classId]);

  async function handleOptOut() {
    if (!confirm("Are you sure you want to opt out of the leaderboard? You can re-enable it later.")) return;
    setOptingOut(true);
    try {
      await fetch("/api/student/streak", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optOut: true }),
      });
      window.location.href = "/student/today";
    } catch {
      setOptingOut(false);
    }
  }

  const top3 = data?.entries.slice(0, 3) ?? [];
  const rest = data?.entries.slice(3) ?? [];
  const weekLabel = data?.weekStart
    ? `Week of ${new Date(data.weekStart).toLocaleDateString("en-LR", { month: "short", day: "numeric" })}`
    : "This Week";

  return (
    <main className="ll-dashboard-shell">
      <div className="ll-page-enter mx-auto max-w-3xl space-y-5 px-4 py-5">
        <Link href="/student/today" className="text-sm text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
          &larr; Back to Today
        </Link>

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--ll-yellow)]">
            {weekLabel}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--ll-text)]">Class Leaderboard</h1>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-[var(--ll-surface-muted)]" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">{error}</div>
        ) : data ? (
          <>
            {/* Podium */}
            {top3.length > 0 ? (
              <section className="grid gap-3 sm:grid-cols-3">
                {top3.map((entry, i) => (
                  <div
                    key={entry.studentId}
                    className={`rounded-2xl border p-4 text-center ${
                      entry.studentId === data.currentStudentId
                        ? "border-amber-400/40 bg-amber-400/10"
                        : "border-[var(--ll-border)] bg-[var(--ll-surface-muted)]"
                    }`}
                  >
                    <p className="text-3xl">{MEDALS[i]}</p>
                    <p className="mt-1 text-base font-semibold text-[var(--ll-text)]">{entry.firstName}</p>
                    <p className="mt-0.5 text-lg font-bold text-[var(--ll-yellow)]">{entry.score} pts</p>
                  </div>
                ))}
              </section>
            ) : null}

            {/* Full table */}
            {data.entries.length > 0 ? (
              <section className="ll-section overflow-x-auto p-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--ll-border)] text-xs text-[var(--ll-text-faint)]">
                      <th className="pb-2 text-left w-8">#</th>
                      <th className="pb-2 text-left">Name</th>
                      <th className="pb-2 text-right">Lessons</th>
                      <th className="pb-2 text-right">Quiz Avg</th>
                      <th className="pb-2 text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--ll-border)]">
                    {data.entries.map((entry) => (
                      <tr
                        key={entry.studentId}
                        className={entry.studentId === data.currentStudentId ? "border border-amber-400/30 rounded-xl" : ""}
                      >
                        <td className="py-2 text-[var(--ll-text-faint)]">{entry.rank}</td>
                        <td className={`py-2 font-semibold ${entry.studentId === data.currentStudentId ? "text-amber-400" : "text-[var(--ll-text)]"}`}>
                          {entry.firstName}
                          {entry.studentId === data.currentStudentId ? " (you)" : ""}
                        </td>
                        <td className="py-2 text-right text-[var(--ll-text-muted)]">{entry.lessonsCompleted}</td>
                        <td className="py-2 text-right text-[var(--ll-text-muted)]">{entry.quizAvg}%</td>
                        <td className="py-2 text-right font-semibold text-[var(--ll-yellow)]">{entry.score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ) : (
              <div className="rounded-xl border border-[var(--ll-border)] p-6 text-center text-sm text-[var(--ll-text-muted)]">
                No leaderboard data yet for this week.
              </div>
            )}

            <div className="text-center">
              <button
                type="button"
                onClick={handleOptOut}
                disabled={optingOut}
                className="text-xs text-[var(--ll-text-faint)] underline underline-offset-2 hover:text-[var(--ll-text-muted)]"
              >
                {optingOut ? "Opting out..." : "Opt out of leaderboard"}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
