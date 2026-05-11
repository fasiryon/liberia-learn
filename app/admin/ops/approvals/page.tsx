import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { classifyApprovalSLA } from "@/lib/autonomous/actions/approvalSLAService";

export const dynamic = "force-dynamic";

export default async function ApprovalQueuePage() {
  const user = await requireUser();
  if (!user.isPlatformAdmin && user.role !== "ADMIN") redirect("/");

  const where: any = { actionExecutionId: { not: null } };
  if (!user.isPlatformAdmin) where.schoolId = user.schoolId ?? "__none__";
  const approvals = await (prisma as any).approvalRequest.findMany({
    where,
    orderBy: { requestedAt: "desc" },
    take: 100,
  });
  const pending = approvals.filter((approval: any) => approval.status === "PENDING").length;

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[var(--ll-text-muted)]">Action Governance</p>
            <h1 className="text-2xl font-semibold">Approval Queue</h1>
          </div>
          <div className="rounded border border-[var(--ll-border)] px-3 py-2 text-sm">Pending: {pending}</div>
        </header>

        <section className="overflow-x-auto rounded border border-[var(--ll-border)]">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead className="bg-[var(--ll-surface)] text-left">
              <tr>
                <th className="px-3 py-2">Approval</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Risk</th>
                <th className="px-3 py-2">Approver</th>
                <th className="px-3 py-2">SLA</th>
                <th className="px-3 py-2">Tenant</th>
                <th className="px-3 py-2">Expires</th>
              </tr>
            </thead>
            <tbody>
              {approvals.map((approval: any) => {
                const sla = classifyApprovalSLA({ requestedAt: approval.requestedAt, expiresAt: approval.expiresAt, riskLevel: approval.riskLevel });
                return (
                  <tr key={approval.id} className="border-t border-[var(--ll-border)]">
                    <td className="px-3 py-2">
                      <Link className="font-medium underline" href={`/admin/ops/approvals/${approval.id}`}>
                        {approval.approvalType}
                      </Link>
                      <div className="text-xs text-[var(--ll-text-muted)]">{approval.actionExecutionId}</div>
                    </td>
                    <td className="px-3 py-2">{approval.status}</td>
                    <td className="px-3 py-2">{approval.riskLevel}</td>
                    <td className="px-3 py-2">{approval.approverRole ?? "n/a"}</td>
                    <td className="px-3 py-2">{sla.status}</td>
                    <td className="px-3 py-2">{approval.schoolId ?? approval.districtId ?? "aggregate"}</td>
                    <td className="px-3 py-2">{approval.expiresAt ? new Date(approval.expiresAt).toLocaleString() : "n/a"}</td>
                  </tr>
                );
              })}
              {approvals.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-[var(--ll-text-muted)]" colSpan={7}>
                    No approval requests recorded.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
