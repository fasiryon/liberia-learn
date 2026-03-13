"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type DashboardData = {
  scheduledToday: number;
  completionRateToday: number;
  recentLessons: Array<{ contentId: string; title: string; status: string; createdAt: string }>;
  classesWithoutLesson: string[];
};

export default function TeacherDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
          <p className="text-sm text-slate-400 mt-1">
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
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-center">
                <p className="text-2xl font-bold text-emerald-400">{data?.scheduledToday || 0}</p>
                <p className="text-xs text-slate-400">Lessons scheduled today</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-center">
                <p className="text-2xl font-bold text-violet-400">{data?.completionRateToday || 0}%</p>
                <p className="text-xs text-slate-400">Completion rate today</p>
              </div>
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Link href="/teacher/create-lesson" className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-center hover:border-emerald-500/30">
                <p className="text-sm font-semibold text-emerald-400">Create with AI</p>
              </Link>
              <Link href="/teacher/students" className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-center hover:border-emerald-500/30">
                <p className="text-sm font-semibold text-violet-400">View Students</p>
              </Link>
              <Link href="/teacher/schedule" className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-center hover:border-emerald-500/30">
                <p className="text-sm font-semibold text-amber-400">Schedule Work</p>
              </Link>
              <Link href="/teacher/curriculum" className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-center hover:border-emerald-500/30">
                <p className="text-sm font-semibold text-sky-400">Curriculum</p>
              </Link>
            </div>

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
