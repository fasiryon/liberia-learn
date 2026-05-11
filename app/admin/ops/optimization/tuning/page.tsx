import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isAutonomousOptimizationEnabled } from "@/lib/serverFlags";
import { getDetectorPrecisionMetrics } from "@/lib/autonomous/optimization/recommendationPrecisionService";
import { listOptimizationRecommendations } from "@/lib/autonomous/optimization/optimizationReviewService";

export const dynamic = "force-dynamic";

export default async function TuningReviewPage() {
  const user = await requireUser();
  if (!user.isPlatformAdmin && user.role !== "ADMIN") redirect("/");
  if (!isAutonomousOptimizationEnabled()) return <main className="min-h-screen px-6 py-8">Autonomous optimization is disabled.</main>;
  const schoolId = user.isPlatformAdmin ? null : user.schoolId;
  const [metrics, recommendations] = await Promise.all([
    getDetectorPrecisionMetrics({ schoolId }),
    listOptimizationRecommendations({ requester: user, schoolId, limit: 100 }),
  ]);
  const tuning = recommendations.filter((item: any) => ["detector_threshold", "evidence_weighting", "confidence_calibration", "escalation_timing"].includes(item.category));
  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-7xl space-y-6">
        <header><p className="text-sm font-semibold uppercase text-[var(--ll-text-muted)]">Human-Reviewed Tuning</p><h1 className="text-2xl font-semibold">Tuning Review</h1></header>
        <section className="grid gap-4 md:grid-cols-5">
          <div className="rounded border p-4 text-sm">Precision<br /><span className="text-2xl font-semibold">{metrics.precision}</span></div>
          <div className="rounded border p-4 text-sm">Recall proxy<br /><span className="text-2xl font-semibold">{metrics.recallProxy}</span></div>
          <div className="rounded border p-4 text-sm">False positives<br /><span className="text-2xl font-semibold">{metrics.falsePositiveRate}</span></div>
          <div className="rounded border p-4 text-sm">Evidence<br /><span className="text-2xl font-semibold">{metrics.averageEvidenceCoverage}</span></div>
          <div className="rounded border p-4 text-sm">Approval rejects<br /><span className="text-2xl font-semibold">{metrics.approvalRejectionRate}</span></div>
        </section>
        <section className="rounded border bg-[var(--ll-surface)] p-4">
          <h2 className="text-lg font-semibold">Review Queue</h2>
          <div className="mt-3 divide-y text-sm">
            {tuning.map((item: any) => <div key={item.id} className="py-3"><Link className="font-medium underline" href={`/admin/ops/optimization/${item.id}`}>{item.title}</Link><p>{item.reviewStatus} · {item.approvalRequirement}</p></div>)}
          </div>
        </section>
      </div>
    </main>
  );
}
