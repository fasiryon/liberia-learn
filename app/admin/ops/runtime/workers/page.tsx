import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getWorkerStatus } from "@/lib/autonomous/runtime/autonomousWorkerService";
import { isRuntimeDashboardEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

export default async function WorkerStatusPage() {
  const user = await requireUser();
  if (!user.isPlatformAdmin && user.role !== "ADMIN") redirect("/");
  if (!isRuntimeDashboardEnabled()) redirect("/admin/ops");

  const status = await getWorkerStatus({ schoolId: user.isPlatformAdmin ? null : user.schoolId });

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <Link className="text-sm underline" href="/admin/ops/runtime">← Runtime Dashboard</Link>
          <h1 className="mt-2 text-2xl font-semibold">Workers & Locks</h1>
        </header>

        {status.emergencyShutdown && (
          <section className="rounded border border-red-700/50 bg-red-700/10 p-4 text-red-100">
            <span className="font-semibold">Emergency Shutdown Active</span> — All new execution is halted.
          </section>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[
            { label: "Running workflows", value: status.runningWorkflows },
            { label: "Executing workflows", value: status.executingWorkflows },
            { label: "Active locks", value: status.activeLocks },
            { label: "Expired locks (unreleased)", value: status.expiredLocks },
            { label: "Tenant running", value: status.tenantRunning },
          ].map(({ label, value }) => (
            <div key={label} className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--ll-text-muted)]">{label}</div>
              <div className="mt-2 text-2xl font-semibold">{value}</div>
            </div>
          ))}
        </section>

        <section className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 text-sm">
          <h2 className="text-lg font-semibold">Limits</h2>
          <div className="mt-3 space-y-2">
            <div>Global saturation limit: <span className="font-mono">{status.saturationLimit}</span></div>
            <div>Tenant saturation limit: <span className="font-mono">{status.tenantSaturationLimit}</span></div>
            {status.expiredLocks > 0 && (
              <p className="mt-3 text-amber-300">
                {status.expiredLocks} expired lock(s) detected. Platform admins can release via the recovery page or the workflow-recovery cron.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
