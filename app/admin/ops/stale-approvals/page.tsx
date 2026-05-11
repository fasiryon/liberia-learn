import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { classifyApprovalSLA } from "@/lib/autonomous/actions/approvalSLAService";

export const dynamic = "force-dynamic";

export default async function StaleApprovalsPage() {
  const user = await requireUser();
  if (!user.isPlatformAdmin && user.role !== "ADMIN") redirect("/");
  const where: any = { status: "PENDING", actionExecutionId: { not: null } };
  if (!user.isPlatformAdmin) where.schoolId = user.schoolId ?? "__none__";
  const approvals = await (prisma as any).approvalRequest.findMany({ where, orderBy: { requestedAt: "asc" }, take: 100 });
  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <Link className="text-sm underline" href="/admin/ops/execution">Back to execution analytics</Link>
            <h1 className="mt-2 text-2xl font-semibold">Stale Approval Management</h1>
          </div>
          <form action="/api/admin/ops/stale-approvals/process" method="post">
            <button className="rounded bg-[var(--ll-primary)] px-4 py-2 text-sm font-semibold text-white" type="submit">Process stale approvals</button>
          </form>
        </header>
        <section className="overflow-x-auto rounded border border-[var(--ll-border)]">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead className="bg-[var(--ll-surface)] text-left">
              <tr><th className="px-3 py-2">Approval</th><th className="px-3 py-2">SLA</th><th className="px-3 py-2">Risk</th><th className="px-3 py-2">Approver</th><th className="px-3 py-2">Expires</th></tr>
            </thead>
            <tbody>
              {approvals.map((approval: any) => {
                const sla = classifyApprovalSLA({ requestedAt: approval.requestedAt, expiresAt: approval.expiresAt, riskLevel: approval.riskLevel });
                return (
                  <tr key={approval.id} className="border-t border-[var(--ll-border)]">
                    <td className="px-3 py-2"><Link className="underline" href={`/admin/ops/approvals/${approval.id}`}>{approval.approvalType}</Link></td>
                    <td className="px-3 py-2">{sla.status}</td>
                    <td className="px-3 py-2">{approval.riskLevel}</td>
                    <td className="px-3 py-2">{approval.approverRole}</td>
                    <td className="px-3 py-2">{approval.expiresAt ? new Date(approval.expiresAt).toLocaleString() : "n/a"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

