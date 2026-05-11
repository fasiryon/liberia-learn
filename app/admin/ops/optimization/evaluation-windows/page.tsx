import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPostChangeOutcomeAnalytics } from "@/lib/autonomous/optimization/postChangeOutcomeAnalyticsService";

export const dynamic = "force-dynamic";

export default async function EvaluationWindowStatusPage() {
  const user = await requireUser();
  if (!user.isPlatformAdmin && user.role !== "ADMIN") redirect("/");
  const analytics = await getPostChangeOutcomeAnalytics({ schoolId: user.isPlatformAdmin ? null : user.schoolId });
  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase text-[var(--ll-text-muted)]">Evaluation Window Monitoring</p>
          <h1 className="text-2xl font-semibold">Window Status</h1>
        </header>
        <section className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
          <div className="divide-y divide-[var(--ll-border)] text-sm">
            {analytics.plans.map((plan: any) => {
              const created = new Date(plan.createdAt).getTime();
              const closes = new Date(created + plan.evaluationWindowDays * 24 * 60 * 60 * 1000);
              return (
                <div key={plan.id} className="grid gap-2 py-3 md:grid-cols-[1fr_auto_auto] md:items-center">
                  <Link className="font-medium underline" href={`/admin/ops/optimization/change-requests/${plan.changeRequestId}/post-change-eval`}>
                    {plan.changeRequest?.title ?? plan.id}
                  </Link>
                  <span>closes {closes.toISOString().slice(0, 10)}</span>
                  <span>{plan.feedbackLoopStatus}</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
