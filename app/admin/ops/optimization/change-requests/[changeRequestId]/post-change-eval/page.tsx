import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getChangeRequest } from "@/lib/autonomous/optimization/optimizationChangeRequestService";
import { getPostChangeEvaluationPlan } from "@/lib/autonomous/optimization/postChangeEvaluationService";
import { getRolloutPlan } from "@/lib/autonomous/optimization/stagedRolloutService";
import { PostChangeEvalActionsPanel } from "@/components/admin/autonomous/PostChangeEvalActionsPanel";

export const dynamic = "force-dynamic";

export default async function PostChangeEvalPage({ params }: { params: { changeRequestId: string } }) {
  const user = await requireUser();
  if (!user.isPlatformAdmin && user.role !== "ADMIN") redirect("/");

  const [changeRequest, evalPlan, rolloutPlan] = await Promise.all([
    getChangeRequest({ id: params.changeRequestId, actor: user }),
    getPostChangeEvaluationPlan(params.changeRequestId, user),
    getRolloutPlan(params.changeRequestId),
  ]);

  const hasRolloutVerification = Boolean((rolloutPlan as any)?.rolloutVerification);

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-[var(--ll-text-muted)]">Post-Change Evaluation</p>
            <h1 className="text-2xl font-semibold">{changeRequest.title}</h1>
          </div>
          <Link
            href={`/admin/ops/optimization/change-requests/${params.changeRequestId}`}
            className="rounded border px-3 py-1.5 text-sm hover:bg-[var(--ll-surface)]"
          >
            ← Change Request
          </Link>
        </header>

        {!evalPlan ? (
          <div className="rounded border bg-[var(--ll-surface)] p-6 text-center text-sm text-[var(--ll-text-muted)]">
            No post-change evaluation plan yet. Record rollout verification first, then create the plan.
          </div>
        ) : (
          <PostChangeEvalActionsPanel
            evalPlan={evalPlan}
            changeRequestId={params.changeRequestId}
            isPlatformAdmin={user.isPlatformAdmin ?? false}
            hasRolloutVerification={hasRolloutVerification}
          />
        )}
      </div>
    </main>
  );
}
