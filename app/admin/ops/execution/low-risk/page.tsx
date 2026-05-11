import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function LowRiskPilotPage() {
  const user = await requireUser();
  if (!user.isPlatformAdmin && user.role !== "ADMIN") redirect("/");
  const where: any = { riskLevel: "low" };
  if (!user.isPlatformAdmin) where.schoolId = user.schoolId ?? "__none__";
  const actions = await (prisma as any).actionExecution.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <Link className="text-sm underline" href="/admin/ops/execution">Back to execution analytics</Link>
          <h1 className="mt-2 text-2xl font-semibold">Low-Risk Pilot Monitoring</h1>
        </header>
        <section className="overflow-x-auto rounded border border-[var(--ll-border)]">
          <table className="w-full min-w-[940px] border-collapse text-sm">
            <thead className="bg-[var(--ll-surface)] text-left">
              <tr><th className="px-3 py-2">Action</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Target</th><th className="px-3 py-2">Pilot</th><th className="px-3 py-2">Rollback</th></tr>
            </thead>
            <tbody>
              {actions.map((action: any) => (
                <tr key={action.id} className="border-t border-[var(--ll-border)]">
                  <td className="px-3 py-2"><Link className="underline" href={`/admin/ops/actions/${action.id}`}>{action.actionType}</Link></td>
                  <td className="px-3 py-2">{action.status}</td>
                  <td className="px-3 py-2">{action.targetType}:{action.targetId ?? action.schoolId}</td>
                  <td className="px-3 py-2">{action.outputRefs?.lowRiskPilot ? "executed" : "prepared/draft"}</td>
                  <td className="px-3 py-2">{action.rollbackStatus ?? "n/a"}</td>
                </tr>
              ))}
              {actions.length === 0 ? <tr><td className="px-3 py-6 text-center text-[var(--ll-text-muted)]" colSpan={5}>No low-risk pilot actions recorded.</td></tr> : null}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

