import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isAutonomousOptimizationEnabled } from "@/lib/serverFlags";
import { getGovernanceOptimizationReport } from "@/lib/autonomous/optimization/governanceReviewReportService";

export const dynamic = "force-dynamic";

export default async function OptimizationDashboardPage() {
  const user = await requireUser();
  if (!user.isPlatformAdmin && user.role !== "ADMIN") redirect("/");
  if (!isAutonomousOptimizationEnabled()) {
    return <main className="min-h-screen px-6 py-8">Autonomous optimization is disabled.</main>;
  }
  const schoolId = user.isPlatformAdmin ? null : user.schoolId;
  const report = await getGovernanceOptimizationReport({ requester: user, schoolId });
  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-[var(--ll-text-muted)]">Governance-Safe Optimization</p>
            <h1 className="text-2xl font-semibold">Optimization Dashboard</h1>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link className="rounded border border-[var(--ll-border)] px-3 py-2 underline" href="/admin/ops/optimization/tuning">Tuning review</Link>
            <Link className="rounded border border-[var(--ll-border)] px-3 py-2 underline" href="/admin/ops/optimization/rollout">Rollout calibration</Link>
            <Link className="rounded border border-[var(--ll-border)] px-3 py-2 underline" href="/admin/ops/optimization/readiness">Autonomy readiness</Link>
          </div>
        </header>
        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 text-sm">Recommendations<br /><span className="text-2xl font-semibold">{report.recommendations.length}</span></div>
          <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 text-sm">Pending review<br /><span className="text-2xl font-semibold">{report.byStatus.PENDING_REVIEW ?? 0}</span></div>
          <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 text-sm">Precision<br /><span className="text-2xl font-semibold">{report.precision.precision}</span></div>
          <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 text-sm">Readiness<br /><span className="text-2xl font-semibold">{report.readiness.score}</span></div>
        </section>
        <section className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
          <h2 className="text-lg font-semibold">Optimization Approval Queue</h2>
          <div className="mt-3 divide-y divide-[var(--ll-border)] text-sm">
            {report.recommendations.slice(0, 20).map((item: any) => (
              <div key={item.id} className="grid gap-2 py-3 md:grid-cols-[1fr_auto_auto] md:items-center">
                <div>
                  <Link className="font-medium underline" href={`/admin/ops/optimization/${item.id}`}>{item.title}</Link>
                  <p className="text-[var(--ll-text-muted)]">{item.category} · {item.expectedImpact}</p>
                </div>
                <span>{item.reviewStatus}</span>
                <span>confidence {item.confidence}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
