import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getWorkerStatus } from "@/lib/autonomous/runtime/autonomousWorkerService";
import { getRuntimeMetrics } from "@/lib/autonomous/runtime/runtimeMetricsService";
import { isRuntimeDashboardEnabled, isWorkflowRecoveryCronEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

export default async function WorkflowRecoveryPage() {
  const user = await requireUser();
  if (!user.isPlatformAdmin && user.role !== "ADMIN") redirect("/");
  if (!isRuntimeDashboardEnabled()) redirect("/admin/ops");

  const [workerStatus, metrics] = await Promise.all([
    getWorkerStatus({ schoolId: user.isPlatformAdmin ? null : user.schoolId }),
    getRuntimeMetrics({ windowHours: 24 }),
  ]);

  const recoveryEnabled = isWorkflowRecoveryCronEnabled();

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <Link className="text-sm underline" href="/admin/ops/runtime">← Runtime Dashboard</Link>
          <h1 className="mt-2 text-2xl font-semibold">Workflow Recovery</h1>
          <p className="text-sm text-[var(--ll-text-muted)]">
            Stuck and failed workflow detection. Recovery cron:{" "}
            <span className={recoveryEnabled ? "text-emerald-400" : "text-zinc-500"}>
              {recoveryEnabled ? "enabled (*/10 * * * *)" : "disabled"}
            </span>
          </p>
        </header>

        {metrics.workflows.stuckCount > 0 && (
          <section className="rounded border border-amber-500/50 bg-amber-500/10 p-4 text-amber-100">
            <span className="font-semibold">{metrics.workflows.stuckCount} stuck workflow(s)</span> — workflows in running/executing state past the stuck threshold. The recovery cron will reset these automatically when enabled.
          </section>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[
            { label: "Stuck workflows", value: metrics.workflows.stuckCount },
            { label: "Failed (24h)", value: metrics.workflows.failed },
            { label: "Dead-lettered (total)", value: metrics.workflows.deadLettered },
            { label: "Running now", value: workerStatus.runningWorkflows },
            { label: "Executing now", value: workerStatus.executingWorkflows },
            { label: "Expired locks", value: workerStatus.expiredLocks },
          ].map(({ label, value }) => (
            <div key={label} className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--ll-text-muted)]">{label}</div>
              <div className="mt-2 text-2xl font-semibold">{value}</div>
            </div>
          ))}
        </section>

        <section className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 text-sm">
          <h2 className="text-lg font-semibold">Recovery Actions</h2>
          <p className="mt-2 text-[var(--ll-text-muted)]">
            To manually trigger recovery, POST to <span className="font-mono">/api/cron/autonomous/workflow-recovery</span> with your CRON_SECRET bearer token.
            Platform admins can also POST to <span className="font-mono">/api/admin/ops/runtime/recovery</span> with <span className="font-mono">{"{ action: \"recover\", dryRun: true }"}</span> to preview first.
          </p>
          <p className="mt-3 text-[var(--ll-text-muted)]">
            To enable recovery cron: set <span className="font-mono">ENABLE_AUTONOMOUS_CRON=true</span> and <span className="font-mono">ENABLE_WORKFLOW_RECOVERY_CRON=true</span>.
          </p>
          <div className="mt-4">
            <Link className="underline" href="/admin/ops/runtime/dead-letter">
              View dead-letter items →
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
