"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Trophy } from "lucide-react";

type DistrictSummary = {
  district: string;
  topSchool: string;
  topScore: number;
  schoolCount: number;
};

type SchoolRow = {
  schoolId: string;
  schoolName: string;
  rank: number;
  score: number;
  pointsTotal: number;
  enrollmentCount: number;
};

export function MoeDistrictLeagueSection() {
  const [districts, setDistricts] = useState<DistrictSummary[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [drillRows, setDrillRows] = useState<SchoolRow[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/league/district/summary")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.districts) setDistricts(d.districts); })
      .finally(() => setLoading(false));
  }, []);

  async function toggleDistrict(district: string) {
    if (expanded === district) {
      setExpanded(null);
      return;
    }
    setExpanded(district);
    setDrillLoading(true);
    setDrillRows([]);
    const res = await fetch(`/api/league/district?district=${encodeURIComponent(district)}`).catch(() => null);
    const data = res?.ok ? await res.json() : null;
    setDrillRows(data?.rows ?? []);
    setDrillLoading(false);
  }

  if (loading) {
    return <div className="h-32 animate-pulse rounded-xl bg-[var(--ll-surface)]" />;
  }

  if (!districts.length) return null;

  return (
    <section className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--ll-text-muted)]">
          District Competition League
        </p>
        <h2 className="mt-1 text-xl font-bold text-[var(--ll-text)]">Weekly School Rankings</h2>
        <p className="text-sm text-[var(--ll-text-muted)]">Click a district to see individual school rankings.</p>
      </div>

      <div className="space-y-2">
        {districts.map((d) => (
          <div key={d.district} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)]">
            <button
              type="button"
              onClick={() => toggleDistrict(d.district)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <div className="flex items-center gap-3">
                <Trophy size={16} className="text-[var(--ll-yellow)]" />
                <div>
                  <p className="font-semibold text-[var(--ll-text)]">{d.district}</p>
                  <p className="text-xs text-[var(--ll-text-muted)]">
                    {d.schoolCount} schools · Leader: {d.topSchool} ({d.topScore.toFixed(1)} pts)
                  </p>
                </div>
              </div>
              {expanded === d.district ? (
                <ChevronDown size={16} className="text-[var(--ll-text-muted)]" />
              ) : (
                <ChevronRight size={16} className="text-[var(--ll-text-muted)]" />
              )}
            </button>

            {expanded === d.district && (
              <div className="border-t border-[var(--ll-border)] px-4 pb-3">
                {drillLoading ? (
                  <div className="py-4 text-center text-sm text-[var(--ll-text-muted)]">Loading…</div>
                ) : (
                  <table className="mt-2 w-full text-sm">
                    <thead>
                      <tr>
                        {["#", "School", "Score", "Points", "Students"].map((h) => (
                          <th
                            key={h}
                            className="pb-1 text-left text-xs font-semibold uppercase text-[var(--ll-text-muted)]"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {drillRows.map((r) => (
                        <tr key={r.schoolId} className="border-t border-[var(--ll-border)]/50">
                          <td className="py-1.5 font-bold text-[var(--ll-yellow)]">{r.rank}</td>
                          <td className="py-1.5 font-medium">{r.schoolName}</td>
                          <td className="py-1.5">{r.score.toFixed(1)}</td>
                          <td className="py-1.5 text-[var(--ll-text-muted)]">{Math.round(r.pointsTotal)}</td>
                          <td className="py-1.5 text-[var(--ll-text-muted)]">{r.enrollmentCount}</td>
                        </tr>
                      ))}
                      {drillRows.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-3 text-center text-[var(--ll-text-muted)]">
                            No data this week.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
