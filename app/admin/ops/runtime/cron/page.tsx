import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getAllAutonomousCronHistory } from "@/lib/autonomous/runtime/autonomousCronLog";
import { getSchedulerStatus } from "@/lib/autonomous/runtime/autonomousSchedulerService";
import { isRuntimeDashboardEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  ok: "text-emerald-400",
  skipped: "text-zinc-400",
  error: "text-red-400",
};

export default async function CronRunHistoryPage() {
  const user = await requireUser();
  if (!user.isPlatformAdmin && user.role !== "ADMIN") redirect("/");
  if (!isRuntimeDashboardEnabled()) redirect("/admin/ops");

  const [history, schedulerStatus] = await Promise.all([
    getAllAutonomousCronHistory(15),
    getSchedulerStatus(),
  ]);

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <Link className="text-sm underline" href="/admin/ops/runtime">← Runtime Dashboard</Link>
          <h1 className="mt-2 text-2xl font-semibold">Cron Run History</h1>
        </header>

        <section className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
          <h2 className="text-lg font-semibold">Scheduled Jobs</h2>
          <div className="mt-3 divide-y divide-[var(--ll-border)] text-sm">
            {schedulerStatus.map((job) => (
              <div key={job.pipeline} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{job.label}</p>
                  <p className="font-mono text-xs text-[var(--ll-text-muted)]">{job.schedule} · {job.pipeline}</p>
                </div>
                <div className="text-right text-xs">
                  <p className={job.enabled ? "font-semibold text-emerald-400" : "text-zinc-500"}>
                    {job.enabled ? "enabled" : "disabled"}
                  </p>
                  {job.lastRunAt && (
                    <p className="text-[var(--ll-text-muted)]">{job.lastRunAt.slice(0, 16).replace("T", " ")}</p>
                  )}
                  {job.lastRunStatus && (
                    <p className={STATUS_STYLE[job.lastRunStatus] ?? "text-zinc-400"}>{job.lastRunStatus}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
          <h2 className="text-lg font-semibold">Recent Runs</h2>
          {history.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--ll-text-muted)]">No cron runs recorded yet. Enable cron jobs and trigger via vercel.json cron config or manual POST.</p>
          ) : (
            <div className="mt-3 divide-y divide-[var(--ll-border)] text-sm">
              {history.map((run, i) => (
                <div key={`${run.pipeline}-${i}`} className="grid gap-1 py-2 md:grid-cols-[1fr_auto]">
                  <div>
                    <p className="font-mono text-xs">{run.pipeline}</p>
                    <p className="text-[var(--ll-text-muted)]">
                      processed {run.processed} · failed {run.failed} · {run.durationMs}ms
                    </p>
                    {run.error && <p className="text-xs text-red-400">{run.error}</p>}
                  </div>
                  <div className="text-right text-xs">
                    <p className="text-[var(--ll-text-muted)]">{run.ranAt.slice(0, 16).replace("T", " ")}</p>
                    <p className={STATUS_STYLE[run.status] ?? "text-zinc-400"}>{run.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 text-sm">
          <h2 className="text-lg font-semibold">Manual Trigger</h2>
          <p className="mt-2 text-[var(--ll-text-muted)]">
            Cron endpoints accept <span className="font-mono">POST</span> with <span className="font-mono">Authorization: Bearer &lt;CRON_SECRET&gt;</span>.
            Endpoints: <span className="font-mono">/api/cron/autonomous/[pipeline]</span>
          </p>
        </section>
      </div>
    </main>
  );
}
