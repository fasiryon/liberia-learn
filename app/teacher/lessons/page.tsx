"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type MyLesson = {
  id: string;
  contentId: string;
  title: string | null;
  grade: number;
  subject: string;
  status: string;
  editReviewStatus: string | null;
  createdAt: string;
};

type SharedLesson = {
  shareId: string;
  id: string;
  contentId: string;
  title: string | null;
  grade: number;
  subject: string;
  status: string;
  sharedByName: string | null;
  sharedAt: string;
};

type Tab = "mine" | "shared";

export default function TeacherLessonsPage() {
  const [tab, setTab] = useState<Tab>("mine");
  const [myLessons, setMyLessons] = useState<MyLesson[]>([]);
  const [sharedLessons, setSharedLessons] = useState<SharedLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    if (tab === "mine") {
      fetch("/api/teacher/lessons/mine")
        .then((r) => r.json())
        .then((data) => setMyLessons(data.lessons ?? []))
        .catch(() => setError("Failed to load lessons"))
        .finally(() => setLoading(false));
    } else {
      fetch("/api/teacher/lessons/shared")
        .then((r) => r.json())
        .then((data) => setSharedLessons(data.lessons ?? []))
        .catch(() => setError("Failed to load shared lessons"))
        .finally(() => setLoading(false));
    }
  }, [tab]);

  const statusBadge = (status: string, review?: string | null) => {
    if (review === "PENDING") return <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">Pending review</span>;
    if (review === "REJECTED") return <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-300">Rejected</span>;
    if (status === "approved" || review === "APPROVED") return <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">Approved</span>;
    return <span className="rounded-full bg-[var(--ll-border)] px-2 py-0.5 text-xs text-[var(--ll-text-muted)]">{status}</span>;
  };

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/teacher/dashboard" className="text-sm text-[var(--ll-yellow)]">
              Back to dashboard
            </Link>
            <h1 className="mt-2 text-2xl font-bold">My Lessons</h1>
          </div>
          <Link
            href="/teacher/lessons/create"
            className="rounded-xl bg-[var(--ll-yellow-soft)] px-4 py-2 text-sm font-semibold text-[var(--ll-text-faint)]"
          >
            Create lesson
          </Link>
        </div>

        <div className="flex gap-1 rounded-xl border border-[var(--ll-border)] p-1 w-fit">
          {(["mine", "shared"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-1.5 text-sm transition-colors ${
                tab === t
                  ? "bg-[var(--ll-border)] font-medium"
                  : "text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]"
              }`}
            >
              {t === "mine" ? "My lessons" : "Shared with me"}
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-[var(--ll-text-muted)]">Loading...</p>
        ) : tab === "mine" ? (
          myLessons.length === 0 ? (
            <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-8 text-center">
              <p className="text-sm text-[var(--ll-text-muted)]">No lessons yet.</p>
              <Link href="/teacher/lessons/create" className="mt-3 inline-block text-sm text-[var(--ll-yellow)]">
                Create your first lesson
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {myLessons.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 px-4 py-3"
                >
                  <div>
                    <p className="font-medium">{l.title ?? "Untitled"}</p>
                    <p className="text-xs text-[var(--ll-text-muted)]">
                      G{l.grade} · {l.subject}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {statusBadge(l.status, l.editReviewStatus)}
                    <Link
                      href={`/teacher/lessons/${l.id}/edit`}
                      className="rounded-lg border border-[var(--ll-border)] px-3 py-1 text-xs hover:bg-[var(--ll-border)]"
                    >
                      Edit
                    </Link>
                    <Link
                      href={`/teacher/lessons/${l.id}/share`}
                      className="rounded-lg border border-[var(--ll-border)] px-3 py-1 text-xs hover:bg-[var(--ll-border)]"
                    >
                      Share
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : sharedLessons.length === 0 ? (
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-8 text-center">
            <p className="text-sm text-[var(--ll-text-muted)]">No lessons shared with you yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sharedLessons.map((l) => (
              <div
                key={l.shareId}
                className="flex items-center justify-between rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 px-4 py-3"
              >
                <div>
                  <p className="font-medium">{l.title ?? "Untitled"}</p>
                  <p className="text-xs text-[var(--ll-text-muted)]">
                    G{l.grade} · {l.subject} · shared by {l.sharedByName ?? "a colleague"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {statusBadge(l.status)}
                  <span className="text-xs text-[var(--ll-text-muted)]">Read-only</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
