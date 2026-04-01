"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";

type MoeExportsClientProps = {
  districts: string[];
  schools: Array<{ id: string; name: string }>;
};

const STORAGE_KEYS = {
  national: "moe_export_last_national",
  district: "moe_export_last_district",
  school: "moe_export_last_school",
} as const;

export default function MoeExportsClient({ districts, schools }: MoeExportsClientProps) {
  const [selectedDistrict, setSelectedDistrict] = useState(districts[0] ?? "");
  const [selectedSchool, setSelectedSchool] = useState(schools[0]?.id ?? "");
  const [lastExported, setLastExported] = useState<Record<string, string | null>>({
    national: null,
    district: null,
    school: null,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    setLastExported({
      national: window.localStorage.getItem(STORAGE_KEYS.national),
      district: window.localStorage.getItem(STORAGE_KEYS.district),
      school: window.localStorage.getItem(STORAGE_KEYS.school),
    });
  }, []);

  function markExport(type: keyof typeof STORAGE_KEYS) {
    if (typeof window === "undefined") return;
    const value = new Date().toISOString();
    window.localStorage.setItem(STORAGE_KEYS[type], value);
    setLastExported((current) => ({ ...current, [type]: value }));
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
            Reporting
          </p>
          <h1 className="text-3xl font-semibold text-white">Data Exports</h1>
          <p className="max-w-3xl text-sm text-slate-300">
            Download national, district, and school cohort reports for ministry review.
          </p>
        </div>

        <div className="mt-8 grid gap-5">
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-slate-50">National Report</h2>
            <p className="mt-2 text-sm text-slate-300">
              Export national school-level indicators across the platform.
            </p>
            <a
              href="/api/moe/export/national"
              onClick={() => markExport("national")}
              className="mt-5 inline-flex min-h-11 items-center rounded-2xl bg-emerald-400 px-5 py-2 text-sm font-semibold text-slate-950"
            >
              Download National CSV
            </a>
            <p className="mt-3 text-xs text-slate-400">
              Last export: {lastExported.national ?? "Not yet exported"}
            </p>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold text-slate-50">District Report</h2>
            <p className="mt-2 text-sm text-slate-300">
              Export school-level breakdown rows for a selected district.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <select
                value={selectedDistrict}
                onChange={(event) => setSelectedDistrict(event.target.value)}
                className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100"
              >
                {districts.map((district) => (
                  <option key={district} value={district}>
                    {district}
                  </option>
                ))}
              </select>
              <a
                href={selectedDistrict ? `/api/moe/export/district/${encodeURIComponent(selectedDistrict)}` : "#"}
                onClick={() => selectedDistrict && markExport("district")}
                className="inline-flex min-h-11 items-center rounded-2xl bg-cyan-500 px-5 py-2 text-sm font-semibold text-slate-950"
              >
                Download District CSV
              </a>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Last export: {lastExported.district ?? "Not yet exported"}
            </p>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold text-slate-50">School Cohort</h2>
            <p className="mt-2 text-sm text-slate-300">
              Export anonymized student cohort rows for a selected school.
            </p>
            <p className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              This export contains student-level data and is logged.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <select
                value={selectedSchool}
                onChange={(event) => setSelectedSchool(event.target.value)}
                className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100"
              >
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
              <a
                href={selectedSchool ? `/api/moe/export/school/${selectedSchool}` : "#"}
                onClick={() => selectedSchool && markExport("school")}
                className="inline-flex min-h-11 items-center rounded-2xl bg-amber-300 px-5 py-2 text-sm font-semibold text-slate-950"
              >
                Download Cohort CSV
              </a>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Last export: {lastExported.school ?? "Not yet exported"}
            </p>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold text-slate-50">Printable Summary</h2>
            <p className="mt-2 text-sm text-slate-300">
              Open a print-optimized HTML summary report for ministry sharing.
            </p>
            <a
              href="/api/moe/export/summary-pdf"
              className="mt-5 inline-flex min-h-11 items-center rounded-2xl border border-white/10 px-5 py-2 text-sm font-semibold text-slate-100"
            >
              Open Summary Report
            </a>
          </Card>
        </div>
      </div>
    </main>
  );
}
