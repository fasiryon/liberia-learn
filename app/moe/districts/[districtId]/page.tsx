"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
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

export default function MoeDistrictDetailPage() {
  const params = useParams();
  const districtId = params.districtId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [district, setDistrict] = useState<ComplianceDistrict | null>(null);
  const [intervention, setIntervention] = useState<InterventionDistrict | null>(null);

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
          setError("Unable to load district data — please refresh.");
          return;
        }
        const match = (comp.byDistrict ?? []).find((d: ComplianceDistrict) => d.districtId === districtId);
        setDistrict(match ?? null);
        const interMatch = (inter.byDistrict ?? []).find((d: InterventionDistrict) => d.districtId === districtId);
        setIntervention(interMatch ?? null);
      })
      .catch(() => {
        if (!active) return;
        setError("Unable to load district data — please refresh.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [districtId]);

  const riskFlags = useMemo(() => {
    if (!intervention?.riskFlags) return [];
    return Object.entries(intervention.riskFlags).map(([flag, count]) => ({
      flag,
      count,
    }));
  }, [intervention]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">District Detail</p>
          <h1 className="text-3xl font-semibold">
            {district?.districtName ?? "District Overview"}
          </h1>
          <p className="text-sm text-slate-400">
            Aggregated compliance and intervention data. No student-level details.
          </p>
        </div>
        <Link
          href="/moe/dashboard"
          className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:text-slate-100"
        >
          ← Back to dashboard
        </Link>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-16 rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : !district ? (
        <div className="rounded-2xl border border-white/10 bg-black/10 p-6 text-sm text-slate-400">
          District data not available yet.
        </div>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs text-slate-400">Schools</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-200">
                {district.schoolCount}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs text-slate-400">Lessons Delivered</p>
              <p className="mt-2 text-2xl font-semibold text-cyan-200">
                {district.scheduledWorkDelivered}/{district.scheduledWorkTotal}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs text-slate-400">Compliance</p>
              <p className="mt-2 text-2xl font-semibold text-amber-200">
                {district.compliancePct == null ? "—" : `${district.compliancePct.toFixed(1)}%`}
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold">School List</h2>
            <p className="text-xs text-slate-500">
              School-level breakdown is not yet available via MOE API.
            </p>
            <div className="mt-4 rounded-xl border border-white/10 bg-black/10 p-6 text-sm text-slate-400">
              No school list available for this district.
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold">Mastery Breakdown by Subject</h2>
            <p className="text-xs text-slate-500">
              Subject-level mastery rates will appear once MOE subject metrics are enabled.
            </p>
            <div className="mt-4 rounded-xl border border-white/10 bg-black/10 p-6 text-sm text-slate-400">
              No mastery breakdown available yet.
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold">Active Interventions</h2>
            <p className="text-xs text-slate-500">
              Aggregated counts of intervention alerts (no student data).
            </p>
            {riskFlags.length === 0 ? (
              <div className="mt-4 rounded-xl border border-white/10 bg-black/10 p-6 text-sm text-slate-400">
                No interventions recorded for this district.
              </div>
            ) : (
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {riskFlags.map((rf) => (
                  <div key={rf.flag} className="rounded-xl border border-white/10 bg-black/10 p-4">
                    <p className="text-xs text-slate-500">{rf.flag}</p>
                    <p className="mt-2 text-2xl font-semibold text-rose-200">{rf.count}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
