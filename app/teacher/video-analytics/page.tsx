"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type VideoAnalytic = {
  id: string;
  title: string;
  lessonId: string;
  subject: string;
  grade: number;
  durationSeconds: number;
  viewCount: number;
  totalWatchers: number;
  avgWatchedSecs: number;
  avgWatchPct: number;
  dropOffRate: number;
  didntFinishStudentIds: string[];
  uploadedAt: string;
  approvedAt: string | null;
};

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function TeacherVideoAnalyticsPage() {
  const [analytics, setAnalytics] = useState<VideoAnalytic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/teacher/video-analytics")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setAnalytics(data.analytics ?? []);
      })
      .catch((err) => setError(err?.message ?? "Failed to load analytics"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="ll-page-enter min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
      <div className="ll-dashboard-shell mx-auto max-w-4xl space-y-6">
        <Link href="/teacher/dashboard" className="text-sm text-[var(--ll-yellow)] hover:opacity-80">
          &larr; Dashboard
        </Link>

        <h1 className="text-2xl font-bold text-[var(--ll-text)]">Video Analytics</h1>

        {loading && (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-40 animate-pulse rounded-xl bg-[var(--ll-surface)]" />
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{error}</div>
        )}

        {!loading && analytics.length === 0 && !error && (
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-8 text-center text-sm text-[var(--ll-text-muted)]">
            No approved videos yet. Upload a video and once it is approved, analytics will appear here.
          </div>
        )}

        <div className="space-y-4">
          {analytics.map((a) => (
            <div
              key={a.id}
              className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-5 space-y-4"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ll-text-muted)]">
                    {a.subject} · Grade {a.grade}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-[var(--ll-text)]">{a.title}</h2>
                  <p className="mt-0.5 text-xs text-[var(--ll-text-faint)]">
                    Duration {formatDuration(a.durationSeconds)} &middot;
                    Uploaded {new Date(a.uploadedAt).toLocaleDateString()}
                    {a.approvedAt && ` · Approved ${new Date(a.approvedAt).toLocaleDateString()}`}
                  </p>
                </div>
                <Link
                  href={`/teacher/lesson/${a.lessonId}`}
                  className="shrink-0 text-xs text-[var(--ll-yellow)] hover:opacity-80"
                >
                  View lesson →
                </Link>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-3 text-center">
                  <p className="text-2xl font-bold text-[var(--ll-yellow)]">{a.viewCount}</p>
                  <p className="text-xs text-[var(--ll-text-muted)]">Views</p>
                </div>
                <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-3 text-center">
                  <p className="text-2xl font-bold text-[var(--ll-text)]">{a.totalWatchers}</p>
                  <p className="text-xs text-[var(--ll-text-muted)]">Watchers</p>
                </div>
                <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-3 text-center">
                  <p className="text-2xl font-bold text-[var(--ll-text)]">{a.avgWatchPct}%</p>
                  <p className="text-xs text-[var(--ll-text-muted)]">Avg watched</p>
                </div>
                <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-3 text-center">
                  <p className={`text-2xl font-bold ${a.dropOffRate > 50 ? "text-red-400" : a.dropOffRate > 25 ? "text-amber-400" : "text-emerald-400"}`}>
                    {a.dropOffRate}%
                  </p>
                  <p className="text-xs text-[var(--ll-text-muted)]">Drop-off</p>
                </div>
              </div>

              {a.didntFinishStudentIds.length > 0 && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                  <p className="text-sm font-semibold text-amber-400">
                    {a.didntFinishStudentIds.length} student{a.didntFinishStudentIds.length !== 1 ? "s" : ""} watched less than 50%
                  </p>
                  <p className="mt-1 text-xs text-[var(--ll-text-muted)]">
                    Consider following up with these students or reviewing the video content.
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
