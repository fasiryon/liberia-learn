"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle, Users, TrendingUp, Shield } from "lucide-react";

type MessageStats = {
  totalToday: number;
  studentToTeacher: number;
  teacherToStudent: number;
  guardianToTeacher: number;
  flaggedMessages: number;
};

export default function AdminCommunicationsPage() {
  const [stats, setStats] = useState<MessageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/messages/stats", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("Unable to load stats");
        return r.json();
      })
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link href="/admin" className="text-xs text-[var(--ll-yellow)] hover:opacity-80">
          &larr; Back to Admin
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Communications</h1>
          <p className="mt-1 text-sm text-[var(--ll-text-muted)]">Message volume overview — no content visible to admin.</p>
        </div>

        {/* Privacy notice */}
        <div className="flex items-start gap-3 rounded-xl border border-[var(--ll-yellow)]/20 bg-[var(--ll-yellow)]/5 px-4 py-3">
          <Shield className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ll-yellow)]" strokeWidth={1.5} />
          <p className="text-xs text-[var(--ll-text-muted)]">
            Message content is private and not accessible to administrators. Only aggregate volume counts are shown here.
          </p>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-[var(--ll-surface)]" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>
        ) : stats ? (
          <div className="space-y-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--ll-text-muted)]">Today&apos;s Volume</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard
                icon={<MessageCircle className="h-5 w-5" strokeWidth={1.5} />}
                label="Total Messages Sent Today"
                value={stats.totalToday}
                accent="emerald"
              />
              <StatCard
                icon={<Users className="h-5 w-5" strokeWidth={1.5} />}
                label="Student → Teacher"
                value={stats.studentToTeacher}
                accent="blue"
              />
              <StatCard
                icon={<TrendingUp className="h-5 w-5" strokeWidth={1.5} />}
                label="Guardian → Teacher"
                value={stats.guardianToTeacher}
                accent="amber"
              />
              <StatCard
                icon={<Shield className="h-5 w-5" strokeWidth={1.5} />}
                label="Flagged Messages"
                value={stats.flaggedMessages}
                accent="red"
                note="Flag system coming in a future sprint"
              />
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent: "emerald" | "blue" | "amber" | "red";
  note?: string;
}) {
  const colors = {
    emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
    blue: "border-blue-500/20 bg-blue-500/10 text-blue-400",
    amber: "border-amber-500/20 bg-amber-500/10 text-amber-400",
    red: "border-red-500/20 bg-red-500/10 text-red-400",
  };

  return (
    <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-5 space-y-3">
      <div className={`inline-flex rounded-lg border p-2 ${colors[accent]}`}>{icon}</div>
      <div>
        <p className="text-xs text-[var(--ll-text-muted)]">{label}</p>
        <p className="mt-1 text-3xl font-bold text-[var(--ll-text)]">{value}</p>
        {note && <p className="mt-1 text-[11px] text-[var(--ll-text-faint)]">{note}</p>}
      </div>
    </div>
  );
}
