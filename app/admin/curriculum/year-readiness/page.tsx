"use client";

import { useEffect, useState } from "react";

type ReadinessRow = {
  grade: number;
  subject: string;
  totalLessons: number;
  mappedLessons: number;
  readinessPct: number;
  weeksCovered: number;
  unitsCovered: number;
  missingWeeks: number[];
  missingAssessments: number;
  missingTeacherGuides: number;
  missingWorksheets: number;
  missingAudio: number;
  missingLabs: number;
  classification: "CRITICAL" | "PARTIAL" | "STRONG";
};

export default function CurriculumYearReadinessPage() {
  const [rows, setRows] = useState<ReadinessRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapping, setMapping] = useState(false);

  async function load() {
    const response = await fetch("/api/admin/curriculum/year-readiness", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok || data.error) throw new Error(data.error ?? "Failed to load readiness");
    setRows(data.rows ?? []);
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message)).finally(() => setLoading(false));
  }, []);

  async function runMapping() {
    setMapping(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/curriculum/year-readiness", { method: "POST" });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error ?? "Failed to map curriculum");
      setRows(data.rows ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to map curriculum");
    } finally {
      setMapping(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--ll-yellow)]">Year Readiness</p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">Full-Year Curriculum Organization</h1>
              <p className="mt-2 max-w-3xl text-sm text-[var(--ll-text-muted)]">
                Real mapped curriculum structure by grade, subject, unit, week, and lesson day. No generated content is used here.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={runMapping}
                disabled={mapping}
                className="min-h-11 rounded-full bg-[var(--ll-yellow-soft)] px-4 text-sm font-semibold text-[var(--ll-text-faint)] disabled:opacity-60"
              >
                {mapping ? "Mapping..." : "Map existing lessons"}
              </button>
              <a
                href="/api/admin/curriculum/year-readiness?format=csv"
                className="inline-flex min-h-11 items-center rounded-full border border-[var(--ll-border)] px-4 text-sm font-semibold"
              >
                Export report
              </a>
            </div>
          </div>
          {error ? <p className="mt-3 text-sm text-[var(--ll-danger)]">{error}</p> : null}
        </section>

        {loading ? (
          <div className="h-40 animate-pulse rounded-xl bg-[var(--ll-surface-muted)]" />
        ) : (
          <section className="overflow-x-auto rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-4">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-[0.16em] text-[var(--ll-text-faint)]">
                <tr>
                  <th className="p-2">Grade</th>
                  <th className="p-2">Subject</th>
                  <th className="p-2">Ready</th>
                  <th className="p-2">Mapped</th>
                  <th className="p-2">Weeks</th>
                  <th className="p-2">Units</th>
                  <th className="p-2">Missing Types</th>
                  <th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.grade}-${row.subject}`} className="border-t border-white/5">
                    <td className="p-2">Grade {row.grade}</td>
                    <td className="p-2">{row.subject.replace(/_/g, " ")}</td>
                    <td className="p-2 font-semibold">{row.readinessPct}%</td>
                    <td className="p-2">{row.mappedLessons}/{row.totalLessons}</td>
                    <td className="p-2">{row.weeksCovered}/36</td>
                    <td className="p-2">{row.unitsCovered}</td>
                    <td className="p-2 text-xs text-[var(--ll-text-muted)]">
                      {row.missingAssessments} assessments, {row.missingTeacherGuides} guides, {row.missingWorksheets} worksheets, {row.missingAudio} audio{row.missingLabs ? `, ${row.missingLabs} labs` : ""}
                    </td>
                    <td className="p-2">
                      <span className="rounded-full border border-[var(--ll-border)] px-2 py-1 text-xs">
                        {row.classification}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </main>
  );
}
