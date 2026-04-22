"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type LessonItem = {
  contentId: string;
  title?: string | null;
  displayTitle: string;
  grade: number;
  subject: string;
  contentType: string;
  status: string;
};

export default function StudentLessonsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [lessons, setLessons] = useState<LessonItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/curriculum?grade=5")
      .then((res) => {
        if (res.status === 401 || res.status === 403) {
          router.push("/login");
          return null;
        }
        if (!res.ok) throw new Error("Failed to load lessons");
        return res.json();
      })
      .then((data) => {
        if (data) setLessons(data.items ?? []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="h-8 w-1/3 animate-pulse rounded-lg bg-[var(--ll-surface)]" />
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-[var(--ll-surface)]" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link href="/student/dashboard" className="inline-block text-sm text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
          &larr; Back to Dashboard
        </Link>

        <h1 className="text-2xl font-bold text-[var(--ll-text)]">My Lessons</h1>

        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        {!error && lessons.length === 0 && (
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-8 text-center">
            <p className="text-sm text-[var(--ll-text-muted)]">No lessons available yet.</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {lessons.map((lesson) => (
            <Link
              key={lesson.contentId}
              href={`/student/lesson/${lesson.contentId}`}
              className="group rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5 space-y-3 hover:border-emerald-400/30 transition-colors"
            >
              <h2 className="text-sm font-semibold text-[var(--ll-text)] group-hover:text-[var(--ll-yellow)] transition-colors">
                {lesson.displayTitle}
              </h2>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-[var(--ll-yellow)]/20 border border-emerald-400/30 px-2.5 py-0.5 text-[11px] font-medium text-[var(--ll-yellow)]">
                  Grade {lesson.grade}
                </span>
                <span className="rounded-full bg-[var(--ll-yellow)]/20 border border-emerald-400/30 px-2.5 py-0.5 text-[11px] font-medium text-[var(--ll-yellow)]">
                  {lesson.subject}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
