"use client";

import { useEffect, useState } from "react";

type Brief = { briefText: string; createdAt: string };

export function TeacherMorningBrief() {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/teacher/brief", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.statusText)))
      .then((json: { brief: Brief | null }) => active && setBrief(json.brief))
      .catch((err) => active && setError(String(err)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Morning Brief</h1>
        <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
          A short daily digest generated before school starts: students who need attention,
          certificate unlocks close, and ungraded work waiting for you.
        </p>
      </div>

      {loading ? (
        <div className="h-24 animate-pulse rounded-xl bg-[var(--ll-surface)]" />
      ) : error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          Could not load your brief: {error}
        </p>
      ) : brief ? (
        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-5">
          <p className="text-sm leading-relaxed">{brief.briefText}</p>
          <p className="mt-4 text-xs text-[var(--ll-text-faint)]">
            Generated {new Date(brief.createdAt).toLocaleString()}
          </p>
        </div>
      ) : (
        <p className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 text-sm text-[var(--ll-text-muted)]">
          No brief yet for today. Briefs generate automatically each school-day morning.
        </p>
      )}
    </div>
  );
}
