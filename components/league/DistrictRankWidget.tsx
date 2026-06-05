"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trophy } from "lucide-react";

type RankData = {
  rank: number | null;
  total: number | null;
  district: string | null;
  schoolName: string | null;
  score: number | null;
  nextReset: string | null;
};

function useCountdown(target: string | null) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    if (!target) return;
    const tick = () => {
      const diff = new Date(target).getTime() - Date.now();
      if (diff <= 0) { setLabel("Resetting…"); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setLabel(d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`);
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [target]);
  return label;
}

export function DistrictRankWidget({ schoolId }: { schoolId: string }) {
  const [data, setData] = useState<RankData | null>(null);
  const [loading, setLoading] = useState(true);
  const countdown = useCountdown(data?.nextReset ?? null);

  useEffect(() => {
    fetch(`/api/league/district?schoolId=${encodeURIComponent(schoolId)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setData(d); })
      .finally(() => setLoading(false));
  }, [schoolId]);

  if (loading) {
    return <div className="h-20 animate-pulse rounded-xl bg-[var(--ll-surface)]" />;
  }

  if (!data?.rank || !data.district) return null;

  const ordinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  return (
    <Link
      href="/league"
      className="flex items-center gap-4 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 hover:border-[var(--ll-yellow)]/50 transition-colors"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--ll-yellow)]/10">
        <Trophy size={22} className="text-[var(--ll-yellow)]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ll-text-muted)]">
          District Standing · {data.district}
        </p>
        <p className="mt-0.5 text-lg font-bold text-[var(--ll-text)]">
          {ordinal(data.rank)}{" "}
          <span className="text-sm font-normal text-[var(--ll-text-muted)]">
            of {data.total} schools
          </span>
        </p>
      </div>
      {countdown && (
        <div className="shrink-0 text-right">
          <p className="text-xs text-[var(--ll-text-muted)]">Resets in</p>
          <p className="text-sm font-semibold text-[var(--ll-accent)]">{countdown}</p>
        </div>
      )}
    </Link>
  );
}

export function DistrictLeaderboardPanel({ district }: { district: string }) {
  type Row = {
    schoolId: string;
    schoolName: string;
    rank: number;
    score: number;
    pointsTotal: number;
  };
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/league/district?district=${encodeURIComponent(district)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setRows(d.rows ?? []); })
      .finally(() => setLoading(false));
  }, [district]);

  if (loading) return <div className="h-24 animate-pulse rounded-xl bg-[var(--ll-surface)]" />;
  if (!rows.length) return <p className="text-xs text-[var(--ll-text-muted)]">No data this week.</p>;

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--ll-border)]">
      <table className="w-full text-sm">
        <thead className="bg-[var(--ll-surface)]">
          <tr>
            {["#", "School", "Score", "Points"].map((h) => (
              <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase text-[var(--ll-text-muted)]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.schoolId} className="border-t border-[var(--ll-border)]">
              <td className="px-3 py-2 font-bold text-[var(--ll-yellow)]">{r.rank}</td>
              <td className="px-3 py-2 font-medium">{r.schoolName}</td>
              <td className="px-3 py-2">{r.score.toFixed(1)}</td>
              <td className="px-3 py-2 text-[var(--ll-text-muted)]">{Math.round(r.pointsTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
