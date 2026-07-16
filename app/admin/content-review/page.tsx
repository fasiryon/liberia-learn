"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminNav } from "@/components/admin/AdminNav";

type Tab = "PENDING" | "APPROVED" | "REJECTED";

type ReviewLesson = {
  id: string;
  contentId: string;
  title: string | null;
  grade: number;
  subject: string;
  editReviewStatus: string | null;
  editedAt: string | null;
  publishedAt: string | null;
  rejectionReason: string | null;
  learningObjectives?: string[];
  editedBy: { id: string; name: string | null; school: { name: string } | null } | null;
  qaReviews?: QaReview[];
};

type QaReview = {
  id: string;
  score: number | null;
  confidence: number;
  feedback: string | null;
  status: string;
  createdAt: string;
};

export default function ContentReviewPage() {
  const [tab, setTab] = useState<Tab>("PENDING");
  const [lessons, setLessons] = useState<ReviewLesson[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [previewLesson, setPreviewLesson] = useState<ReviewLesson | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [unpublishModal, setUnpublishModal] = useState<string | null>(null);
  const [unpublishReason, setUnpublishReason] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/content-review?status=${tab}`)
      .then((r) => r.json())
      .then((data) => {
        setLessons(data.lessons ?? []);
        if (data.pendingCount !== undefined) setPendingCount(data.pendingCount);
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, [tab]);

  async function handleApprove(id: string) {
    setActing(id);
    try {
      const r = await fetch(`/api/admin/content-review/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editReviewStatus: "APPROVED" }),
      });
      if (r.ok) setLessons((l) => l.filter((x) => x.id !== id));
      else setError("Approve failed");
    } finally { setActing(null); }
  }

  async function handleReject(id: string) {
    if (!rejectReason.trim()) return;
    setActing(id);
    try {
      const r = await fetch(`/api/admin/content-review/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editReviewStatus: "REJECTED", rejectionReason: rejectReason }),
      });
      if (r.ok) {
        setLessons((l) => l.filter((x) => x.id !== id));
        setRejectModal(null);
        setRejectReason("");
      } else setError("Reject failed");
    } finally { setActing(null); }
  }

  async function handleUnpublish(id: string) {
    setActing(id);
    try {
      const r = await fetch(`/api/admin/content-review/${id}/unpublish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: unpublishReason || undefined }),
      });
      if (r.ok) {
        setLessons((l) => l.filter((x) => x.id !== id));
        setUnpublishModal(null);
        setUnpublishReason("");
      } else setError("Unpublish failed");
    } finally { setActing(null); }
  }

  return (
    <main className="ll-page-enter min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
      <div className="ll-dashboard-shell mx-auto max-w-6xl space-y-5">
        <Link href="/admin/dashboard" className="text-sm text-[var(--ll-yellow)]">&larr; Dashboard</Link>
        <AdminNav />

        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Lesson Moderation</h1>
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
              {t === "PENDING"
                ? `Pending${pendingCount > 0 ? ` (${pendingCount})` : ""}`
                : t.charAt(0) + t.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading && (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-[var(--ll-surface)]" />
            ))}
          </div>
        )}

        {!loading && lessons.length === 0 && (
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-8 text-center text-sm text-[var(--ll-text-muted)]">
            No {tab.toLowerCase()} lessons.
          </div>
        )}

        <div className="space-y-3">
          {lessons.map((lesson) => (
            <div
              key={lesson.id}
              className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-5 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ll-text-muted)]">
                    {lesson.subject} &middot; G{lesson.grade}
                  </p>
                  <h2 className="mt-0.5 font-semibold">{lesson.title ?? "Untitled"}</h2>
                  <p className="text-xs text-[var(--ll-text-muted)]">
                    {lesson.editedBy?.name ?? "—"} &middot; {lesson.editedBy?.school?.name ?? "—"}
                    {lesson.editedAt ? ` · ${new Date(lesson.editedAt).toLocaleDateString()}` : ""}
                    {lesson.publishedAt ? ` · Published ${new Date(lesson.publishedAt).toLocaleDateString()}` : ""}
                  </p>
                  {lesson.rejectionReason && (
                    <p className="mt-1 text-sm text-red-400">Rejected: {lesson.rejectionReason}</p>
                  )}
                  {lesson.qaReviews && lesson.qaReviews.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {lesson.qaReviews
                        .filter((r) => r.status === "PENDING_TEACHER_REVIEW")
                        .map((r) => (
                          <p
                            key={r.id}
                            className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300"
                          >
                            <span className="font-semibold">AI QA flag</span>
                            {r.score !== null && <span>· score {(r.score * 100).toFixed(0)}%</span>}
                            <span>· confidence {(r.confidence * 100).toFixed(0)}%</span>
                            {r.feedback && <span className="text-amber-200/80">— {r.feedback}</span>}
                          </p>
                        ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewLesson(previewLesson?.id === lesson.id ? null : lesson)}
                  className="shrink-0 rounded-lg border border-[var(--ll-border)] px-3 py-1 text-xs hover:bg-[var(--ll-border)]"
                >
                  {previewLesson?.id === lesson.id ? "Close" : "Preview"}
                </button>
              </div>

              {previewLesson?.id === lesson.id && (
                <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-4 space-y-2">
                  {Array.isArray(previewLesson.learningObjectives) &&
                    previewLesson.learningObjectives.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-[var(--ll-text-muted)]">Objectives</p>
                        <ul className="mt-1 list-disc pl-4 text-sm space-y-0.5">
                          {(previewLesson.learningObjectives as string[]).map((o, i) => (
                            <li key={i}>{o}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                </div>
              )}

              {tab === "PENDING" && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={acting === lesson.id}
                    onClick={() => handleApprove(lesson.id)}
                    className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                  >
                    {acting === lesson.id ? "Approving…" : "Approve"}
                  </button>
                  <button
                    type="button"
                    disabled={acting === lesson.id}
                    onClick={() => { setRejectModal(lesson.id); setRejectReason(""); }}
                    className="rounded-xl bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/30 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              )}

              {tab === "APPROVED" && (
                <button
                  type="button"
                  onClick={() => { setUnpublishModal(lesson.id); setUnpublishReason(""); }}
                  className="rounded-xl border border-red-500/30 px-4 py-2 text-xs text-red-400 hover:bg-red-500/10"
                >
                  Unpublish (emergency)
                </button>
              )}

              {rejectModal === lesson.id && (
                <div className="space-y-2 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                  <p className="text-sm font-semibold">Rejection reason *</p>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={2}
                    placeholder="Explain why this lesson is being rejected…"
                    className="w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 px-3 py-2 text-sm outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={!rejectReason.trim() || acting === lesson.id}
                      onClick={() => handleReject(lesson.id)}
                      className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {acting === lesson.id ? "Rejecting…" : "Confirm Reject"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejectModal(null)}
                      className="rounded-xl border border-[var(--ll-border)] px-4 py-2 text-sm"
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

      {unpublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-2xl border border-[var(--ll-border)] bg-[var(--ll-bg)] p-6 shadow-xl space-y-4">
            <h2 className="text-lg font-semibold">Emergency Unpublish</h2>
            <p className="text-sm text-[var(--ll-text-muted)]">
              This removes the lesson from all student views immediately. Teacher will be notified.
            </p>
            <textarea
              value={unpublishReason}
              onChange={(e) => setUnpublishReason(e.target.value)}
              rows={2}
              placeholder="Optional: reason for unpublishing…"
              className="w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setUnpublishModal(null)}
                className="rounded-xl border border-[var(--ll-border)] px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={acting === unpublishModal}
                onClick={() => handleUnpublish(unpublishModal)}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {acting === unpublishModal ? "Unpublishing…" : "Confirm Unpublish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
