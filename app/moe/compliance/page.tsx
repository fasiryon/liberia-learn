"use client";

import { useEffect, useMemo, useState } from "react";

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

function toCsv(rows: string[][]) {
  return rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
}

export default function MoeCompliancePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<ComplianceData | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetch("/api/moe/delivery-compliance", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        if (d?.error) {
          setError("Unable to load compliance data — please refresh.");
          return;
        }
        setData(d);
      })
      .catch(() => {
        if (!active) return;
        setError("Unable to load compliance data — please refresh.");
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
    if (!data?.byDistrict) return 0;
    return data.byDistrict.filter((d) => (d.compliancePct ?? 0) >= 100).length;
  }, [data]);

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch("/api/moe/delivery-compliance", { cache: "no-store" });
      const payload = await res.json();
      if (!res.ok || payload?.error) {
        throw new Error(payload?.error || "Export failed");
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
        ...(payload.byDistrict || []).map((d: ComplianceDistrict) => [
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

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--ll-yellow)]">Compliance</p>
        <h1 className="text-3xl font-semibold">Delivery Compliance</h1>
        <p className="text-sm text-[var(--ll-text-muted)]">
          District-level delivery compliance aggregated nationally.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-[var(--ll-border)] bg-white/5 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">National Summary</h2>
            <p className="text-xs text-[var(--ll-text-faint)]">
              Reporting rate, late submissions, and fully compliant districts.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {exportError && (
              <span className="text-xs text-red-300">{exportError}</span>
            )}
            <button
              onClick={handleExport}
              disabled={exporting}
              className="rounded-full bg-[var(--ll-yellow)] px-4 py-1.5 text-xs font-semibold text-[var(--ll-text-faint)] hover:bg-[var(--ll-yellow-soft)] disabled:opacity-60"
            >
              {exporting ? "Exporting..." : "Export Compliance Report (CSV)"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="h-12 rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-[var(--ll-border)] bg-black/10 p-4">
              <p className="text-xs text-[var(--ll-text-faint)]">Reporting Rate</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--ll-yellow)]">
                {data?.national?.compliancePct == null
                  ? "—"
                  : `${data.national.compliancePct.toFixed(1)}%`}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--ll-border)] bg-black/10 p-4">
              <p className="text-xs text-[var(--ll-text-faint)]">Late Submissions</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--ll-yellow)]">
                {(data?.national?.scheduledWorkTotal ?? 0) -
                  (data?.national?.scheduledWorkDelivered ?? 0)}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--ll-border)] bg-black/10 p-4">
              <p className="text-xs text-[var(--ll-text-faint)]">Fully Compliant Schools</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--ll-silver)]">
                {fullyCompliantDistricts}
              </p>
              <p className="text-[11px] text-[var(--ll-text-faint)]">districts at 100%</p>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-[var(--ll-border)] bg-white/5 p-6">
        <h2 className="text-lg font-semibold">District Breakdown</h2>
        {loading ? (
          <div className="mt-4 space-y-2">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="h-10 rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : !data || data.byDistrict.length === 0 ? (
          <div className="mt-4 rounded-xl border border-[var(--ll-border)] bg-black/10 p-6 text-sm text-[var(--ll-text-muted)]">
            No compliance data available yet.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--ll-border)] text-left text-xs text-[var(--ll-text-faint)]">
                  <th className="pb-2 pr-4">District</th>
                  <th className="pb-2 pr-4">Schools</th>
                  <th className="pb-2 pr-4">Lessons Delivered</th>
                  <th className="pb-2 pr-4">Compliance</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.byDistrict.map((d) => {
                  const compliance = d.compliancePct ?? 0;
                  const status =
                    d.compliancePct == null
                      ? "No data"
                      : compliance >= 85
                      ? "On Track"
                      : compliance >= 60
                      ? "Watch"
                      : "At Risk";
                  return (
                    <tr key={d.districtId} className="border-b border-white/5 text-[var(--ll-text)]">
                      <td className="py-3 pr-4 font-medium">{d.districtName}</td>
                      <td className="py-3 pr-4">{d.schoolCount}</td>
                      <td className="py-3 pr-4">
                        {d.scheduledWorkDelivered}/{d.scheduledWorkTotal}
                      </td>
                      <td className="py-3 pr-4">
                        {d.compliancePct == null ? "—" : `${d.compliancePct.toFixed(1)}%`}
                      </td>
                      <td className="py-3">
                        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-[var(--ll-text)]">
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
    </div>
  );
}
