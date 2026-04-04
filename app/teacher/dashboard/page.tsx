"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { teacherWelcomeStorageKey } from "@/app/teacher/TeacherWelcomeGate";

type DashboardData = {
  scheduledToday: number;
  completionRateToday: number;
  assignmentsPendingGrading: number;
  labsPendingReview: number;
  adaptiveStats: {
    studentsWithGaps: number;
    totalGapsDetected: number;
    avgMasteryScore: number;
    topWeakStrands: string[];
  };
  todayLessons: Array<{
    id: string;
    title: string;
    className: string;
    teacherName: string;
    durationMinutes: number;
    status: string;
    startedCount: number;
    completedCount: number;
    averageExitTicketScore: number | null;
  }>;
  recentLessons: Array<{ contentId: string; title: string; status: string; createdAt: string }>;
  classesWithoutLesson: string[];
};

export default function TeacherDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const adaptiveEnabled = process.env.NEXT_PUBLIC_ENABLE_ADAPTIVE_ENGINE !== "false";

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(teacherWelcomeStorageKey, "true");
    }
    fetch("/api/teacher/dashboard")
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Teacher Dashboard</h1>
          <p className="mt-1 text-sm text-slate-300">
            {new Date().toLocaleDateString("en-LR", { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>

        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-2xl bg-slate-800/50 animate-pulse" />)}</div>
        ) : (
          <>
            {/* Alert banner */}
            {data?.classesWithoutLesson && data.classesWithoutLesson.length > 0 && (
              <div className="rounded-xl bg-amber-500/20 border border-amber-500/30 px-4 py-3 text-sm text-amber-300">
                {data.classesWithoutLesson.length} class(es) have no lesson scheduled for today: {data.classesWithoutLesson.join(", ")}
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-center">
                <p className="text-2xl font-bold text-emerald-400">{data?.scheduledToday || 0}</p>
                <p className="text-xs text-slate-400">Lessons scheduled today</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-center">
                <p className="text-2xl font-bold text-violet-400">{data?.completionRateToday || 0}%</p>
                <p className="text-xs text-slate-400">Completion rate today</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-center">
                <p className="text-2xl font-bold text-amber-400">{data?.assignmentsPendingGrading || 0}</p>
                <p className="text-xs text-slate-400">Assignments pending grading</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-center">
                <p className="text-2xl font-bold text-cyan-400">{data?.labsPendingReview || 0}</p>
                <p className="text-xs text-slate-400">Labs pending review</p>
              </div>
            </div>

            {adaptiveEnabled && (
              <section className="rounded-3xl border border-amber-400/20 bg-gradient-to-br from-amber-500/10 to-slate-900/80 p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-slate-100">Students Needing Extra Support</h2>
                    <p className="mt-1 text-sm text-slate-300">Use this section first when deciding who needs intervention today.</p>
                  </div>
                  <span className="text-xs text-emerald-300">Closed-loop mastery</span>
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-xl bg-slate-950/50 p-4">
                    <p className="text-2xl font-bold text-emerald-400">
                      {data?.adaptiveStats?.studentsWithGaps ?? 0}
                    </p>
                    <p className="text-sm text-slate-300">Students with gaps</p>
                  </div>
                  <div className="rounded-xl bg-slate-950/50 p-4">
                    <p className="text-2xl font-bold text-amber-300">
                      {data?.adaptiveStats?.totalGapsDetected ?? 0}
                    </p>
                    <p className="text-sm text-slate-300">Total gaps detected</p>
                  </div>
                  <div className="rounded-xl bg-slate-950/50 p-4">
                    <p className="text-2xl font-bold text-cyan-300">
                      {data?.adaptiveStats?.avgMasteryScore ?? 0}
                    </p>
                    <p className="text-sm text-slate-300">Average mastery score</p>
                  </div>
                  <div className="rounded-xl bg-slate-950/50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Top weak strands
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-slate-200">
                      {(data?.adaptiveStats?.topWeakStrands?.length ?? 0) === 0 ? (
                        <li className="text-slate-500">No adaptive attempts yet.</li>
                      ) : (
                        data?.adaptiveStats?.topWeakStrands?.map((strand) => (
                          <li key={strand}>{strand}</li>
                        ))
                      )}
                    </ul>
                  </div>
                </div>
              </section>
            )}

            {/* Quick actions */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <Link href="/teacher/create-lesson" className="ll-touch-target rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-center hover:border-emerald-500/30">
                <p className="text-sm font-semibold text-emerald-400">Create with AI</p>
              </Link>
              <Link href="/teacher/students" className="ll-touch-target rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-center hover:border-emerald-500/30">
                <p className="text-sm font-semibold text-violet-400">View Students</p>
              </Link>
              <Link href="/teacher/schedule" className="ll-touch-target rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-center hover:border-emerald-500/30">
                <p className="text-sm font-semibold text-amber-400">Schedule Work</p>
              </Link>
              <Link href="/teacher/curriculum" className="ll-touch-target rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-center hover:border-emerald-500/30">
                <p className="text-sm font-semibold text-sky-400">Curriculum</p>
              </Link>
              <Link href="/teacher/labs" className="ll-touch-target rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-center hover:border-emerald-500/30">
                <p className="text-sm font-semibold text-cyan-400">Review Labs</p>
              </Link>
              <Link href="/teacher/assignments" className="ll-touch-target rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-center hover:border-emerald-500/30">
                <p className="text-sm font-semibold text-amber-300">Grade Assignments</p>
              </Link>
            </div>

            <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-300">Today&apos;s Scheduled Lessons</h2>
                <Link href="/teacher/schedule" className="text-xs text-emerald-300 hover:text-emerald-200">
                  Open Schedule
                </Link>
              </div>
              {(!data?.todayLessons || data.todayLessons.length === 0) ? (
                <p className="text-xs text-slate-500">No lessons scheduled for today.</p>
              ) : (
                <div className="space-y-3">
                  {data.todayLessons.map((lesson) => (
                    <div key={lesson.id} className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-100">{lesson.title}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {lesson.className} · {lesson.teacherName} · {lesson.durationMinutes}-minute{" "}
                            {lesson.durationMinutes >= 90 ? "block" : "period"}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] ${
                            lesson.status === "delivered"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : "bg-amber-500/20 text-amber-300"
                          }`}
                        >
                          {lesson.status}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                        <div className="rounded-xl bg-slate-900/70 p-3">
                          <p className="text-lg font-semibold text-slate-100">{lesson.startedCount}</p>
                          <p className="text-[11px] text-slate-500">Started</p>
                        </div>
                        <div className="rounded-xl bg-slate-900/70 p-3">
                          <p className="text-lg font-semibold text-slate-100">{lesson.completedCount}</p>
                          <p className="text-[11px] text-slate-500">Completed</p>
                        </div>
                        <div className="rounded-xl bg-slate-900/70 p-3">
                          <p className="text-lg font-semibold text-slate-100">
                            {lesson.averageExitTicketScore ?? "—"}
                          </p>
                          <p className="text-[11px] text-slate-500">Avg exit ticket</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Recent lessons */}
            <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
              <h2 className="text-sm font-semibold text-slate-300 mb-3">Recent Published Lessons</h2>
              {(!data?.recentLessons || data.recentLessons.length === 0) ? (
                <p className="text-xs text-slate-500">No published lessons yet. Generate your first lesson!</p>
              ) : (
                <div className="space-y-2">
                  {data.recentLessons.slice(0, 5).map((l) => (
                    <div key={l.contentId} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-2">
                      <div>
                        <p className="text-sm text-slate-200">{l.title}</p>
                        <p className="text-xs text-slate-500">{new Date(l.createdAt).toLocaleDateString()}</p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${l.status === "APPROVED" ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"}`}>
                        {l.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
