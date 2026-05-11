import { requireMoePortalUser } from "@/lib/moeAccess";
import { isDetectorMoeAggregationEnabled, isNationalTrendAnalysisEnabled } from "@/lib/serverFlags";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function MoeDetectorSignalsPage() {
  await requireMoePortalUser();

  if (!isDetectorMoeAggregationEnabled() && !isNationalTrendAnalysisEnabled()) {
    return (
      <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-2xl font-semibold">Detector Signals</h1>
          <p className="mt-3 text-sm text-[var(--ll-text-muted)]">MOE detector aggregation is disabled.</p>
        </div>
      </main>
    );
  }

  const rows = await (prisma as any).agentDecision.groupBy({
    by: ["decisionType", "status", "riskLevel"],
    where: {
      decisionType: { in: ["detector.recommendation.moe-governance", "detector.recommendation.national-trend"] },
    },
    _count: { _all: true },
    _avg: { confidence: true },
  });

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--ll-text-muted)]">Aggregate Only</p>
          <h1 className="text-2xl font-semibold">MOE Detector Signals</h1>
          <p className="mt-2 text-sm text-[var(--ll-text-muted)]">
            National and district detector summaries. Raw student records and PII are not exposed.
          </p>
        </header>

        <section className="grid gap-3 md:grid-cols-3">
          {rows.map((row: any) => (
            <div key={`${row.decisionType}:${row.status}:${row.riskLevel}`} className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
              <div className="text-sm font-semibold">{row.decisionType.replace("detector.recommendation.", "")}</div>
              <div className="mt-2 text-2xl font-semibold">{row._count._all}</div>
              <div className="text-sm text-[var(--ll-text-muted)]">
                {row.status} · {row.riskLevel} · avg confidence {Math.round(Number(row._avg.confidence ?? 0) * 100)}%
              </div>
            </div>
          ))}
          {rows.length === 0 ? <p className="text-sm text-[var(--ll-text-muted)]">No aggregate detector signals recorded.</p> : null}
        </section>
      </div>
    </main>
  );
}
