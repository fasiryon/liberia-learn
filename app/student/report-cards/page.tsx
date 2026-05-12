"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SubjectGrade, AttendanceSummary } from "@/lib/reportCards/generateReportCard";

type ReportCardItem = {
  id: string;
  status: string;
  generatedAt: string;
  publishedAt: string | null;
  teacherComment: string | null;
  subjectGrades: SubjectGrade[];
  attendanceSummary: AttendanceSummary;
  term: {
    name: string;
    academicYear: { yearLabel: string };
  };
};

function gradeLetter(avg: number) {
  if (avg >= 90) return "A";
  if (avg >= 80) return "B";
  if (avg >= 70) return "C";
  if (avg >= 60) return "D";
  return "F";
}

export default function StudentReportCardsPage() {
  const [cards, setCards] = useState<ReportCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/student/report-cards", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setCards(d.reportCards ?? []);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <Link href="/dashboard" className="text-sm text-[var(--ll-yellow)]">
            &larr; Back to Dashboard
          </Link>
          <h1 className="mt-2 text-3xl font-semibold">My Report Cards</h1>
          <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
            Published report cards from your school.
          </p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-40 animate-pulse rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)]" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>
        ) : cards.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-8 text-center">
            <p className="text-sm text-[var(--ll-text-muted)]">No published report cards yet.</p>
            <p className="mt-1 text-xs text-[var(--ll-text-faint)]">Your school admin will publish them at the end of each term.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {cards.map((card) => {
              const grades = card.subjectGrades as SubjectGrade[];
              const att = card.attendanceSummary as AttendanceSummary;
              return (
                <div key={card.id} className="ll-card space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-[var(--ll-text)]">
                        {card.term.name}
                      </h2>
                      <p className="text-sm text-[var(--ll-text-muted)]">
                        Academic Year {card.term.academicYear.yearLabel}
                      </p>
                    </div>
                    <Link
                      href={`/student/report-cards/${card.id}/print`}
                      target="_blank"
                      className="shrink-0 min-h-9 rounded-full border border-[var(--ll-border)] px-4 text-xs font-semibold text-[var(--ll-text-muted)] hover:text-[var(--ll-text)] inline-flex items-center"
                    >
                      Print / Download
                    </Link>
                  </div>

                  {/* Subject grades */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--ll-border)]">
                          <th className="py-2 pr-4 text-left text-xs font-medium text-[var(--ll-text-muted)]">Subject</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-[var(--ll-text-muted)]">Assignments Avg</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-[var(--ll-text-muted)]">Exam</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-[var(--ll-text-muted)]">Mastery</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-[var(--ll-text-muted)]">Final</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grades.map((g) => (
                          <tr key={g.subject} className="border-b border-[var(--ll-border)] last:border-b-0">
                            <td className="py-2 pr-4 font-medium text-[var(--ll-text)]">
                              {g.subject.replace(/_/g, " ")}
                            </td>
                            <td className="px-3 py-2 text-center">{g.average}%</td>
                            <td className="px-3 py-2 text-center text-[var(--ll-text-muted)]">
                              {g.examScore != null ? `${g.examScore}%` : "—"}
                            </td>
                            <td className="px-3 py-2 text-center text-[var(--ll-text-muted)]">
                              {g.masteryScore != null ? `${g.masteryScore}%` : "—"}
                            </td>
                            <td className="px-3 py-2 text-center font-bold text-[var(--ll-accent)]">
                              {gradeLetter(g.average)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Attendance */}
                  <div className="rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 px-4 py-3">
                    <p className="text-xs font-medium text-[var(--ll-text-muted)] mb-1">Attendance</p>
                    <p className="text-sm text-[var(--ll-text)]">
                      {att.rate}% &mdash; Present {att.present} &middot; Absent {att.absent} &middot; Late {att.late}
                    </p>
                  </div>

                  {/* Teacher comment */}
                  {card.teacherComment ? (
                    <div className="rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 px-4 py-3">
                      <p className="text-xs font-medium text-[var(--ll-text-muted)] mb-1">Teacher Comment</p>
                      <p className="text-sm text-[var(--ll-text)]">{card.teacherComment}</p>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
