import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getRuntimeOverview } from "@/lib/autonomous/runtime/autonomousRuntimeService";
import { getCronPauseStatus, getManualRuntimeRunHistory } from "@/lib/autonomous/runtime/manualRuntimeRunService";
import { isRuntimeDashboardEnabled } from "@/lib/serverFlags";
import ManualRuntimeControls from "@/components/admin/ManualRuntimeControls";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  healthy: "border-emerald-500/50 bg-emerald-500/10 text-emerald-100",
  degraded: "border-amber-500/50 bg-amber-500/10 text-amber-100",
  saturated: "border-red-500/50 bg-red-500/10 text-red-100",
  shutdown: "border-red-700/50 bg-red-700/10 text-red-100",
  unknown: "border-zinc-500/50 bg-zinc-500/10 text-zinc-300",
};

export default async function RuntimeHubPage() {
  const user = await requireUser();
  if (!user.isPlatformAdmin && user.role !== "ADMIN") redirect("/");
  if (!isRuntimeDashboardEnabled()) redirect("/admin/ops");

  const overview = await getRuntimeOverview({ schoolId: user.isPlatformAdmin ? null : user.schoolId });
  const [manualHistory, cronPauseStatus] = user.isPlatformAdmin
    ? await Promise.all([getManualRuntimeRunHistory(20), getCronPauseStatus()])
    : [[], { paused: false, configuredCount: null, restoreCount: null }];
  const { health, metrics, backpressure, workerStatus, schedulerStatus } = overview;
  const statusStyle = STATUS_STYLE[health.status] ?? STATUS_STYLE.unknown;
  const cronRunTimes = schedulerStatus
    .map((job) => job.lastRunAt)
    .filter((value): value is string => Boolean(value))
    .sort();
  const lastCronRun = cronRunTimes.length > 0 ? cronRunTimes[cronRunTimes.length - 1] : null;

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <Link className="text-sm underline" href="/admin/ops">← Operations</Link>
          <h1 className="mt-2 text-2xl font-semibold">Runtime Dashboard</h1>
          <p className="text-sm text-[var(--ll-text-muted)]">
            Production health, workers, queue, and scheduler status.
          </p>
        </header>

        <section className={`rounded border p-5 ${statusStyle}`}>
          <div className="text-sm font-semibold uppercase tracking-wide">Runtime Status</div>
          <div className="mt-2 text-3xl font-semibold capitalize">{health.status}</div>
          {health.signals.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-sm">
              {health.signals.map((s) => <li key={s}>{s}</li>)}
            </ul>
          )}
          <p className="mt-2 text-xs">{health.timestamp}</p>
        </section>

        {user.isPlatformAdmin && (
          <ManualRuntimeControls
            history={manualHistory}
            cronPaused={cronPauseStatus.paused || schedulerStatus.every((job) => !job.enabled)}
          />
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Active executions", value: health.activeExecutions },
            { label: "Stuck workflows", value: health.stuckWorkflows },
            { label: "Dead-letter items", value: health.deadLetterCount },
            { label: "Backpressure", value: backpressure.active ? "Active" : "OK" },
            { label: "Pending approvals", value: metrics.approvals.pending },
            { label: "Overdue approvals", value: metrics.approvals.overdue },
            { label: "Eval windows open", value: metrics.evaluationWindows.open },
            { label: "Eval windows due", value: metrics.evaluationWindows.due },
          ].map(({ label, value }) => (
            <div key={label} className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--ll-text-muted)]">{label}</div>
              <div className="mt-2 text-2xl font-semibold">{value}</div>
            </div>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
            <h2 className="text-lg font-semibold">Navigation</h2>
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <Link className="rounded border border-[var(--ll-border)] px-3 py-2 underline" href="/admin/ops/runtime/workers">Workers & Locks</Link>
              <Link className="rounded border border-[var(--ll-border)] px-3 py-2 underline" href="/admin/ops/runtime/queue">Queue Backlog</Link>
              <Link className="rounded border border-[var(--ll-border)] px-3 py-2 underline" href="/admin/ops/runtime/recovery">Workflow Recovery</Link>
              <Link className="rounded border border-[var(--ll-border)] px-3 py-2 underline" href="/admin/ops/runtime/dead-letter">Dead-Letter Items</Link>
              {user.isPlatformAdmin && (
                <Link className="rounded border border-[var(--ll-border)] px-3 py-2 underline" href="/admin/ops/runtime/runs">Run History</Link>
              )}
              {user.isPlatformAdmin && (
                <Link className="rounded border border-[var(--ll-border)] px-3 py-2 underline" href="/admin/ops/runtime/smoke">Smoke Verification</Link>
              )}
              <Link className="rounded border border-[var(--ll-border)] px-3 py-2 underline" href="/admin/ops/runtime/cron">Cron Run History</Link>
              <Link className="rounded border border-[var(--ll-border)] px-3 py-2 underline" href="/admin/ops/effectiveness">Effectiveness Dashboard</Link>
            </div>
          </div>

          <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
            <h2 className="text-lg font-semibold">Scheduler Status</h2>
            <p className="mt-1 text-xs text-[var(--ll-text-muted)]">
              Last cron run: {lastCronRun ? lastCronRun.slice(0, 16).replace("T", " ") : "Never"}
            </p>
            <div className="mt-3 divide-y divide-[var(--ll-border)] text-sm">
              {schedulerStatus.map((job) => (
                <div key={job.pipeline} className="flex items-center justify-between py-2">
                  <div>
                    <span className="font-medium">{job.label}</span>
                    <p className="text-xs text-[var(--ll-text-muted)]">{job.schedule}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-semibold ${job.enabled ? "text-emerald-400" : "text-zinc-500"}`}>
                      {job.enabled ? "enabled" : "disabled"}
                    </span>
                    {job.lastRunAt && (
                      <p className="text-xs text-[var(--ll-text-muted)]">{job.lastRunAt.slice(0, 16).replace("T", " ")}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 text-sm">
          <h2 className="text-lg font-semibold">Workflow Summary (24h)</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {[
              { label: "Succeeded", value: metrics.workflows.succeeded },
              { label: "Failed", value: metrics.workflows.failed },
              { label: "Dead-lettered", value: metrics.workflows.deadLettered },
              { label: "Pending", value: metrics.workflows.pending },
              { label: "Running", value: metrics.workflows.running },
              { label: "Stuck", value: metrics.workflows.stuckCount },
            ].map(({ label, value }) => (
              <div key={label} className="rounded border border-[var(--ll-border)] p-3 text-center">
                <div className="text-xs text-[var(--ll-text-muted)]">{label}</div>
                <div className="text-xl font-semibold">{value}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
