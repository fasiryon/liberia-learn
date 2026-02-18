"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type ProgressRecord = {
  id: string;
  title: string;
  subject: string;
  completedAt: string | null;
  startedAt: string | null;
  scheduledDate: string;
};

export default function TeacherStudentDetailPage() {
  const params = useParams();
  const studentId = params.studentId as string;
  const [student, setStudent] = useState<{ id: string; name: string; email: string } | null>(null);
  const [records, setRecords] = useState<ProgressRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/teacher/students/${studentId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else { setStudent(d.student); setRecords(d.records || []); }
      })
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl bg-slate-800/50 animate-pulse" />)}</div>;
  }

  if (error) {
    return <div className="rounded-2xl border border-red-500/20 bg-slate-900/70 p-8 text-center"><p className="text-red-400">{error}</p></div>;
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
        <a href="/teacher/students" className="text-xs text-emerald-400 hover:underline">&larr; Back to Students</a>
        <h1 className="text-2xl font-bold mt-2">{student?.name || "Student"}</h1>
        <p className="text-sm text-slate-400">{student?.email}</p>
      </div>

      {/* Subject breakdown */}
      <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Progress by Subject</h2>
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

      {/* All assigned work */}
      <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">All Assigned Work</h2>
        {records.length === 0 ? (
          <p className="text-xs text-slate-500">No work assigned yet.</p>
        ) : (
          <div className="space-y-2">
            {records.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-2">
                <div>
                  <p className="text-sm text-slate-200">{r.title}</p>
                  <p className="text-xs text-slate-500">{r.subject} &middot; {new Date(r.scheduledDate).toLocaleDateString()}</p>
                </div>
                {r.completedAt ? (
                  <span className="rounded-full bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 text-[10px]">Completed</span>
                ) : r.startedAt ? (
                  <span className="rounded-full bg-amber-500/20 text-amber-300 px-2.5 py-0.5 text-[10px]">In Progress</span>
                ) : (
                  <span className="rounded-full bg-slate-700 text-slate-300 px-2.5 py-0.5 text-[10px]">Not Started</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
