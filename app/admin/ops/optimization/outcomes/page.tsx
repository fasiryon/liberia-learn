import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPostChangeOutcomeAnalytics } from "@/lib/autonomous/optimization/postChangeOutcomeAnalyticsService";

export const dynamic = "force-dynamic";

export default async function PostChangeOutcomesPage() {
  const user = await requireUser();
  if (!user.isPlatformAdmin && user.role !== "ADMIN") redirect("/");
  const analytics = await getPostChangeOutcomeAnalytics({ schoolId: user.isPlatformAdmin ? null : user.schoolId });
  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase text-[var(--ll-text-muted)]">Post-Change Outcomes</p>
          <h1 className="text-2xl font-semibold">Evaluation Closure Dashboard</h1>
        </header>
        <section className="grid gap-4 md:grid-cols-5">
          <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">Plans<br /><span className="text-2xl font-semibold">{analytics.summary.total}</span></div>
          <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">Complete<br /><span className="text-2xl font-semibold">{analytics.summary.complete}</span></div>
          <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">Sparse<br /><span className="text-2xl font-semibold">{analytics.summary.sparse}</span></div>
          <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">Improved<br /><span className="text-2xl font-semibold">{analytics.summary.improvementConfirmed}</span></div>
          <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">Rollback advice<br /><span className="text-2xl font-semibold">{analytics.summary.rollbackRecommended}</span></div>
        </section>
        <section className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
          <h2 className="text-lg font-semibold">Feedback Loop Completion</h2>
          <div className="mt-3 divide-y divide-[var(--ll-border)] text-sm">
            {analytics.plans.map((plan: any) => (
              <div key={plan.id} className="grid gap-2 py-3 md:grid-cols-[1fr_auto_auto] md:items-center">
                <div>
                  <Link className="font-medium underline" href={`/admin/ops/optimization/change-requests/${plan.changeRequestId}/post-change-eval`}>
                    {plan.changeRequest?.title ?? plan.changeRequestId}
                  </Link>
                  <p className="text-[var(--ll-text-muted)]">{plan.status} · {plan.evaluationWindowDays} day window</p>
                </div>
                <span>{plan.feedbackLoopStatus}</span>
                <span>{plan.postChangeMetrics?.sparseData ? "sparse evidence" : "evidence tracked"}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
