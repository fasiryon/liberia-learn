"use client";

import { useEffect, useState } from "react";

type ProgressRecord = {
  id: string;
  title: string;
  subject: string;
  completedAt: string | null;
  startedAt: string | null;
};

export default function StudentProgressPage() {
  const [records, setRecords] = useState<ProgressRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/student/progress")
      .then((r) => r.json())
      .then((d) => setRecords(d.records || []))
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setUTCDate(weekStart.getUTCDate() - 7);

  const completedThisWeek = records.filter(
    (r) => r.completedAt && new Date(r.completedAt) >= weekStart
  );

  // Streak calculation (consecutive days with completions)
  const completedDays = new Set<string>();
  for (const r of records) {
    if (r.completedAt) {
      const d = new Date(r.completedAt);
      completedDays.add(d.toISOString().slice(0, 10));
    }
  }
  let streak = 0;
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  for (let i = 0; i < 365; i++) {
    const key = day.toISOString().slice(0, 10);
    if (completedDays.has(key)) streak++;
    else if (i > 0) break;
    day.setUTCDate(day.getUTCDate() - 1);
  }

  // Subject breakdown
  const bySubject: Record<string, { completed: number; total: number }> = {};
  for (const r of records) {
    if (!bySubject[r.subject]) bySubject[r.subject] = { completed: 0, total: 0 };
    bySubject[r.subject].total++;
    if (r.completedAt) bySubject[r.subject].completed++;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Progress</h1>
        <p className="text-sm text-slate-400 mt-1">Track your learning journey</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-2xl bg-slate-800/50 animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-center">
              <p className="text-2xl font-bold text-emerald-400">{completedThisWeek.length}</p>
              <p className="text-xs text-slate-400">Completed this week</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-center">
              <p className="text-2xl font-bold text-amber-400">{records.length}</p>
              <p className="text-xs text-slate-400">Total assigned</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-center">
              <p className="text-2xl font-bold text-violet-400">{streak}</p>
              <p className="text-xs text-slate-400">Day streak</p>
            </div>
          </div>

          {/* Subject breakdown */}
          {Object.keys(bySubject).length > 0 && (
            <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
              <h2 className="text-sm font-semibold text-slate-300 mb-3">By Subject</h2>
              <div className="space-y-3">
                {Object.entries(bySubject).map(([subject, data]) => {
                  const pct = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
                  return (
                    <div key={subject}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-300">{subject}</span>
                        <span className="text-slate-400">{data.completed}/{data.total} ({pct}%)</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-800">
                        <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Recent completions */}
          <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
            <h2 className="text-sm font-semibold text-slate-300 mb-3">Recent Completions</h2>
            {completedThisWeek.length === 0 ? (
              <p className="text-xs text-slate-500">No completions this week yet.</p>
            ) : (
              <div className="space-y-2">
                {completedThisWeek.slice(0, 10).map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-2">
                    <div>
                      <p className="text-sm text-slate-200">{r.title}</p>
                      <p className="text-xs text-slate-500">{r.subject}</p>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      {new Date(r.completedAt!).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

