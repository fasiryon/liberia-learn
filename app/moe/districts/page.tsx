"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type ComplianceDistrict = {
  districtId: string;
  districtName: string;
  region: string | null;
  schoolCount: number;
  scheduledWorkTotal: number;
  scheduledWorkDelivered: number;
  compliancePct: number | null;
};

type InterventionDistrict = {
  districtId: string;
  interventionCount: number;
  riskFlags: Record<string, number>;
};

export default function MoeDistrictsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [districts, setDistricts] = useState<ComplianceDistrict[]>([]);
  const [interventions, setInterventions] = useState<InterventionDistrict[]>([]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    Promise.all([
      fetch("/api/moe/delivery-compliance", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/moe/intervention-impact", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([comp, inter]) => {
        if (!active) return;
        if (comp?.error || inter?.error) {
          setError("Unable to load data — please refresh.");
          return;
        }
        setDistricts(comp.byDistrict ?? []);
        setInterventions(inter.byDistrict ?? []);
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

  const interventionMap = useMemo(() => {
    const map: Record<string, number> = {};
    interventions.forEach((d) => {
      map[d.districtId] = d.interventionCount;
    });
    return map;
  }, [interventions]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Districts</p>
        <h1 className="text-3xl font-semibold">District Performance</h1>
        <p className="text-sm text-slate-400">
          National delivery compliance and intervention aggregates by district.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="h-10 rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : districts.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-black/10 p-6 text-sm text-slate-400">
            No district data available yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs text-slate-500">
                  <th className="pb-2 pr-4">District</th>
                  <th className="pb-2 pr-4">Schools</th>
                  <th className="pb-2 pr-4">Lessons Delivered</th>
                  <th className="pb-2 pr-4">Compliance</th>
                  <th className="pb-2 pr-4">Interventions</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {districts.map((d) => {
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
                      <td className="py-3 pr-4">
                        {d.scheduledWorkDelivered}/{d.scheduledWorkTotal}
                      </td>
                      <td className="py-3 pr-4">
                        {d.compliancePct == null ? "—" : `${d.compliancePct.toFixed(1)}%`}
                      </td>
                      <td className="py-3 pr-4">{interventionMap[d.districtId] ?? 0}</td>
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
    </div>
  );
}
