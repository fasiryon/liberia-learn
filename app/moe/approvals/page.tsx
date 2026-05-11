import { requireMoePortalUser } from "@/lib/moeAccess";
import { prisma } from "@/lib/db";
import { isActionGovernanceEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

export default async function MoeApprovalReviewPage() {
  await requireMoePortalUser();
  if (!isActionGovernanceEnabled()) {
    return (
      <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-2xl font-semibold">MOE Approvals</h1>
          <p className="mt-3 text-sm text-[var(--ll-text-muted)]">Action governance is disabled.</p>
        </div>
      </main>
    );
  }

  const approvals = await (prisma as any).approvalRequest.findMany({
    where: { approverRole: "MOE_OFFICIAL", actionExecutionId: { not: null } },
    orderBy: { requestedAt: "desc" },
    take: 100,
    select: { id: true, status: true, riskLevel: true, approvalType: true, districtId: true, requestedAt: true, expiresAt: true },
  });

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--ll-text-muted)]">Aggregate Only</p>
          <h1 className="text-2xl font-semibold">MOE Action Approvals</h1>
          <p className="mt-2 text-sm text-[var(--ll-text-muted)]">This view lists governance approvals without student, guardian, or raw school-level PII.</p>
        </header>
        <section className="grid gap-3 md:grid-cols-2">
          {approvals.map((approval: any) => (
            <div key={approval.id} className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
              <div className="font-semibold">{approval.approvalType}</div>
              <div className="mt-1 text-sm text-[var(--ll-text-muted)]">
                {approval.status} · {approval.riskLevel} · {approval.districtId ?? "national aggregate"}
              </div>
            </div>
          ))}
          {approvals.length === 0 ? <p className="text-sm text-[var(--ll-text-muted)]">No MOE aggregate approvals recorded.</p> : null}
        </section>
      </div>
    </main>
  );
}
