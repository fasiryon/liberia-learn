import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ApprovalDetailPage({ params }: { params: { approvalRequestId: string } }) {
  const user = await requireUser();
  if (!user.isPlatformAdmin && user.role !== "ADMIN") redirect("/");

  const approval = await (prisma as any).approvalRequest.findUnique({ where: { id: params.approvalRequestId } });
  if (!approval) notFound();
  if (!user.isPlatformAdmin && approval.schoolId !== user.schoolId) redirect("/");

  const action = approval.actionExecutionId
    ? await (prisma as any).actionExecution.findUnique({ where: { id: approval.actionExecutionId } })
    : null;
  const pending = approval.status === "PENDING";

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <Link className="text-sm underline" href="/admin/ops/approvals">Back to approvals</Link>
          <h1 className="mt-2 text-2xl font-semibold">{approval.approvalType}</h1>
          <div className="mt-2 grid gap-2 text-sm text-[var(--ll-text-muted)] md:grid-cols-4">
            <div>Status: {approval.status}</div>
            <div>Risk: {approval.riskLevel}</div>
            <div>Approver: {approval.approverRole}</div>
            <div>Trace: {approval.traceId ?? "n/a"}</div>
          </div>
        </header>

        <section className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
          <h2 className="text-lg font-semibold">Action</h2>
          <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
            <div>Type: {action?.actionType ?? "n/a"}</div>
            <div>Status: {action?.status ?? "n/a"}</div>
            <div>Target: {action?.targetType ?? "target"}:{action?.targetId ?? "n/a"}</div>
            <div>Workflow: {action?.workflowRunId ?? "n/a"}</div>
          </div>
          {action ? (
            <Link className="mt-3 inline-block text-sm underline" href={`/admin/ops/actions/${action.id}`}>
              View action trace
            </Link>
          ) : null}
        </section>

        {pending ? (
          <section className="grid gap-3 md:grid-cols-4">
            <form method="post" action={`/api/admin/ops/approvals/${approval.id}/approve`} className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
              <label className="text-sm font-medium" htmlFor="approve-comment">Approval comment</label>
              <textarea id="approve-comment" name="comment" className="mt-2 w-full rounded border border-[var(--ll-border)] bg-[var(--ll-bg)] p-2 text-sm" />
              <button className="mt-3 rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Approve</button>
            </form>
            <form method="post" action={`/api/admin/ops/approvals/${approval.id}/reject`} className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
              <label className="text-sm font-medium" htmlFor="reject-comment">Rejection comment</label>
              <textarea id="reject-comment" name="comment" className="mt-2 w-full rounded border border-[var(--ll-border)] bg-[var(--ll-bg)] p-2 text-sm" />
              <button className="mt-3 rounded bg-red-600 px-3 py-2 text-sm font-semibold text-white">Reject</button>
            </form>
            <form method="post" action={`/api/admin/ops/approvals/${approval.id}/cancel`} className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
              <label className="text-sm font-medium" htmlFor="cancel-comment">Cancellation comment</label>
              <textarea id="cancel-comment" name="comment" className="mt-2 w-full rounded border border-[var(--ll-border)] bg-[var(--ll-bg)] p-2 text-sm" />
              <button className="mt-3 rounded border border-[var(--ll-border)] px-3 py-2 text-sm font-semibold">Cancel</button>
            </form>
            <form method="post" action={`/api/admin/ops/approvals/${approval.id}/escalate`} className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
              <label className="text-sm font-medium" htmlFor="escalate-comment">Escalation reason</label>
              <textarea id="escalate-comment" name="reason" className="mt-2 w-full rounded border border-[var(--ll-border)] bg-[var(--ll-bg)] p-2 text-sm" />
              <button className="mt-3 rounded bg-amber-600 px-3 py-2 text-sm font-semibold text-white">Escalate</button>
            </form>
          </section>
        ) : null}
      </div>
    </main>
  );
}
