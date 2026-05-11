import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ActionExecutionDetailPage({ params }: { params: { actionExecutionId: string } }) {
  const user = await requireUser();
  if (!user.isPlatformAdmin && user.role !== "ADMIN") redirect("/");

  const action = await (prisma as any).actionExecution.findUnique({ where: { id: params.actionExecutionId } });
  if (!action) notFound();
  if (!user.isPlatformAdmin && action.schoolId !== user.schoolId) redirect("/");

  const [approval, traces, steps] = await Promise.all([
    action.approvalRequestId ? (prisma as any).approvalRequest.findUnique({ where: { id: action.approvalRequestId } }) : null,
    (prisma as any).executionTrace.findMany({ where: { workflowRunId: action.workflowRunId }, orderBy: { startedAt: "asc" } }),
    (prisma as any).workflowStep.findMany({ where: { workflowRunId: action.workflowRunId }, orderBy: { sequence: "asc" } }),
  ]);

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <Link className="text-sm underline" href="/admin/ops/approvals">Back to approvals</Link>
          <h1 className="mt-2 text-2xl font-semibold">{action.actionType}</h1>
          <div className="mt-2 grid gap-2 text-sm text-[var(--ll-text-muted)] md:grid-cols-4">
            <div>Status: {action.status}</div>
            <div>Risk: {action.riskLevel}</div>
            <div>Target: {action.targetType}:{action.targetId}</div>
            <div>Trace: {action.traceId ?? "n/a"}</div>
          </div>
        </header>

        <section className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
          <h2 className="text-lg font-semibold">Approval Linkage</h2>
          {approval ? (
            <div className="mt-3 text-sm">
              <Link className="underline" href={`/admin/ops/approvals/${approval.id}`}>{approval.approvalType}</Link>
              <span className="ml-3 text-[var(--ll-text-muted)]">{approval.status} · {approval.approverRole}</span>
            </div>
          ) : (
            <p className="mt-2 text-sm text-[var(--ll-text-muted)]">No approval request linked.</p>
          )}
        </section>

        <section className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
          <h2 className="text-lg font-semibold">Rollback</h2>
          <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
            <div>Status: {action.rollbackStatus ?? "n/a"}</div>
            <div>Operation: {action.rollbackRefs?.operation ?? "n/a"}</div>
            <div>Possible: {action.rollbackRefs?.rollbackPossible === false ? "no" : "yes"}</div>
          </div>
          {action.executionMetadata?.rollback ? (
            <pre className="mt-3 overflow-x-auto rounded border border-[var(--ll-border)] p-3 text-xs">{JSON.stringify(action.executionMetadata.rollback, null, 2)}</pre>
          ) : null}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
            <h2 className="text-lg font-semibold">Action Trace</h2>
            <div className="mt-3 space-y-2 text-sm">
              {traces.map((trace: any) => (
                <div key={trace.id} className="border-t border-[var(--ll-border)] py-2">
                  <div className="font-medium">{trace.spanType}: {trace.spanName}</div>
                  <div className="text-[var(--ll-text-muted)]">{trace.status} · {trace.durationMs ?? 0}ms</div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
            <h2 className="text-lg font-semibold">Workflow Steps</h2>
            <div className="mt-3 space-y-2 text-sm">
              {steps.map((step: any) => (
                <div key={step.id} className="border-t border-[var(--ll-border)] py-2">
                  <div className="font-medium">{step.sequence}. {step.stepKey}</div>
                  <div className="text-[var(--ll-text-muted)]">{step.status}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
