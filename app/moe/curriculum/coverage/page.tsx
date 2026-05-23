"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GRADES, SUBJECTS, NATIONAL_GATE, type CoverageResult, type CoverageCell } from "@/app/api/admin/curriculum/coverage/route";

function cellClass(cell: CoverageCell): string {
  if (cell.approved === 0) return "bg-red-500/20 text-red-400 border-red-500/30";
  if (cell.meetsGate) return "bg-emerald-500/15 text-emerald-400 border-emerald-500/25";
  return "bg-amber-500/15 text-amber-400 border-amber-500/25";
}

export default function MoeCoveragePage() {
  const [data, setData] = useState<CoverageResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/curriculum/coverage", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((d) => setData(d))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/moe/curriculum" className="text-sm text-[var(--ll-yellow)] hover:opacity-80">
          &larr; Curriculum
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--ll-text)]">Coverage Matrix</h1>
        <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
          National gate: ≥{NATIONAL_GATE} approved lessons per grade × subject cell
        </p>
        {data ? (
          <p className="mt-1 text-xs text-[var(--ll-text-faint)]">
            Updated {new Date(data.summary.generatedAt).toLocaleString()} · refreshes every 30 min
          </p>
        ) : null}
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-xl bg-[var(--ll-surface)]" />
      ) : error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{error}</p>
      ) : data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--ll-text-muted)]">Cells at gate</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--ll-text)]">
                {data.summary.passingCells}
                <span className="text-sm font-normal text-[var(--ll-text-muted)]"> / {data.summary.totalCells}</span>
              </p>
              <p className="mt-1 text-xs text-[var(--ll-text-faint)]">{data.summary.coveragePercent}% national coverage</p>
            </div>
            <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--ll-text-muted)]">Content deserts</p>
              <p className="mt-2 text-2xl font-semibold text-red-400">{data.deserts.length}</p>
              <p className="mt-1 text-xs text-[var(--ll-text-faint)]">grade × subject cells with zero lessons</p>
            </div>
            <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--ll-text-muted)]">National gate</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--ll-text)]">{NATIONAL_GATE}</p>
              <p className="mt-1 text-xs text-[var(--ll-text-faint)]">minimum approved lessons per cell</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 text-xs">
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-emerald-400">■ ≥{NATIONAL_GATE} — gate met</span>
            <span className="rounded-full bg-amber-500/15 px-3 py-1 text-amber-400">■ 1–{NATIONAL_GATE - 1} — below gate</span>
            <span className="rounded-full bg-red-500/15 px-3 py-1 text-red-400">■ 0 — desert</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="py-2 pr-3 text-left text-[var(--ll-text-muted)]">Grade</th>
                  {SUBJECTS.map((subject) => (
                    <th key={subject} className="px-1 py-2 text-center text-[var(--ll-text-muted)]">
                      {subject.replace(/_/g, " ")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {GRADES.map((grade) => (
                  <tr key={grade}>
                    <td className="py-1 pr-3 font-semibold text-[var(--ll-text)]">{grade}</td>
                    {SUBJECTS.map((subject) => {
                      const cell = data.matrix[grade][subject];
                      return (
                        <td key={subject} className="px-0.5 py-0.5">
                          <div
                            title={`${grade} ${subject}: ${cell.approved} approved`}
                            className={`flex items-center justify-center rounded border p-1 text-center text-xs font-semibold ${cellClass(cell)}`}
                            style={{ minHeight: "2.5rem" }}
                          >
                            {cell.approved}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.deserts.length > 0 ? (
            <div>
              <h2 className="text-base font-semibold text-[var(--ll-text)]">Deserts ({data.deserts.length})</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {data.deserts.map((d) => (
                  <span key={`${d.grade}-${d.subject}`} className="rounded-full bg-red-500/10 px-3 py-1 text-xs text-red-400">
                    {d.grade} {d.subject.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-400">
              No content deserts — every grade × subject has at least one approved lesson.
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}
