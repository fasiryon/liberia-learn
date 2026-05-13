"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type Project = {
  id: string;
  title: string;
  description: string | null;
  skills: string[] | null;
  fileUrls: string[] | null;
  status: "SUBMITTED" | "APPROVED" | "REJECTED";
  submittedAt: string | null;
  reviewedAt: string | null;
  teacherFeedback: string | null;
  studentName: string | null;
  gradeLevel: number | null;
};

type Filter = "SUBMITTED" | "APPROVED" | "REJECTED";

const STATUS_BADGE: Record<string, string> = {
  SUBMITTED: "bg-amber-500/20 text-amber-300",
  APPROVED: "bg-emerald-500/20 text-emerald-300",
  REJECTED: "bg-red-500/20 text-red-300",
};

export default function TeacherCapstonePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("SUBMITTED");
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/teacher/capstone", { cache: "no-store" });
      if (res.ok) setProjects(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = projects.filter((p) => p.status === filter);

  async function handleReview(id: string, decision: "APPROVED" | "REJECTED") {
    if (decision === "REJECTED" && !feedback.trim()) {
      setError("Feedback is required when rejecting");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/teacher/capstone/${id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, feedback }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      setReviewing(null);
      setFeedback("");
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Review failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="ll-dashboard-shell px-4 py-5">
      <div className="ll-page-enter mx-auto max-w-4xl space-y-6">
        <Link href="/teacher" className="text-xs text-[var(--ll-yellow)]">&larr; Dashboard</Link>
        <h1 className="text-2xl font-bold text-[var(--ll-text)]">Capstone Reviews</h1>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {(["SUBMITTED", "APPROVED", "REJECTED"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold border transition ${
                filter === f
                  ? "bg-[var(--ll-yellow)] text-[var(--ll-bg)] border-transparent"
                  : "border-[var(--ll-border)] text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]"
              }`}
            >
              {f === "SUBMITTED" ? "Pending" : f === "APPROVED" ? "Approved" : "Rejected"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-[var(--ll-surface)]" />)}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-[var(--ll-text-muted)]">No {filter.toLowerCase()} capstones.</p>
        ) : (
          <div className="space-y-3">
            {filtered.map((p) => (
              <div key={p.id} className="ll-section p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[var(--ll-text)]">{p.title}</p>
                    <p className="text-xs text-[var(--ll-text-muted)]">
                      {p.studentName ?? "Student"}
                      {p.gradeLevel ? ` · Grade ${p.gradeLevel}` : ""}
                      {p.submittedAt ? ` · Submitted ${new Date(p.submittedAt).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_BADGE[p.status]}`}>
                    {p.status}
                  </span>
                </div>

                {p.description && <p className="text-sm text-[var(--ll-text-muted)]">{p.description}</p>}

                {p.skills && p.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {p.skills.map((s) => (
                      <span key={s} className="rounded-full bg-[var(--ll-surface-muted)] px-2 py-0.5 text-xs text-[var(--ll-text-muted)]">{s}</span>
                    ))}
                  </div>
                )}

                {p.fileUrls && p.fileUrls.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {p.fileUrls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer" className="text-xs text-[var(--ll-yellow)] hover:underline">
                        File {i + 1}
                      </a>
                    ))}
                  </div>
                )}

                {p.teacherFeedback && (
                  <div className="rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] p-3 text-sm text-[var(--ll-text-muted)]">
                    Feedback: {p.teacherFeedback}
                  </div>
                )}

                {p.status === "SUBMITTED" && (
                  reviewing === p.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        placeholder="Feedback for student (required to reject)"
                        rows={3}
                        className="w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-3 py-2 text-sm text-[var(--ll-text)]"
                      />
                      {error && <p className="text-xs text-red-400">{error}</p>}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleReview(p.id, "APPROVED")}
                          disabled={submitting}
                          className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReview(p.id, "REJECTED")}
                          disabled={submitting}
                          className="rounded-xl bg-red-500/80 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => { setReviewing(null); setFeedback(""); setError(null); }}
                          className="rounded-xl border border-[var(--ll-border)] px-4 py-2 text-sm text-[var(--ll-text-muted)]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setReviewing(p.id); setFeedback(""); setError(null); }}
                      className="rounded-xl bg-[var(--ll-yellow)] px-4 py-2 text-sm font-semibold text-[var(--ll-bg)]"
                    >
                      Review
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
