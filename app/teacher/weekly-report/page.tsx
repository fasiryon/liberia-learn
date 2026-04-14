"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ClassSummary = {
  classId: string;
  className: string;
  lessonCount: number;
  lessonCompletionRate: number;
  assignmentSubmissionRate: number;
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
  const color = value >= 70 ? "bg-emerald-500" : value >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 rounded-full bg-slate-800">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-slate-300">{value}%</span>
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
    <div className="min-h-screen bg-slate-950 text-slate-50 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <Link href="/teacher/dashboard" className="text-sm text-emerald-300 hover:text-emerald-200">
            &larr; Dashboard
          </Link>
          <h1 className="mt-3 text-2xl font-bold">Weekly Class Report</h1>
          {report && (
            <p className="mt-1 text-sm text-slate-400">
              {formatDate(report.weekStart)} – {formatDate(report.weekEnd)}
            </p>
          )}
        </div>

        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-800/50" />
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
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-center">
                <p className="text-2xl font-bold text-emerald-400">{report.overallCompletionRate}%</p>
                <p className="mt-1 text-xs text-slate-400">Completion Rate</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-center">
                <p className="text-2xl font-bold text-slate-200">{report.totalLessons}</p>
                <p className="mt-1 text-xs text-slate-400">Lessons Scheduled</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-center">
                <p className="text-2xl font-bold text-amber-400">{report.totalAbsences}</p>
                <p className="mt-1 text-xs text-slate-400">Absences</p>
              </div>
            </div>

            {/* Per-class cards */}
            {report.classes.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 text-center text-sm text-slate-400">
                No classes found for this week.
              </div>
            ) : (
              <div className="space-y-4">
                {report.classes.map((cls) => (
                  <div
                    key={cls.classId}
                    className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <h2 className="font-semibold text-slate-100">{cls.className}</h2>
                      <span className="text-xs text-slate-500">{cls.enrolledStudentCount} students</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Lesson Completion</p>
                        <RateBar value={cls.lessonCompletionRate} />
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Assignment Submission</p>
                        <RateBar value={cls.assignmentSubmissionRate} />
                      </div>
                    </div>

                    <div className="flex gap-4 text-xs">
                      <span className="text-slate-400">
                        <span className="text-slate-200 font-medium">{cls.lessonCount}</span> lessons
                      </span>
                      <span className="text-slate-400">
                        <span className="text-amber-300 font-medium">{cls.absencesThisWeek}</span> absences
                      </span>
                      {cls.atRiskStudentCount > 0 && (
                        <span className="text-slate-400">
                          <span className="text-red-400 font-medium">{cls.atRiskStudentCount}</span> at-risk
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="text-center text-[11px] text-slate-600">
              Generated {new Date(report.generatedAt).toLocaleTimeString()}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
