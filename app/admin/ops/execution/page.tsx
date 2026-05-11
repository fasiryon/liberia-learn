import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getApprovalSLAAnalytics } from "@/lib/autonomous/actions/approvalSLAService";
import { getExecutionHealth } from "@/lib/autonomous/actions/executionHealthService";

export const dynamic = "force-dynamic";

export default async function ExecutionAnalyticsPage() {
  const user = await requireUser();
  if (!user.isPlatformAdmin && user.role !== "ADMIN") redirect("/");
  const schoolId = user.isPlatformAdmin ? null : user.schoolId;
  const where: any = schoolId ? { schoolId } : {};
  const [actions, sla, health] = await Promise.all([
    (prisma as any).actionExecution.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 }),
    getApprovalSLAAnalytics({ schoolId }),
    getExecutionHealth({ schoolId }),
  ]);
  const byStatus = actions.reduce((acc: Record<string, number>, action: any) => {
    acc[action.status] = (acc[action.status] ?? 0) + 1;
    return acc;
  }, {});
  const lowRiskPilots = actions.filter((action: any) => action.outputRefs?.lowRiskPilot === true);

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[var(--ll-text-muted)]">Governed Execution</p>
            <h1 className="text-2xl font-semibold">Execution Analytics</h1>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link className="rounded border border-[var(--ll-border)] px-3 py-2 underline" href="/admin/ops/execution/health">Worker health</Link>
            <Link className="rounded border border-[var(--ll-border)] px-3 py-2 underline" href="/admin/ops/execution/low-risk">Low-risk pilots</Link>
            <Link className="rounded border border-[var(--ll-border)] px-3 py-2 underline" href="/admin/ops/stale-approvals">Stale approvals</Link>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 text-sm">Actions<br /><span className="text-2xl font-semibold">{actions.length}</span></div>
          <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 text-sm">Low-risk pilots<br /><span className="text-2xl font-semibold">{lowRiskPilots.length}</span></div>
          <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 text-sm">SLA breached<br /><span className="text-2xl font-semibold">{sla.buckets.breached}</span></div>
          <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 text-sm">Worker<br /><span className="text-2xl font-semibold">{health.status}</span></div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
            <h2 className="text-lg font-semibold">Action Status</h2>
            <div className="mt-3 space-y-2 text-sm">
              {Object.entries(byStatus).map(([status, count]) => (
                <div key={status} className="flex justify-between border-t border-[var(--ll-border)] py-2"><span>{status}</span><span>{String(count)}</span></div>
              ))}
            </div>
          </div>
          <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
            <h2 className="text-lg font-semibold">Approval SLA</h2>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              {Object.entries(sla.buckets).map(([bucket, count]) => (
                <div key={bucket} className="border-t border-[var(--ll-border)] py-2">{bucket}: {count}</div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
