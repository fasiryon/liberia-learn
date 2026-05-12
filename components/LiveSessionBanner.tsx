"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type LiveSession = {
  id: string;
  subject: string | null;
  Class: { name: string; subject: string } | null;
};

export function LiveSessionBanner() {
  const router = useRouter();
  const [session, setSession] = useState<LiveSession | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function checkActive() {
    try {
      const res = await fetch("/api/student/live-sessions/active", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const first: LiveSession | null = data.sessions?.[0] ?? null;
      setSession(first);
      if (first) setDismissed(false);
    } catch {
      // silent
    }
  }

  useEffect(() => {
    checkActive();
    intervalRef.current = setInterval(checkActive, 30000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  if (!session || dismissed) return null;

  const subjectLabel =
    (session.subject ?? session.Class?.subject ?? "").replace(/_/g, " ") || "Your";

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
      <div className="flex items-center gap-2 text-amber-200">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
        </span>
        <span>
          <span className="font-semibold">🔴 Your {subjectLabel} class is live now</span>
          {" → Join"}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => router.push(`/student/live/${session.id}`)}
          className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600"
        >
          Join Now
        </button>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => setDismissed(true)}
          className="text-[var(--ll-text-faint)] hover:text-[var(--ll-text)]"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
