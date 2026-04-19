"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card, StatCard } from "@/components/ui/Card";
import { DashboardTopBar } from "@/components/DashboardTopBar";
import { SkeletonCard } from "@/components/ui/Skeleton";

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
  const districtsRequiringAttention = districtRows.filter(
    (district) =>
      (district.schoolCount ?? 0) > 0 &&
      ((district.compliancePct ?? 0) < 60 || (district.scheduledWorkDelivered ?? 0) === 0)
  );

  return (
    <main className="ll-dashboard-shell">
      <div className="ll-page-enter mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8 space-y-5">
        <DashboardTopBar
          roleLabel="Ministry Official"
          roleBadgeBg="bg-slate-500/10 border-slate-500/20"
          roleAccent="text-[var(--ll-text-muted)]"
          subtitle="National Overview — LiberiaLearn"
        />

        <div>
          <h1 className="text-2xl font-semibold text-[var(--ll-text)]">Good morning. National overview.</h1>
          <p className="mt-1 text-sm leading-6 text-[var(--ll-text-muted)]">
            Aggregated indicators across all districts. No student-level data.
          </p>
        </div>

        <div className="space-y-5">
          {error && (
            <div className="ll-notice ll-notice-warning">
              <p className="font-medium">Unable to load dashboard data</p>
              <p className="mt-1 text-sm">{error}</p>
            </div>
          )}

          <section className="grid gap-3 grid-cols-2 sm:grid-cols-4">
            {loading ? (
              Array.from({ length: 4 }).map((_, idx) => <SkeletonCard key={idx} />)
            ) : (
              <>
                <StatCard
                  label="Schools Active"
                  value={dashboard?.schools ?? 0}
                  subtitle={`Across ${dashboard?.districts ?? 0} districts`}
                  valueClassName="text-[var(--ll-text)]"
                />
                <StatCard
                  label="Lessons Delivered"
                  value={dashboard?.scheduledWork?.delivered ?? 0}
                  subtitle="This month"
                  valueClassName="text-[var(--ll-text)]"
                />
                <Card className="p-5">
                  <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ll-text-faint)]">
                    National Mastery Rate
                  </p>
                  <div className="mt-2 flex items-end gap-2">
                    <p className="text-2xl font-semibold text-[var(--ll-warning)]">
                      {formatPct(compliance?.national?.compliancePct)}
                    </p>
                    <span className="pb-1 text-xs font-medium uppercase tracking-[0.1em] text-[var(--ll-accent)]">
                      Up
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--ll-text-faint)]">
                    Delivery compliance proxy
                  </p>
                </Card>
                <StatCard
                  label="Active Interventions"
                  value={dashboard?.interventionsLast30Days ?? 0}
                  subtitle="Students at risk"
                  valueClassName="text-[var(--ll-danger)]"
                />
              </>
            )}
          </section>

          <section className="ll-section rounded-xl p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ll-text-faint)]">
                  Districts
                </p>
                <h2 className="mt-2 text-base font-semibold text-[var(--ll-text)]">
                  District Performance
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--ll-text-muted)]">
                  Delivery compliance by district
                </p>
              </div>
              <Link
                href="/moe/districts"
                className="ll-interactive rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-3 py-1.5 text-xs font-medium text-[var(--ll-text-muted)]"
              >
                View all districts
              </Link>
            </div>

            {loading ? (
              <div className="mt-4 space-y-2">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <div key={idx} className="h-12 animate-pulse rounded-xl bg-[var(--ll-surface-muted)]" />
                ))}
              </div>
            ) : districtRows.length === 0 ? (
              <div className="ll-section mt-4 p-6 text-center">
                <p className="text-sm leading-6 text-[var(--ll-text-muted)]">
                  No activity data yet for this county.
                </p>
              </div>
            ) : (
              <div className="ll-scroll-table mt-5 overflow-hidden rounded-xl border border-[var(--ll-border)]">
                <table className="w-full text-sm">
                    <thead className="bg-[var(--ll-surface-muted)]">
                      <tr className="text-left text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ll-text-faint)]">
                        <th className="px-4 py-3">District</th>
                        <th className="px-4 py-3">Schools</th>
                        <th className="px-4 py-3">Students</th>
                        <th className="px-4 py-3">Lessons</th>
                        <th className="px-4 py-3">Mastery Rate</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--ll-border)] bg-[var(--ll-surface)]">
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
                            ? "border-[var(--ll-accent)]/20 bg-[var(--ll-accent-soft)] text-[var(--ll-accent)]"
                            : status === "Watch"
                              ? "border-[var(--ll-warning)]/20 bg-[rgba(250,204,21,0.10)] text-[var(--ll-warning)]"
                              : status === "At Risk"
                                ? "border-[var(--ll-danger)]/20 bg-[rgba(251,113,133,0.10)] text-[var(--ll-danger)]"
                                : "border-[var(--ll-border)] bg-[var(--ll-surface-muted)] text-[var(--ll-text-muted)]";

                        return (
                          <tr key={d.districtId} className="text-[var(--ll-text-muted)]">
                            <td className="px-4 py-3 font-medium">
                              <Link
                                href={`/moe/districts/${d.districtId}`}
                                className="transition-colors hover:text-[var(--ll-accent)]"
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
            )}
          </section>

          {districtsRequiringAttention.length > 0 && (
            <section className="ll-section rounded-xl p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ll-text-faint)]">
                Requires attention
              </p>
              <h2 className="mt-2 text-base font-semibold text-[var(--ll-text)]">
                Districts Requiring Attention
              </h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {districtsRequiringAttention.slice(0, 6).map((district) => (
                  <Link
                    key={district.districtId}
                    href={`/moe/districts/${district.districtId}`}
                    className="ll-command ll-focus justify-between text-sm"
                  >
                    <span className="font-semibold text-[var(--ll-text)]">{district.districtName}</span>
                    <span className="text-[var(--ll-warning)]">{formatPct(district.compliancePct)}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <details className="ll-section rounded-xl p-4">
            <summary className="cursor-pointer text-sm font-semibold text-[var(--ll-text)]">
              Exports and audit
            </summary>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Link href="/moe/districts" className="ll-command ll-focus flex-col items-start">
                <p className="text-sm font-semibold text-[var(--ll-text)]">County breakdown</p>
                <p className="text-xs text-[var(--ll-text-muted)]">View all district performance</p>
              </Link>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="ll-command ll-focus flex-col items-start text-left disabled:opacity-60"
              >
                <p className="text-sm font-semibold text-[var(--ll-text)]">Generate report</p>
                <p className="text-xs text-[var(--ll-text-muted)]">{exporting ? "Exporting..." : "Export compliance CSV"}</p>
              </button>
              <Link href="/moe/audit" className="ll-command ll-focus flex-col items-start">
                <p className="text-sm font-semibold text-[var(--ll-text)]">View audit log</p>
                <p className="text-xs text-[var(--ll-text-muted)]">National audit trail</p>
              </Link>
            </div>
            {exportError && <p className="mt-3 text-xs text-[var(--ll-danger)]">{exportError}</p>}
          </details>

          <section className="ll-section rounded-xl p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ll-text-faint)]">
                  Compliance
                </p>
                <h2 className="mt-2 text-base font-semibold text-[var(--ll-text)]">
                  Compliance Summary
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--ll-text-muted)]">
                  National delivery compliance and reporting signals
                </p>
              </div>
            </div>

            {loading ? (
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {Array.from({ length: 3 }).map((_, idx) => <SkeletonCard key={idx} />)}
              </div>
            ) : (
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <Card className="p-5">
                  <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ll-text-faint)]">
                    Reporting Rate
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--ll-accent)]">
                    {formatPct(compliance?.national?.compliancePct)}
                  </p>
                  <div className="mt-4 h-2 rounded-full bg-[var(--ll-surface-muted)]">
                    <div
                      className="h-2 rounded-full bg-[var(--ll-accent)]"
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
                  valueClassName="text-[var(--ll-warning)]"
                />
                <StatCard
                  label="Fully Compliant Districts"
                  value={fullyCompliantDistricts}
                  subtitle="Districts at 100%"
                  valueClassName="text-[var(--ll-text)]"
                />
              </div>
            )}
          </section>

          {interventions && (
            <section className="ll-section rounded-xl p-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ll-text-faint)]">
                  Interventions
                </p>
                <h2 className="mt-2 text-base font-semibold text-[var(--ll-text)]">
                  Interventions Snapshot
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--ll-text-muted)]">
                  National aggregates from the last 30 days
                </p>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <StatCard
                  label="Total Active"
                  value={interventions.national.totalInterventions ?? 0}
                  valueClassName="text-[var(--ll-danger)]"
                />
                <StatCard
                  label="Avg Outcome Delta"
                  value={interventions.national.avgOutcomeDelta ?? "--"}
                  valueClassName="text-[var(--ll-accent)]"
                />
                <StatCard
                  label="Avg Effect Size"
                  value={interventions.national.avgOutcomeEffectSize ?? "--"}
                  valueClassName="text-[var(--ll-warning)]"
                />
              </div>
            </section>
          )}

          <section className="ll-section rounded-xl p-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ll-text-faint)]">
                National Outcomes
              </p>
              <h2 className="mt-2 text-base font-semibold text-[var(--ll-text)]">
                Product Metrics Snapshot
              </h2>
              <p className="mt-1 text-sm leading-6 text-[var(--ll-text-muted)]">
                National completion, assessment, guardian engagement, and district outcome ranking.
              </p>
            </div>

            {loading ? (
              <div className="mt-5 grid gap-3 md:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => <SkeletonCard key={index} />)}
              </div>
            ) : (
              <>
                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  <StatCard
                    label="Lesson Completion"
                    value={formatPct(dashboard?.productMetrics.nationalLessonCompletionRate)}
                    valueClassName="text-[var(--ll-text)]"
                  />
                  <StatCard
                    label="Exam Pass Rate"
                    value={formatPct(dashboard?.productMetrics.nationalExamPassRate)}
                    valueClassName="text-[var(--ll-text)]"
                  />
                  <StatCard
                    label="Guardian Engagement"
                    value={formatPct(dashboard?.productMetrics.nationalGuardianEngagementRate)}
                    valueClassName="text-[var(--ll-text)]"
                  />
                  <StatCard
                    label="Intervention Impact"
                    value={formatPct(dashboard?.productMetrics.interventionImpactRate)}
                    valueClassName="text-[var(--ll-danger)]"
                  />
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <Card className="p-5">
                    <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ll-text-faint)]">
                      Top Performing Districts
                    </p>
                    <div className="mt-4 space-y-3">
                      {(dashboard?.productMetrics.topPerformingDistricts ?? []).map((district) => (
                        <div
                          key={district.districtId}
                          className="flex items-center justify-between rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-4 py-3"
                        >
                          <p className="font-medium text-[var(--ll-text)]">{district.districtName}</p>
                          <p className="font-semibold text-[var(--ll-accent)]">{district.compositeScore.toFixed(1)}%</p>
                        </div>
                      ))}
                    </div>
                  </Card>
                  <Card className="p-5">
                    <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ll-text-faint)]">
                      Lowest Performing Districts
                    </p>
                    <div className="mt-4 space-y-3">
                      {(dashboard?.productMetrics.lowestPerformingDistricts ?? []).map((district) => (
                        <div
                          key={district.districtId}
                          className="flex items-center justify-between rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-4 py-3"
                        >
                          <p className="font-medium text-[var(--ll-text)]">{district.districtName}</p>
                          <p className="font-semibold text-[var(--ll-danger)]">{district.compositeScore.toFixed(1)}%</p>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </>
            )}
          </section>

          <section className="ll-section rounded-xl p-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ll-text-faint)]">
                Exams
              </p>
              <h2 className="mt-2 text-base font-semibold text-[var(--ll-text)]">Exam System</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--ll-text-muted)]">
                National exam publication, pass rate, certification, and integrity signals
              </p>
            </div>

            {loading ? (
              <div className="mt-5 grid gap-3 md:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => <SkeletonCard key={index} />)}
              </div>
            ) : (
              <>
                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  <StatCard
                    label="Published Exams"
                    value={dashboard?.examStats.totalExamsPublished ?? 0}
                    valueClassName="text-[var(--ll-text)]"
                  />
                  <StatCard
                    label="National Pass Rate"
                    value={formatPct(dashboard?.examStats.nationalPassRate)}
                    valueClassName="text-[var(--ll-text)]"
                  />
                  <StatCard
                    label="Certifications Issued"
                    value={dashboard?.examStats.certificationIssued ?? 0}
                    valueClassName="text-[var(--ll-text)]"
                  />
                  <StatCard
                    label="Flagged Attempts"
                    value={dashboard?.examStats.flaggedAttempts ?? 0}
                    valueClassName="text-[var(--ll-danger)]"
                  />
                </div>

                <div className="mt-5 overflow-hidden rounded-xl border border-[var(--ll-border)]">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[var(--ll-surface-muted)]">
                        <tr className="text-left text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ll-text-faint)]">
                          <th className="px-4 py-3">Subject</th>
                          <th className="px-4 py-3">Attempts</th>
                          <th className="px-4 py-3">Pass Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--ll-border)] bg-[var(--ll-surface)]">
                        {(dashboard?.examStats.subjectBreakdown ?? []).map((row) => (
                          <tr key={row.subject} className="text-[var(--ll-text-muted)]">
                            <td className="px-4 py-3 font-medium text-[var(--ll-text)]">{row.subject}</td>
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

          <section className="ll-section rounded-xl p-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ll-text-faint)]">
                Placement
              </p>
              <h2 className="mt-2 text-base font-semibold text-[var(--ll-text)]">
                National Placement Analytics
              </h2>
              <p className="mt-1 text-sm leading-6 text-[var(--ll-text-muted)]">
                AI placement calibration and teacher override patterns
              </p>
            </div>

            {loading ? (
              <div className="mt-5 grid gap-3 md:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => <SkeletonCard key={index} />)}
              </div>
            ) : (
              <>
                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  <StatCard
                    label="Students Placed"
                    value={placements?.totalStudentsPlaced ?? 0}
                    subtitle="National total"
                    valueClassName="text-[var(--ll-text)]"
                  />
                  <StatCard
                    label="Average AI Confidence"
                    value={
                      placements?.averageAiConfidence == null
                        ? "--"
                        : `${placements.averageAiConfidence}%`
                    }
                    valueClassName="text-[var(--ll-text)]"
                  />
                  <StatCard
                    label="National Override Rate"
                    value={`${placements?.nationalOverrideRate ?? 0}%`}
                    valueClassName="text-[var(--ll-warning)]"
                  />
                  <StatCard
                    label="Most Common Placement Band"
                    value={placements?.mostCommonPlacementBand ?? "--"}
                    valueClassName="text-[var(--ll-text)]"
                  />
                </div>

                <div className="mt-5 overflow-hidden rounded-xl border border-[var(--ll-border)]">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[var(--ll-surface-muted)]">
                        <tr className="text-left text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ll-text-faint)]">
                          <th className="px-4 py-3">District</th>
                          <th className="px-4 py-3">Students Placed</th>
                          <th className="px-4 py-3">Override Rate</th>
                          <th className="px-4 py-3">Avg AI Confidence</th>
                          <th className="px-4 py-3">Top Override Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--ll-border)] bg-[var(--ll-surface)]">
                        {(placements?.byDistrict ?? []).map((district) => (
                          <tr key={district.districtId} className="text-[var(--ll-text-muted)]">
                            <td className="px-4 py-3">
                              <div className="space-y-1">
                                <p className="font-medium text-[var(--ll-text)]">{district.districtName}</p>
                                {district.warning ? (
                                  <p className="text-xs text-[var(--ll-warning)]">
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
                            <td className="px-4 py-3 text-[var(--ll-text-faint)]">
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
    </main>
  );
}
