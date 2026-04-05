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
      <main className="min-h-screen bg-slate-950 px-4 py-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="h-8 w-1/3 animate-pulse rounded-lg bg-slate-800" />
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-800" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link href="/student/dashboard" className="inline-block text-sm text-emerald-300 hover:text-emerald-200">
          &larr; Back to Dashboard
        </Link>

        <h1 className="text-2xl font-bold text-slate-50">My Lessons</h1>

        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        {!error && lessons.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-8 text-center">
            <p className="text-sm text-slate-400">No lessons available yet.</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {lessons.map((lesson) => (
            <Link
              key={lesson.contentId}
              href={`/student/lesson/${lesson.contentId}`}
              className="group rounded-2xl border border-white/10 bg-slate-900/70 p-5 space-y-3 hover:border-emerald-400/30 transition-colors"
            >
              <h2 className="text-sm font-semibold text-slate-50 group-hover:text-emerald-300 transition-colors">
                {lesson.displayTitle}
              </h2>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-emerald-500/20 border border-emerald-400/30 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
                  Grade {lesson.grade}
                </span>
                <span className="rounded-full bg-emerald-500/20 border border-emerald-400/30 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
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
