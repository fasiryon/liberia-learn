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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Today&apos;s Work</h1>
        <p className="text-sm text-slate-400 mt-1">
          {new Date().toLocaleDateString("en-LR", { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-slate-800/50 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-8 text-center">
          <p className="text-slate-400">No lessons scheduled for today.</p>
          <p className="text-xs text-slate-500 mt-1">Check back tomorrow or ask your teacher.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const badge = STATUS_BADGE[item.status];
            return (
              <Link
                key={item.id}
                href={`/student/lessons/${item.id}`}
                className="flex items-center gap-4 rounded-2xl border border-white/10 bg-slate-900/70 p-4 hover:border-emerald-500/30 transition-colors"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 text-sm font-bold">
                  {item.subject.slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-100 truncate">{item.title}</p>
                  <p className="text-xs text-slate-400">
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
  );
}
