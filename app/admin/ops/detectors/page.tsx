import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listDetectors } from "@/lib/autonomous/detectors/detectorRegistry";

export const dynamic = "force-dynamic";

export default async function DetectorDashboardPage() {
  const user = await requireUser();
  if (!user.isPlatformAdmin) redirect("/");

  const detectors = listDetectors();
  const [runs, decisions] = await Promise.all([
    (prisma as any).workflowRun.findMany({
      where: { workflowType: { startsWith: "detector." } },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: { id: true, workflowType: true, status: true, riskLevel: true, traceId: true, schoolId: true, createdAt: true },
    }),
    (prisma as any).agentDecision.groupBy({
      by: ["decisionType", "status"],
      where: { decisionType: { startsWith: "detector.recommendation." } },
      _count: { _all: true },
    }),
  ]);

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[var(--ll-text-muted)]">Recommend-Only OS</p>
            <h1 className="text-2xl font-semibold">Detector Dashboard</h1>
          </div>
          <Link className="text-sm font-medium underline" href="/admin/ops/recommendations">
            Recommendation queue
          </Link>
        </header>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {detectors.map((detector) => (
            <div key={detector.id} className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
              <div className="text-sm font-semibold">{detector.name}</div>
              <div className="mt-1 text-xs text-[var(--ll-text-muted)]">{detector.ownerDomain}</div>
              <div className="mt-3 text-xs">Risk ceiling: {detector.riskCeiling}</div>
              <div className="text-xs">Scope: {detector.allowedTenantScopes.join(", ")}</div>
              <div className="mt-3 text-xs text-[var(--ll-text-muted)]">{detector.confidenceContract}</div>
            </div>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="overflow-x-auto rounded border border-[var(--ll-border)]">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead className="bg-[var(--ll-surface)] text-left">
                <tr>
                  <th className="px-3 py-2">Execution</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Risk</th>
                  <th className="px-3 py-2">Tenant</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2">Trace</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run: any) => (
                  <tr key={run.id} className="border-t border-[var(--ll-border)]">
                    <td className="px-3 py-2">
                      <Link className="font-medium underline" href={`/admin/ops/detectors/executions/${run.id}`}>
                        {run.workflowType.replace("detector.", "")}
                      </Link>
                      <div className="text-xs text-[var(--ll-text-muted)]">{run.id}</div>
                    </td>
                    <td className="px-3 py-2">{run.status}</td>
                    <td className="px-3 py-2">{run.riskLevel}</td>
                    <td className="px-3 py-2">{run.schoolId ?? "aggregate"}</td>
                    <td className="px-3 py-2">{new Date(run.createdAt).toLocaleString()}</td>
                    <td className="max-w-[220px] truncate px-3 py-2">{run.traceId}</td>
                  </tr>
                ))}
                {runs.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-center text-[var(--ll-text-muted)]" colSpan={6}>
                      No detector executions recorded.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <aside className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
            <h2 className="text-lg font-semibold">Recommendation Status</h2>
            <div className="mt-4 space-y-3">
              {decisions.map((row: any) => (
                <div key={`${row.decisionType}:${row.status}`} className="border-t border-[var(--ll-border)] pt-3">
                  <div className="text-sm font-medium">{row.decisionType.replace("detector.recommendation.", "")}</div>
                  <div className="text-xs text-[var(--ll-text-muted)]">
                    {row.status}: {row._count._all}
                  </div>
                </div>
              ))}
              {decisions.length === 0 ? <p className="text-sm text-[var(--ll-text-muted)]">No recommendations yet.</p> : null}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
