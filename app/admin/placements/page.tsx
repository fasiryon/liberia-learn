"use client";

import { useEffect, useMemo, useState } from "react";
import { placementBandStyles, placementReviewStatusStyles } from "@/lib/placement";

type PlacementRow = {
  id: string;
  studentName: string;
  currentGrade: number | null;
  testDate: string;
  aiGrade: number;
  band: "foundational" | "developing" | "proficient" | "advanced";
  levelLabel: string;
  teacherGrade: number | null;
  teacherDecision: string | null;
  teacherReason: string | null;
  status: "pending" | "confirmed" | "overridden";
};

type Summary = {
  totalPlacements: number;
  pendingTeacherReview: number;
  aiConfirmed: number;
  aiOverridden: number;
  overrideRate: number;
  calibrationSignal: {
    label: string;
    level: "green" | "amber" | "red";
  };
};

export default function AdminPlacementsPage() {
  const [data, setData] = useState<{ summary: Summary; placements: PlacementRow[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [bandFilter, setBandFilter] = useState("all");

  useEffect(() => {
    let active = true;
    fetch("/api/admin/placements", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error ?? "Failed to load placement audit");
        if (active) setData(payload);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredPlacements = useMemo(() => {
    const placements = data?.placements ?? [];
    return placements.filter((placement) => {
      const matchesStatus = statusFilter === "all" || placement.status === statusFilter;
      const matchesBand = bandFilter === "all" || placement.band === bandFilter;
      return matchesStatus && matchesBand;
    });
  }, [bandFilter, data?.placements, statusFilter]);

  async function downloadCsv() {
    const response = await fetch("/api/admin/placements?format=csv", { cache: "no-store" });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "placements.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const summary = data?.summary;
  const calibrationClass =
    summary?.calibrationSignal.level === "green"
      ? "border-green-500/30 bg-green-500/10 text-green-200"
      : summary?.calibrationSignal.level === "amber"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
      : "border-red-500/30 bg-red-500/10 text-red-200";

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">School Calibration</p>
          <h1 className="text-3xl font-bold">Placement Audit</h1>
          <p className="text-sm text-slate-400">
            AI placement accuracy and teacher override patterns across your school.
          </p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-2xl bg-slate-900/70" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-200">{error}</div>
        ) : (
          <>
            <section className="grid gap-4 lg:grid-cols-5">
              {[
                ["Total placements taken", summary?.totalPlacements ?? 0, "text-slate-100"],
                ["Pending teacher review", summary?.pendingTeacherReview ?? 0, "text-amber-300"],
                ["AI confirmed", summary?.aiConfirmed ?? 0, "text-green-300"],
                ["AI overridden", summary?.aiOverridden ?? 0, "text-blue-300"],
                ["Override rate", `${summary?.overrideRate ?? 0}%`, "text-rose-300"],
              ].map(([label, value, color]) => (
                <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                  <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
                  <p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </section>

            <section className={`rounded-2xl border p-4 text-sm ${calibrationClass}`}>
              {summary?.calibrationSignal.label ?? "No calibration signal available."}
            </section>

            <section className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row">
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100"
                >
                  <option value="all">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="overridden">Overridden</option>
                </select>
                <select
                  value={bandFilter}
                  onChange={(event) => setBandFilter(event.target.value)}
                  className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100"
                >
                  <option value="all">All bands</option>
                  <option value="foundational">Foundational</option>
                  <option value="developing">Developing</option>
                  <option value="proficient">Proficient</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
              <button
                type="button"
                onClick={downloadCsv}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
              >
                Download CSV
              </button>
            </section>

            <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3">Grade</th>
                      <th className="px-4 py-3">Test Date</th>
                      <th className="px-4 py-3">AI Grade</th>
                      <th className="px-4 py-3">Band</th>
                      <th className="px-4 py-3">Teacher Grade</th>
                      <th className="px-4 py-3">Decision</th>
                      <th className="px-4 py-3">Override Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPlacements.map((placement) => (
                      <tr key={placement.id} className="border-b border-slate-800/60 text-slate-200">
                        <td className="px-4 py-4 font-semibold text-slate-100">{placement.studentName}</td>
                        <td className="px-4 py-4">Grade {placement.currentGrade ?? "—"}</td>
                        <td className="px-4 py-4">{new Date(placement.testDate).toLocaleDateString("en-LR")}</td>
                        <td className="px-4 py-4">Grade {placement.aiGrade}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${placementBandStyles[placement.band]}`}>
                            {placement.levelLabel}
                          </span>
                        </td>
                        <td className="px-4 py-4">{placement.teacherGrade ? `Grade ${placement.teacherGrade}` : "—"}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${placementReviewStatusStyles[placement.status]}`}>
                            {placement.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-slate-400">{placement.teacherReason ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
