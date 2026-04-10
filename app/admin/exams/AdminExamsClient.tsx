"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type SupportData = {
  academicYears: Array<{ id: string; yearLabel: string; isActive: boolean }>;
  classes: Array<{ id: string; name: string; subject: string }>;
};

type ExamRow = {
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
  publishedAt: string | null;
  resultsPublishedAt: string | null;
};

export default function AdminExamsClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [support, setSupport] = useState<SupportData>({ academicYears: [], classes: [] });

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/exams", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to load exams");
      setExams(data.exams ?? []);
      setSupport(data.support ?? { academicYears: [], classes: [] });
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
          academicYearId: formData.get("academicYearId") || undefined,
          classId: formData.get("classId") || undefined,
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

  async function postAction(url: string) {
    setError(null);
    const response = await fetch(url, { method: "POST" });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.error ?? "Request failed");
    }
    await load();
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <Link href="/admin" className="text-sm text-emerald-300 hover:text-emerald-200">
            &larr; Back to Admin Console
          </Link>
          <h1 className="mt-3 text-3xl font-semibold">Exam Management</h1>
          <p className="mt-2 text-sm text-slate-400">
            Manage school-scoped exams, publish schedules, and release official results into transcript records.
          </p>
        </div>

        <form onSubmit={onGenerate} className="grid gap-3 rounded-3xl border border-white/10 bg-slate-900/70 p-6 md:grid-cols-7">
          <input name="title" placeholder="Exam title" className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm md:col-span-2" />
          <input name="subject" placeholder="Subject" required className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm" />
          <input name="grade" type="number" min="1" max="12" required className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm" />
          <input name="questionCount" type="number" min="5" defaultValue="20" required className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm" />
          <input name="timeLimit" type="number" min="10" defaultValue="60" required className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm" />
          <select name="academicYearId" className="rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-sm">
            <option value="">Active academic year</option>
            {support.academicYears.map((year) => (
              <option key={year.id} value={year.id}>
                {year.yearLabel}{year.isActive ? " (Active)" : ""}
              </option>
            ))}
          </select>
          <select name="classId" className="rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-sm">
            <option value="">School-wide / grade-wide</option>
            {support.classes.map((klass) => (
              <option key={klass.id} value={klass.id}>
                {klass.name} - {klass.subject}
              </option>
            ))}
          </select>
          <input name="moeStandards" placeholder="MOE codes comma-separated" required className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm md:col-span-6" />
          <button type="submit" disabled={submitting} className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60">
            {submitting ? "Generating..." : "Generate Exam"}
          </button>
        </form>

        {error ? <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">{error}</div> : null}

        <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-900/90 text-slate-300">
              <tr>
                <th className="px-4 py-3">Exam</th>
                <th className="px-4 py-3">Scope</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Attempts</th>
                <th className="px-4 py-3">Pass Rate</th>
                <th className="px-4 py-3">Flags</th>
                <th className="px-4 py-3">Official Results</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="px-4 py-6 text-slate-400" colSpan={8}>Loading exams...</td></tr>
              ) : exams.length === 0 ? (
                <tr><td className="px-4 py-6 text-slate-400" colSpan={8}>No exams yet.</td></tr>
              ) : (
                exams.map((exam) => (
                  <tr key={exam.id} className="border-t border-white/5 align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium">{exam.title}</div>
                      <div className="mt-1 text-xs text-slate-400">{exam.subject} · Grade {exam.grade}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">
                      <div>{exam.className ?? "Grade-wide"}</div>
                      <div className="mt-1 text-slate-500">{exam.academicYearLabel ?? "No academic year set"}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">
                      <div>{exam.status}</div>
                      <div className="mt-1 text-slate-500">
                        {exam.publishedAt ? `Published ${new Date(exam.publishedAt).toLocaleDateString()}` : "Not yet published"}
                      </div>
                    </td>
                    <td className="px-4 py-3">{exam.attemptCount}</td>
                    <td className="px-4 py-3">{Math.round(exam.passRate * 100)}%</td>
                    <td className="px-4 py-3">{exam.flaggedCount}</td>
                    <td className="px-4 py-3 text-xs text-slate-300">
                      {exam.resultsPublishedAt
                        ? `Released ${new Date(exam.resultsPublishedAt).toLocaleDateString()}`
                        : "Pending review"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {exam.status !== "PUBLISHED" ? (
                          <button type="button" onClick={() => void postAction(`/api/admin/exams/${exam.id}/publish`).catch((err) => setError(err.message))} className="rounded-2xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950">
                            Publish
                          </button>
                        ) : null}
                        {!exam.resultsPublishedAt ? (
                          <button type="button" onClick={() => void postAction(`/api/admin/exams/${exam.id}/results`).catch((err) => setError(err.message))} className="rounded-2xl border border-white/10 px-3 py-2 text-xs">
                            Release Results
                          </button>
                        ) : null}
                        <Link href={`/teacher/exams/${exam.id}`} className="rounded-2xl border border-cyan-400/30 px-3 py-2 text-xs text-cyan-300">
                          Review
                        </Link>
                      </div>
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
