import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { checkBackpressure } from "@/lib/autonomous/runtime/runtimeBackpressureService";
import { getRuntimeMetrics } from "@/lib/autonomous/runtime/runtimeMetricsService";
import { isQueueConfigured } from "@/lib/queue";
import { isRuntimeDashboardEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

export default async function QueueBacklogPage() {
  const user = await requireUser();
  if (!user.isPlatformAdmin && user.role !== "ADMIN") redirect("/");
  if (!isRuntimeDashboardEnabled()) redirect("/admin/ops");

  const [bp, metrics] = await Promise.all([
    checkBackpressure(),
    getRuntimeMetrics({ windowHours: 24 }),
  ]);

  const queueConfigured = isQueueConfigured();

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <Link className="text-sm underline" href="/admin/ops/runtime">← Runtime Dashboard</Link>
          <h1 className="mt-2 text-2xl font-semibold">Queue Backlog</h1>
        </header>

        {bp.active && (
          <section className="rounded border border-amber-500/50 bg-amber-500/10 p-4 text-amber-100">
            <span className="font-semibold">Backpressure Active</span> — {bp.reason}. Pending: {bp.pendingWorkflows}/{bp.pendingThreshold}.
          </section>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[
            { label: "SQS configured", value: queueConfigured ? "Yes" : "No" },
            { label: "Pending workflows", value: bp.pendingWorkflows },
            { label: "Backpressure threshold", value: bp.pendingThreshold },
            { label: "Running", value: metrics.workflows.running },
            { label: "Succeeded (24h)", value: metrics.workflows.succeeded },
            { label: "Failed (24h)", value: metrics.workflows.failed },
          ].map(({ label, value }) => (
            <div key={label} className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--ll-text-muted)]">{label}</div>
              <div className="mt-2 text-2xl font-semibold">{value}</div>
            </div>
          ))}
        </section>

        <section className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 text-sm">
          <h2 className="text-lg font-semibold">Retry Budget (24h)</h2>
          <div className="mt-3 space-y-1">
            <div>Used: {metrics.retryBudget.used} / {metrics.retryBudget.limit}</div>
            <div>
              Status:{" "}
              <span className={metrics.retryBudget.exhausted ? "text-red-400" : "text-emerald-400"}>
                {metrics.retryBudget.exhausted ? "Exhausted" : "Available"}
              </span>
            </div>
          </div>
        </section>

        {!queueConfigured && (
          <section className="rounded border border-zinc-600/50 bg-zinc-700/10 p-4 text-sm text-zinc-300">
            SQS queue is not configured (SQS_QUEUE_URL not set). Workflows can still be created, but autonomous queue processing is unavailable. See docs/ai/RUNTIME_OPERATIONS.md for deployment steps.
          </section>
        )}
      </div>
    </main>
  );
}
