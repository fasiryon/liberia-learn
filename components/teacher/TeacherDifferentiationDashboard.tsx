"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type TeacherClassOption = { id: string; name: string; subject: string; gradeLevel: number | null };

type DifferentiationStudent = {
  studentId: string;
  userId: string;
  name: string;
  currentGrade: number | null;
  hero: {
    type: string;
    label: string;
    reason: string;
    href: string;
    priority: number;
  } | null;
  interventionCount: number;
  certificateProximity: {
    subject: string;
    completionPct: number;
    remainingLessons: number;
  } | null;
};

type DifferentiationGroup = {
  type: string;
  label: string;
  students: DifferentiationStudent[];
};

type DifferentiationResult = {
  classId: string;
  className: string;
  studentCount: number;
  generatedAt: string;
  groups: DifferentiationGroup[];
};

const GROUP_STYLE: Record<string, string> = {
  CRITICAL_MASTERY: "border-red-500/30 bg-red-500/10 text-red-400",
  OVERDUE: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  WAEC_PRACTICE: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  ON_TRACK: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
};

export function TeacherDifferentiationDashboard({ classes }: { classes: TeacherClassOption[] }) {
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [data, setData] = useState<DifferentiationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!classId) return;
    let active = true;
    setLoading(true);
    setError(null);
    fetch(`/api/teacher/classes/${classId}/differentiation`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.statusText)))
      .then((json: DifferentiationResult) => active && setData(json))
      .catch((err) => active && setError(String(err)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [classId]);

  if (classes.length === 0) {
    return (
      <p className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 text-sm text-[var(--ll-text-muted)]">
        You have no classes assigned yet.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Differentiation Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
          Which students in this class need which kind of help right now, ranked by the same
          scoring model that powers each student&apos;s own /student/today.
        </p>
      </div>

      <select
        value={classId}
        onChange={(event) => setClassId(event.target.value)}
        className="w-full max-w-sm rounded-md border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm"
      >
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} ({c.subject}
            {c.gradeLevel ? `, Grade ${c.gradeLevel}` : ""})
          </option>
        ))}
      </select>

      {loading ? (
        <div className="h-64 animate-pulse rounded-xl bg-[var(--ll-surface)]" />
      ) : error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          Could not load differentiation view: {error}
        </p>
      ) : data ? (
        <div className="space-y-6">
          <p className="text-xs text-[var(--ll-text-faint)]">
            {data.studentCount} students - generated {new Date(data.generatedAt).toLocaleTimeString()}
          </p>
          {data.groups.map((group) => (
            <section key={group.type}>
              <h2
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                  GROUP_STYLE[group.type] ?? "border-[var(--ll-border)] bg-[var(--ll-surface)] text-[var(--ll-text)]"
                }`}
              >
                {group.label} ({group.students.length})
              </h2>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {group.students.map((student) => (
                  <Link
                    key={student.studentId}
                    href={student.hero?.href ?? `/teacher/students/${student.studentId}`}
                    className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 hover:bg-[var(--ll-surface-muted)]"
                  >
                    <p className="text-sm font-semibold">{student.name}</p>
                    {student.hero ? (
                      <>
                        <p className="mt-1 text-xs font-semibold text-[var(--ll-yellow)]">{student.hero.label}</p>
                        <p className="mt-1 text-xs text-[var(--ll-text-muted)]">{student.hero.reason}</p>
                      </>
                    ) : (
                      <p className="mt-1 text-xs text-[var(--ll-text-muted)]">No active intervention signal.</p>
                    )}
                    {student.certificateProximity ? (
                      <p className="mt-2 text-xs text-emerald-400">
                        {student.certificateProximity.subject} certificate: {student.certificateProximity.completionPct}%
                        complete, {student.certificateProximity.remainingLessons} lesson
                        {student.certificateProximity.remainingLessons === 1 ? "" : "s"} to unlock.
                      </p>
                    ) : null}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
