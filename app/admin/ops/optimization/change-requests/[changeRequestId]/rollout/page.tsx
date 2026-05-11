import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getChangeRequest } from "@/lib/autonomous/optimization/optimizationChangeRequestService";
import { getRolloutPlan } from "@/lib/autonomous/optimization/stagedRolloutService";

export const dynamic = "force-dynamic";

export default async function RolloutDetailPage({ params }: { params: { changeRequestId: string } }) {
  const user = await requireUser();
  if (!user.isPlatformAdmin && user.role !== "ADMIN" && user.role !== "MOE_OFFICIAL") redirect("/");

  const changeRequest = await getChangeRequest({ id: params.changeRequestId, actor: user });
  const plan = await getRolloutPlan(params.changeRequestId);

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-[var(--ll-text-muted)]">Staged Rollout Dashboard</p>
            <h1 className="text-2xl font-semibold">{changeRequest.title}</h1>
          </div>
          <Link href={`/admin/ops/optimization/change-requests/${params.changeRequestId}`} className="rounded border px-3 py-1.5 text-sm hover:bg-[var(--ll-surface)]">
            ← Change Request
          </Link>
        </header>

        {!plan ? (
          <div className="rounded border bg-[var(--ll-surface)] p-6 text-center space-y-3">
            <p className="text-sm text-[var(--ll-text-muted)]">No rollout plan yet. Prepare one from an APPROVED_FOR_ROLLOUT change request.</p>
            {changeRequest.status === "APPROVED_FOR_ROLLOUT" && (
              <form action={`/api/admin/ops/optimization/change-requests/${params.changeRequestId}/rollout`} method="POST">
                <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
                  Prepare Rollout Plan
                </button>
              </form>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <section className="rounded border bg-[var(--ll-surface)] p-4 text-sm space-y-1.5">
              <div className="flex gap-6">
                <div><span className="text-[var(--ll-text-muted)]">Plan status:</span> <strong>{plan.status}</strong></div>
                <div><span className="text-[var(--ll-text-muted)]">Current stage:</span> <strong>{plan.currentStage}</strong></div>
                <div><span className="text-[var(--ll-text-muted)]">Manual only:</span> <strong>{plan.requiresManualImplementation ? "Yes" : "No"}</strong></div>
              </div>
              {plan.rollbackTrigger && <div><span className="text-[var(--ll-text-muted)]">Rollback trigger:</span> {plan.rollbackTrigger}</div>}
              {plan.rollbackOwner && <div><span className="text-[var(--ll-text-muted)]">Rollback owner:</span> {plan.rollbackOwner}</div>}
            </section>

            <section className="rounded border bg-[var(--ll-surface)] p-4 space-y-3">
              <h2 className="text-lg font-semibold">Rollout Stages</h2>
              <ul className="space-y-2">
                {(Array.isArray(plan.stages) ? plan.stages : []).map((s: any) => (
                  <li key={s.stage} className="flex items-start gap-3 text-sm">
                    <span className="mt-0.5 text-[var(--ll-text-muted)]">→</span>
                    <div>
                      <p className="font-medium">{s.stage}</p>
                      <p className="text-xs text-[var(--ll-text-muted)]">{s.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded border bg-[var(--ll-surface)] p-4 space-y-2">
              <h2 className="text-lg font-semibold">Rollback Verification Checklist</h2>
              <ul className="space-y-1">
                {(Array.isArray(plan.rollbackVerificationChecklist) ? plan.rollbackVerificationChecklist : []).map((item: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-[var(--ll-text-muted)]">□</span> {item}
                  </li>
                ))}
              </ul>
            </section>

            {plan.rolloutVerification && (
              <section className="rounded border border-green-200 bg-green-50 p-4 text-sm">
                <p className="font-medium text-green-700">Rollout Verified</p>
                <p className="text-green-600">Outcome: {plan.rolloutVerification.outcome} · Stage: {plan.rolloutVerification.stage}</p>
                <p className="text-xs text-green-500">{plan.rolloutVerification.notes}</p>
              </section>
            )}

            {plan.rollbackVerification && (
              <section className="rounded border border-red-200 bg-red-50 p-4 text-sm">
                <p className="font-medium text-red-700">Rollback Verified</p>
                <p className="text-xs text-red-500">{plan.rollbackVerification.notes}</p>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
