"use client";

/**
 * Learner-facing offline storage management. Lesson bytes are re-downloadable;
 * the P5-B outbox is a separate partition and is never touched by removal.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  evictSafeCachedLessons,
  removeCachedLesson,
  type CachedLessonEntry,
} from "@/lib/lesson-offline-cache";
import {
  getOfflineStorageSnapshot,
  storageUsagePercent,
  type OfflineStorageSnapshot,
} from "@/lib/offline/storageManagement";
import { detectAndSetActiveSessionPartition, type SessionPartition } from "@/lib/offline-session";

function formatBytes(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "Unknown";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const statusLabels: Record<CachedLessonEntry["status"], string> = {
  "trusted-current": "Trusted and current",
  expired: "Expired — download a current version when online",
  revoked: "Revoked — not served as trusted content",
  "update-required": "Update required before use",
  incomplete: "Incomplete — safe to remove and download again",
  corrupt: "Integrity check failed — safe to remove and repair",
};

export default function OfflineLessonsPage() {
  const [snapshot, setSnapshot] = useState<OfflineStorageSnapshot | null>(null);
  const [partition, setPartition] = useState<SessionPartition | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const current = await detectAndSetActiveSessionPartition();
    setPartition(current);
    const next = await getOfflineStorageSnapshot(current);
    setSnapshot(next);
    setLoading(false);
  }

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  async function handleRemove(contentId: string) {
    const removed = await removeCachedLesson(contentId, partition ?? undefined);
    setActionMessage(
      removed
        ? "Downloaded content removed. Unsynced learner work remains saved."
        : "Downloaded content could not be removed. Saved learner work remains protected.",
    );
    await load();
  }

  async function handleFreeSafeSpace() {
    const result = await evictSafeCachedLessons({ maxItems: 1, partition: partition ?? undefined });
    setActionMessage(
      result.removed.length > 0
        ? `Removed ${result.removed[0]} (${formatBytes(result.freedBytes)}). Unsynced learner work was not touched.`
        : "No downloaded lesson can be removed right now.",
    );
    await load();
  }

  const estimate = snapshot?.estimate;
  const usagePercent = estimate ? storageUsagePercent(estimate) : null;

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-sm text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]">
            ← Dashboard
          </Link>
        </div>

        <header>
          <h1 className="text-2xl font-bold tracking-tight">Offline Storage</h1>
          <p className="mt-2 text-sm text-[var(--ll-text-muted)]">
            Manage downloaded lessons. Removing a lesson never removes saved learner work waiting to sync.
          </p>
        </header>

        {snapshot ? (
          <section className="grid gap-3 sm:grid-cols-3" aria-label="Offline storage summary">
            <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
              <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">Browser storage</p>
              <p className="mt-2 text-lg font-semibold">{formatBytes(estimate?.usageBytes ?? null)}</p>
              <p className="text-xs text-[var(--ll-text-muted)]">
                {estimate?.quotaBytes != null ? `of ${formatBytes(estimate.quotaBytes)} quota` : "Estimate unavailable"}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
              <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">Downloaded content</p>
              <p className="mt-2 text-lg font-semibold">{snapshot.downloadedLessons.length} lesson{snapshot.downloadedLessons.length === 1 ? "" : "s"}</p>
              <p className="text-xs text-[var(--ll-text-muted)]">{formatBytes(snapshot.downloadedContentBytes)}</p>
            </div>
            <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
              <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">Saved learner work</p>
              <p className="mt-2 text-lg font-semibold">{snapshot.unsyncedWorkCount}</p>
              <p className="text-xs text-[var(--ll-text-muted)]">unsynced item{snapshot.unsyncedWorkCount === 1 ? "" : "s"}; protected</p>
            </div>
          </section>
        ) : null}

        {usagePercent != null && usagePercent >= 80 ? (
          <section className="rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm" role="alert">
            <p className="font-semibold text-red-300">Storage is almost full ({usagePercent.toFixed(0)}%).</p>
            <p className="mt-1 text-red-200">Remove downloaded lessons below to free space. Unsynced learner work will not be removed.</p>
          </section>
        ) : null}

        {snapshot?.unsyncedWorkCount ? (
          <section className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-4 text-sm" role="status">
            <p className="font-semibold text-amber-200">Sync pending: {snapshot.unsyncedWorkCount} learner item{snapshot.unsyncedWorkCount === 1 ? "" : "s"} remain on this device.</p>
            <p className="mt-1 text-amber-100">Downloaded lessons may be removed safely; saved work remains in the outbox until acknowledged.</p>
          </section>
        ) : null}

        {snapshot?.storageError ? (
          <p className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-4 text-sm text-amber-100" role="alert">
            Some storage details could not be read. Saved learner work is retained; reconnect before attempting a new download.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleFreeSafeSpace}
            disabled={loading || !snapshot?.downloadedLessons.length}
            className="rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Remove oldest safe lesson
          </button>
          <Link href="/student/offline-status" className="text-sm font-semibold text-[var(--ll-yellow)] underline-offset-2 hover:underline">
            View sync status
          </Link>
        </div>

        {loading ? (
          <div className="space-y-2" aria-label="Loading offline content">
            {[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-[var(--ll-surface)]" />)}
          </div>
        ) : !snapshot?.downloadedLessons.length ? (
          <div className="rounded-xl border border-[var(--ll-border)]/50 bg-[var(--ll-bg)]/60 px-6 py-8 text-center">
            <p className="text-sm text-[var(--ll-text-muted)]">No lessons saved for offline use yet.</p>
            <Link href="/student/lessons" className="mt-4 inline-block text-sm text-[var(--ll-yellow)] underline">
              Browse lessons
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {snapshot.downloadedLessons.map((lesson) => (
              <li key={lesson.contentId} className="rounded-xl border border-[var(--ll-border)]/50 bg-[var(--ll-bg)]/60 px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Link href={`/student/lesson/${lesson.contentId}`} className="truncate text-sm font-medium hover:text-[var(--ll-yellow)]">
                      {lesson.contentId}
                    </Link>
                    <p className="mt-1 text-xs text-[var(--ll-text-faint)]">
                      Saved {formatDate(lesson.cachedAt)} · {formatBytes(lesson.sizeBytes)}
                    </p>
                    <p className={`mt-1 text-xs ${lesson.status === "trusted-current" ? "text-emerald-300" : "text-amber-300"}`}>
                      {statusLabels[lesson.status]}
                      {lesson.expiresAt ? ` · Expires ${formatDate(lesson.expiresAt)}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(lesson.contentId)}
                    className="shrink-0 rounded-md px-2 py-1 text-xs text-[var(--ll-text-muted)] hover:bg-[var(--ll-surface-muted)] hover:text-red-300"
                    aria-label={`Remove ${lesson.contentId} from offline storage`}
                  >
                    Remove download
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {actionMessage ? <p className="text-sm text-[var(--ll-text-muted)]" role="status">{actionMessage}</p> : null}
        <p className="text-xs text-[var(--ll-text-faint)]">
          Browser or operating-system actions that clear site data or uninstall the PWA can remove local data beyond the app&apos;s control.
        </p>
      </div>
    </main>
  );
}
