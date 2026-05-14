"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Question = {
  idx: number;
  text: string;
  correctRate: number | null;
  totalAnswered: number;
  mostCommonWrongAnswer: string | null;
};

type AnalyticsData = {
  lesson: { contentId: string; title: string | null; subject: string; grade: number };
  totalAttempts: number;
  avgScore: number | null;
  hardestQuestion: { idx: number; text: string; correctRate: number | null } | null;
  questions: Question[];
};

function correctRateColor(rate: number | null): string {
  if (rate === null) return "text-[var(--ll-text-muted)]";
  if (rate >= 0.8) return "text-emerald-400";
  if (rate >= 0.6) return "text-amber-400";
  return "text-red-400";
}

function correctRateBg(rate: number | null): string {
  if (rate === null) return "bg-[var(--ll-surface-muted)]";
  if (rate >= 0.8) return "bg-emerald-400/10";
  if (rate >= 0.6) return "bg-amber-400/10";
  return "bg-red-400/10";
}

export default function AssessmentAnalyticsPage({
  params,
}: {
  params: { contentId: string };
}) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/teacher/analytics/assessment/${params.contentId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d as AnalyticsData);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [params.contentId]);

  return (
    <main className="ll-dashboard-shell">
      <div className="ll-page-enter mx-auto max-w-5xl space-y-5 px-4 py-5">
        <Link href="/teacher/dashboard" className="text-sm text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
          &larr; Back to Dashboard
        </Link>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-[var(--ll-surface-muted)]" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">{error}</div>
        ) : data ? (
          <>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--ll-yellow)]">
                Assessment Analytics
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-[var(--ll-text)]">
                {data.lesson.title ?? data.lesson.contentId}
              </h1>
              <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
                {data.lesson.subject.replace(/_/g, " ")} &middot; Grade {data.lesson.grade}
              </p>
            </div>

            {/* Summary Bar */}
            <section className="grid gap-3 sm:grid-cols-3">
              <div className="ll-kpi">
                <p className="text-xs text-[var(--ll-text-faint)] uppercase tracking-wide">Total Attempts</p>
                <p className="mt-1 text-2xl font-bold text-[var(--ll-text)]">{data.totalAttempts}</p>
              </div>
              <div className="ll-kpi">
                <p className="text-xs text-[var(--ll-text-faint)] uppercase tracking-wide">Avg Score</p>
                <p className={`mt-1 text-2xl font-bold ${correctRateColor(data.avgScore != null ? data.avgScore / 100 : null)}`}>
                  {data.avgScore != null ? `${data.avgScore}%` : "—"}
                </p>
              </div>
              <div className="ll-kpi">
                <p className="text-xs text-[var(--ll-text-faint)] uppercase tracking-wide">Hardest Question</p>
                {data.hardestQuestion ? (
                  <>
                    <p className={`mt-1 text-2xl font-bold ${correctRateColor(data.hardestQuestion.correctRate)}`}>
                      Q{data.hardestQuestion.idx + 1}
                    </p>
                    <p className="mt-1 text-xs text-[var(--ll-text-muted)] line-clamp-1">{data.hardestQuestion.text}</p>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-[var(--ll-text-muted)]">No data yet</p>
                )}
              </div>
            </section>

            {/* Per-question table */}
            <section className="ll-section overflow-x-auto p-4">
              <h2 className="mb-3 text-base font-semibold text-[var(--ll-text)]">Per-Question Breakdown</h2>
              {data.questions.length === 0 ? (
                <p className="text-sm text-[var(--ll-text-muted)]">No question-level data recorded yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--ll-border)] text-xs text-[var(--ll-text-faint)]">
                      <th className="pb-2 text-left">Q#</th>
                      <th className="pb-2 text-left">Question</th>
                      <th className="pb-2 text-right">Correct Rate</th>
                      <th className="pb-2 text-right">Answered</th>
                      <th className="pb-2 text-left pl-4">Most Common Wrong Answer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--ll-border)]">
                    {data.questions.map((q) => (
                      <tr key={q.idx} className={`${correctRateBg(q.correctRate)} transition-colors`}>
                        <td className="py-2 pr-3 font-semibold text-[var(--ll-text-muted)]">Q{q.idx + 1}</td>
                        <td className="py-2 pr-4 text-[var(--ll-text)] max-w-[280px]">
                          <span title={q.text} className="block truncate">{q.text}</span>
                        </td>
                        <td className={`py-2 text-right font-semibold ${correctRateColor(q.correctRate)}`}>
                          {q.correctRate != null ? `${Math.round(q.correctRate * 100)}%` : "—"}
                        </td>
                        <td className="py-2 text-right text-[var(--ll-text-muted)]">{q.totalAnswered}</td>
                        <td className="py-2 pl-4 text-[var(--ll-text-muted)]">
                          {q.mostCommonWrongAnswer ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
