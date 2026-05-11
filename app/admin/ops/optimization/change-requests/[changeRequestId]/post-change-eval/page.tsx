import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getChangeRequest } from "@/lib/autonomous/optimization/optimizationChangeRequestService";
import { getPostChangeEvaluationPlan } from "@/lib/autonomous/optimization/postChangeEvaluationService";

export const dynamic = "force-dynamic";

export default async function PostChangeEvalPage({ params }: { params: { changeRequestId: string } }) {
  const user = await requireUser();
  if (!user.isPlatformAdmin && user.role !== "ADMIN") redirect("/");

  const changeRequest = await getChangeRequest({ id: params.changeRequestId, actor: user });
  const evalPlan = await getPostChangeEvaluationPlan(params.changeRequestId);

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-[var(--ll-text-muted)]">Post-Change Evaluation</p>
            <h1 className="text-2xl font-semibold">{changeRequest.title}</h1>
          </div>
          <Link href={`/admin/ops/optimization/change-requests/${params.changeRequestId}`} className="rounded border px-3 py-1.5 text-sm hover:bg-[var(--ll-surface)]">
            ← Change Request
          </Link>
        </header>

        {!evalPlan ? (
          <div className="rounded border bg-[var(--ll-surface)] p-6 text-center text-sm text-[var(--ll-text-muted)]">
            No post-change evaluation plan yet. Record rollout verification first, then create the plan.
          </div>
        ) : (
          <div className="space-y-4">
            <section className="rounded border bg-[var(--ll-surface)] p-4 text-sm space-y-1.5">
              <div className="flex gap-6">
                <div><span className="text-[var(--ll-text-muted)]">Status:</span> <strong>{evalPlan.status}</strong></div>
                <div><span className="text-[var(--ll-text-muted)]">Window:</span> <strong>{evalPlan.evaluationWindowDays} days</strong></div>
                <div><span className="text-[var(--ll-text-muted)]">Feedback loop:</span> <strong>{evalPlan.feedbackLoopStatus}</strong></div>
              </div>
            </section>

            <section className="rounded border bg-[var(--ll-surface)] p-4 space-y-2">
              <h2 className="text-lg font-semibold">Baseline Metrics</h2>
              {evalPlan.detectorPrecisionBaseline != null && (
                <div className="text-sm">Detector precision: <strong>{(evalPlan.detectorPrecisionBaseline * 100).toFixed(1)}%</strong></div>
              )}
              {evalPlan.falsePositiveRateBaseline != null && (
                <div className="text-sm">False-positive rate: <strong>{(evalPlan.falsePositiveRateBaseline * 100).toFixed(1)}%</strong></div>
              )}
              {evalPlan.approvalRejectionBaseline != null && (
                <div className="text-sm">Approval rejection rate: <strong>{(evalPlan.approvalRejectionBaseline * 100).toFixed(1)}%</strong></div>
              )}
              <pre className="overflow-auto rounded bg-black/5 p-3 text-xs mt-2">{JSON.stringify(evalPlan.baselineMetrics, null, 2)}</pre>
            </section>

            {evalPlan.postChangeMetrics && (
              <section className="rounded border bg-[var(--ll-surface)] p-4 space-y-2">
                <h2 className="text-lg font-semibold">Post-Change Metrics</h2>
                <pre className="overflow-auto rounded bg-black/5 p-3 text-xs">{JSON.stringify(evalPlan.postChangeMetrics, null, 2)}</pre>
              </section>
            )}

            {evalPlan.findings && (
              <section className="rounded border bg-[var(--ll-surface)] p-4 space-y-2">
                <h2 className="text-lg font-semibold">Findings</h2>
                <pre className="overflow-auto rounded bg-black/5 p-3 text-xs">{JSON.stringify(evalPlan.findings, null, 2)}</pre>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
