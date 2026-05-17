"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Teacher = { id: string; name: string | null; email: string };

export default function LessonSharePage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [shareId, setShareId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch teacher dashboard to get schoolId
    fetch("/api/teacher/dashboard")
      .then((r) => r.json())
      .then((data) => {
        setSchoolId(data.schoolId ?? null);
      })
      .catch(() => setError("Failed to load school context"))
      .finally(() => setLoading(false));
  }, []);

  async function handleShare() {
    if (!schoolId) return;
    setSharing(true);
    setError(null);
    try {
      const res = await fetch(`/api/teacher/lessons/${lessonId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to share lesson");
      setShareId(data.shareId);
      setShared(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSharing(false);
    }
  }

  async function handleUnshare() {
    if (!schoolId) return;
    setSharing(true);
    setError(null);
    try {
      const res = await fetch(`/api/teacher/lessons/${lessonId}/share`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId }),
      });
      if (!res.ok) throw new Error("Failed to unshare lesson");
      setShared(false);
      setShareId(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSharing(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
        <p className="text-sm text-[var(--ll-text-muted)]">Loading...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-2xl space-y-5">
        <div>
          <Link href={`/teacher/lessons/${lessonId}/edit`} className="text-sm text-[var(--ll-yellow)]">
            Back to edit
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Share Lesson</h1>
          <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
            Share this lesson with all teachers at your school. They can view it under &ldquo;Shared with me.&rdquo;
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Share with whole school</p>
              <p className="text-xs text-[var(--ll-text-muted)] mt-0.5">
                All teachers at your school will see this lesson in their library.
              </p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={shared}
                onChange={shared ? handleUnshare : handleShare}
                disabled={sharing || !schoolId}
                className="sr-only"
              />
              <div
                className={`h-6 w-11 rounded-full transition-colors ${
                  shared ? "bg-emerald-500" : "bg-[var(--ll-border)]"
                } ${sharing ? "opacity-50" : ""}`}
              >
                <div
                  className={`h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5 ml-0.5 ${
                    shared ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </div>
            </label>
          </div>

          {shared && (
            <p className="text-xs text-emerald-400">
              This lesson is now shared with your school.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
