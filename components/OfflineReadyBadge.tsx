"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Download } from "lucide-react";
import { isLessonCached } from "@/lib/lesson-offline-cache";

type Props = { lessonId: string; href?: string };

export function OfflineReadyBadge({ lessonId, href }: Props) {
  const [cached, setCached] = useState(false);
  const [loading, setLoading] = useState(true);

  const lessonUrl = href ?? `/student/lessons/${lessonId}`;

  useEffect(() => {
    isLessonCached(lessonId)
      .then((available) => {
        setCached(available);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [lessonId]);

  if (loading) return null;

  if (cached) {
    return (
      <span
        title="Available offline"
        className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400"
      >
        <CheckCircle2 className="h-3 w-3" strokeWidth={1.5} />
        Offline
      </span>
    );
  }

  return (
    <a
      href={lessonUrl}
      title="Open lesson to save trusted content for offline use"
      className="inline-flex items-center gap-1 rounded-full border border-[var(--ll-border)]/40 bg-[var(--ll-surface-muted)]/60 px-2 py-0.5 text-[10px] font-medium text-[var(--ll-text-muted)] hover:text-[var(--ll-text)] disabled:opacity-50"
    >
      <Download className="h-3 w-3" strokeWidth={1.5} />
      Save offline
    </a>
  );
}
