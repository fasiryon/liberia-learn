"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type WorkItem = {
  id: string;
  title: string;
  subject: string;
  contentType: string;
  estimatedDuration: number;
  periodNumber: number | null;
  startTime: string | null;
  endTime: string | null;
  status: "not_started" | "in_progress" | "completed";
  completedAt: string | null;
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  not_started: { label: "Not Started", cls: "bg-slate-700 text-slate-300" },
  in_progress: { label: "In Progress", cls: "bg-amber-500/20 text-amber-300" },
  completed: { label: "Completed", cls: "bg-emerald-500/20 text-emerald-300" },
};

export default function StudentTodayPage() {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/student/today")
      .then((r) => r.json())
      .then((d) => setItems(d.items || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="ll-dashboard-shell">
      <div className="mx-auto max-w-4xl px-4 py-6 space-y-5">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--ll-text)]">Today&apos;s Work</h1>
          <p className="text-sm text-[var(--ll-text-muted)] mt-1">
            {new Date().toLocaleDateString("en-LR", { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-[var(--ll-surface-muted)] animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="ll-section rounded-xl p-6 text-left">
            <p className="text-[var(--ll-text)]">You have no lessons scheduled today.</p>
            <p className="text-sm text-[var(--ll-text-muted)] mt-1">
              Browse the curriculum to keep learning while you wait for your next class assignment.
            </p>
            <Link
              href="/student/lessons"
              className="ll-command ll-focus mt-4 inline-flex text-sm font-semibold text-[var(--ll-text)]"
            >
              Browse lessons
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const badge = STATUS_BADGE[item.status];
              return (
                <Link
                  key={item.id}
                  href={`/student/lessons/${item.id}`}
                  className="ll-card ll-focus flex items-center gap-4 transition-colors hover:border-[var(--ll-border-strong)]"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--ll-accent-soft)] text-sm font-semibold text-[var(--ll-accent)]">
                    {item.subject.slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--ll-text)] truncate">{item.title}</p>
                    <p className="text-xs text-[var(--ll-text-muted)]">
                      {item.periodNumber ? `P${item.periodNumber}` : ""}{item.startTime && item.endTime ? ` \u2022 ${item.startTime}\u2013${item.endTime}` : ""}{" \u2022 "}{item.subject} &middot; {item.estimatedDuration} min
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${badge.cls}`}>
                    {badge.label}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
