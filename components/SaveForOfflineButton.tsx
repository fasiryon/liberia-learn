"use client";

/**
 * components/SaveForOfflineButton.tsx
 *
 * Per-lesson button that explicitly caches lesson content to IndexedDB.
 * Prompts user to remove older lessons when MAX_CACHED_LESSONS (20) is reached.
 */

import { useEffect, useState } from "react";
import {
  cacheLessonContent,
  isLessonCached,
  removeCachedLesson,
  getCachedLessonCount,
  listCachedLessons,
  MAX_CACHED_LESSONS,
  type CachedLessonData,
} from "@/lib/lesson-offline-cache";

type SaveForOfflineButtonProps = {
  contentId: string;
  lessonData: CachedLessonData;
};

export function SaveForOfflineButton({ contentId, lessonData }: SaveForOfflineButtonProps) {
  const [cached, setCached] = useState(false);
  const [saving, setSaving] = useState(false);
  const [atCapacity, setAtCapacity] = useState(false);
  const [oldestId, setOldestId] = useState<string | null>(null);

  useEffect(() => {
    isLessonCached(contentId).then(setCached);
  }, [contentId]);

  async function handleSave() {
    setSaving(true);
    try {
      const count = await getCachedLessonCount();
      if (!cached && count >= MAX_CACHED_LESSONS) {
        const list = await listCachedLessons();
        const oldest = list[list.length - 1];
        if (oldest) setOldestId(oldest.contentId);
        setAtCapacity(true);
        setSaving(false);
        return;
      }

      const ok = await cacheLessonContent(contentId, lessonData);
      if (ok) setCached(true);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    await removeCachedLesson(contentId);
    setCached(false);
  }

  async function handleEvictAndSave() {
    if (oldestId) {
      await removeCachedLesson(oldestId);
    }
    setAtCapacity(false);
    setOldestId(null);
    setSaving(true);
    const ok = await cacheLessonContent(contentId, lessonData);
    if (ok) setCached(true);
    setSaving(false);
  }

  if (atCapacity) {
    return (
      <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3 text-sm">
        <p className="text-amber-300 mb-2">
          You have reached the {MAX_CACHED_LESSONS}-lesson offline limit.
          Remove the oldest lesson to save this one?
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleEvictAndSave}
            className="rounded-md px-3 py-1 text-xs font-medium bg-amber-600 hover:bg-amber-500 text-white"
          >
            Remove oldest &amp; save
          </button>
          <button
            onClick={() => { setAtCapacity(false); setOldestId(null); }}
            className="rounded-md px-3 py-1 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-200"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (cached) {
    return (
      <button
        onClick={handleRemove}
        className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium bg-emerald-700/40 border border-emerald-600/40 text-emerald-300 hover:bg-emerald-700/60"
      >
        <span aria-hidden="true">✓</span>
        Saved for offline
        <span className="text-emerald-500 opacity-70 ml-1">(remove)</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleSave}
      disabled={saving}
      className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium bg-slate-700/60 border border-slate-600/40 text-slate-300 hover:bg-slate-700 disabled:opacity-50"
    >
      {saving ? "Saving…" : "Save for offline"}
    </button>
  );
}
