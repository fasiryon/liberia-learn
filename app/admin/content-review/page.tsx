"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ReviewLesson = {
  id: string;
  contentId: string;
  title: string | null;
  grade: number;
  subject: string;
  editReviewStatus: string | null;
  editedAt: string | null;
  editedBy: {
    id: string;
    name: string | null;
    schoolId: string | null;
    school: { name: string } | null;
  } | null;
};

export default function ContentReviewPage() {
  const [lessons, setLessons] = useState<ReviewLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/content-review?status=PENDING")
      .then((r) => r.json())
      .then((data) => setLessons(data.lessons ?? []))
      .catch(() => setError("Failed to load lessons"))
      .finally(() => setLoading(false));
  }, []);

  async function handleAction(lessonId: string, status: "APPROVED" | "REJECTED", note?: string) {
    setActing(lessonId);
    try {
      const res = await fetch(`/api/admin/content-review/${lessonId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editReviewStatus: status, rejectionNote: note }),
      });
      if (!res.ok) throw new Error("Action failed");
      setLessons((prev) => prev.filter((l) => l.id !== lessonId));
      setRejectModal(null);
      setRejectNote("");
    } catch {
      setError("Failed to update lesson.");
    } finally {
      setActing(null);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-6xl space-y-5">
        <div>
          <Link href="/admin" className="text-sm text-[var(--ll-yellow)]">
            Back to admin
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Content Review Queue</h1>
          <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
            Teacher-authored or teacher-edited lessons awaiting approval.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-[var(--ll-text-muted)]">Loading...</p>
        ) : lessons.length === 0 ? (
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-8 text-center">
            <p className="text-sm text-[var(--ll-text-muted)]">No pending lessons.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--ll-border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--ll-border)] text-xs text-[var(--ll-text-muted)]">
                  <th className="px-4 py-3 text-left">Title</th>
                  <th className="px-4 py-3 text-left">Grade</th>
                  <th className="px-4 py-3 text-left">Subject</th>
                  <th className="px-4 py-3 text-left">Teacher</th>
                  <th className="px-4 py-3 text-left">School</th>
                  <th className="px-4 py-3 text-left">Submitted</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {lessons.map((lesson) => (
                  <tr key={lesson.id} className="border-b border-[var(--ll-border)] hover:bg-[var(--ll-border)]/20">
                    <td className="px-4 py-3 font-medium">
                      {lesson.title ?? <span className="text-[var(--ll-text-muted)]">Untitled</span>}
                    </td>
                    <td className="px-4 py-3">G{lesson.grade}</td>
                    <td className="px-4 py-3">{lesson.subject}</td>
                    <td className="px-4 py-3">{lesson.editedBy?.name ?? "—"}</td>
                    <td className="px-4 py-3">{lesson.editedBy?.school?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-[var(--ll-text-muted)]">
                      {lesson.editedAt ? new Date(lesson.editedAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={acting === lesson.id}
                          onClick={() => handleAction(lesson.id, "APPROVED")}
                          className="rounded-lg bg-emerald-500/20 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={acting === lesson.id}
                          onClick={() => { setRejectModal(lesson.id); setRejectNote(""); }}
                          className="rounded-lg bg-red-500/20 px-3 py-1 text-xs text-red-300 hover:bg-red-500/30 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rejection modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-2xl border border-[var(--ll-border)] bg-[var(--ll-bg)] p-6 shadow-xl">
            <h2 className="mb-3 text-lg font-semibold">Reject lesson</h2>
            <label className="block text-xs text-[var(--ll-text-muted)]">Rejection note (optional)</label>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={3}
              placeholder="Explain why this lesson was not approved..."
              className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectModal(null)}
                className="rounded-xl border border-[var(--ll-border)] px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={acting === rejectModal}
                onClick={() => handleAction(rejectModal, "REJECTED", rejectNote || undefined)}
                className="rounded-xl bg-red-500/20 px-4 py-2 text-sm text-red-300 hover:bg-red-500/30 disabled:opacity-50"
              >
                {acting === rejectModal ? "Rejecting..." : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
