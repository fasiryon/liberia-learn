import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "n/a";
  return new Date(value).toLocaleString();
}

export default async function WorkflowDiagnosticsPage() {
  const user = await requireUser();
  if (!user.isPlatformAdmin) redirect("/");

  const [runs, statusCounts, deadLettered] = await Promise.all([
    prisma.workflowRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        workflowType: true,
        status: true,
        riskLevel: true,
        partitionKey: true,
        traceId: true,
        currentCheckpoint: true,
        attempt: true,
        maxAttempts: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.workflowRun.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.workflowRun.count({ where: { status: "dead_lettered" } }),
  ]);

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--ll-text-muted)]">
            Internal Operations
          </p>
          <h1 className="text-2xl font-semibold">Workflow Diagnostics</h1>
        </header>

        <section className="grid gap-3 md:grid-cols-4">
          {statusCounts.map((row) => (
            <div key={row.status} className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
              <div className="text-sm text-[var(--ll-text-muted)]">{row.status}</div>
              <div className="text-2xl font-semibold">{row._count._all}</div>
            </div>
          ))}
          <div className="rounded border border-red-500/40 bg-red-500/10 p-4">
            <div className="text-sm text-red-200">dead_lettered</div>
            <div className="text-2xl font-semibold text-red-100">{deadLettered}</div>
          </div>
        </section>

        <section className="overflow-x-auto rounded border border-[var(--ll-border)]">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead className="bg-[var(--ll-surface)] text-left">
              <tr>
                <th className="px-3 py-2">Workflow</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Risk</th>
                <th className="px-3 py-2">Partition</th>
                <th className="px-3 py-2">Checkpoint</th>
                <th className="px-3 py-2">Attempts</th>
                <th className="px-3 py-2">Updated</th>
                <th className="px-3 py-2">Trace</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-t border-[var(--ll-border)]">
                  <td className="px-3 py-2">
                    <Link className="font-medium underline" href={`/admin/ops/workflows/${run.id}`}>
                      {run.workflowType}
                    </Link>
                    <div className="text-xs text-[var(--ll-text-muted)]">{run.id}</div>
                  </td>
                  <td className="px-3 py-2">{run.status}</td>
                  <td className="px-3 py-2">{run.riskLevel}</td>
                  <td className="px-3 py-2">{run.partitionKey}</td>
                  <td className="px-3 py-2">{run.currentCheckpoint ?? "n/a"}</td>
                  <td className="px-3 py-2">
                    {run.attempt}/{run.maxAttempts}
                  </td>
                  <td className="px-3 py-2">{formatDate(run.updatedAt)}</td>
                  <td className="max-w-[220px] truncate px-3 py-2">{run.traceId}</td>
                </tr>
              ))}
              {runs.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-[var(--ll-text-muted)]" colSpan={8}>
                    No autonomous workflows have been recorded.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

