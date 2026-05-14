"use client";

import { useEffect, useState } from "react";
import { X, Megaphone } from "lucide-react";

type Announcement = {
  id: string;
  title: string;
  body: string;
  audience: string;
  isPinned: boolean;
  publishedAt: string | null;
  expiresAt: string | null;
};

const DISMISS_PREFIX = "ll_announce_dismiss_";

export function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Load dismissed IDs from localStorage
    const dismissedIds = new Set<string>();
    if (typeof window !== "undefined") {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(DISMISS_PREFIX)) {
          dismissedIds.add(key.slice(DISMISS_PREFIX.length));
        }
      }
    }
    setDismissed(dismissedIds);

    fetch("/api/announcements", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.announcements) {
          setAnnouncements(d.announcements.filter((a: Announcement) => a.isPinned));
        }
      })
      .catch(() => null);
  }, []);

  function dismiss(id: string) {
    localStorage.setItem(`${DISMISS_PREFIX}${id}`, "1");
    setDismissed((prev) => new Set([...prev, id]));
  }

  const visible = announcements.filter((a) => !dismissed.has(a.id));

  if (visible.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {visible.map((a) => (
        <div
          key={a.id}
          className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3"
          role="alert"
        >
          <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" strokeWidth={1.5} aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-300">{a.title}</p>
            <p className="mt-0.5 text-xs text-amber-200/80">{a.body}</p>
          </div>
          <button
            type="button"
            onClick={() => dismiss(a.id)}
            className="shrink-0 text-amber-400/70 hover:text-amber-300"
            aria-label="Dismiss announcement"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
      ))}
    </div>
  );
}
