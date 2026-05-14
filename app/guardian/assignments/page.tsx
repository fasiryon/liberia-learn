"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { GuardianNav } from "@/components/guardian/GuardianNav";
import { DashboardTopBar } from "@/components/DashboardTopBar";
import { SkeletonCard } from "@/components/ui/Skeleton";

type Assignment = {
  id: string;
  title: string;
  description: string | null;
  dueAt: string | null;
  points: number;
  subject: string;
  className: string;
  status: "submitted" | "overdue" | "upcoming";
  submission: {
    id: string;
    score: number | null;
    submittedAt: string;
  } | null;
};

type Student = {
  studentId: string;
  name: string | null;
};

function statusBadge(status: Assignment["status"]) {
  if (status === "submitted") return "bg-emerald-400/15 text-emerald-400";
  if (status === "overdue") return "bg-red-400/15 text-red-400";
  return "bg-[var(--ll-surface-muted)] text-[var(--ll-text-muted)]";
}

function statusLabel(status: Assignment["status"]) {
  if (status === "submitted") return "Submitted";
  if (status === "overdue") return "Overdue";
  return "Upcoming";
}

function assignmentRowBg(status: Assignment["status"]) {
  if (status === "submitted") return "border-emerald-400/20";
  if (status === "overdue") return "border-red-400/30 bg-red-400/5";
  return "border-[var(--ll-border)]";
}

export default function GuardianAssignmentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/guardian/students", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const list: Student[] = (d.students ?? []).map((s: any) => ({
          studentId: s.studentId,
          name: s.name,
        }));
        setStudents(list);
        if (list.length > 0) setSelectedStudentId(list[0].studentId);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedStudentId) return;
    setAssignmentsLoading(true);
    fetch(`/api/guardian/assignments?studentId=${encodeURIComponent(selectedStudentId)}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((d) => setAssignments(d.assignments ?? []))
      .catch(() => setAssignments([]))
      .finally(() => setAssignmentsLoading(false));
  }, [selectedStudentId]);

  // Group by subject
  const grouped = assignments.reduce<Record<string, Assignment[]>>((acc, a) => {
    const key = a.subject.replace(/_/g, " ");
    if (!acc[key]) acc[key] = [];
    acc[key].push(a);
    return acc;
  }, {});

  const now = new Date();
  const upcomingIn7Days = assignments.filter(
    (a) => a.status === "upcoming" && a.dueAt && new Date(a.dueAt) < new Date(now.getTime() + 7 * 86400000)
  ).length;

  return (
    <main className="ll-dashboard-shell px-4 py-5">
      <div className="ll-page-enter mx-auto max-w-5xl space-y-5">
        <Link
          href="/guardian/dashboard"
          className="inline-flex items-center gap-1 text-sm text-[var(--ll-text-muted)] hover:text-[var(--ll-yellow)] mb-4 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Dashboard
        </Link>
        <DashboardTopBar
          roleLabel="Guardian"
          roleBadgeBg="bg-[var(--ll-pink-soft)] border-purple-500/20"
          roleAccent="text-[var(--ll-text-muted)]"
        />

        <h1 className="text-2xl font-semibold text-[var(--ll-text)]">Assignments</h1>

        <GuardianNav />

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">{error}</div>
        ) : (
          <>
            {students.length > 1 ? (
              <section className="ll-section p-4">
                <label className="block text-xs font-medium text-[var(--ll-text-faint)] uppercase tracking-wide">
                  Select child
                </label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="mt-2 min-h-11 w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-4 py-3 text-sm text-[var(--ll-text)]"
                >
                  {students.map((s) => (
                    <option key={s.studentId} value={s.studentId}>
                      {s.name ?? s.studentId}
                    </option>
                  ))}
                </select>
              </section>
            ) : null}

            {/* KPI */}
            <div className="ll-kpi max-w-xs">
              <p className="text-xs text-[var(--ll-text-faint)] uppercase tracking-wide">Due in 7 days</p>
              <p className={`mt-1 text-2xl font-bold ${upcomingIn7Days > 0 ? "text-amber-400" : "text-[var(--ll-text-muted)]"}`}>
                {upcomingIn7Days}
              </p>
              <p className="mt-0.5 text-xs text-[var(--ll-text-faint)]">upcoming assignments</p>
            </div>

            {assignmentsLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => <SkeletonCard key={i} />)}
              </div>
            ) : assignments.length === 0 ? (
              <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-6 text-center">
                <p className="text-sm text-[var(--ll-text-muted)]">No assignments found for this student.</p>
              </div>
            ) : (
              Object.entries(grouped).map(([subject, items]) => (
                <section key={subject} className="ll-section p-4">
                  <h2 className="mb-3 text-base font-semibold text-[var(--ll-text)]">{subject}</h2>
                  <div className="space-y-2">
                    {items.map((a) => (
                      <div
                        key={a.id}
                        className={`rounded-xl border p-3 ${assignmentRowBg(a.status)}`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-[var(--ll-text)]">{a.title}</p>
                          <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${statusBadge(a.status)}`}>
                            {statusLabel(a.status)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-[var(--ll-text-muted)]">
                          {a.className}
                          {a.dueAt ? ` · Due ${new Date(a.dueAt).toLocaleDateString("en-LR", { month: "short", day: "numeric" })}` : ""}
                          {a.submission?.score != null ? ` · Score: ${a.submission.score}/${a.points}` : ""}
                        </p>
                        {a.description ? (
                          <p className="mt-1 text-xs text-[var(--ll-text-faint)] line-clamp-2">{a.description}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </section>
              ))
            )}

            <div className="text-center">
              <Link href="/guardian/grades" className="text-sm text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
                View grades &rarr;
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
