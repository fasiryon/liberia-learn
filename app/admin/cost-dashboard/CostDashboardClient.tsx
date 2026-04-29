"use client";

import { useState, useCallback } from "react";
import type { PipelineCostSummary } from "@/lib/curriculum/pipelineCostSummary";

function fmt(n: number) {
  return `$${n.toFixed(4)}`;
}

function fmtShort(n: number) {
  return `$${n.toFixed(2)}`;
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "amber" | "green" | "red" | "blue";
}) {
  const colorMap = {
    amber: "text-amber-400",
    green: "text-emerald-400",
    red: "text-red-400",
    blue: "text-sky-400",
  };
  return (
    <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
      <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${accent ? colorMap[accent] : "text-[var(--ll-text)]"}`}>
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-[var(--ll-text-muted)]">{sub}</p>}
    </div>
  );
}

function SubjectTable({ rows }: { rows: PipelineCostSummary["audio"]["bySubject"] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-[var(--ll-text-muted)]">No data yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--ll-border)] text-left text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">
            <th className="pb-2 pr-4">Subject</th>
            <th className="pb-2 pr-4 text-right">Total cost</th>
            <th className="pb-2 pr-4 text-right">Lessons</th>
            <th className="pb-2 text-right">Avg / lesson</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--ll-border)]">
          {rows.map((r) => (
            <tr key={r.subject} className="py-2">
              <td className="py-2 pr-4 font-medium text-[var(--ll-text)]">{r.subject}</td>
              <td className="py-2 pr-4 text-right text-teal-300">{fmtShort(r.totalCostUsd)}</td>
              <td className="py-2 pr-4 text-right text-[var(--ll-text-muted)]">{r.lessonCount.toLocaleString()}</td>
              <td className="py-2 text-right text-[var(--ll-text-muted)]">{fmt(r.avgCostPerLesson)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GradeTable({ rows }: { rows: PipelineCostSummary["audio"]["byGrade"] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-[var(--ll-text-muted)]">No data yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--ll-border)] text-left text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">
            <th className="pb-2 pr-4">Grade</th>
            <th className="pb-2 pr-4 text-right">Total cost</th>
            <th className="pb-2 text-right">Lessons</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--ll-border)]">
          {rows.map((r) => (
            <tr key={r.grade}>
              <td className="py-2 pr-4 font-medium text-[var(--ll-text)]">Grade {r.grade}</td>
              <td className="py-2 pr-4 text-right text-teal-300">{fmtShort(r.totalCostUsd)}</td>
              <td className="py-2 text-right text-[var(--ll-text-muted)]">{r.lessonCount.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CostDashboardClient({
  initialData,
}: {
  initialData: PipelineCostSummary;
}) {
  const [data, setData] = useState(initialData);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/admin/cost-dashboard", { cache: "no-store" });
      if (res.ok) {
        setData(await res.json());
        setLastRefreshed(new Date());
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  const stopFlagActive = data.ttsStopFlagActive;

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {data.alerts.length > 0 && (
        <section className="space-y-2">
          {data.alerts.map((alert) => (
            <div
              key={alert}
              className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300"
            >
              <span className="mt-0.5 shrink-0">⚠</span>
              <p>{alert}</p>
            </div>
          ))}
        </section>
      )}

      {/* Stop flag status */}
      <section
        className={`flex items-start justify-between gap-4 rounded-xl border px-4 py-3 ${
          stopFlagActive
            ? "border-red-500/30 bg-red-500/10"
            : "border-emerald-500/30 bg-emerald-500/10"
        }`}
      >
        <div>
          <p className="text-sm font-semibold">
            TTS Generation:{" "}
            <span className={stopFlagActive ? "text-red-400" : "text-emerald-400"}>
              {stopFlagActive ? "STOPPED" : "ACTIVE"}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-[var(--ll-text-muted)]">
            {stopFlagActive
              ? "Set TTS_STOP_GENERATION=false (or remove the env var) in Vercel to resume."
              : "Set TTS_STOP_GENERATION=true in Vercel environment variables to halt new job claims."}
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="shrink-0 rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 px-3 py-1.5 text-xs text-[var(--ll-text-muted)] hover:text-[var(--ll-text)] disabled:opacity-50"
        >
          {refreshing ? "Refreshing…" : lastRefreshed ? `Refreshed ${lastRefreshed.toLocaleTimeString()}` : "Refresh"}
        </button>
      </section>

      {/* Summary stat cards */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Today (audio)"
          value={fmtShort(data.todayCostUsd)}
          sub={`of ${fmtShort(data.dailyCap)} daily cap`}
          accent={data.todayCostUsd >= data.dailyCap ? "red" : data.todayCostUsd >= data.dailyCap * 0.8 ? "amber" : "green"}
        />
        <StatCard
          label="Total audio generated"
          value={fmtShort(data.audio.totalCostUsd)}
          sub={`${data.audio.lessonCount.toLocaleString()} lessons`}
        />
        <StatCard
          label="Avg cost per lesson"
          value={fmt(data.audio.avgCostPerLesson)}
          sub="TTS audio only"
        />
        <StatCard
          label="Combined total"
          value={fmtShort(data.combinedTotalCostUsd)}
          sub={`Audio + ${data.textbooks.jobCount} textbook job${data.textbooks.jobCount !== 1 ? "s" : ""}`}
          accent="blue"
        />
      </section>

      {/* Budget progress */}
      <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">
              Monthly TTS Budget
            </p>
            <p className="mt-1 text-3xl font-bold text-[var(--ll-text)]">
              {fmtShort(data.audio.monthCostUsd)}
            </p>
            <p className="text-sm text-[var(--ll-text-muted)]">
              of {fmtShort(data.monthlyCap)} monthly cap
            </p>
          </div>
          <p className="text-xl font-semibold text-teal-300">
            {((data.audio.monthCostUsd / Math.max(data.monthlyCap, 0.001)) * 100).toFixed(1)}%
          </p>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-[var(--ll-surface)]">
          <div
            className={`h-full rounded-full transition-all ${
              data.audio.monthCostUsd >= data.monthlyCap * 0.9 ? "bg-red-400" : "bg-teal-400"
            }`}
            style={{
              width: `${Math.min((data.audio.monthCostUsd / Math.max(data.monthlyCap, 0.001)) * 100, 100)}%`,
            }}
          />
        </div>
      </section>

      {/* Audio by subject + grade */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
          <p className="mb-4 text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">
            Audio Cost by Subject
          </p>
          <SubjectTable rows={data.audio.bySubject} />
        </div>
        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
          <p className="mb-4 text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">
            Audio Cost by Grade
          </p>
          <GradeTable rows={data.audio.byGrade} />
        </div>
      </section>

      {/* Textbook costs */}
      {(data.textbooks.jobCount > 0 || data.textbooks.bySubject.length > 0) && (
        <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">
              Textbook Generation Cost
            </p>
            <p className="text-sm font-semibold text-teal-300">
              {fmtShort(data.textbooks.totalCostUsd)} total — {data.textbooks.jobCount} jobs
            </p>
          </div>
          {data.textbooks.bySubject.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--ll-border)] text-left text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">
                    <th className="pb-2 pr-4">Subject</th>
                    <th className="pb-2 pr-4 text-right">Total cost</th>
                    <th className="pb-2 text-right">Jobs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--ll-border)]">
                  {data.textbooks.bySubject.map((r) => (
                    <tr key={r.subject}>
                      <td className="py-2 pr-4 font-medium text-[var(--ll-text)]">{r.subject}</td>
                      <td className="py-2 pr-4 text-right text-teal-300">{fmtShort(r.totalCostUsd)}</td>
                      <td className="py-2 text-right text-[var(--ll-text-muted)]">{r.jobCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-[var(--ll-text-muted)]">No completed textbook jobs yet.</p>
          )}
        </section>
      )}

      {/* No data state */}
      {data.audio.lessonCount === 0 && data.textbooks.jobCount === 0 && data.alerts.length === 0 && (
        <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-8 text-center">
          <p className="text-sm text-[var(--ll-text-muted)]">
            No GENERATED audio or textbook records yet. Run Phase 1 to see costs here.
          </p>
        </section>
      )}
    </div>
  );
}
