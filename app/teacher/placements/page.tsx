"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { placementBandStyles, placementReviewStatusStyles } from "@/lib/placement";

type PlacementListItem = {
  id: string;
  studentName: string;
  currentGrade: number | null;
  testDate: string;
  recommendedGrade: number;
  band: "foundational" | "developing" | "proficient" | "advanced";
  levelLabel: string;
  status: "pending" | "confirmed" | "overridden";
};

type PlacementSummary = {
  totalTested: number;
  pendingReview: number;
  confirmed: number;
  overridden: number;
};

export default function TeacherPlacementsPage() {
  const [data, setData] = useState<{ summary: PlacementSummary; placements: PlacementListItem[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/teacher/placements", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error ?? "Failed to load placements");
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

  const summary = data?.summary ?? {
    totalTested: 0,
    pendingReview: 0,
    confirmed: 0,
    overridden: 0,
  };

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">Teacher Placement Review</p>
          <h1 className="text-3xl font-bold">Student Placement Results</h1>
          <p className="text-sm text-slate-400">
            Review AI recommendations and confirm or adjust each student&apos;s grade placement.
          </p>
        </div>

        <section className="grid gap-4 md:grid-cols-4">
          {[
            ["Total tested", summary.totalTested, "text-slate-100"],
            ["Pending review", summary.pendingReview, "text-amber-300"],
            ["Confirmed", summary.confirmed, "text-green-300"],
            ["Overridden", summary.overridden, "text-blue-300"],
          ].map(([label, value, color]) => (
            <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
              <p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </section>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-2xl bg-slate-900/70" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-200">{error}</div>
        ) : !data || data.placements.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 text-center text-sm text-slate-400">
            No placement tests have been submitted yet.
          </div>
        ) : (
          <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Grade</th>
                    <th className="px-4 py-3">Test Date</th>
                    <th className="px-4 py-3">AI Recommendation</th>
                    <th className="px-4 py-3">Band</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.placements.map((placement) => (
                    <tr key={placement.id} className="border-b border-slate-800/60 text-slate-200">
                      <td className="px-4 py-4 font-semibold text-slate-100">{placement.studentName}</td>
                      <td className="px-4 py-4">Grade {placement.currentGrade ?? "—"}</td>
                      <td className="px-4 py-4">{new Date(placement.testDate).toLocaleDateString("en-LR")}</td>
                      <td className="px-4 py-4">Grade {placement.recommendedGrade}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${placementBandStyles[placement.band]}`}>
                          {placement.levelLabel}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${placementReviewStatusStyles[placement.status]}`}>
                          {placement.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <Link
                          href={`/teacher/placements/${placement.id}`}
                          className="inline-flex rounded-xl bg-emerald-500 px-4 py-2 font-semibold text-slate-950 hover:bg-emerald-400"
                        >
                          Review
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
