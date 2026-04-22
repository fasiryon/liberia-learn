"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ClassSummary = {
  classId: string;
  className: string;
  lessonCount: number;
  lessonCompletionRate: number;
  assignmentSubmissionRate: number;
  averageQuizScore: number | null;
  weakestLessonTitle: string | null;
  absencesThisWeek: number;
  atRiskStudentCount: number;
  enrolledStudentCount: number;
};

type WeeklyReport = {
  weekStart: string;
  weekEnd: string;
  generatedAt: string;
  classes: ClassSummary[];
  totalLessons: number;
  totalAbsences: number;
  overallCompletionRate: number;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-LR", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function RateBar({ value }: { value: number }) {
  const color = value >= 70 ? "bg-[var(--ll-yellow)]" : value >= 40 ? "bg-[var(--ll-yellow-soft)]" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 rounded-full bg-[var(--ll-surface)]">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-[var(--ll-text)]">{value}%</span>
    </div>
  );
}

export default function TeacherWeeklyReportPage() {
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/teacher/weekly-report")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load weekly report");
        return r.json();
      })
      .then(setReport)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)] px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <Link href="/teacher/dashboard" className="text-sm text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
            &larr; Dashboard
          </Link>
          <h1 className="mt-3 text-2xl font-bold">Weekly Class Report</h1>
          {report && (
            <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
              {formatDate(report.weekStart)} – {formatDate(report.weekEnd)}
            </p>
          )}
        </div>

        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-[var(--ll-surface)]/50" />
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {report && !loading && (
          <>
            {/* Summary row */}
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-4 text-center">
                <p className="text-2xl font-bold text-[var(--ll-yellow)]">{report.overallCompletionRate}%</p>
                <p className="mt-1 text-xs text-[var(--ll-text-muted)]">Completion Rate</p>
              </div>
              <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-4 text-center">
                <p className="text-2xl font-bold text-[var(--ll-text)]">{report.totalLessons}</p>
                <p className="mt-1 text-xs text-[var(--ll-text-muted)]">Lessons Scheduled</p>
              </div>
              <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-4 text-center">
                <p className="text-2xl font-bold text-[var(--ll-yellow)]">{report.totalAbsences}</p>
                <p className="mt-1 text-xs text-[var(--ll-text-muted)]">Absences</p>
              </div>
            </div>

            {/* Per-class cards */}
            {report.classes.length === 0 ? (
              <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6 text-center text-sm text-[var(--ll-text-muted)]">
                No classes found for this week.
              </div>
            ) : (
              <div className="space-y-4">
                {report.classes.map((cls) => (
                  <div
                    key={cls.classId}
                    className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <h2 className="font-semibold text-[var(--ll-text)]">{cls.className}</h2>
                      <span className="text-xs text-[var(--ll-text-faint)]">{cls.enrolledStudentCount} students</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-[var(--ll-text-muted)] mb-1">Lesson Completion</p>
                        <RateBar value={cls.lessonCompletionRate} />
                      </div>
                      <div>
                        <p className="text-xs text-[var(--ll-text-muted)] mb-1">Assignment Submission</p>
                        <RateBar value={cls.assignmentSubmissionRate} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-3">
                        <p className="text-xs text-[var(--ll-text-muted)]">Average quiz score</p>
                        <p className="mt-2 text-lg font-semibold text-[var(--ll-silver)]">
                          {cls.averageQuizScore == null ? "No data" : `${cls.averageQuizScore}%`}
                        </p>
                      </div>
                      <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-3">
                        <p className="text-xs text-[var(--ll-text-muted)]">Hardest lesson</p>
                        <p className="mt-2 text-sm font-medium text-[var(--ll-text)]">
                          {cls.weakestLessonTitle ?? "No lesson quiz data"}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4 text-xs">
                      <span className="text-[var(--ll-text-muted)]">
                        <span className="text-[var(--ll-text)] font-medium">{cls.lessonCount}</span> lessons
                      </span>
                      <span className="text-[var(--ll-text-muted)]">
                        <span className="text-[var(--ll-yellow)] font-medium">{cls.absencesThisWeek}</span> absences
                      </span>
                      {cls.atRiskStudentCount > 0 && (
                        <span className="text-[var(--ll-text-muted)]">
                          <span className="text-red-400 font-medium">{cls.atRiskStudentCount}</span> at-risk
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="text-center text-[11px] text-[var(--ll-text-faint)]">
              Generated {new Date(report.generatedAt).toLocaleTimeString()}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
