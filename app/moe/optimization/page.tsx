import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isAutonomousOptimizationEnabled } from "@/lib/serverFlags";
import { getGovernanceOptimizationReport } from "@/lib/autonomous/optimization/governanceReviewReportService";

export const dynamic = "force-dynamic";

export default async function MoeOptimizationPage() {
  const user = await requireUser();
  if (!["MOE_OFFICIAL", "MOE_SUPER_ADMIN", "DISTRICT_ADMIN"].includes(String(user.role)) && !user.isPlatformAdmin) redirect("/");
  if (!isAutonomousOptimizationEnabled()) return <main className="min-h-screen px-6 py-8">Autonomous optimization is disabled.</main>;
  const report = await getGovernanceOptimizationReport({ requester: user, aggregateOnly: true });
  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-7xl space-y-6">
        <header><p className="text-sm font-semibold uppercase text-[var(--ll-text-muted)]">MOE Aggregate Review</p><h1 className="text-2xl font-semibold">Optimization Governance</h1></header>
        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded border p-4 text-sm">Aggregate recommendations<br /><span className="text-2xl font-semibold">{report.recommendations.length}</span></div>
          <div className="rounded border p-4 text-sm">Pending review<br /><span className="text-2xl font-semibold">{report.byStatus.PENDING_REVIEW ?? 0}</span></div>
          <div className="rounded border p-4 text-sm">Readiness<br /><span className="text-2xl font-semibold">{report.readiness.score}</span></div>
        </section>
        <section className="rounded border bg-[var(--ll-surface)] p-4">
          <h2 className="text-lg font-semibold">Aggregate-Safe Queue</h2>
          <div className="mt-3 divide-y text-sm">
            {report.recommendations.map((item: any) => <div key={item.id} className="py-3"><Link className="font-medium underline" href={`/admin/ops/optimization/${item.id}`}>{item.title}</Link><p>{item.category} · no raw student PII</p></div>)}
          </div>
        </section>
      </div>
    </main>
  );
}
