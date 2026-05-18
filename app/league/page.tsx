"use client";

import { useEffect, useState, useMemo } from "react";

type LeagueRow = {
  id: string;
  schoolId: string;
  schoolName: string;
  county: string;
  district: string;
  term: string;
  avgGrade: number;
  attendance: number;
  lessonCompletion: number;
  studentCount: number;
  nationalRank: number | null;
  countyRank: number | null;
  score: number;
};

function pct(n: number) {
  return `${Math.round(n)}%`;
}

const IFRAME_SNIPPET = `<iframe src="https://liberia-learn.vercel.app/league/embed" width="100%" height="600" frameborder="0" title="LiberiaLearn National School Rankings"></iframe>`;

export default function LeaguePage() {
  const [rows, setRows] = useState<LeagueRow[]>([]);
  const [term, setTerm] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [county, setCounty] = useState("");
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/league");
        if (res.ok) {
          const data = await res.json();
          setRows(data.rows ?? []);
          setTerm(data.term ?? "");
          setUpdatedAt(data.updatedAt ? new Date(data.updatedAt).toLocaleDateString() : null);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const counties = useMemo(() => {
    const set = new Set(rows.map((r) => r.county).filter(Boolean));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const matchCounty = !county || r.county === county;
      const matchSearch = !search || r.schoolName.toLowerCase().includes(search.toLowerCase());
      return matchCounty && matchSearch;
    });
  }, [rows, county, search]);

  function handleCopyEmbed() {
    navigator.clipboard.writeText(IFRAME_SNIPPET).catch(() => null);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-10 text-[var(--ll-text)]">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--ll-yellow)]">
            Powered by Liberia Ministry of Education
          </p>
          <h1 className="text-3xl font-bold">LiberiaLearn National School Rankings</h1>
          <p className="text-sm text-[var(--ll-text-muted)]">
            {term ? `Term: ${term}` : ""}
            {updatedAt ? ` · Last updated: ${updatedAt}` : ""}
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search school..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface)] px-3 py-2 text-sm text-[var(--ll-text)] placeholder-[var(--ll-text-muted)] focus:outline-none"
          />
          <select
            value={county}
            onChange={(e) => setCounty(e.target.value)}
            className="rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface)] px-3 py-2 text-sm text-[var(--ll-text)] focus:outline-none"
          >
            <option value="">All Counties</option>
            {counties.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleCopyEmbed}
            className="ml-auto rounded-lg bg-[var(--ll-yellow)] px-4 py-2 text-sm font-semibold text-[var(--ll-bg)] hover:opacity-90"
          >
            {copied ? "Copied!" : "Embed this table"}
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-[var(--ll-surface)]" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--ll-border)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--ll-surface)]">
                <tr>
                  {["Rank", "School", "County", "Students", "Avg Grade", "Attendance", "Lessons", "Score"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--ll-text-muted)]"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-[var(--ll-text-muted)]">
                      No data available for this term.
                    </td>
                  </tr>
                )}
                {filtered.slice(0, 100).map((r, idx) => (
                  <tr key={r.id} className="border-t border-[var(--ll-border)] hover:bg-[var(--ll-surface-muted)]">
                    <td className="px-4 py-3 font-bold text-[var(--ll-yellow)]">
                      {county ? (r.countyRank ?? idx + 1) : (r.nationalRank ?? idx + 1)}
                    </td>
                    <td className="px-4 py-3 font-medium">{r.schoolName}</td>
                    <td className="px-4 py-3 text-[var(--ll-text-muted)]">{r.county || "—"}</td>
                    <td className="px-4 py-3">{r.studentCount}</td>
                    <td className="px-4 py-3">{pct(r.avgGrade)}</td>
                    <td className="px-4 py-3">{pct(r.attendance)}</td>
                    <td className="px-4 py-3">{pct(r.lessonCompletion)}</td>
                    <td className="px-4 py-3 font-semibold">{r.score.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-[var(--ll-text-faint)]">
          Score = Avg Grade × 0.5 + Attendance × 0.3 + Lesson Completion × 0.2
        </p>
      </div>
    </main>
  );
}
