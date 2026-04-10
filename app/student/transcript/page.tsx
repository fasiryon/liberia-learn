"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Transcript = {
  id: string;
  academicYearLabel: string | null;
  grade: number;
  gpa: number | null;
  summary: Record<string, unknown> | null;
  createdAt: string;
};

type ExamAuthoritySummary = {
  publishedExamCount?: number;
  passedExamCount?: number;
  averageScorePct?: number;
  latestPublishedResultAt?: string | null;
  results?: Array<{
    examId: string;
    title: string;
    subject: string;
    grade: number;
    scorePct: number;
    passed: boolean;
    submittedAt: string | null;
    resultsPublishedAt: string | null;
  }>;
};

function summaryEntries(summary: Record<string, unknown> | null) {
  if (!summary) return [];
  return Object.entries(summary).filter(
    ([key, value]) => key !== "examAuthority" && value != null && value !== ""
  );
}

function getExamAuthoritySummary(summary: Record<string, unknown> | null): ExamAuthoritySummary | null {
  if (!summary || typeof summary.examAuthority !== "object" || summary.examAuthority == null) {
    return null;
  }
  return summary.examAuthority as ExamAuthoritySummary;
}

export default function StudentTranscriptPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);

  useEffect(() => {
    fetch("/api/student/transcript", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load transcript");
        setTranscripts(data.transcripts ?? []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href="/dashboard" className="text-sm text-emerald-300 hover:text-emerald-200">
          &larr; Back to Dashboard
        </Link>

        <div>
          <h1 className="text-3xl font-semibold">My Transcript</h1>
          <p className="mt-2 text-sm text-slate-400">Your official school-year record, ready for promotion and graduation workflows.</p>
        </div>

        {loading ? <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 text-sm text-slate-400">Loading transcript...</div> : null}
        {error ? <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-200">{error}</div> : null}
        {!loading && !error && transcripts.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-8 text-center text-sm text-slate-400">
            No transcript records are available yet. Your school will see them as soon as your academic-year enrollment is recorded.
          </div>
        ) : null}

        <div className="grid gap-4">
          {transcripts.map((transcript) => {
            const entries = summaryEntries(transcript.summary);
            const examAuthority = getExamAuthoritySummary(transcript.summary);
            return (
              <section key={transcript.id} className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Transcript Record</p>
                    <h2 className="mt-2 text-xl font-semibold">{transcript.academicYearLabel ?? "Academic Year"}</h2>
                    <p className="mt-1 text-sm text-slate-400">
                      Recorded {new Date(transcript.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Grade</p>
                      <p className="mt-1 text-lg font-semibold text-slate-100">Grade {transcript.grade}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">GPA</p>
                      <p className="mt-1 text-lg font-semibold text-slate-100">
                        {transcript.gpa != null ? transcript.gpa.toFixed(2) : "Pending"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5">
                  <h3 className="text-sm font-semibold text-slate-100">Summary</h3>
                  {examAuthority ? (
                    <div className="mt-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                      <div className="grid gap-3 md:grid-cols-4">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-emerald-200">Published Exams</p>
                          <p className="mt-1 text-lg font-semibold text-slate-100">{examAuthority.publishedExamCount ?? 0}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-emerald-200">Passed Exams</p>
                          <p className="mt-1 text-lg font-semibold text-slate-100">{examAuthority.passedExamCount ?? 0}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-emerald-200">Average Score</p>
                          <p className="mt-1 text-lg font-semibold text-slate-100">
                            {examAuthority.averageScorePct != null ? `${examAuthority.averageScorePct}%` : "Pending"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-emerald-200">Last Release</p>
                          <p className="mt-1 text-sm font-semibold text-slate-100">
                            {examAuthority.latestPublishedResultAt
                              ? new Date(examAuthority.latestPublishedResultAt).toLocaleDateString()
                              : "Pending"}
                          </p>
                        </div>
                      </div>
                      {(examAuthority.results?.length ?? 0) > 0 ? (
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          {examAuthority.results?.map((result) => (
                            <div key={result.examId} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                              <p className="text-sm font-semibold text-slate-100">{result.title}</p>
                              <p className="mt-1 text-xs text-slate-400">
                                {result.subject} · Grade {result.grade}
                              </p>
                              <p className="mt-2 text-sm text-slate-100">
                                Score {result.scorePct}% · {result.passed ? "Passed" : "Not passed"}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {entries.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-400">No summary has been published for this year yet.</p>
                  ) : (
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {entries.map(([key, value]) => (
                        <div key={key} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                          <p className="text-xs uppercase tracking-wide text-slate-500">{key.replace(/_/g, " ")}</p>
                          <p className="mt-2 text-sm text-slate-100">
                            {typeof value === "string" || typeof value === "number" || typeof value === "boolean"
                              ? String(value)
                              : JSON.stringify(value)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
