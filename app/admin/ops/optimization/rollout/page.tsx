import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isAutonomousOptimizationEnabled } from "@/lib/serverFlags";
import { getOperationalEffectivenessMetrics } from "@/lib/autonomous/optimization/operationalEffectivenessService";
import { scoreAutonomyReadiness } from "@/lib/autonomous/optimization/rolloutCalibrationService";

export const dynamic = "force-dynamic";

export default async function RolloutCalibrationPage() {
  const user = await requireUser();
  if (!user.isPlatformAdmin && user.role !== "ADMIN") redirect("/");
  if (!isAutonomousOptimizationEnabled()) return <main className="min-h-screen px-6 py-8">Autonomous optimization is disabled.</main>;
  const schoolId = user.isPlatformAdmin ? null : user.schoolId;
  const [ops, readiness] = await Promise.all([getOperationalEffectivenessMetrics({ schoolId }), scoreAutonomyReadiness({ schoolId })]);
  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-7xl space-y-6">
        <header><p className="text-sm font-semibold uppercase text-[var(--ll-text-muted)]">Rollout Calibration</p><h1 className="text-2xl font-semibold">Pilot Safety Dashboard</h1></header>
        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded border p-4 text-sm">Readiness<br /><span className="text-2xl font-semibold">{readiness.score}</span></div>
          <div className="rounded border p-4 text-sm">Execution success<br /><span className="text-2xl font-semibold">{ops.executionSuccessRate}</span></div>
          <div className="rounded border p-4 text-sm">Workflow stability<br /><span className="text-2xl font-semibold">{ops.workflowStability}</span></div>
          <div className="rounded border p-4 text-sm">Worker health<br /><span className="text-2xl font-semibold">{ops.workerHealth.status}</span></div>
        </section>
        <section className="rounded border bg-[var(--ll-surface)] p-4 text-sm">
          <h2 className="text-lg font-semibold">Low-Risk Pilot Evidence</h2>
          <div className="mt-3 grid gap-2 md:grid-cols-5">
            <div>Pilots: {ops.pilot.pilots}</div>
            <div>Executed: {ops.pilot.executed}</div>
            <div>Failed: {ops.pilot.failed}</div>
            <div>Rollback frequency: {ops.rollbackFrequency}</div>
            <div>SLA breached: {ops.approvalSLA.buckets.breached}</div>
          </div>
        </section>
      </div>
    </main>
  );
}
