"use client";

import { useState } from "react";

const REPORT_TYPES = [
  { value: "enrollment", label: "Student Enrollment" },
  { value: "attendance", label: "Attendance Records" },
  { value: "grades", label: "Grades" },
  { value: "curriculum", label: "Curriculum Items" },
];

export default function AdminReportsPage() {
  const [type, setType] = useState("enrollment");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadReport() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/school?type=${type}&format=json`, { cache: "no-store" });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed");
      }
      const d = await res.json();
      setData({ headers: d.headers, rows: d.rows });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function downloadCSV() {
    window.open(`/api/reports/school?type=${type}&format=csv`, "_blank");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
      <div className="mx-auto max-w-6xl space-y-6">
        <a href="/admin" className="text-sm text-emerald-300 hover:text-emerald-200">
          &larr; Back to Admin
        </a>
        <h1 className="text-2xl font-bold">Reports & Exports</h1>
        <p className="text-sm text-slate-400">
          Generate reports for your school. Download as CSV for MOE reporting.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
          >
            {REPORT_TYPES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>

          <button
            onClick={loadReport}
            disabled={loading}
            className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Preview"}
          </button>

          <button
            onClick={downloadCSV}
            className="rounded-xl border border-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/10"
          >
            Download CSV
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        {data && (
          <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
            <p className="text-xs text-slate-400 mb-3">{data.rows.length} rows</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left text-xs text-slate-500">
                    {data.headers.map((h) => (
                      <th key={h} className="pb-2 pr-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.slice(0, 50).map((row, i) => (
                    <tr key={i} className="border-b border-slate-800/50 text-slate-300">
                      {row.map((cell, j) => (
                        <td key={j} className="py-2 pr-3 text-xs">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.rows.length > 50 && (
                <p className="text-xs text-slate-500 mt-2">
                  Showing first 50 of {data.rows.length} rows. Download CSV for full data.
                </p>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
