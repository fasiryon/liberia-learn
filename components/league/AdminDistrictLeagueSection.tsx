"use client";

import { useEffect, useState } from "react";
import { Trophy, TrendingUp, TrendingDown, Minus } from "lucide-react";

type HistoryEntry = {
  weekStart: string;
  weekEnd: string;
  rank: number;
  score: number;
  district: string;
  total: number;
};

type RankData = {
  rank: number | null;
  total: number | null;
  district: string | null;
  schoolName: string | null;
  nextReset: string | null;
};

export function AdminDistrictLeagueSection({ schoolId }: { schoolId: string }) {
  const [rank, setRank] = useState<RankData | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/league/district?schoolId=${encodeURIComponent(schoolId)}`).then((r) =>
        r.ok ? r.json() : null
      ),
      fetch(
        `/api/league/district?schoolId=${encodeURIComponent(schoolId)}&history=true`
      ).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([rankData, histData]) => {
        if (rankData) setRank(rankData);
        if (histData?.history) setHistory(histData.history);
      })
      .finally(() => setLoading(false));
  }, [schoolId]);

  if (loading) {
    return <div className="h-48 animate-pulse rounded-xl bg-[var(--ll-surface)]" />;
  }

  if (!rank?.district) return null;

  function trendIcon(entries: HistoryEntry[]) {
    if (entries.length < 2) return <Minus size={14} className="text-[var(--ll-text-muted)]" />;
    const diff = entries[1].rank - entries[0].rank;
    if (diff > 0) return <TrendingDown size={14} className="text-[var(--ll-danger)]" />;
    if (diff < 0) return <TrendingUp size={14} className="text-[var(--ll-yellow)]" />;
    return <Minus size={14} className="text-[var(--ll-text-muted)]" />;
  }

  const ordinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">
          District Competition
        </p>
        <h2 className="mt-1 text-lg font-semibold text-[var(--ll-text)]">
          Weekly school league · {rank.district}
        </h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Current rank card */}
        <div className="flex items-center gap-4 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--ll-yellow)]/10">
            <Trophy size={22} className="text-[var(--ll-yellow)]" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">
              Current District Rank
            </p>
            <p className="mt-1 text-2xl font-bold text-[var(--ll-text)]">
              {rank.rank != null ? ordinal(rank.rank) : "—"}
              <span className="ml-1 text-sm font-normal text-[var(--ll-text-muted)]">
                of {rank.total ?? "?"} schools
              </span>
            </p>
          </div>
        </div>

        {/* Trend over last 4 weeks */}
        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
          <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">
            Last 4 weeks
          </p>
          {history.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--ll-text-muted)]">No history yet.</p>
          ) : (
            <div className="mt-3 space-y-1">
              {history.map((h, i) => (
                <div key={h.weekStart} className="flex items-center justify-between text-sm">
                  <span className="text-[var(--ll-text-muted)]">
                    {new Date(h.weekStart).toLocaleDateString("en-LR", {
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    week
                  </span>
                  <span className="flex items-center gap-1 font-semibold text-[var(--ll-text)]">
                    {i < history.length - 1 && trendIcon(history.slice(i, i + 2))}
                    {ordinal(h.rank)}{" "}
                    <span className="text-xs font-normal text-[var(--ll-text-muted)]">
                      of {h.total}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
