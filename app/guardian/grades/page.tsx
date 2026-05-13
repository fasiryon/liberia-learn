"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { GuardianNav } from "@/components/guardian/GuardianNav";

type Child = { studentId: string; studentName: string };
type GradeEntry = { title: string; dueAt: string | null; score: number; maxScore: number; feedback: string | null; gradedAt: string | null };
type SubjectData = { subject: string; grades: GradeEntry[]; average: number | null; trend: "improving" | "stable" | "declining" };

function trendIcon(trend: string) {
  if (trend === "improving") return <span className="text-emerald-400">↑ Improving</span>;
  if (trend === "declining") return <span className="text-red-400">↓ Declining</span>;
  return <span className="text-[var(--ll-text-muted)]">→ Stable</span>;
}

function avgColor(avg: number | null) {
  if (avg === null) return "text-[var(--ll-text-muted)]";
  if (avg >= 80) return "text-emerald-400";
  if (avg >= 60) return "text-amber-400";
  return "text-red-400";
}

export default function GuardianGradesPage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>("");
  const [subjects, setSubjects] = useState<SubjectData[]>([]);
  const [activeTab, setActiveTab] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/guardian/students", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const list: Child[] = (d.students ?? []).map((s: { studentId: string; name: string | null }) => ({
          studentId: s.studentId,
          studentName: s.name ?? "Child",
        }));
        setChildren(list);
        if (list.length > 0) setSelectedChildId(list[0].studentId);
      })
      .catch(() => null);
  }, []);

  const loadGrades = useCallback(async (studentId: string) => {
    if (!studentId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/guardian/grades?studentId=${studentId}`);
      if (res.ok) {
        const data = await res.json();
        setSubjects(data.subjects ?? []);
        setActiveTab(data.subjects?.[0]?.subject ?? "");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedChildId) loadGrades(selectedChildId);
  }, [selectedChildId, loadGrades]);

  const activeSubject = subjects.find((s) => s.subject === activeTab);
  const overallAvg = subjects.length > 0
    ? Math.round(subjects.filter(s => s.average !== null).reduce((sum, s) => sum + (s.average ?? 0), 0) / subjects.filter(s => s.average !== null).length)
    : null;

  return (
    <main className="ll-dashboard-shell px-4 py-5">
      <div className="ll-page-enter mx-auto max-w-5xl space-y-6">
        <Link href="/guardian/dashboard" className="text-xs text-[var(--ll-yellow)]">&larr; Back to dashboard</Link>
        <h1 className="text-2xl font-bold text-[var(--ll-text)]">Grades</h1>
        <GuardianNav />

        {children.length > 1 && (
          <div className="ll-section p-4">
            <label className="block text-xs font-medium text-[var(--ll-text-faint)] mb-1">Select Child</label>
            <select
              value={selectedChildId}
              onChange={(e) => setSelectedChildId(e.target.value)}
              className="w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface)] px-3 py-2 text-sm text-[var(--ll-text)]"
            >
              {children.map((c) => (
                <option key={c.studentId} value={c.studentId}>{c.studentName}</option>
              ))}
            </select>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 animate-pulse rounded-xl bg-[var(--ll-surface)]" />)}</div>
        ) : subjects.length === 0 ? (
          <p className="text-sm text-[var(--ll-text-muted)]">No graded assignments yet.</p>
        ) : (
          <>
            {overallAvg !== null && !isNaN(overallAvg) && (
              <div className="ll-section p-4 flex items-center justify-between">
                <span className="text-sm text-[var(--ll-text-muted)]">Overall average</span>
                <span className={`text-xl font-bold ${avgColor(overallAvg)}`}>{overallAvg}%</span>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {subjects.map((s) => (
                <button
                  key={s.subject}
                  type="button"
                  onClick={() => setActiveTab(s.subject)}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold border transition ${
                    activeTab === s.subject
                      ? "bg-[var(--ll-yellow)] text-[var(--ll-bg)] border-transparent"
                      : "border-[var(--ll-border)] text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]"
                  }`}
                >
                  {s.subject.replace(/_/g, " ")}
                </button>
              ))}
            </div>

            {activeSubject && (
              <div className="ll-section p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-[var(--ll-text)]">{activeSubject.subject.replace(/_/g, " ")}</h2>
                    <span className="text-sm text-[var(--ll-text-muted)]">{trendIcon(activeSubject.trend)}</span>
                  </div>
                  {activeSubject.average !== null && (
                    <span className={`text-2xl font-bold ${avgColor(activeSubject.average)}`}>{activeSubject.average}%</span>
                  )}
                </div>

                <div className="space-y-2">
                  {activeSubject.grades.length === 0 ? (
                    <p className="text-sm text-[var(--ll-text-muted)]">No graded assignments yet.</p>
                  ) : (
                    activeSubject.grades.map((g, i) => (
                      <div key={i} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-[var(--ll-text)]">{g.title}</span>
                          <span className={`text-sm font-bold ${avgColor(Math.round((g.score / g.maxScore) * 100))}`}>
                            {g.score}/{g.maxScore}
                          </span>
                        </div>
                        {g.dueAt && (
                          <p className="text-xs text-[var(--ll-text-faint)] mt-0.5">
                            Due: {new Date(g.dueAt).toLocaleDateString("en-LR")}
                          </p>
                        )}
                        {g.feedback && (
                          <p className="text-xs text-[var(--ll-text-muted)] mt-1 italic">{g.feedback.slice(0, 120)}{g.feedback.length > 120 ? "…" : ""}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
