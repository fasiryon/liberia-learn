"use client";

/**
 * app/student/offline-lessons/page.tsx
 *
 * Lists lessons saved for offline access.
 * Shows cached-at date, size, and allows removal.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { listCachedLessons, removeCachedLesson, type CachedLessonEntry } from "@/lib/lesson-offline-cache";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function OfflineLessonsPage() {
  const [lessons, setLessons] = useState<CachedLessonEntry[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const list = await listCachedLessons();
    setLessons(list);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleRemove(contentId: string) {
    await removeCachedLesson(contentId);
    setLessons((prev) => prev.filter((l) => l.contentId !== contentId));
  }

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/student/dashboard"
            className="text-sm text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]"
          >
            ← Dashboard
          </Link>
        </div>

        <h1 className="text-2xl font-bold tracking-tight">Offline Lessons</h1>
        <p className="text-sm text-[var(--ll-text-muted)]">
          These lessons are saved to your device and available without an internet connection.
        </p>

        {loading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-[var(--ll-surface)] animate-pulse" />
            ))}
          </div>
        )}

        {!loading && lessons.length === 0 && (
          <div className="rounded-xl border border-[var(--ll-border)]/50 bg-[var(--ll-bg)]/60 px-6 py-8 text-center">
            <p className="text-[var(--ll-text-muted)] text-sm">No lessons saved for offline use yet.</p>
            <p className="mt-2 text-xs text-[var(--ll-text-faint)]">
              Open a lesson and tap &quot;Save for offline&quot; to access it without internet.
            </p>
            <Link
              href="/student/lessons"
              className="mt-4 inline-block text-sm text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)] underline"
            >
              Browse lessons
            </Link>
          </div>
        )}

        {!loading && lessons.length > 0 && (
          <ul className="space-y-3">
            {lessons.map((lesson) => (
              <li
                key={lesson.contentId}
                className="flex items-center justify-between rounded-xl border border-[var(--ll-border)]/50 bg-[var(--ll-bg)]/60 px-4 py-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/student/lesson/${lesson.contentId}`}
                    className="truncate text-sm font-medium text-[var(--ll-text)] hover:text-[var(--ll-yellow)]"
                  >
                    {lesson.contentId}
                  </Link>
                  <div className="mt-0.5 flex gap-3 text-xs text-[var(--ll-text-faint)]">
                    <span>Saved {formatDate(lesson.cachedAt)}</span>
                    <span>{formatBytes(lesson.sizeBytes)}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(lesson.contentId)}
                  className="ml-4 shrink-0 rounded-md px-2 py-1 text-xs text-[var(--ll-text-muted)] hover:bg-[var(--ll-surface-muted)]/60 hover:text-red-400"
                  aria-label={`Remove ${lesson.contentId} from offline cache`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
