"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type ProgressRecord = {
  id: string;
  contentId: string;
  title: string;
  subject: string;
  completedAt: string | null;
  startedAt: string | null;
  scheduledDate: string;
  quizScore: number | null;
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
        else {
          setStudent(d.student);
          setRecords(d.records || []);
        }
      })
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 rounded-xl bg-[var(--ll-surface)]/50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-[var(--ll-bg)]/70 p-8 text-center">
        <p className="text-red-400">{error}</p>
      </div>
    );
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
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-[var(--ll-text-faint)]">
        <Link href="/teacher" className="hover:text-[var(--ll-yellow)]">
          Dashboard
        </Link>
        <span>/</span>
        <Link href="/teacher/students" className="hover:text-[var(--ll-yellow)]">
          My Students
        </Link>
        <span>/</span>
        <span className="text-[var(--ll-text-muted)]">{student?.name ?? "Student"}</span>
      </nav>

      <div>
        <h1 className="text-2xl font-bold mt-1">{student?.name || "Student"}</h1>
        <p className="text-sm text-[var(--ll-text-muted)]">{student?.email}</p>
      </div>

      {/* Subject breakdown */}
      <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
        <h2 className="text-sm font-semibold text-[var(--ll-text)] mb-3">Progress by Subject</h2>
        <div className="space-y-3">
          {Object.entries(bySubject).map(([subject, data]) => {
            const pct = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
            return (
              <div key={subject}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[var(--ll-text)]">{subject}</span>
                  <span className="text-[var(--ll-text-muted)]">
                    {data.completed}/{data.total} ({pct}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[var(--ll-surface)]">
                  <div
                    className="h-2 rounded-full bg-[var(--ll-yellow)]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* All assigned work */}
      <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
        <h2 className="text-sm font-semibold text-[var(--ll-text)] mb-3">All Assigned Work</h2>
        {records.length === 0 ? (
          <p className="text-xs text-[var(--ll-text-faint)]">No work assigned yet.</p>
        ) : (
          <div className="space-y-2">
            {records.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/50 px-4 py-2"
              >
                <div>
                  <p className="text-sm text-[var(--ll-text)]">{r.title}</p>
                  <p className="text-xs text-[var(--ll-text-faint)]">
                    {r.subject} &middot; {new Date(r.scheduledDate).toLocaleDateString()}
                    {r.quizScore !== null && (
                      <span className="ml-2 font-medium text-[var(--ll-yellow)]">
                        Quiz: {r.quizScore}%
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {r.completedAt ? (
                    <>
                      <Link
                        href={`/student/lesson/${r.contentId}`}
                        className="rounded-full border border-[var(--ll-border)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--ll-text-muted)] hover:text-[var(--ll-yellow)] hover:border-[var(--ll-yellow)]/40"
                      >
                        Review
                      </Link>
                      <span className="rounded-full bg-[var(--ll-yellow)]/20 text-[var(--ll-yellow)] px-2.5 py-0.5 text-[10px]">
                        Completed
                      </span>
                    </>
                  ) : r.startedAt ? (
                    <span className="rounded-full bg-[var(--ll-yellow-soft)] text-[var(--ll-yellow)] px-2.5 py-0.5 text-[10px]">
                      In Progress
                    </span>
                  ) : (
                    <span className="rounded-full bg-[var(--ll-surface-muted)] text-[var(--ll-text)] px-2.5 py-0.5 text-[10px]">
                      Not Started
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
