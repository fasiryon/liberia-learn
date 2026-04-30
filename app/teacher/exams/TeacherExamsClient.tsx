"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type TeacherExam = {
  id: string;
  title: string;
  subject: string;
  grade: number;
  status: string;
  className: string | null;
  academicYearLabel: string | null;
  attemptCount: number;
  passRate: number;
  flaggedCount: number;
  resultsPublishedAt: string | null;
};

type ReadinessSummary = {
  classSummaries: Array<{
    classId: string;
    className: string;
    subject: string;
    gradeLevel: number | null;
    studentCount: number;
    averageReadiness: number | null;
    weakTopics: string[];
    studentsNeedingSupport: Array<{ studentId: string; name: string | null; readinessScore: number | null }>;
  }>;
};

export default function TeacherExamsClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exams, setExams] = useState<TeacherExam[]>([]);
  const [readinessSummary, setReadinessSummary] = useState<ReadinessSummary | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/teacher/exams", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to load exams");
      setExams(data.exams ?? []);
      setReadinessSummary(data.readinessSummary ?? null);
      setError(null);
    } catch (err: any) {
      setError(err.message ?? "Failed to load exams");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin/exams/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.get("title") || undefined,
          subject: formData.get("subject"),
          grade: Number(formData.get("grade")),
          timeLimit: Number(formData.get("timeLimit")),
          questionCount: Number(formData.get("questionCount")),
          moeStandards: String(formData.get("moeStandards") ?? "")
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to generate exam");
      await load();
      event.currentTarget.reset();
    } catch (err: any) {
      setError(err.message ?? "Failed to generate exam");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <Link href="/teacher" className="text-sm text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
            &larr; Back to Teacher Dashboard
          </Link>
          <h1 className="mt-3 text-3xl font-semibold">Teacher Exam Overview</h1>
        </div>

        <form
          onSubmit={onGenerate}
          className="grid gap-3 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6 md:grid-cols-6"
        >
          <input
            name="title"
            placeholder="Exam title"
            className="rounded-xl border border-[var(--ll-border)] bg-white/5 px-3 py-2 text-sm md:col-span-2"
          />
          <input
            name="subject"
            placeholder="Subject"
            required
            className="rounded-xl border border-[var(--ll-border)] bg-white/5 px-3 py-2 text-sm"
          />
          <input
            name="grade"
            type="number"
            min="1"
            max="12"
            required
            className="rounded-xl border border-[var(--ll-border)] bg-white/5 px-3 py-2 text-sm"
          />
          <input
            name="questionCount"
            type="number"
            min="5"
            defaultValue="20"
            required
            className="rounded-xl border border-[var(--ll-border)] bg-white/5 px-3 py-2 text-sm"
          />
          <input
            name="timeLimit"
            type="number"
            min="10"
            defaultValue="60"
            required
            className="rounded-xl border border-[var(--ll-border)] bg-white/5 px-3 py-2 text-sm"
          />
          <input
            name="moeStandards"
            placeholder="MOE codes comma-separated"
            required
            className="rounded-xl border border-[var(--ll-border)] bg-white/5 px-3 py-2 text-sm md:col-span-5"
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-[var(--ll-yellow)] px-4 py-2 text-sm font-semibold text-[var(--ll-text-faint)] disabled:opacity-60"
          >
            {submitting ? "Generating..." : "Generate New Exam"}
          </button>
        </form>

        {error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {readinessSummary?.classSummaries?.length ? (
          <section className="grid gap-4 md:grid-cols-2">
            {readinessSummary.classSummaries.slice(0, 4).map((summary) => (
              <article
                key={summary.classId}
                className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--ll-text-muted)]">
                      Exam readiness
                    </p>
                    <h2 className="mt-1 text-base font-semibold text-[var(--ll-text)]">{summary.className}</h2>
                    <p className="mt-1 text-xs text-[var(--ll-text-muted)]">
                      {summary.subject.replace(/_/g, " ")}
                      {summary.gradeLevel ? ` - Grade ${summary.gradeLevel}` : ""}
                    </p>
                  </div>
                  <p className="text-2xl font-semibold text-[var(--ll-yellow)]">
                    {summary.averageReadiness != null ? `${Math.round(summary.averageReadiness)}%` : "--"}
                  </p>
                </div>
                <div className="mt-4 text-sm text-[var(--ll-text-muted)]">
                  {summary.studentsNeedingSupport.length} student
                  {summary.studentsNeedingSupport.length === 1 ? "" : "s"} need support
                </div>
                {summary.weakTopics.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {summary.weakTopics.slice(0, 3).map((topic) => (
                      <span key={topic} className="rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1 text-xs text-red-200">
                        {topic}
                      </span>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </section>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--ll-bg)]/90 text-[var(--ll-text)]">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Scope</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Grade</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Attempts</th>
                <th className="px-4 py-3">Pass Rate</th>
                <th className="px-4 py-3">Flags</th>
                <th className="px-4 py-3">Results</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-[var(--ll-text-muted)]" colSpan={10}>
                    Loading exams...
                  </td>
                </tr>
              ) : exams.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-[var(--ll-text-muted)]" colSpan={10}>
                    No exams yet.
                  </td>
                </tr>
              ) : (
                exams.map((exam) => (
                  <tr key={exam.id} className="border-t border-white/5">
                    <td className="px-4 py-3">{exam.title}</td>
                    <td className="px-4 py-3 text-xs text-[var(--ll-text-muted)]">
                      <div>{exam.className ?? "Grade-wide"}</div>
                      <div>{exam.academicYearLabel ?? "No academic year"}</div>
                    </td>
                    <td className="px-4 py-3">{exam.subject}</td>
                    <td className="px-4 py-3">Grade {exam.grade}</td>
                    <td className="px-4 py-3">{exam.status}</td>
                    <td className="px-4 py-3">{exam.attemptCount}</td>
                    <td className="px-4 py-3">{Math.round(exam.passRate * 100)}%</td>
                    <td className="px-4 py-3">{exam.flaggedCount}</td>
                    <td className="px-4 py-3 text-xs text-[var(--ll-text-muted)]">
                      {exam.resultsPublishedAt
                        ? new Date(exam.resultsPublishedAt).toLocaleDateString()
                        : "Pending"}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/teacher/exams/${exam.id}`}
                        className="text-[var(--ll-silver)] hover:text-[var(--ll-silver)]"
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
