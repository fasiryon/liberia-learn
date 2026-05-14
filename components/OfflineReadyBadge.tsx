"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Download } from "lucide-react";

const CACHE_NAME = "liberialearn-v2";

type Props = { lessonId: string; href?: string };

export function OfflineReadyBadge({ lessonId, href }: Props) {
  const [cached, setCached] = useState(false);
  const [loading, setLoading] = useState(true);
  const [caching, setCaching] = useState(false);

  const lessonUrl = href ?? `/student/lessons/${lessonId}`;

  useEffect(() => {
    if (typeof caches === "undefined") {
      setLoading(false);
      return;
    }
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.match(lessonUrl))
      .then((match) => {
        setCached(!!match);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [lessonUrl]);

  if (loading) return null;

  async function handleDownload(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (typeof caches === "undefined") return;
    setCaching(true);
    try {
      const cache = await caches.open(CACHE_NAME);
      await cache.add(lessonUrl);
      setCached(true);
    } catch {
      // silently fail — user will see "Save offline" again on next render
    } finally {
      setCaching(false);
    }
  }

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
    <button
      type="button"
      title="Download for offline"
      onClick={handleDownload}
      disabled={caching}
      className="inline-flex items-center gap-1 rounded-full border border-[var(--ll-border)]/40 bg-[var(--ll-surface-muted)]/60 px-2 py-0.5 text-[10px] font-medium text-[var(--ll-text-muted)] hover:text-[var(--ll-text)] disabled:opacity-50"
    >
      <Download className="h-3 w-3" strokeWidth={1.5} />
      {caching ? "Saving…" : "Save offline"}
    </button>
  );
}
