"use client";

import { useEffect, useState } from "react";
import { TeacherNav } from "@/components/teacher/TeacherNav";
import Link from "next/link";

type LessonRow = {
  contentId: string;
  title: string | null;
  subject: string;
  grade: number;
  questions: number;
  flags: number;
};

type StudentRow = {
  studentId: string;
  name: string;
  questions: number;
  flags: number;
};

type Analytics = {
  totalQuestions: number;
  uniqueStudents: number;
  mostFlaggedLesson: string | null;
  lessonBreakdown: LessonRow[];
  studentBreakdown: StudentRow[];
};

export default function TutorAnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/teacher/tutor-analytics")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="ll-dashboard-shell px-4 py-5 ll-page-enter">
      <div className="mx-auto max-w-5xl space-y-6">
        <TeacherNav />
        <Link
          href="/teacher/dashboard"
          className="inline-flex items-center gap-1 text-sm text-[var(--ll-yellow)] hover:opacity-80"
        >
          ← Dashboard
        </Link>

        <div>
          <h1 className="text-2xl font-semibold text-[var(--ll-text)]">AI Tutor Insights</h1>
          <p className="mt-1 text-sm text-[var(--ll-text-muted)]">This week&apos;s tutor usage across your students</p>
        </div>

        {loading && (
          <div className="h-32 animate-pulse rounded-xl bg-[var(--ll-surface)]" />
        )}
        {error && (
          <div className="rounded-xl border border-[var(--ll-danger)]/30 bg-[var(--ll-danger)]/10 p-4 text-sm text-[var(--ll-danger)]">
            {error}
          </div>
        )}

        {data && (
          <>
            {/* Stat cards */}
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard label="Total questions asked" value={data.totalQuestions} />
              <StatCard label="Students who used the tutor" value={data.uniqueStudents} />
              <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ll-text-muted)]">
                  Most-flagged lesson
                </p>
                <p className="mt-2 text-lg font-semibold text-[var(--ll-text)] truncate">
                  {data.mostFlaggedLesson ?? "—"}
                </p>
              </div>
            </div>

            {/* Lesson breakdown */}
            <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-5">
              <h2 className="text-base font-semibold text-[var(--ll-text)]">
                Lessons students need most help with
              </h2>
              {data.lessonBreakdown.length === 0 ? (
                <p className="mt-4 text-sm text-[var(--ll-text-muted)]">No tutor usage this week.</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm text-[var(--ll-text)]">
                    <thead>
                      <tr className="border-b border-[var(--ll-border)] text-left text-xs font-semibold uppercase tracking-[0.15em] text-[var(--ll-text-muted)]">
                        <th className="pb-3 pr-4">Lesson</th>
                        <th className="pb-3 pr-4">Subject</th>
                        <th className="pb-3 pr-4">Grade</th>
                        <th className="pb-3 pr-4">Questions</th>
                        <th className="pb-3">Flags</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--ll-border)]">
                      {data.lessonBreakdown.map((row) => (
                        <tr key={row.contentId}>
                          <td className="py-3 pr-4 font-medium">{row.title ?? row.contentId}</td>
                          <td className="py-3 pr-4 text-[var(--ll-text-muted)]">{row.subject}</td>
                          <td className="py-3 pr-4 text-[var(--ll-text-muted)]">{row.grade}</td>
                          <td className="py-3 pr-4">{row.questions}</td>
                          <td className="py-3">
                            {row.flags > 0 ? (
                              <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-400">
                                {row.flags} 🚩
                              </span>
                            ) : (
                              <span className="text-[var(--ll-text-muted)]">0</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Student breakdown */}
            <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-5">
              <h2 className="text-base font-semibold text-[var(--ll-text)]">
                Students asking the most questions
              </h2>
              {data.studentBreakdown.length === 0 ? (
                <p className="mt-4 text-sm text-[var(--ll-text-muted)]">No tutor usage this week.</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm text-[var(--ll-text)]">
                    <thead>
                      <tr className="border-b border-[var(--ll-border)] text-left text-xs font-semibold uppercase tracking-[0.15em] text-[var(--ll-text-muted)]">
                        <th className="pb-3 pr-4">Student</th>
                        <th className="pb-3 pr-4">Questions this week</th>
                        <th className="pb-3">Flags</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--ll-border)]">
                      {data.studentBreakdown.map((row) => (
                        <tr key={row.studentId}>
                          <td className="py-3 pr-4">
                            <Link
                              href={`/teacher/students/${row.studentId}`}
                              className="font-medium text-[var(--ll-yellow)] hover:underline"
                            >
                              {row.name}
                            </Link>
                          </td>
                          <td className="py-3 pr-4">{row.questions}</td>
                          <td className="py-3">
                            {row.flags > 0 ? (
                              <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-400">
                                {row.flags} 🚩
                              </span>
                            ) : (
                              <span className="text-[var(--ll-text-muted)]">0</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ll-text-muted)]">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-[var(--ll-text)]">{value}</p>
    </div>
  );
}
