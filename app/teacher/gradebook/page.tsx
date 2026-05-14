"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

type ClassOption = { id: string; name: string; subject: string };
type StudentRow = { id: string; name: string };
type AssignmentCol = { id: string; title: string; points: number; dueAt: string | null };
type SubmissionCell = { id: string; studentId: string; assignmentId: string; grade: number | null; gradedAt: string | null };

type GradebookData = {
  classes: ClassOption[];
  selectedClass?: ClassOption;
  students?: StudentRow[];
  assignments?: AssignmentCol[];
  submissions?: SubmissionCell[];
};

function scoreColor(score: number | null) {
  if (score === null) return "text-[var(--ll-text-muted)]";
  if (score >= 80) return "text-emerald-300";
  if (score >= 60) return "text-amber-300";
  return "text-red-300";
}

export default function GradebookPage() {
  const [data, setData] = useState<GradebookData | null>(null);
  const [classId, setClassId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback((cid: string) => {
    setLoading(true);
    setError(null);
    const url = cid ? `/api/teacher/gradebook?classId=${cid}` : "/api/teacher/gradebook";
    fetch(url, { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load gradebook");
        return json as GradebookData;
      })
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData("");
  }, [fetchData]);

  function handleClassChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const cid = e.target.value;
    setClassId(cid);
    if (cid) fetchData(cid);
    else setData((d) => d ? { classes: d.classes } : null);
  }

  const cellMap = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const s of data?.submissions ?? []) {
      map.set(`${s.studentId}:${s.assignmentId}`, s.grade);
    }
    return map;
  }, [data?.submissions]);

  const studentAverages = useMemo(() => {
    const avgs = new Map<string, number | null>();
    for (const student of data?.students ?? []) {
      const scores = (data?.assignments ?? [])
        .map((a) => cellMap.get(`${student.id}:${a.id}`) ?? null)
        .filter((v) => v !== null) as number[];
      avgs.set(
        student.id,
        scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
      );
    }
    return avgs;
  }, [data?.students, data?.assignments, cellMap]);

  const classes = data?.classes ?? [];
  const students = data?.students ?? [];
  const assignments = data?.assignments ?? [];

  return (
    <main className="ll-dashboard-shell px-4 py-5 text-[var(--ll-text)]">
      <div className="ll-page-enter mx-auto max-w-5xl space-y-6">
        <Link
          href="/teacher/dashboard"
          className="inline-flex items-center gap-1 text-sm text-[var(--ll-text-muted)] hover:text-[var(--ll-yellow)] mb-4 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Dashboard
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Gradebook</h1>
            <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
              Student grades across all assignments.
            </p>
          </div>
          <Link
            href="/teacher/assignments/grading"
            className="rounded-full border border-[var(--ll-border)] px-4 py-2 text-sm text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]"
          >
            Go to Grading Inbox
          </Link>
        </div>

        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-48">
            <label className="block space-y-1.5 text-sm">
              <span className="text-[var(--ll-text-muted)]">Class</span>
              <select
                value={classId}
                onChange={handleClassChange}
                className="w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-2.5 text-[var(--ll-text)]"
              >
                <option value="">Select a class…</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.subject}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {classId ? (
            <div className="flex items-end">
              <a
                href={`/api/teacher/gradebook/export?classId=${classId}`}
                className="inline-flex min-h-11 items-center rounded-full bg-[var(--ll-yellow-soft)] px-5 text-sm font-semibold text-[var(--ll-text-faint)]"
              >
                Export CSV
              </a>
            </div>
          ) : null}
        </div>

        {loading ? (
          <div className="h-40 animate-pulse rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70" />
        ) : error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>
        ) : !classId ? (
          <div className="rounded-xl border border-dashed border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-6 text-sm text-[var(--ll-text-muted)]">
            Select a class above to view the gradebook.
          </div>
        ) : students.length === 0 ? (
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6 text-sm text-[var(--ll-text-muted)]">
            No enrolled students found for this class.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--ll-border)]">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--ll-border)] bg-[var(--ll-bg)]/80">
                  <th className="sticky left-0 z-10 bg-[var(--ll-bg)] px-4 py-3 text-left font-semibold text-[var(--ll-text)]">
                    Student
                  </th>
                  {assignments.map((a) => (
                    <th
                      key={a.id}
                      className="max-w-[120px] px-3 py-3 text-center font-medium text-[var(--ll-text-muted)]"
                      title={a.title}
                    >
                      <span className="line-clamp-2 block">{a.title}</span>
                      <span className="text-xs text-[var(--ll-text-faint)]">{a.points}pts</span>
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center font-semibold text-[var(--ll-text)]">Avg</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  const avg = studentAverages.get(student.id) ?? null;
                  return (
                    <tr key={student.id} className="border-b border-[var(--ll-border)] last:border-b-0 hover:bg-[var(--ll-bg)]/50">
                      <td className="sticky left-0 z-10 bg-[var(--ll-bg)] px-4 py-3 font-medium text-[var(--ll-text)]">
                        {student.name}
                      </td>
                      {assignments.map((a) => {
                        const score = cellMap.get(`${student.id}:${a.id}`) ?? null;
                        return (
                          <td key={a.id} className={`px-3 py-3 text-center font-semibold ${scoreColor(score)}`}>
                            {score !== null ? score : <span className="text-[var(--ll-text-faint)]">–</span>}
                          </td>
                        );
                      })}
                      <td className={`px-3 py-3 text-center font-bold ${scoreColor(avg)}`}>
                        {avg !== null ? avg : <span className="text-[var(--ll-text-faint)]">–</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
