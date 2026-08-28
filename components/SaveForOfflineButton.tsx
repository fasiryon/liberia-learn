"use client";

/**
 * components/SaveForOfflineButton.tsx
 *
 * Per-lesson button that explicitly caches lesson content to IndexedDB.
 * Prompts user to remove older lessons when MAX_CACHED_LESSONS (50) is reached.
 */

import { useEffect, useState } from "react";
import {
  cacheLessonContent,
  evictSafeCachedLessons,
  isLessonCached,
  removeCachedLesson,
  getCachedLessonCount,
  MAX_CACHED_LESSONS,
  type CachedLessonData,
} from "@/lib/lesson-offline-cache";
import type { SignedContentAvailabilityManifest } from "@/lib/content-availability-manifest";

type SaveForOfflineButtonProps = {
  contentId: string;
  lessonData: CachedLessonData;
};

export function SaveForOfflineButton({ contentId, lessonData }: SaveForOfflineButtonProps) {
  const [cached, setCached] = useState(false);
  const [saving, setSaving] = useState(false);
  const [atCapacity, setAtCapacity] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    isLessonCached(contentId).then(setCached);
  }, [contentId]);

  async function cacheCurrentSignedLesson(): Promise<boolean> {
    const response = await fetch(`/api/curriculum/${encodeURIComponent(contentId)}`, {
      cache: "no-store",
    });
    if (!response.ok) return false;
    const current = (await response.json()) as {
      metadata?: Record<string, unknown> | null;
      payload?: Record<string, unknown> | null;
      audio?: Record<string, unknown> | null;
      offlineManifest?: SignedContentAvailabilityManifest | null;
    };
    if (!current.offlineManifest) return false;
    return cacheLessonContent(
      contentId,
      {
        ...lessonData,
        metadata: current.metadata ?? null,
        payload: current.payload ?? null,
        audio: current.audio ?? null,
      },
      current.offlineManifest,
    );
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const count = await getCachedLessonCount();
      if (!cached && count >= MAX_CACHED_LESSONS) {
        setAtCapacity(true);
        setSaving(false);
        return;
      }

      const ok = await cacheCurrentSignedLesson();
      if (ok) setCached(true);
      else setError("Offline download could not complete. Reconnect and try again, or remove a downloaded lesson first.");
    } catch {
      setError("Offline download could not complete. Reconnect and try again, or remove a downloaded lesson first.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    const removed = await removeCachedLesson(contentId);
    if (removed) setCached(false);
    else setError("This download could not be removed. Your saved learner work remains protected.");
  }

  async function handleEvictAndSave() {
    setError(null);
    const evicted = await evictSafeCachedLessons({ maxItems: 1 });
    setAtCapacity(false);
    setSaving(true);
    try {
      if (evicted.removed.length === 0) {
        setError("No downloaded lesson is available for safe removal.");
        return;
      }
      const ok = await cacheCurrentSignedLesson();
      if (ok) setCached(true);
      else setError("Offline download could not complete after freeing space.");
    } catch {
      setError("Offline download could not complete after freeing space. Reconnect and try again.");
    } finally {
      setSaving(false);
    }
  }

  if (atCapacity) {
    return (
      <div className="rounded-xl bg-[var(--ll-yellow-soft)] border border-amber-500/30 px-4 py-3 text-sm">
        <p className="text-[var(--ll-yellow)] mb-2">
          You have reached the {MAX_CACHED_LESSONS}-lesson offline limit.
          Remove the oldest lesson to save this one?
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleEvictAndSave}
            className="rounded-md px-3 py-1 text-xs font-medium bg-[var(--ll-yellow-soft)] hover:bg-[var(--ll-yellow-soft)] text-[var(--ll-text)]"
          >
            Remove oldest &amp; save
          </button>
          <button
            type="button"
            onClick={() => setAtCapacity(false)}
            className="rounded-md px-3 py-1 text-xs font-medium bg-[var(--ll-surface-muted)] hover:bg-[var(--ll-surface-muted)] text-[var(--ll-text)]"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2 rounded-xl border border-amber-500/30 bg-[var(--ll-yellow-soft)] px-4 py-3 text-sm">
        <p className="text-[var(--ll-yellow)]">{error}</p>
        <button
          type="button"
          onClick={() => setError(null)}
          className="rounded-md bg-[var(--ll-surface-muted)] px-3 py-1 text-xs font-medium text-[var(--ll-text)]"
        >
          Dismiss
        </button>
      </div>
    );
  }

  if (cached) {
    return (
      <button
        type="button"
        onClick={handleRemove}
        className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium bg-[var(--ll-yellow-soft)] border border-emerald-600/40 text-[var(--ll-yellow)] hover:bg-[var(--ll-yellow-soft)]"
      >
        <span aria-hidden="true">✓</span>
        Saved for offline
        <span className="text-[var(--ll-yellow)] opacity-70 ml-1">(remove)</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleSave}
      disabled={saving}
      aria-busy={saving}
      className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium bg-[var(--ll-surface-muted)]/60 border border-[var(--ll-border)]/40 text-[var(--ll-text)] hover:bg-[var(--ll-surface-muted)] disabled:opacity-50"
    >
      {saving ? "Saving…" : "Save for offline"}
    </button>
  );
}
