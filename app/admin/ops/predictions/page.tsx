import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { assertPredictiveAccess, forecastScopeForUser } from "@/lib/autonomous/predictions/access";
import { getPredictiveIntelligence } from "@/lib/autonomous/predictions/predictiveIntelligenceService";
import { parseForecastRange } from "@/lib/autonomous/predictions/predictiveEvidenceService";

export const dynamic = "force-dynamic";

type SearchParams = { from?: string; to?: string };

function dateValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

function pct(value: number | null | undefined) {
  return value == null ? "n/a" : `${Math.round(value * 100)}%`;
}

function tone(risk: string) {
  if (risk === "HIGH") return "border-red-500/50 bg-red-500/10";
  if (risk === "MEDIUM") return "border-amber-500/50 bg-amber-500/10";
  return "border-[var(--ll-border)] bg-[var(--ll-surface)]";
}

export default async function PredictionsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  try {
    assertPredictiveAccess(user);
  } catch {
    redirect("/");
  }
  const range = parseForecastRange(searchParams);
  const { scope, label } = forecastScopeForUser(user);
  const result = await getPredictiveIntelligence({ scope, range });

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[var(--ll-text-muted)]">Autonomous OS</p>
            <h1 className="text-2xl font-semibold">Predictive Intelligence</h1>
            <p className="mt-2 text-sm text-[var(--ll-text-muted)]">{label}. Forecasts are recommendation-only and approval-gated.</p>
          </div>
          <form className="flex gap-3 rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-3 text-sm">
            <input className="rounded border border-[var(--ll-border)] bg-transparent px-2 py-1" type="date" name="from" defaultValue={dateValue(range.from)} />
            <input className="rounded border border-[var(--ll-border)] bg-transparent px-2 py-1" type="date" name="to" defaultValue={dateValue(range.to)} />
            <button className="rounded border border-[var(--ll-border)] px-3 py-1.5" type="submit">Apply</button>
          </form>
        </header>

        {!result.enabled ? (
          <section className="rounded border border-amber-500/40 bg-amber-500/10 p-4">Predictive intelligence is disabled by feature flag.</section>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-4">
              <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4"><div className="text-xs uppercase text-[var(--ll-text-muted)]">Forecasts</div><div className="mt-2 text-2xl font-semibold">{result.analytics?.totalForecasts ?? 0}</div></div>
              <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4"><div className="text-xs uppercase text-[var(--ll-text-muted)]">High risk</div><div className="mt-2 text-2xl font-semibold">{result.analytics?.highRisk ?? 0}</div></div>
              <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4"><div className="text-xs uppercase text-[var(--ll-text-muted)]">Low confidence</div><div className="mt-2 text-2xl font-semibold">{result.analytics?.lowConfidence ?? 0}</div></div>
              <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4"><div className="text-xs uppercase text-[var(--ll-text-muted)]">Evidence coverage</div><div className="mt-2 text-2xl font-semibold">{pct(result.analytics?.detectorEvidenceCoverage)}</div></div>
            </section>

            {result.warnings.length ? (
              <section className="rounded border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
                {result.warnings.slice(0, 8).map((warning) => <div key={warning}>{warning}</div>)}
              </section>
            ) : null}

            <section className="grid gap-4 lg:grid-cols-2">
              {result.forecasts.map((forecast) => (
                <article key={forecast.id} className={`rounded border p-4 ${tone(forecast.riskBand)}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">{forecast.type.replaceAll("_", " ")}</h2>
                      <p className="text-sm text-[var(--ll-text-muted)]">{forecast.trajectory} trajectory · {forecast.riskBand} risk · {forecast.confidenceBand} confidence</p>
                    </div>
                    <div className="text-right text-sm font-semibold">{pct(forecast.confidenceScore)}</div>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm">
                    {forecast.contributingFactors.slice(0, 4).map((factor) => (
                      <div key={factor.key} className="rounded border border-[var(--ll-border)] px-3 py-2">
                        <span className="font-medium">{factor.label}</span>
                        <span className="ml-2 text-xs text-[var(--ll-text-muted)]">{factor.direction}, score {factor.score}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 text-sm">
                    <div className="font-medium">Recommended review actions</div>
                    <ul className="mt-1 space-y-1 text-[var(--ll-text-muted)]">
                      {forecast.recommendedActions.map((action) => <li key={action}>{action}</li>)}
                    </ul>
                  </div>
                  <p className="mt-3 text-xs text-[var(--ll-text-muted)]">Evidence refs: {forecast.evidenceRefs.length}. Memory refs: {forecast.memoryLineageRefs.length}. {forecast.historicalTrendBasis}</p>
                </article>
              ))}
            </section>
          </>
        )}

        <section className="grid gap-2 text-sm sm:grid-cols-3">
          <Link className="rounded border border-[var(--ll-border)] px-3 py-2 underline" href="/admin/ops/early-warnings">Early warnings</Link>
          <Link className="rounded border border-[var(--ll-border)] px-3 py-2 underline" href="/admin/ops/forecasting">Forecasting analytics</Link>
          <Link className="rounded border border-[var(--ll-border)] px-3 py-2 underline" href="/admin/ops/signals">Signal coverage</Link>
        </section>
      </div>
    </main>
  );
}
