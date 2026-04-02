"use client";

import { useEffect, useMemo, useState } from "react";

type ComplianceDistrict = {
  districtId: string;
  districtName: string;
};

type InterventionDistrict = {
  districtId: string;
  interventionCount: number;
  riskFlags: Record<string, number>;
  latestAt: string | null;
};

type AlertRow = {
  districtId: string;
  districtName: string;
  subject: string;
  strand: string;
  alertType: string;
  studentsAffected: number;
  created: string;
};

export default function MoeAlertsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [districtFilter, setDistrictFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    Promise.all([
      fetch("/api/moe/intervention-impact", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/moe/delivery-compliance", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([inter, comp]) => {
        if (!active) return;
        if (inter?.error || comp?.error) {
          setError("Unable to load data — please refresh.");
          return;
        }
        const districtMap: Record<string, string> = {};
        (comp.byDistrict ?? []).forEach((d: ComplianceDistrict) => {
          districtMap[d.districtId] = d.districtName;
        });

        const rows: AlertRow[] = [];
        (inter.byDistrict ?? []).forEach((d: InterventionDistrict) => {
          const districtName = districtMap[d.districtId] ?? "Unassigned";
          const createdLabel = d.latestAt
            ? new Date(d.latestAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
            : inter.generatedAt
              ? new Date(inter.generatedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
              : "N/A";
          Object.entries(d.riskFlags ?? {}).forEach(([flag, count]) => {
            rows.push({
              districtId: d.districtId,
              districtName,
              subject: "All Subjects",
              strand: "All",
              alertType: flag,
              studentsAffected: count,
              created: createdLabel,
            });
          });
        });

        setAlerts(rows);
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

  const districts = useMemo(() => {
    const unique = new Map<string, string>();
    alerts.forEach((a) => unique.set(a.districtId, a.districtName));
    return Array.from(unique.entries()).map(([id, name]) => ({ id, name }));
  }, [alerts]);

  const subjects = ["All Subjects"];

  const filtered = alerts.filter((a) => {
    if (districtFilter !== "all" && a.districtId !== districtFilter) return false;
    if (subjectFilter !== "all" && a.subject !== subjectFilter) return false;
    return true;
  });

  const totalActive = alerts.reduce((s, a) => s + a.studentsAffected, 0);
  const highPriority = alerts.filter((a) => a.studentsAffected >= 50).length;
  const byDistrict = districts.length;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">
          National Alerts
        </p>
        <h1 className="text-3xl font-semibold">National Intervention Alerts</h1>
        <p className="text-sm text-slate-400">
          Aggregated intervention signals across districts. No student PII.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs text-slate-400">Total Active</p>
          <p className="mt-2 text-2xl font-semibold text-rose-200">{totalActive}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs text-slate-400">High Priority</p>
          <p className="mt-2 text-2xl font-semibold text-amber-200">{highPriority}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs text-slate-400">Districts Reporting</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-200">{byDistrict}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[11px] text-slate-500">District</label>
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="mt-1 rounded-lg border border-white/10 bg-[#0b1120] px-3 py-2 text-xs text-slate-200"
            >
              <option value="all">All Districts</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-slate-500">Subject</label>
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="mt-1 rounded-lg border border-white/10 bg-[#0b1120] px-3 py-2 text-xs text-slate-200"
            >
              <option value="all">All Subjects</option>
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="h-10 rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-black/10 p-6 text-sm text-slate-400">
            No alerts found for the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs text-slate-500">
                  <th className="pb-2 pr-4">District</th>
                  <th className="pb-2 pr-4">Subject</th>
                  <th className="pb-2 pr-4">Strand</th>
                  <th className="pb-2 pr-4">Alert Type</th>
                  <th className="pb-2 pr-4">Students Affected</th>
                  <th className="pb-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a, idx) => (
                  <tr key={`${a.districtId}-${a.alertType}-${idx}`} className="border-b border-white/5 text-slate-200">
                    <td className="py-3 pr-4 font-medium">{a.districtName}</td>
                    <td className="py-3 pr-4">{a.subject}</td>
                    <td className="py-3 pr-4">{a.strand}</td>
                    <td className="py-3 pr-4">{a.alertType}</td>
                    <td className="py-3 pr-4">{a.studentsAffected}</td>
                    <td className="py-3">{a.created}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
