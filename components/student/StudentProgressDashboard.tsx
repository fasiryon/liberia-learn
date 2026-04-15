"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SubjectProgressSummary = {
  subject: string;
  label: string;
  completedLessons: number;
  totalLessons: number;
  completionPercent: number;
  latestDerivedScore: number | null;
  latestMasteryState: string | null;
};

type ProgressActivity = {
  id: string;
  type: "lesson_completed" | "quiz_submitted" | "certificate_awarded";
  title: string;
  subject: string;
  occurredAt: string;
  scorePercent?: number | null;
};

type StudentProgressSummary = {
  totalLessonsCompleted: number;
  totalLessonsAssigned: number;
  averageQuizScorePercent: number;
  currentStreakDays: number;
  overallCurriculumCompletionPercent: number;
  subjectProgress: SubjectProgressSummary[];
  recentActivity: ProgressActivity[];
};

const EMPTY_SUMMARY: StudentProgressSummary = {
  totalLessonsCompleted: 0,
  totalLessonsAssigned: 0,
  averageQuizScorePercent: 0,
  currentStreakDays: 0,
  overallCurriculumCompletionPercent: 0,
  subjectProgress: [],
  recentActivity: [],
};

function activityLabel(type: ProgressActivity["type"]) {
  switch (type) {
    case "lesson_completed":
      return "Lesson";
    case "quiz_submitted":
      return "Quiz";
    case "certificate_awarded":
      return "Certificate";
    default:
      return "Activity";
  }
}

export default function StudentProgressDashboard() {
  const [summary, setSummary] = useState<StudentProgressSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/student/progress", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(data?.error ?? "Failed to load progress.");
        }

        setSummary({
          ...EMPTY_SUMMARY,
          ...data,
          subjectProgress: Array.isArray(data?.subjectProgress) ? data.subjectProgress : [],
          recentActivity: Array.isArray(data?.recentActivity) ? data.recentActivity : [],
        });
      })
      .catch((loadError: Error) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-white">My Progress</h1>
            <p className="mt-2 text-sm text-slate-400">
              Track lesson completion, quiz performance, streaks, and subject mastery.
            </p>
          </div>
          <Link
            href="/student/certificates"
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/10 px-5 py-3 text-sm font-semibold text-emerald-100 transition-colors hover:bg-emerald-400/20"
          >
            View Certificates
          </Link>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-28 animate-pulse rounded-[1.75rem] border border-white/10 bg-slate-900/70"
              />
            ))}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-[1.75rem] border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {!loading && !error ? (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[1.75rem] border border-white/10 bg-slate-900/80 p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Lessons Completed
                </p>
                <p className="mt-3 text-3xl font-semibold text-white">
                  {summary.totalLessonsCompleted}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  of {summary.totalLessonsAssigned} assigned lessons
                </p>
              </div>

              <div className="rounded-[1.75rem] border border-white/10 bg-slate-900/80 p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Average Quiz Score
                </p>
                <p className="mt-3 text-3xl font-semibold text-cyan-300">
                  {summary.averageQuizScorePercent}%
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  Based on lesson quiz attempts
                </p>
              </div>

              <div className="rounded-[1.75rem] border border-white/10 bg-slate-900/80 p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Current Streak
                </p>
                <p className="mt-3 text-3xl font-semibold text-amber-300">
                  {summary.currentStreakDays}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  Consecutive active days
                </p>
              </div>

              <div className="rounded-[1.75rem] border border-white/10 bg-slate-900/80 p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Curriculum Completion
                </p>
                <p className="mt-3 text-3xl font-semibold text-emerald-300">
                  {summary.overallCurriculumCompletionPercent}%
                </p>
                <div className="mt-4 h-2 rounded-full bg-slate-800">
                  <div
                    className="h-2 rounded-full bg-emerald-400"
                    style={{ width: `${summary.overallCurriculumCompletionPercent}%` }}
                  />
                </div>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
              <div className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Subject Progress</h2>
                    <p className="mt-1 text-sm text-slate-400">
                      Lesson completion and latest derived mastery signal by subject.
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  {summary.subjectProgress.length === 0 ? (
                    <p className="text-sm text-slate-400">No lesson progress yet.</p>
                  ) : (
                    summary.subjectProgress.map((subject) => (
                      <article
                        key={subject.subject}
                        className="rounded-[1.5rem] border border-white/10 bg-slate-950/70 p-4"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <h3 className="text-base font-semibold text-white">
                              {subject.label}
                            </h3>
                            <p className="mt-1 text-sm text-slate-400">
                              {subject.completedLessons} of {subject.totalLessons} lessons completed
                            </p>
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="text-sm font-semibold text-emerald-300">
                              {subject.completionPercent}%
                            </p>
                            <p className="text-xs text-slate-500">
                              {subject.latestMasteryState
                                ? `Mastery: ${subject.latestMasteryState.replace(/_/g, " ")}`
                                : "Mastery pending"}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 h-3 rounded-full bg-slate-800">
                          <div
                            className="h-3 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400"
                            style={{ width: `${subject.completionPercent}%` }}
                          />
                        </div>

                        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">
                          <span>Completion: {subject.completionPercent}%</span>
                          <span>
                            Derived score:{" "}
                            {subject.latestDerivedScore != null
                              ? `${subject.latestDerivedScore}%`
                              : "Not available"}
                          </span>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-5 sm:p-6">
                <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Your latest 10 lesson, quiz, and certificate actions.
                </p>

                <div className="mt-5 space-y-3">
                  {summary.recentActivity.length === 0 ? (
                    <p className="text-sm text-slate-400">No recent activity yet.</p>
                  ) : (
                    summary.recentActivity.map((activity) => (
                      <article
                        key={activity.id}
                        className="rounded-[1.5rem] border border-white/10 bg-slate-950/70 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                              {activityLabel(activity.type)}
                            </p>
                            <p className="mt-1 text-sm font-medium text-white">
                              {activity.title}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                              {activity.subject.replace(/_/g, " ")}
                              {activity.scorePercent != null
                                ? ` · Score ${activity.scorePercent}%`
                                : ""}
                            </p>
                          </div>
                          <p className="text-xs text-slate-500">
                            {new Date(activity.occurredAt).toLocaleString()}
                          </p>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
