import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { assertPredictiveAccess, forecastScopeForUser } from "@/lib/autonomous/predictions/access";
import { getInstitutionalForecast } from "@/lib/autonomous/predictions/institutionalForecastService";
import { parseForecastRange } from "@/lib/autonomous/predictions/predictiveEvidenceService";

export const dynamic = "force-dynamic";

type SearchParams = { from?: string; to?: string };

function dateValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

function pct(value: number | null | undefined) {
  return value == null ? "n/a" : `${Math.round(value * 100)}%`;
}

export default async function ForecastingPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  try {
    assertPredictiveAccess(user);
  } catch {
    redirect("/");
  }
  const range = parseForecastRange(searchParams);
  const { scope, label } = forecastScopeForUser(user);
  const result = await getInstitutionalForecast({ scope, range });

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[var(--ll-text-muted)]">Autonomous OS</p>
            <h1 className="text-2xl font-semibold">Forecasting Analytics</h1>
            <p className="mt-2 text-sm text-[var(--ll-text-muted)]">{label}. Institutional forecasting suppresses raw school/class/student/user identifiers.</p>
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
              <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4"><div className="text-xs uppercase text-[var(--ll-text-muted)]">Medium risk</div><div className="mt-2 text-2xl font-semibold">{result.analytics?.mediumRisk ?? 0}</div></div>
              <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4"><div className="text-xs uppercase text-[var(--ll-text-muted)]">Stale forecasts</div><div className="mt-2 text-2xl font-semibold">{result.analytics?.staleForecasts ?? 0}</div></div>
              <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4"><div className="text-xs uppercase text-[var(--ll-text-muted)]">Detector coverage</div><div className="mt-2 text-2xl font-semibold">{pct(result.analytics?.detectorEvidenceCoverage)}</div></div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              {result.forecasts.map((forecast) => (
                <article key={forecast.id} className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
                  <h2 className="text-lg font-semibold">{forecast.type.replaceAll("_", " ")}</h2>
                  <p className="mt-1 text-sm text-[var(--ll-text-muted)]">{forecast.trajectory} · {forecast.riskBand} risk · confidence {pct(forecast.confidenceScore)}</p>
                  <p className="mt-3 text-sm">{forecast.confidenceRationale.join(", ")}</p>
                  <div className="mt-3 text-sm text-[var(--ll-text-muted)]">
                    Forecast freshness: {forecast.forecastFreshness.lastSignalAt ? forecast.forecastFreshness.lastSignalAt.toISOString().slice(0, 16).replace("T", " ") : "not seen"}.
                  </div>
                  <div className="mt-3 text-xs text-[var(--ll-text-muted)]">Outcome tracking uses append-only `predictive.forecast.outcome_recorded` events and confidence calibration feedback.</div>
                </article>
              ))}
            </section>
          </>
        )}

        <section className="grid gap-2 text-sm sm:grid-cols-3">
          <Link className="rounded border border-[var(--ll-border)] px-3 py-2 underline" href="/admin/ops/predictions">Predictions</Link>
          <Link className="rounded border border-[var(--ll-border)] px-3 py-2 underline" href="/admin/ops/early-warnings">Early warnings</Link>
          <Link className="rounded border border-[var(--ll-border)] px-3 py-2 underline" href="/admin/ops/effectiveness">Effectiveness</Link>
        </section>
      </div>
    </main>
  );
}
