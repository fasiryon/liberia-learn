"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GRADES, SUBJECTS, NATIONAL_GATE, type CoverageResult, type CoverageCell } from "@/app/api/admin/curriculum/coverage/route";

function cellColor(cell: CoverageCell): string {
  if (cell.approved === 0) return "bg-red-500/20 text-red-400 border-red-500/30";
  if (cell.meetsGate) return "bg-emerald-500/15 text-emerald-400 border-emerald-500/25";
  return "bg-amber-500/15 text-amber-400 border-amber-500/25";
}

function CoverageCell({
  cell,
  grade,
  subject,
}: {
  cell: CoverageCell;
  grade: string;
  subject: string;
}) {
  const audioPercent =
    cell.approved > 0 ? Math.round((cell.withAudio / cell.approved) * 100) : 0;

  return (
    <div
      title={`${grade} ${subject}: ${cell.approved} approved, ${cell.pending} pending, ${cell.needsReview} needs review, ${audioPercent}% audio`}
      className={`flex flex-col items-center justify-center rounded border p-1 text-center text-xs ${cellColor(cell)}`}
      style={{ minHeight: "3rem" }}
    >
      <span className="font-semibold">{cell.approved}</span>
      {cell.approved > 0 ? (
        <span className="text-[10px] opacity-70">{audioPercent}% 🔊</span>
      ) : null}
    </div>
  );
}

export default function CoverageDashboardPage() {
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/admin/curriculum" className="text-sm text-[var(--ll-yellow)] hover:opacity-80">
            &larr; Curriculum
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--ll-text)]">Coverage Dashboard</h1>
          <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
            National gate: ≥{NATIONAL_GATE} approved lessons per grade × subject cell
          </p>
        </div>
        {data ? (
          <p className="text-xs text-[var(--ll-text-faint)]">
            Updated {new Date(data.summary.generatedAt).toLocaleString()}
          </p>
        ) : null}
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-xl bg-[var(--ll-surface)]" />
      ) : error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{error}</p>
      ) : data ? (
        <>
          {/* Summary bar */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--ll-text-muted)]">Cells at gate</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--ll-text)]">
                {data.summary.passingCells}
                <span className="text-sm font-normal text-[var(--ll-text-muted)]"> / {data.summary.totalCells}</span>
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--ll-surface-muted)]">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${data.summary.coveragePercent}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-[var(--ll-text-faint)]">{data.summary.coveragePercent}% national coverage</p>
            </div>
            <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--ll-text-muted)]">Content deserts</p>
              <p className="mt-2 text-2xl font-semibold text-red-400">{data.deserts.length}</p>
              <p className="mt-1 text-xs text-[var(--ll-text-faint)]">grade × subject cells with zero approved lessons</p>
            </div>
            <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--ll-text-muted)]">National gate</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--ll-text)]">{NATIONAL_GATE}</p>
              <p className="mt-1 text-xs text-[var(--ll-text-faint)]">minimum approved lessons per cell for MOE sign-off</p>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-emerald-400">
              ■ ≥{NATIONAL_GATE} — gate met
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-amber-400">
              ■ 1–{NATIONAL_GATE - 1} — below gate
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-1 text-red-400">
              ■ 0 — desert
            </span>
          </div>

          {/* 12×8 heatmap */}
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
                    {SUBJECTS.map((subject) => (
                      <td key={subject} className="px-0.5 py-0.5">
                        <CoverageCell
                          cell={data.matrix[grade][subject]}
                          grade={grade}
                          subject={subject}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Desert list */}
          {data.deserts.length > 0 ? (
            <div>
              <h2 className="text-base font-semibold text-[var(--ll-text)]">Content deserts ({data.deserts.length})</h2>
              <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
                These grade × subject combinations have zero approved lessons. Generate content to close the gap.
              </p>
              <div className="mt-3 overflow-hidden rounded-xl border border-[var(--ll-border)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--ll-border)] bg-[var(--ll-surface)]">
                      <th className="px-4 py-3 text-left font-semibold text-[var(--ll-text)]">Grade</th>
                      <th className="px-4 py-3 text-left font-semibold text-[var(--ll-text)]">Subject</th>
                      <th className="px-4 py-3 text-right font-semibold text-[var(--ll-text)]">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.deserts.map((desert) => (
                      <tr key={`${desert.grade}-${desert.subject}`} className="border-b border-[var(--ll-border)] last:border-0">
                        <td className="px-4 py-3 text-[var(--ll-text)]">{desert.grade}</td>
                        <td className="px-4 py-3 text-[var(--ll-text)]">{desert.subject.replace(/_/g, " ")}</td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/admin/curriculum?generate=1&grade=${desert.grade.replace("G", "")}&subject=${desert.subject}`}
                            className="rounded-lg bg-[var(--ll-accent)] px-3 py-1.5 text-xs font-semibold text-[var(--ll-text-faint)]"
                          >
                            Generate
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
