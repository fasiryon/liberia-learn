"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminNav } from "@/components/admin/AdminNav";

type VideoItem = {
  id: string;
  title: string;
  description: string | null;
  storageUrl: string;
  thumbnailUrl: string | null;
  durationSeconds: number;
  fileSize: number;
  status: string;
  rejectedReason: string | null;
  viewCount: number;
  uploadedAt: string;
  approvedAt: string | null;
  lesson: { contentId: string; subject: string; grade: number };
  teacher: { name: string | null };
};

type Tab = "PENDING" | "APPROVED" | "REJECTED";

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function VideoModerationPage() {
  const [tab, setTab] = useState<Tab>("PENDING");
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/videos?status=${tab}`)
      .then((r) => r.json())
      .then((data) => {
        setVideos(data.videos ?? []);
        setPendingCount(data.pendingCount ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tab]);

  async function approve(id: string) {
    setActing(id);
    try {
      const r = await fetch(`/api/admin/videos/${id}/approve`, { method: "PATCH" });
      if (r.ok) setVideos((v) => v.filter((x) => x.id !== id));
    } finally {
      setActing(null);
    }
  }

  async function reject(id: string) {
    if (!rejectReason.trim()) return;
    setActing(id);
    try {
      const r = await fetch(`/api/admin/videos/${id}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });
      if (r.ok) {
        setVideos((v) => v.filter((x) => x.id !== id));
        setRejectId(null);
        setRejectReason("");
      }
    } finally {
      setActing(null);
    }
  }

  return (
    <main className="ll-page-enter min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
      <div className="ll-dashboard-shell mx-auto max-w-5xl space-y-6">
        <Link href="/admin/dashboard" className="text-sm text-[var(--ll-yellow)] hover:opacity-80">
          &larr; Dashboard
        </Link>
        <AdminNav />

        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[var(--ll-text)]">Video Moderation</h1>
          {pendingCount > 0 && (
            <span className="rounded-full bg-red-500 px-2.5 py-0.5 text-xs font-bold text-white">
              {pendingCount}
            </span>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-[var(--ll-border)] pb-3">
          {(["PENDING", "APPROVED", "REJECTED"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                tab === t
                  ? "bg-[var(--ll-yellow)] text-[var(--ll-bg)]"
                  : "border border-[var(--ll-border)] text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]"
              }`}
            >
              {t === "PENDING" ? `Pending${pendingCount > 0 ? ` (${pendingCount})` : ""}` : t.charAt(0) + t.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {loading && (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-48 animate-pulse rounded-xl bg-[var(--ll-surface)]" />
            ))}
          </div>
        )}

        {!loading && videos.length === 0 && (
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-8 text-center text-sm text-[var(--ll-text-muted)]">
            No {tab.toLowerCase()} videos.
          </div>
        )}

        <div className="space-y-4">
          {videos.map((video) => (
            <div
              key={video.id}
              className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-5 space-y-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ll-text-muted)]">
                    {video.lesson.subject} · Grade {video.lesson.grade}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-[var(--ll-text)]">{video.title}</h2>
                  {video.description && (
                    <p className="mt-1 text-sm text-[var(--ll-text-muted)]">{video.description}</p>
                  )}
                  <p className="mt-1 text-xs text-[var(--ll-text-faint)]">
                    By {video.teacher.name ?? "Teacher"} &middot;{" "}
                    {new Date(video.uploadedAt).toLocaleDateString()} &middot;{" "}
                    {formatBytes(video.fileSize)} &middot; {formatDuration(video.durationSeconds)}
                  </p>
                  {video.status === "REJECTED" && video.rejectedReason && (
                    <p className="mt-2 text-sm font-medium text-red-400">
                      Rejected: {video.rejectedReason}
                    </p>
                  )}
                </div>
                {video.thumbnailUrl && (
                  <img
                    src={video.thumbnailUrl}
                    alt="Video thumbnail"
                    className="h-24 w-40 shrink-0 rounded-xl object-cover border border-[var(--ll-border)]"
                  />
                )}
              </div>

              <video
                className="w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-graphite)]"
                controls
                preload="metadata"
                poster={video.thumbnailUrl ?? undefined}
                src={video.storageUrl}
              />

              {tab === "PENDING" && (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    disabled={acting === video.id}
                    onClick={() => approve(video.id)}
                    className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                  >
                    {acting === video.id ? "Approving…" : "Approve"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejectId(rejectId === video.id ? null : video.id)}
                    className="rounded-xl bg-red-500/20 px-5 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/30"
                  >
                    Reject
                  </button>
                </div>
              )}

              {rejectId === video.id && (
                <div className="space-y-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                  <p className="text-sm font-semibold text-[var(--ll-text)]">Rejection reason</p>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={2}
                    placeholder="Explain why this video is being rejected…"
                    className="w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 px-3 py-2 text-sm text-[var(--ll-text)] outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={!rejectReason.trim() || acting === video.id}
                      onClick={() => reject(video.id)}
                      className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                    >
                      {acting === video.id ? "Rejecting…" : "Confirm Reject"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setRejectId(null); setRejectReason(""); }}
                      className="rounded-xl border border-[var(--ll-border)] px-4 py-2 text-sm text-[var(--ll-text-muted)]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
