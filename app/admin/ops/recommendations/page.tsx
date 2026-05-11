import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function RecommendationQueuePage() {
  const user = await requireUser();
  if (!user.isPlatformAdmin) redirect("/");

  const recommendations = await (prisma as any).agentDecision.findMany({
    where: { decisionType: { startsWith: "detector.recommendation." } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      decisionType: true,
      status: true,
      riskLevel: true,
      confidence: true,
      requiresApproval: true,
      workflowRunId: true,
      traceId: true,
      decision: true,
      createdAt: true,
    },
  });

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--ll-text-muted)]">Recommend-Only OS</p>
          <h1 className="text-2xl font-semibold">Recommendation Queue</h1>
        </header>

        <section className="overflow-x-auto rounded border border-[var(--ll-border)]">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead className="bg-[var(--ll-surface)] text-left">
              <tr>
                <th className="px-3 py-2">Recommendation</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Risk</th>
                <th className="px-3 py-2">Confidence</th>
                <th className="px-3 py-2">Approval</th>
                <th className="px-3 py-2">Workflow</th>
                <th className="px-3 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {recommendations.map((recommendation: any) => {
                const payload = recommendation.decision ?? {};
                return (
                  <tr key={recommendation.id} className="border-t border-[var(--ll-border)]">
                    <td className="px-3 py-2">
                      <Link className="font-medium underline" href={`/admin/ops/recommendations/${recommendation.id}`}>
                        {payload.title ?? recommendation.decisionType}
                      </Link>
                      <div className="text-xs text-[var(--ll-text-muted)]">{recommendation.decisionType}</div>
                    </td>
                    <td className="px-3 py-2">{recommendation.status}</td>
                    <td className="px-3 py-2">{recommendation.riskLevel}</td>
                    <td className="px-3 py-2">{Math.round(Number(recommendation.confidence ?? 0) * 100)}%</td>
                    <td className="px-3 py-2">{recommendation.requiresApproval ? "required" : "not required"}</td>
                    <td className="px-3 py-2">
                      <Link className="underline" href={`/admin/ops/detectors/executions/${recommendation.workflowRunId}`}>
                        workflow
                      </Link>
                    </td>
                    <td className="px-3 py-2">{new Date(recommendation.createdAt).toLocaleString()}</td>
                  </tr>
                );
              })}
              {recommendations.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-[var(--ll-text-muted)]" colSpan={7}>
                    No detector recommendations recorded.
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
