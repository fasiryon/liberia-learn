import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getExecutionHealth } from "@/lib/autonomous/actions/executionHealthService";

export const dynamic = "force-dynamic";

export default async function WorkerHealthPage() {
  const user = await requireUser();
  if (!user.isPlatformAdmin && user.role !== "ADMIN") redirect("/");
  const health = await getExecutionHealth({ schoolId: user.isPlatformAdmin ? null : user.schoolId });
  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <Link className="text-sm underline" href="/admin/ops/execution">Back to execution analytics</Link>
          <h1 className="mt-2 text-2xl font-semibold">Worker Health</h1>
        </header>
        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">Status<br /><span className="text-2xl font-semibold">{health.status}</span></div>
          <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">Active global<br /><span className="text-2xl font-semibold">{health.activeGlobal}</span></div>
          <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">Active tenant<br /><span className="text-2xl font-semibold">{health.activeTenant}</span></div>
        </section>
        <section className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 text-sm">
          <div>Queue configured: {health.queueConfigured ? "yes" : "no"}</div>
          <div>Stale running executions: {health.staleRunning}</div>
          <div>Global saturation limit: {health.saturationLimit}</div>
          <div>Tenant saturation limit: {health.tenantSaturationLimit}</div>
        </section>
      </div>
    </main>
  );
}

