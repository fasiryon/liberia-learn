"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type DashboardData = {
  schools: number;
  districts: number;
  students: number;
  scheduledWork: {
    total: number;
    delivered: number;
    deliveryRatePct: number | null;
  };
  interventionsLast30Days: number;
};

type ComplianceDistrict = {
  districtId: string;
  districtName: string;
  region: string | null;
  schoolCount: number;
  scheduledWorkTotal: number;
  scheduledWorkDelivered: number;
  compliancePct: number | null;
};

type ComplianceData = {
  national: {
    scheduledWorkTotal: number;
    scheduledWorkDelivered: number;
    compliancePct: number | null;
  };
  byDistrict: ComplianceDistrict[];
};

type InterventionData = {
  national: {
    totalInterventions: number;
    avgOutcomeDelta: number | null;
    avgOutcomeEffectSize: number | null;
  };
  byDistrict: Array<{
    districtId: string;
    interventionCount: number;
    riskFlags: Record<string, number>;
  }>;
};

function formatPct(value: number | null | undefined) {
  if (value == null) return "—";
  return `${value.toFixed(1)}%`;
}

function toCsv(rows: string[][]) {
  return rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
}

export default function MoeDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [compliance, setCompliance] = useState<ComplianceData | null>(null);
  const [interventions, setInterventions] = useState<InterventionData | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([
      fetch("/api/moe/dashboard", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/moe/delivery-compliance", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/moe/intervention-impact", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([dash, comp, inter]) => {
        if (!active) return;
        if (dash?.error || comp?.error || inter?.error) {
          setError("Unable to load data — please refresh.");
          return;
        }
        setDashboard(dash);
        setCompliance(comp);
        setInterventions(inter);
      })
      .catch(() => {
        if (!active) return;
        setError("Unable to load data — please refresh.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const fullyCompliantDistricts = useMemo(() => {
    if (!compliance?.byDistrict) return 0;
    return compliance.byDistrict.filter((d) => (d.compliancePct ?? 0) >= 100).length;
  }, [compliance]);

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch("/api/moe/delivery-compliance", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || data?.error) {
        throw new Error(data?.error || "Export failed");
      }

      const rows: string[][] = [
        [
          "District",
          "Region",
          "Schools",
          "Lessons Scheduled",
          "Lessons Delivered",
          "Compliance %",
        ],
        ...(data.byDistrict || []).map((d: ComplianceDistrict) => [
          d.districtName,
          d.region ?? "",
          String(d.schoolCount ?? 0),
          String(d.scheduledWorkTotal ?? 0),
          String(d.scheduledWorkDelivered ?? 0),
          d.compliancePct == null ? "" : d.compliancePct.toFixed(2),
        ]),
      ];

      const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `moe-compliance-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setExportError(err.message || "Export failed");
    } finally {
      setExporting(false);
    }
  }

  const districtRows = compliance?.byDistrict ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">
          National Overview
        </p>
        <h1 className="text-3xl font-semibold text-slate-100">
          LiberiaLearn National Dashboard
        </h1>
        <p className="text-sm text-slate-400">
          Aggregated indicators across all districts. No student-level data.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Stat cards */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 animate-pulse"
            >
              <div className="space-y-3">
                <div className="h-3 w-1/2 rounded bg-white/10" />
                <div className="h-7 w-24 rounded bg-white/10" />
                <div className="h-3 w-2/3 rounded bg-white/10" />
              </div>
            </div>
          ))
        ) : (
          <>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs text-slate-400">Schools Active</p>
              <p className="mt-2 text-3xl font-semibold text-emerald-200">
                {dashboard?.schools ?? 0}
              </p>
              <p className="text-xs text-slate-500">
                across {dashboard?.districts ?? 0} districts
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs text-slate-400">Lessons Delivered</p>
              <p className="mt-2 text-3xl font-semibold text-cyan-200">
                {dashboard?.scheduledWork?.delivered ?? 0}
              </p>
              <p className="text-xs text-slate-500">this month</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs text-slate-400">National Mastery Rate</p>
              <div className="mt-2 flex items-baseline gap-2">
                <p className="text-3xl font-semibold text-amber-200">
                  {formatPct(compliance?.national?.compliancePct)}
                </p>
                <span className="text-xs text-emerald-300">▲</span>
              </div>
              <p className="text-xs text-slate-500">delivery compliance proxy</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs text-slate-400">Active Interventions</p>
              <p className="mt-2 text-3xl font-semibold text-rose-200">
                {dashboard?.interventionsLast30Days ?? 0}
              </p>
              <p className="text-xs text-slate-500">students at risk</p>
            </div>
          </>
        )}
      </section>

      {/* District Performance */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">District Performance</h2>
            <p className="text-xs text-slate-500">Delivery compliance by district</p>
          </div>
          <Link
            href="/moe/districts"
            className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:text-slate-100"
          >
            View all districts
          </Link>
        </div>

        {loading ? (
          <div className="mt-4 space-y-2">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div key={idx} className="h-10 rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : districtRows.length === 0 ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-black/10 p-6 text-sm text-slate-400">
            No data available yet. District compliance will appear once lessons are delivered.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs text-slate-500">
                  <th className="pb-2 pr-4">District</th>
                  <th className="pb-2 pr-4">Schools</th>
                  <th className="pb-2 pr-4">Students</th>
                  <th className="pb-2 pr-4">Lessons</th>
                  <th className="pb-2 pr-4">Mastery Rate</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {districtRows.map((d) => {
                  const status =
                    d.compliancePct == null
                      ? "No data"
                      : d.compliancePct >= 85
                      ? "On Track"
                      : d.compliancePct >= 60
                      ? "Watch"
                      : "At Risk";
                  return (
                    <tr key={d.districtId} className="border-b border-white/5 text-slate-200">
                      <td className="py-3 pr-4 font-medium">
                        <Link
                          href={`/moe/districts/${d.districtId}`}
                          className="hover:text-emerald-200"
                        >
                          {d.districtName}
                        </Link>
                      </td>
                      <td className="py-3 pr-4">{d.schoolCount}</td>
                      <td className="py-3 pr-4 text-slate-500">—</td>
                      <td className="py-3 pr-4">{d.scheduledWorkDelivered}/{d.scheduledWorkTotal}</td>
                      <td className="py-3 pr-4">{formatPct(d.compliancePct)}</td>
                      <td className="py-3">
                        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-slate-300">
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Compliance Summary */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Compliance Summary</h2>
            <p className="text-xs text-slate-500">
              National delivery compliance and reporting signals
            </p>
          </div>
          <div className="flex items-center gap-3">
            {exportError && (
              <span className="text-xs text-red-300">{exportError}</span>
            )}
            <button
              onClick={handleExport}
              disabled={exporting}
              className="rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
            >
              {exporting ? "Exporting..." : "Export Compliance Report (CSV)"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="mt-4 space-y-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="h-12 rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-black/10 p-4">
              <p className="text-xs text-slate-500">Reporting Rate</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-200">
                {formatPct(compliance?.national?.compliancePct)}
              </p>
              <div className="mt-3 h-2 rounded-full bg-white/10">
                <div
                  className="h-2 rounded-full bg-emerald-400"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(0, compliance?.national?.compliancePct ?? 0)
                    )}%`,
                  }}
                />
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/10 p-4">
              <p className="text-xs text-slate-500">Late Submissions</p>
              <p className="mt-2 text-2xl font-semibold text-amber-200">
                {(compliance?.national?.scheduledWorkTotal ?? 0) -
                  (compliance?.national?.scheduledWorkDelivered ?? 0)}
              </p>
              <p className="text-xs text-slate-500">lessons not delivered</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/10 p-4">
              <p className="text-xs text-slate-500">Fully Compliant Schools</p>
              <p className="mt-2 text-2xl font-semibold text-cyan-200">
                {fullyCompliantDistricts}
              </p>
              <p className="text-xs text-slate-500">districts at 100%</p>
            </div>
          </div>
        )}
      </section>

      {/* Interventions Summary */}
      {interventions && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold">Interventions Snapshot</h2>
          <p className="text-xs text-slate-500">
            National aggregates (last 30 days)
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-black/10 p-4">
              <p className="text-xs text-slate-500">Total Active</p>
              <p className="mt-2 text-2xl font-semibold text-rose-200">
                {interventions.national.totalInterventions ?? 0}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/10 p-4">
              <p className="text-xs text-slate-500">Avg Outcome Delta</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-200">
                {interventions.national.avgOutcomeDelta ?? "—"}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/10 p-4">
              <p className="text-xs text-slate-500">Avg Effect Size</p>
              <p className="mt-2 text-2xl font-semibold text-amber-200">
                {interventions.national.avgOutcomeEffectSize ?? "—"}
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
