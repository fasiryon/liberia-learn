"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { placementBandStyles, placementReviewStatusStyles } from "@/lib/placement";
import HelpTooltip from "@/components/ui/HelpTooltip";
import { TeacherDashboardBackLink } from "@/app/teacher/TeacherDashboardBackLink";

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
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-6xl space-y-6">
        <TeacherDashboardBackLink />
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ll-yellow)]">Teacher Placement Review</p>
          <h1 className="text-3xl font-bold">Student Placement Results</h1>
          <p className="text-sm text-[var(--ll-text-muted)]">
            Review AI recommendations and confirm or adjust each student&apos;s grade placement.
          </p>
        </div>

        <section className="grid gap-4 md:grid-cols-4">
          {[
            ["Total tested", summary.totalTested, "text-[var(--ll-text)]"],
            ["Pending review", summary.pendingReview, "text-[var(--ll-yellow)]"],
            ["Confirmed", summary.confirmed, "text-green-300"],
            ["Overridden", summary.overridden, "text-[var(--ll-silver)]"],
          ].map(([label, value, color]) => (
            <div key={label} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-5">
              <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">{label}</p>
              <p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </section>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-xl bg-[var(--ll-bg)]/70" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-200">{error}</div>
        ) : !data || data.placements.length === 0 ? (
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-8 text-center text-sm text-[var(--ll-text-muted)]">
            No placement tests have been submitted yet.
          </div>
        ) : (
          <section className="overflow-hidden rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--ll-border)] text-left text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Grade</th>
                    <th className="px-4 py-3">Test Date</th>
                    <th className="px-4 py-3">AI Recommendation</th>
                    <th className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        Placement Band
                        <HelpTooltip
                          text="The grade level where this student's knowledge was assessed to begin"
                          position="right"
                        />
                      </span>
                    </th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.placements.map((placement) => (
                    <tr key={placement.id} className="border-b border-[var(--ll-border)]/60 text-[var(--ll-text)]">
                      <td className="px-4 py-4 font-semibold text-[var(--ll-text)]">{placement.studentName}</td>
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
                          className="inline-flex rounded-xl bg-[var(--ll-yellow)] px-4 py-2 font-semibold text-[var(--ll-text-faint)] hover:bg-[var(--ll-yellow-soft)]"
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
