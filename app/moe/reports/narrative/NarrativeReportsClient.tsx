"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";

type ReportListItem = {
  id: string;
  scope: string;
  scopeId: string | null;
  periodType: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  createdAt: string;
};

type ReportDetail = ReportListItem & {
  narrativeText: string;
  dataSnapshot: unknown;
  changesSummary: Array<{ metric: string; direction: string; magnitude: number; significance: string }> | null;
};

type NarrativeReportsClientProps = {
  districts: Array<{ id: string; name: string }>;
  schools: Array<{ id: string; name: string }>;
  isPlatformAdmin: boolean;
};

function formatScopeLabel(
  report: ReportListItem,
  districts: Array<{ id: string; name: string }>,
  schools: Array<{ id: string; name: string }>
): string {
  if (report.scope === "national") return "National";
  if (report.scope === "district") {
    return districts.find((d) => d.id === report.scopeId)?.name ?? `District (${report.scopeId})`;
  }
  return schools.find((s) => s.id === report.scopeId)?.name ?? `School (${report.scopeId})`;
}

export default function NarrativeReportsClient({ districts, schools, isPlatformAdmin }: NarrativeReportsClientProps) {
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ReportDetail | null>(null);
  const [runStatus, setRunStatus] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const [scope, setScope] = useState<"national" | "district" | "school">("national");
  const [scopeId, setScopeId] = useState("");
  const [periodType, setPeriodType] = useState<"monthly" | "quarterly">("monthly");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");

  async function loadReports() {
    setLoading(true);
    try {
      const res = await fetch("/api/moe/narrative-reports");
      const data = await res.json();
      setReports(Array.isArray(data.reports) ? data.reports : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, []);

  async function viewReport(id: string) {
    const res = await fetch(`/api/moe/narrative-reports/${id}`);
    const data = await res.json();
    if (data.report) setSelected(data.report);
  }

  async function generateReport() {
    setRunning(true);
    setRunStatus(null);
    try {
      const res = await fetch("/api/admin/agents/moe-narrative-report/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          scopeId: scope === "national" ? undefined : scopeId,
          periodType,
          periodStart,
          periodEnd,
        }),
      });
      const data = await res.json();
      setRunStatus(data.status ?? data.error ?? "unknown");
      await loadReports();
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)]">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ll-yellow)]">Reporting</p>
          <h1 className="text-3xl font-semibold text-[var(--ll-text)]">Narrative Reports</h1>
          <p className="max-w-3xl text-sm text-[var(--ll-text)]">
            Draft written progress reports generated from platform data. Every report is a draft only -
            review it in full before using it anywhere, nothing here is ever sent automatically.
          </p>
        </div>

        {isPlatformAdmin ? (
          <Card className="mt-8 p-6">
            <h2 className="text-xl font-semibold text-[var(--ll-text)]">Generate a report</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-[var(--ll-text-muted)]">
                Scope
                <select
                  value={scope}
                  onChange={(e) => {
                    setScope(e.target.value as typeof scope);
                    setScopeId("");
                  }}
                  className="mt-1 block min-h-11 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm text-[var(--ll-text)]"
                >
                  <option value="national">National</option>
                  <option value="district">District</option>
                  <option value="school">School</option>
                </select>
              </label>

              {scope === "district" ? (
                <label className="text-xs font-semibold text-[var(--ll-text-muted)]">
                  District
                  <select
                    value={scopeId}
                    onChange={(e) => setScopeId(e.target.value)}
                    className="mt-1 block min-h-11 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm text-[var(--ll-text)]"
                  >
                    <option value="">Select a district</option>
                    {districts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {scope === "school" ? (
                <label className="text-xs font-semibold text-[var(--ll-text-muted)]">
                  School
                  <select
                    value={scopeId}
                    onChange={(e) => setScopeId(e.target.value)}
                    className="mt-1 block min-h-11 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm text-[var(--ll-text)]"
                  >
                    <option value="">Select a school</option>
                    {schools.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <label className="text-xs font-semibold text-[var(--ll-text-muted)]">
                Period type
                <select
                  value={periodType}
                  onChange={(e) => setPeriodType(e.target.value as typeof periodType)}
                  className="mt-1 block min-h-11 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm text-[var(--ll-text)]"
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </label>

              <label className="text-xs font-semibold text-[var(--ll-text-muted)]">
                Period start
                <input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="mt-1 block min-h-11 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm text-[var(--ll-text)]"
                />
              </label>
              <label className="text-xs font-semibold text-[var(--ll-text-muted)]">
                Period end
                <input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="mt-1 block min-h-11 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm text-[var(--ll-text)]"
                />
              </label>
            </div>

            <button
              type="button"
              disabled={running || !periodStart || !periodEnd || (scope !== "national" && !scopeId)}
              onClick={generateReport}
              className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[var(--ll-yellow-soft)] px-5 py-2 text-sm font-semibold text-[var(--ll-text-faint)] disabled:opacity-50"
            >
              {running ? "Generating..." : "Generate Report"}
            </button>
            {runStatus ? (
              <p className="mt-3 text-xs text-[var(--ll-text-muted)]">Result: {runStatus}</p>
            ) : null}
          </Card>
        ) : null}

        <Card className="mt-8 p-6">
          <h2 className="text-xl font-semibold text-[var(--ll-text)]">Recent drafts</h2>
          {loading ? (
            <p className="mt-3 text-sm text-[var(--ll-text-muted)]">Loading...</p>
          ) : reports.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--ll-text-muted)]">No reports generated yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-[var(--ll-border)]">
              {reports.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--ll-text)]">
                      {formatScopeLabel(r, districts, schools)} - {r.periodType}
                    </p>
                    <p className="text-xs text-[var(--ll-text-muted)]">
                      {new Date(r.periodStart).toLocaleDateString()} to {new Date(r.periodEnd).toLocaleDateString()},
                      status {r.status}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => viewReport(r.id)}
                    className="inline-flex min-h-11 items-center rounded-xl border border-[var(--ll-border)] px-4 py-2 text-xs font-semibold text-[var(--ll-text)]"
                  >
                    View
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {selected ? (
          <Card className="mt-8 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[var(--ll-text)]">
                {formatScopeLabel(selected, districts, schools)} - {selected.periodType} draft
              </h2>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-xs font-semibold text-[var(--ll-text-muted)]"
              >
                Close
              </button>
            </div>
            <p className="mt-2 rounded-xl border border-amber-400/20 bg-[var(--ll-yellow-soft)] px-4 py-3 text-xs font-semibold text-[var(--ll-yellow)]">
              DRAFT - review in full before sharing anywhere. Nothing here has been sent.
            </p>
            <div className="mt-4 whitespace-pre-wrap text-sm text-[var(--ll-text)]">{selected.narrativeText}</div>

            {selected.changesSummary && selected.changesSummary.length > 0 ? (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-[var(--ll-text)]">Detected changes (deterministic)</h3>
                <ul className="mt-2 space-y-1 text-xs text-[var(--ll-text-muted)]">
                  {selected.changesSummary.map((c, i) => (
                    <li key={i}>
                      {c.metric}: {c.direction} {c.magnitude} ({c.significance})
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <details className="mt-6">
              <summary className="cursor-pointer text-sm font-semibold text-[var(--ll-text)]">
                Underlying data snapshot
              </summary>
              <pre className="mt-2 overflow-x-auto rounded-xl bg-black/20 p-4 text-xs text-[var(--ll-text-muted)]">
                {JSON.stringify(selected.dataSnapshot, null, 2)}
              </pre>
            </details>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
