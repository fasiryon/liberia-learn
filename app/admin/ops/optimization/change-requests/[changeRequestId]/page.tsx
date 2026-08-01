import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getChangeRequest } from "@/lib/autonomous/optimization/optimizationChangeRequestService";
import { getRolloutPlan } from "@/lib/autonomous/optimization/stagedRolloutService";
import { getPostChangeEvaluationPlan } from "@/lib/autonomous/optimization/postChangeEvaluationService";
import { isImplementationWorkflowEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

export default async function ChangeRequestDetailPage({ params }: { params: { changeRequestId: string } }) {
  const user = await requireUser();
  if (!user.isPlatformAdmin && user.role !== "ADMIN" && user.role !== "MOE_OFFICIAL") {
    redirect("/");
  }
  if (!isImplementationWorkflowEnabled()) {
    return (
      <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
        <p className="text-sm text-[var(--ll-text-muted)]">Implementation workflow is not enabled.</p>
      </main>
    );
  }

  const changeRequest = await getChangeRequest({ id: params.changeRequestId, actor: user });
  const [rolloutPlan, evalPlan] = await Promise.all([
    getRolloutPlan(params.changeRequestId),
    getPostChangeEvaluationPlan(params.changeRequestId, user),
  ]);

  const signoffs: any[] = changeRequest.signoffs ?? [];
  const required: string[] = changeRequest.requiredReviewerRoles ?? [];
  const approvedRoles = new Set(signoffs.filter((s: any) => s.decision === "APPROVED").map((s: any) => s.reviewerRole));
  const allSigned = required.every((r) => approvedRoles.has(r));

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-[var(--ll-text-muted)]">Change Request</p>
            <h1 className="text-2xl font-semibold">{changeRequest.title}</h1>
            <p className="mt-1 text-sm text-[var(--ll-text-muted)]">{changeRequest.category} · {changeRequest.affectedScope}</p>
          </div>
          <Link href="/admin/ops/optimization/change-requests" className="rounded border px-3 py-1.5 text-sm hover:bg-[var(--ll-surface)]">
            ← All Change Requests
          </Link>
        </header>

        <section className="rounded border bg-[var(--ll-surface)] p-4 text-sm space-y-1.5">
          <div className="flex gap-8">
            <div><span className="text-[var(--ll-text-muted)]">Status:</span> <strong>{changeRequest.status}</strong></div>
            <div><span className="text-[var(--ll-text-muted)]">Implementation:</span> <strong>{changeRequest.implementationStatus}</strong></div>
            <div><span className="text-[var(--ll-text-muted)]">Manual only:</span> <strong>{changeRequest.requiresManualImplementation ? "Yes" : "No"}</strong></div>
          </div>
          <div><span className="text-[var(--ll-text-muted)]">Proposal ID:</span> {changeRequest.proposalEventId}</div>
          {changeRequest.expectedImpact && <div><span className="text-[var(--ll-text-muted)]">Expected impact:</span> {changeRequest.expectedImpact}</div>}
        </section>

        <section className="rounded border bg-[var(--ll-surface)] p-4 space-y-3">
          <h2 className="text-lg font-semibold">Reviewer Sign-Offs</h2>
          <p className="text-xs text-[var(--ll-text-muted)]">Required: {required.join(", ") || "none"}</p>
          {signoffs.length === 0 ? (
            <p className="text-sm text-[var(--ll-text-muted)]">No sign-offs yet.</p>
          ) : (
            <ul className="space-y-1">
              {signoffs.map((s: any) => (
                <li key={s.id} className="flex items-center gap-3 text-sm">
                  <span className={s.decision === "APPROVED" ? "text-green-600" : "text-red-600"}>●</span>
                  <span>{s.reviewerRole}</span>
                  <span className="text-[var(--ll-text-muted)]">{s.decision}</span>
                  {s.comment && <span className="text-xs text-[var(--ll-text-muted)] italic">&quot;{s.comment}&quot;</span>}
                </li>
              ))}
            </ul>
          )}
          {changeRequest.status === "PENDING_REVIEW" && (
            <Link href={`/admin/ops/optimization/change-requests/${params.changeRequestId}/signoff`} className="inline-block rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700">
              Record Sign-Off
            </Link>
          )}
        </section>

        {rolloutPlan && (
          <section className="rounded border bg-[var(--ll-surface)] p-4 space-y-2">
            <h2 className="text-lg font-semibold">Staged Rollout Plan</h2>
            <div className="flex gap-6 text-sm">
              <div><span className="text-[var(--ll-text-muted)]">Status:</span> {rolloutPlan.status}</div>
              <div><span className="text-[var(--ll-text-muted)]">Current stage:</span> {rolloutPlan.currentStage}</div>
              <div><span className="text-[var(--ll-text-muted)]">Manual only:</span> {rolloutPlan.requiresManualImplementation ? "Yes" : "No"}</div>
            </div>
            <Link href={`/admin/ops/optimization/change-requests/${params.changeRequestId}/rollout`} className="inline-block text-sm text-blue-600 hover:underline">
              View rollout details →
            </Link>
          </section>
        )}

        {changeRequest.status === "APPROVED_FOR_ROLLOUT" && !rolloutPlan && (
          <section className="rounded border border-dashed bg-[var(--ll-surface)] p-4 text-sm text-[var(--ll-text-muted)]">
            Change request approved. <Link href={`/admin/ops/optimization/change-requests/${params.changeRequestId}/rollout`} className="text-blue-600 hover:underline">Prepare staged rollout plan →</Link>
          </section>
        )}

        {evalPlan && (
          <section className="rounded border bg-[var(--ll-surface)] p-4 space-y-2">
            <h2 className="text-lg font-semibold">Post-Change Evaluation</h2>
            <div className="text-sm">Status: {evalPlan.status} · Window: {evalPlan.evaluationWindowDays} days</div>
            <Link href={`/admin/ops/optimization/change-requests/${params.changeRequestId}/post-change-eval`} className="inline-block text-sm text-blue-600 hover:underline">
              View evaluation plan →
            </Link>
          </section>
        )}

        <section className="rounded border bg-[var(--ll-surface)] p-4 space-y-2">
          <h2 className="text-lg font-semibold">Implementation Plan</h2>
          <pre className="overflow-auto rounded bg-black/5 p-3 text-xs">{JSON.stringify(changeRequest.proposedImplementationPlan, null, 2)}</pre>
        </section>

        <section className="rounded border bg-[var(--ll-surface)] p-4 space-y-2">
          <h2 className="text-lg font-semibold">Rollback Plan</h2>
          <pre className="overflow-auto rounded bg-black/5 p-3 text-xs">{JSON.stringify(changeRequest.rollbackPlan, null, 2)}</pre>
        </section>

        <div className="flex gap-3 text-sm">
          <Link href={`/admin/ops/optimization/change-requests/${params.changeRequestId}/audit`} className="rounded border px-3 py-1.5 hover:bg-[var(--ll-surface)]">
            Implementation Audit History
          </Link>
        </div>
      </div>
    </main>
  );
}
