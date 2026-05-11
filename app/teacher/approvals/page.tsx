import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function TeacherApprovalQueuePage() {
  const user = await requireUser();
  if (user.role !== "TEACHER" || !user.schoolId) redirect("/teacher");

  const approvals = await (prisma as any).approvalRequest.findMany({
    where: { schoolId: user.schoolId, approverRole: "TEACHER", status: "PENDING", actionExecutionId: { not: null } },
    orderBy: { requestedAt: "desc" },
    take: 50,
  });

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--ll-text-muted)]">Action Governance</p>
          <h1 className="text-2xl font-semibold">Teacher Approval Queue</h1>
        </header>
        <section className="space-y-3">
          {approvals.map((approval: any) => (
            <div key={approval.id} className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
              <div className="font-semibold">{approval.approvalType}</div>
              <div className="mt-1 text-sm text-[var(--ll-text-muted)]">Risk {approval.riskLevel} · expires {approval.expiresAt ? new Date(approval.expiresAt).toLocaleString() : "n/a"}</div>
              <div className="mt-3 flex gap-3">
                <form method="post" action={`/api/admin/ops/approvals/${approval.id}/approve`}>
                  <button className="rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Approve</button>
                </form>
                <form method="post" action={`/api/admin/ops/approvals/${approval.id}/reject`}>
                  <button className="rounded bg-red-600 px-3 py-2 text-sm font-semibold text-white">Reject</button>
                </form>
              </div>
            </div>
          ))}
          {approvals.length === 0 ? <p className="text-sm text-[var(--ll-text-muted)]">No pending teacher approvals.</p> : null}
        </section>
      </div>
    </main>
  );
}
