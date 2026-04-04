"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card, StatCard } from "@/components/ui/Card";

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
  examStats: {
    totalExamsPublished: number;
    totalAttempts: number;
    nationalPassRate: number;
    certificationIssued: number;
    flaggedAttempts: number;
    subjectBreakdown: {
      subject: string;
      attempts: number;
      passRate: number;
    }[];
  };
  productMetrics: {
    nationalLessonCompletionRate: number;
    nationalExamPassRate: number;
    nationalGuardianEngagementRate: number;
    interventionImpactRate: number;
    topPerformingDistricts: Array<{
      districtId: string;
      districtName: string;
      compositeScore: number;
    }>;
    lowestPerformingDistricts: Array<{
      districtId: string;
      districtName: string;
      compositeScore: number;
    }>;
  };
};

type ComplianceDistrict = {
  districtId: string;
  districtName: string;
  region: string | null;
  schoolCount: number;
  studentCount: number;
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

type PlacementDistrict = {
  districtId: string;
  districtName: string;
  studentsPlaced: number;
  reviewedCount: number;
  overrideRate: number;
  avgAiConfidence: number | null;
  topOverrideReason: string | null;
  warning: string | null;
};

type PlacementData = {
  totalStudentsPlaced: number;
  averageAiConfidence: number | null;
  nationalOverrideRate: number;
  mostCommonPlacementBand: string | null;
  byDistrict: PlacementDistrict[];
};

function formatPct(value: number | null | undefined) {
  if (value == null) return "--";
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
  const [placements, setPlacements] = useState<PlacementData | null>(null);
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
      fetch("/api/moe/placements", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([dash, comp, inter, placementData]) => {
        if (!active) return;
        if (dash?.error || comp?.error || inter?.error || placementData?.error) {
          setError("Unable to load data. Please refresh.");
          return;
        }
        setDashboard(dash);
        setCompliance(comp);
        setInterventions(inter);
        setPlacements(placementData);
      })
      .catch(() => {
        if (!active) return;
        setError("Unable to load data. Please refresh.");
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
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/90 px-6 py-8 shadow-2xl shadow-slate-950/30 sm:px-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.14),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.12),_transparent_26%)]" />

          <div className="relative space-y-8">
            <div className="flex flex-col gap-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-emerald-300">
                National Overview
              </p>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
                  LiberiaLearn National Dashboard
                </h1>
                <p className="max-w-3xl text-sm text-slate-400 sm:text-base">
                  Aggregated indicators across all districts, aligned to the same
                  operational patterns used across the platform. No student-level data.
                </p>
              </div>
            </div>

            {error && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                <p className="font-medium text-amber-200">Unable to load dashboard data</p>
                <p className="mt-1 text-amber-100/90">{error}</p>
              </div>
            )}

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {loading ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <Card key={idx} className="animate-pulse p-5">
                    <div className="space-y-3">
                      <div className="h-3 w-1/2 rounded bg-slate-800" />
                      <div className="h-8 w-24 rounded bg-slate-800" />
                      <div className="h-3 w-2/3 rounded bg-slate-800" />
                    </div>
                  </Card>
                ))
              ) : (
                <>
                  <StatCard
                    label="Schools Active"
                    value={dashboard?.schools ?? 0}
                    subtitle={`Across ${dashboard?.districts ?? 0} districts`}
                    valueClassName="text-emerald-300"
                  />
                  <StatCard
                    label="Lessons Delivered"
                    value={dashboard?.scheduledWork?.delivered ?? 0}
                    subtitle="This month"
                    valueClassName="text-cyan-300"
                  />
                  <Card className="p-5">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                      National Mastery Rate
                    </p>
                    <div className="mt-2 flex items-end gap-2">
                      <p className="text-3xl font-semibold text-amber-300">
                        {formatPct(compliance?.national?.compliancePct)}
                      </p>
                      <span className="pb-1 text-xs font-medium uppercase tracking-wide text-emerald-300">
                        Up
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Delivery compliance proxy
                    </p>
                  </Card>
                  <StatCard
                    label="Active Interventions"
                    value={dashboard?.interventionsLast30Days ?? 0}
                    subtitle="Students at risk"
                    valueClassName="text-rose-300"
                  />
                </>
              )}
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">
                    Districts
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-100">
                    District Performance
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Delivery compliance by district
                  </p>
                </div>
                <Link
                  href="/moe/districts"
                  className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-900 hover:text-slate-100"
                >
                  View all districts
                </Link>
              </div>

              {loading ? (
                <div className="mt-4 space-y-2">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <div key={idx} className="h-12 animate-pulse rounded-xl bg-slate-800/70" />
                  ))}
                </div>
              ) : districtRows.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-700 bg-slate-950/70 p-6 text-sm text-slate-400">
                  No data available yet. District compliance will appear once lessons are delivered.
                </div>
              ) : (
                <div className="mt-5 overflow-hidden rounded-2xl border border-slate-800">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-950/80">
                        <tr className="text-left text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
                          <th className="px-4 py-3">District</th>
                          <th className="px-4 py-3">Schools</th>
                          <th className="px-4 py-3">Students</th>
                          <th className="px-4 py-3">Lessons</th>
                          <th className="px-4 py-3">Mastery Rate</th>
                          <th className="px-4 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 bg-slate-900/60">
                        {districtRows.map((d) => {
                          const status =
                            d.compliancePct == null
                              ? "No data"
                              : d.compliancePct >= 85
                                ? "On Track"
                                : d.compliancePct >= 60
                                  ? "Watch"
                                  : "At Risk";
                          const statusClassName =
                            status === "On Track"
                              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
                              : status === "Watch"
                                ? "border-amber-500/20 bg-amber-500/10 text-amber-200"
                                : status === "At Risk"
                                  ? "border-rose-500/20 bg-rose-500/10 text-rose-200"
                                  : "border-slate-700 bg-slate-800/70 text-slate-300";

                          return (
                            <tr key={d.districtId} className="text-slate-200">
                              <td className="px-4 py-3 font-medium">
                                <Link
                                  href={`/moe/districts/${d.districtId}`}
                                  className="transition-colors hover:text-emerald-200"
                                >
                                  {d.districtName}
                                </Link>
                              </td>
                              <td className="px-4 py-3">{d.schoolCount}</td>
                              <td className="px-4 py-3">{d.studentCount ?? 0}</td>
                              <td className="px-4 py-3">
                                {d.scheduledWorkDelivered}/{d.scheduledWorkTotal}
                              </td>
                              <td className="px-4 py-3">{formatPct(d.compliancePct)}</td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusClassName}`}
                                >
                                  {status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">
                    Compliance
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-100">
                    Compliance Summary
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    National delivery compliance and reporting signals
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {exportError && (
                    <span className="text-xs text-rose-300">{exportError}</span>
                  )}
                  <button
                    onClick={handleExport}
                    disabled={exporting}
                    className="rounded-full bg-emerald-400 px-4 py-1.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {exporting ? "Exporting..." : "Export Compliance Report (CSV)"}
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <Card key={idx} className="animate-pulse bg-slate-900/80 p-5">
                      <div className="h-20 rounded-xl bg-slate-800" />
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <Card className="p-5">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                      Reporting Rate
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-emerald-300">
                      {formatPct(compliance?.national?.compliancePct)}
                    </p>
                    <div className="mt-4 h-2 rounded-full bg-slate-800">
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
                  </Card>
                  <StatCard
                    label="Late Submissions"
                    value={
                      (compliance?.national?.scheduledWorkTotal ?? 0) -
                      (compliance?.national?.scheduledWorkDelivered ?? 0)
                    }
                    subtitle="Lessons not delivered"
                    valueClassName="text-amber-300"
                  />
                  <StatCard
                    label="Fully Compliant Schools"
                    value={fullyCompliantDistricts}
                    subtitle="Districts at 100%"
                    valueClassName="text-cyan-300"
                  />
                </div>
              )}
            </section>

            {interventions && (
              <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">
                    Interventions
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-100">
                    Interventions Snapshot
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    National aggregates from the last 30 days
                  </p>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <StatCard
                    label="Total Active"
                    value={interventions.national.totalInterventions ?? 0}
                    valueClassName="text-rose-300"
                  />
                  <StatCard
                    label="Avg Outcome Delta"
                    value={interventions.national.avgOutcomeDelta ?? "--"}
                    valueClassName="text-emerald-300"
                  />
                  <StatCard
                    label="Avg Effect Size"
                    value={interventions.national.avgOutcomeEffectSize ?? "--"}
                    valueClassName="text-amber-300"
                  />
                </div>
              </section>
            )}

            <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">
                  National Outcomes
                </p>
                <h2 className="mt-2 text-xl font-semibold text-slate-100">
                  Product Metrics Snapshot
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  National completion, assessment, guardian engagement, and district outcome ranking.
                </p>
              </div>

              {loading ? (
                <div className="mt-5 grid gap-4 md:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Card key={index} className="animate-pulse bg-slate-900/80 p-5">
                      <div className="h-20 rounded-xl bg-slate-800" />
                    </Card>
                  ))}
                </div>
              ) : (
                <>
                  <div className="mt-5 grid gap-4 md:grid-cols-4">
                    <StatCard
                      label="Lesson Completion"
                      value={formatPct(dashboard?.productMetrics.nationalLessonCompletionRate)}
                      valueClassName="text-emerald-300"
                    />
                    <StatCard
                      label="Exam Pass Rate"
                      value={formatPct(dashboard?.productMetrics.nationalExamPassRate)}
                      valueClassName="text-cyan-300"
                    />
                    <StatCard
                      label="Guardian Engagement"
                      value={formatPct(dashboard?.productMetrics.nationalGuardianEngagementRate)}
                      valueClassName="text-amber-300"
                    />
                    <StatCard
                      label="Intervention Impact"
                      value={formatPct(dashboard?.productMetrics.interventionImpactRate)}
                      valueClassName="text-rose-300"
                    />
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    <Card className="p-5">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                        Top Performing Districts
                      </p>
                      <div className="mt-4 space-y-3">
                        {(dashboard?.productMetrics.topPerformingDistricts ?? []).map((district) => (
                          <div
                            key={district.districtId}
                            className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3"
                          >
                            <p className="font-medium text-slate-100">{district.districtName}</p>
                            <p className="font-semibold text-emerald-300">{district.compositeScore.toFixed(1)}%</p>
                          </div>
                        ))}
                      </div>
                    </Card>
                    <Card className="p-5">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                        Lowest Performing Districts
                      </p>
                      <div className="mt-4 space-y-3">
                        {(dashboard?.productMetrics.lowestPerformingDistricts ?? []).map((district) => (
                          <div
                            key={district.districtId}
                            className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3"
                          >
                            <p className="font-medium text-slate-100">{district.districtName}</p>
                            <p className="font-semibold text-rose-300">{district.compositeScore.toFixed(1)}%</p>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </div>
                </>
              )}
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">
                  Exams
                </p>
                <h2 className="mt-2 text-xl font-semibold text-slate-100">Exam System</h2>
                <p className="mt-1 text-sm text-slate-400">
                  National exam publication, pass rate, certification, and integrity signals
                </p>
              </div>

              {loading ? (
                <div className="mt-5 grid gap-4 md:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Card key={index} className="animate-pulse bg-slate-900/80 p-5">
                      <div className="h-20 rounded-xl bg-slate-800" />
                    </Card>
                  ))}
                </div>
              ) : (
                <>
                  <div className="mt-5 grid gap-4 md:grid-cols-4">
                    <StatCard
                      label="Published Exams"
                      value={dashboard?.examStats.totalExamsPublished ?? 0}
                      valueClassName="text-emerald-300"
                    />
                    <StatCard
                      label="National Pass Rate"
                      value={formatPct(dashboard?.examStats.nationalPassRate)}
                      valueClassName="text-cyan-300"
                    />
                    <StatCard
                      label="Certifications Issued"
                      value={dashboard?.examStats.certificationIssued ?? 0}
                      valueClassName="text-amber-300"
                    />
                    <StatCard
                      label="Flagged Attempts"
                      value={dashboard?.examStats.flaggedAttempts ?? 0}
                      valueClassName="text-rose-300"
                    />
                  </div>

                  <div className="mt-5 overflow-hidden rounded-2xl border border-slate-800">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-950/80">
                          <tr className="text-left text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
                            <th className="px-4 py-3">Subject</th>
                            <th className="px-4 py-3">Attempts</th>
                            <th className="px-4 py-3">Pass Rate</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 bg-slate-900/60">
                          {(dashboard?.examStats.subjectBreakdown ?? []).map((row) => (
                            <tr key={row.subject} className="text-slate-200">
                              <td className="px-4 py-3 font-medium">{row.subject}</td>
                              <td className="px-4 py-3">{row.attempts}</td>
                              <td className="px-4 py-3">{formatPct(row.passRate)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">
                  Placement
                </p>
                <h2 className="mt-2 text-xl font-semibold text-slate-100">
                  National Placement Analytics
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  AI placement calibration and teacher override patterns
                </p>
              </div>

              {loading ? (
                <div className="mt-5 grid gap-4 md:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Card key={index} className="animate-pulse bg-slate-900/80 p-5">
                      <div className="h-20 rounded-xl bg-slate-800" />
                    </Card>
                  ))}
                </div>
              ) : (
                <>
                  <div className="mt-5 grid gap-4 md:grid-cols-4">
                    <StatCard
                      label="Students Placed"
                      value={placements?.totalStudentsPlaced ?? 0}
                      subtitle="National total"
                      valueClassName="text-emerald-300"
                    />
                    <StatCard
                      label="Average AI Confidence"
                      value={
                        placements?.averageAiConfidence == null
                          ? "--"
                          : `${placements.averageAiConfidence}%`
                      }
                      valueClassName="text-cyan-300"
                    />
                    <StatCard
                      label="National Override Rate"
                      value={`${placements?.nationalOverrideRate ?? 0}%`}
                      valueClassName="text-amber-300"
                    />
                    <StatCard
                      label="Most Common Placement Band"
                      value={placements?.mostCommonPlacementBand ?? "--"}
                      valueClassName="text-rose-300"
                    />
                  </div>

                  <div className="mt-5 overflow-hidden rounded-2xl border border-slate-800">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-950/80">
                          <tr className="text-left text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
                            <th className="px-4 py-3">District</th>
                            <th className="px-4 py-3">Students Placed</th>
                            <th className="px-4 py-3">Override Rate</th>
                            <th className="px-4 py-3">Avg AI Confidence</th>
                            <th className="px-4 py-3">Top Override Reason</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 bg-slate-900/60">
                          {(placements?.byDistrict ?? []).map((district) => (
                            <tr key={district.districtId} className="text-slate-200">
                              <td className="px-4 py-3">
                                <div className="space-y-1">
                                  <p className="font-medium">{district.districtName}</p>
                                  {district.warning ? (
                                    <p className="text-xs text-amber-300">
                                      {district.warning} - high teacher override rate
                                    </p>
                                  ) : null}
                                </div>
                              </td>
                              <td className="px-4 py-3">{district.studentsPlaced}</td>
                              <td className="px-4 py-3">{district.overrideRate}%</td>
                              <td className="px-4 py-3">
                                {district.avgAiConfidence == null
                                  ? "--"
                                  : `${district.avgAiConfidence}%`}
                              </td>
                              <td className="px-4 py-3 text-slate-400">
                                {district.topOverrideReason ?? "--"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
