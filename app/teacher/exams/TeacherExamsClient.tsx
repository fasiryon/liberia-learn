"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type TeacherExam = {
  id: string;
  title: string;
  subject: string;
  grade: number;
  status: string;
  attemptCount: number;
  passRate: number;
  flaggedCount: number;
};

export default function TeacherExamsClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exams, setExams] = useState<TeacherExam[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/teacher/exams", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to load exams");
      setExams(data.exams ?? []);
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
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <Link href="/teacher" className="text-sm text-emerald-300 hover:text-emerald-200">&larr; Back to Teacher Dashboard</Link>
          <h1 className="mt-3 text-3xl font-semibold">Teacher Exam Overview</h1>
        </div>

        <form onSubmit={onGenerate} className="grid gap-3 rounded-3xl border border-white/10 bg-slate-900/70 p-6 md:grid-cols-6">
          <input name="title" placeholder="Exam title" className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm md:col-span-2" />
          <input name="subject" placeholder="Subject" required className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm" />
          <input name="grade" type="number" min="1" max="12" required className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm" />
          <input name="questionCount" type="number" min="5" defaultValue="20" required className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm" />
          <input name="timeLimit" type="number" min="10" defaultValue="60" required className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm" />
          <input name="moeStandards" placeholder="MOE codes comma-separated" required className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm md:col-span-5" />
          <button type="submit" disabled={submitting} className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60">
            {submitting ? "Generating..." : "Generate New Exam"}
          </button>
        </form>

        {error ? <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">{error}</div> : null}

        <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-900/90 text-slate-300">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Grade</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Attempts</th>
                <th className="px-4 py-3">Pass Rate</th>
                <th className="px-4 py-3">Flags</th>
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
                  <tr key={exam.id} className="border-t border-white/5">
                    <td className="px-4 py-3">{exam.title}</td>
                    <td className="px-4 py-3">{exam.subject}</td>
                    <td className="px-4 py-3">Grade {exam.grade}</td>
                    <td className="px-4 py-3">{exam.status}</td>
                    <td className="px-4 py-3">{exam.attemptCount}</td>
                    <td className="px-4 py-3">{Math.round(exam.passRate * 100)}%</td>
                    <td className="px-4 py-3">{exam.flaggedCount}</td>
                    <td className="px-4 py-3">
                      <Link href={`/teacher/exams/${exam.id}`} className="text-cyan-300 hover:text-cyan-200">View Details</Link>
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
