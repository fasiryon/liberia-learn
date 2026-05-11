import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isAutonomousOptimizationEnabled } from "@/lib/serverFlags";
import { scoreAutonomyReadiness } from "@/lib/autonomous/optimization/rolloutCalibrationService";

export const dynamic = "force-dynamic";

export default async function AutonomyReadinessPage() {
  const user = await requireUser();
  if (!user.isPlatformAdmin && user.role !== "ADMIN") redirect("/");
  if (!isAutonomousOptimizationEnabled()) return <main className="min-h-screen px-6 py-8">Autonomous optimization is disabled.</main>;
  const readiness = await scoreAutonomyReadiness({ schoolId: user.isPlatformAdmin ? null : user.schoolId });
  const components = [
    ["Detector reliability", readiness.detectorReliability],
    ["Recommendation precision", readiness.recommendationPrecision],
    ["Rollback effectiveness", readiness.rollbackEffectiveness],
    ["Workflow stability", readiness.workflowStability],
    ["Tenant safety confidence", readiness.tenantSafetyConfidence],
    ["Approval governance quality", readiness.approvalGovernanceQuality],
  ];
  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-5xl space-y-6">
        <header><p className="text-sm font-semibold uppercase text-[var(--ll-text-muted)]">Advisory Only</p><h1 className="text-2xl font-semibold">Autonomy Readiness</h1></header>
        <section className="rounded border bg-[var(--ll-surface)] p-4">
          <div className="text-sm">Readiness score</div>
          <div className="text-4xl font-semibold">{readiness.score}</div>
          <p className="mt-2 text-sm text-[var(--ll-text-muted)]">This score informs future pilot review only. It does not expand autonomy scope.</p>
        </section>
        <section className="rounded border bg-[var(--ll-surface)] p-4 text-sm">
          {components.map(([label, value]) => <div key={label} className="flex justify-between border-t py-2"><span>{label}</span><span>{value}</span></div>)}
        </section>
      </div>
    </main>
  );
}
