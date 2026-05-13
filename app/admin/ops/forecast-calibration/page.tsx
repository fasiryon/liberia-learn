import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { assertPredictiveAccess, forecastScopeForUser } from "@/lib/autonomous/predictions/access";
import { parseForecastRange } from "@/lib/autonomous/predictions/predictiveEvidenceService";
import { getForecastCalibrationDashboard } from "@/lib/autonomous/predictions/forecastCalibrationDashboardService";

export const dynamic = "force-dynamic";

type SearchParams = { from?: string; to?: string };

function dateValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

function pct(value: number | null | undefined) {
  return value == null ? "n/a" : `${Math.round(value * 100)}%`;
}

export default async function ForecastCalibrationPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  try {
    assertPredictiveAccess(user);
  } catch {
    redirect("/");
  }
  const range = parseForecastRange(searchParams);
  const { scope, label } = forecastScopeForUser(user);
  const dashboard = await getForecastCalibrationDashboard({ scope, range });

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[var(--ll-text-muted)]">Autonomous OS</p>
            <h1 className="text-2xl font-semibold">Forecast Calibration</h1>
            <p className="mt-2 text-sm text-[var(--ll-text-muted)]">{label}. Calibration is based on explicit human outcome feedback.</p>
          </div>
          <form className="flex gap-3 rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-3 text-sm">
            <input className="rounded border border-[var(--ll-border)] bg-transparent px-2 py-1" type="date" name="from" defaultValue={dateValue(range.from)} />
            <input className="rounded border border-[var(--ll-border)] bg-transparent px-2 py-1" type="date" name="to" defaultValue={dateValue(range.to)} />
            <button className="rounded border border-[var(--ll-border)] px-3 py-1.5" type="submit">Apply</button>
          </form>
        </header>

        {!dashboard.enabled ? (
          <section className="rounded border border-amber-500/40 bg-amber-500/10 p-4">{dashboard.warnings.join(" ")}</section>
        ) : (
          <>
            {dashboard.warnings.length ? (
              <section className="rounded border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
                {dashboard.warnings.map((warning) => <div key={warning}>{warning}</div>)}
              </section>
            ) : null}

            <section className="grid gap-4 md:grid-cols-4">
              <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4"><div className="text-xs uppercase text-[var(--ll-text-muted)]">Outcomes</div><div className="mt-2 text-2xl font-semibold">{dashboard.analytics?.totalOutcomes ?? 0}</div></div>
              <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4"><div className="text-xs uppercase text-[var(--ll-text-muted)]">Accuracy</div><div className="mt-2 text-2xl font-semibold">{pct(dashboard.analytics?.forecastAccuracy)}</div></div>
              <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4"><div className="text-xs uppercase text-[var(--ll-text-muted)]">False positive</div><div className="mt-2 text-2xl font-semibold">{pct(dashboard.analytics?.falsePositiveRate)}</div></div>
              <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4"><div className="text-xs uppercase text-[var(--ll-text-muted)]">Calibration move</div><div className="mt-2 text-2xl font-semibold">{dashboard.analytics?.calibrationMovement ?? "n/a"}</div></div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
                <h2 className="text-lg font-semibold">By Forecast Type</h2>
                <div className="mt-3 divide-y divide-[var(--ll-border)] text-sm">
                  {dashboard.byType.map((row) => (
                    <div key={String(row.forecastType)} className="grid grid-cols-4 gap-2 py-2">
                      <div className="font-medium">{String(row.forecastType).replaceAll("_", " ")}</div>
                      <div>{row.total} total</div>
                      <div>{row.accurate} accurate</div>
                      <div>{row.falsePositive} false positive</div>
                    </div>
                  ))}
                  {dashboard.byType.length === 0 ? <p className="py-3 text-[var(--ll-text-muted)]">No outcome records yet.</p> : null}
                </div>
              </div>
              <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
                <h2 className="text-lg font-semibold">Recent Outcomes</h2>
                <div className="mt-3 divide-y divide-[var(--ll-border)] text-sm">
                  {dashboard.recentOutcomes.map((event) => (
                    <div key={event.id} className="py-2">
                      <div className="font-medium">{String(event.forecastType).replaceAll("_", " ")} · {event.outcome}</div>
                      <div className="text-xs text-[var(--ll-text-muted)]">confidence {pct(event.confidenceBefore)} → {pct(event.confidenceAfter)} · {new Date(event.occurredAt).toISOString().slice(0, 16).replace("T", " ")}</div>
                    </div>
                  ))}
                  {dashboard.recentOutcomes.length === 0 ? <p className="py-3 text-[var(--ll-text-muted)]">No recent outcomes.</p> : null}
                </div>
              </div>
            </section>
          </>
        )}

        <Link className="text-sm underline" href="/admin/ops/prediction-review">Back to prediction review</Link>
      </div>
    </main>
  );
}
