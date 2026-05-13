import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { assertPredictiveAccess, forecastScopeForUser } from "@/lib/autonomous/predictions/access";
import { parseForecastRange } from "@/lib/autonomous/predictions/predictiveEvidenceService";
import { getPredictionReviewQueue } from "@/lib/autonomous/predictions/predictionReviewService";

export const dynamic = "force-dynamic";

type SearchParams = { from?: string; to?: string };

function dateValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

export default async function PredictionReviewPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  try {
    assertPredictiveAccess(user);
  } catch {
    redirect("/");
  }
  const range = parseForecastRange(searchParams);
  const { scope, label } = forecastScopeForUser(user);
  const queue = await getPredictionReviewQueue({ scope, range });

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[var(--ll-text-muted)]">Autonomous OS</p>
            <h1 className="text-2xl font-semibold">Prediction Review Queue</h1>
            <p className="mt-2 text-sm text-[var(--ll-text-muted)]">{label}. Reviews record human judgment only; they do not execute forecast actions.</p>
          </div>
          <form className="flex gap-3 rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-3 text-sm">
            <input className="rounded border border-[var(--ll-border)] bg-transparent px-2 py-1" type="date" name="from" defaultValue={dateValue(range.from)} />
            <input className="rounded border border-[var(--ll-border)] bg-transparent px-2 py-1" type="date" name="to" defaultValue={dateValue(range.to)} />
            <button className="rounded border border-[var(--ll-border)] px-3 py-1.5" type="submit">Apply</button>
          </form>
        </header>

        {!queue.enabled ? (
          <section className="rounded border border-amber-500/40 bg-amber-500/10 p-4">{queue.warnings.join(" ")}</section>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-5">
              <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4"><div className="text-xs uppercase text-[var(--ll-text-muted)]">Queue</div><div className="mt-2 text-2xl font-semibold">{queue.analytics?.total ?? 0}</div></div>
              <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4"><div className="text-xs uppercase text-[var(--ll-text-muted)]">Unreviewed</div><div className="mt-2 text-2xl font-semibold">{queue.analytics?.unreviewed ?? 0}</div></div>
              <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4"><div className="text-xs uppercase text-[var(--ll-text-muted)]">Escalated</div><div className="mt-2 text-2xl font-semibold">{queue.analytics?.escalated ?? 0}</div></div>
              <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4"><div className="text-xs uppercase text-[var(--ll-text-muted)]">Need data</div><div className="mt-2 text-2xl font-semibold">{queue.analytics?.needsMoreData ?? 0}</div></div>
              <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4"><div className="text-xs uppercase text-[var(--ll-text-muted)]">Outcomes</div><div className="mt-2 text-2xl font-semibold">{queue.analytics?.outcomesRecorded ?? 0}</div></div>
            </section>

            <section className="space-y-4">
              {queue.items.map((item) => (
                <article key={item.id} className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">{item.type.replaceAll("_", " ")}</h2>
                      <p className="text-sm text-[var(--ll-text-muted)]">{item.trajectory} · {item.riskBand} risk · {item.confidenceBand} confidence ({pct(item.confidenceScore)})</p>
                      <p className="mt-2 text-sm text-[var(--ll-text-muted)]">Review: {item.reviewState}. Outcome: {item.outcomeState}. Evidence refs: {item.evidenceRefs.length}.</p>
                    </div>
                    <div className="grid gap-2 text-sm sm:grid-cols-2 lg:min-w-[34rem]">
                      <form action="/api/admin/ops/prediction-reviews" method="post" className="rounded border border-[var(--ll-border)] p-3">
                        <input type="hidden" name="forecastId" value={item.forecastId} />
                        <input type="hidden" name="forecastType" value={item.type} />
                        <input type="hidden" name="confidenceScore" value={item.confidenceScore} />
                        <label className="grid gap-1">
                          <span className="text-xs text-[var(--ll-text-muted)]">Review decision</span>
                          <select className="rounded border border-[var(--ll-border)] bg-transparent px-2 py-1" name="decision" defaultValue="acknowledged">
                            {item.reviewActions.map((action: string) => <option key={action} value={action}>{action.replaceAll("_", " ")}</option>)}
                          </select>
                        </label>
                        <textarea className="mt-2 min-h-16 w-full rounded border border-[var(--ll-border)] bg-transparent px-2 py-1" name="rationale" placeholder="Optional rationale; stored as length only" />
                        <button className="mt-2 rounded border border-[var(--ll-border)] px-3 py-1.5" type="submit">Record Review</button>
                      </form>
                      <form action="/api/admin/ops/prediction-outcomes" method="post" className="rounded border border-[var(--ll-border)] p-3">
                        <input type="hidden" name="forecastId" value={item.forecastId} />
                        <input type="hidden" name="forecastType" value={item.type} />
                        <input type="hidden" name="confidenceBefore" value={item.confidenceScore} />
                        <label className="grid gap-1">
                          <span className="text-xs text-[var(--ll-text-muted)]">Outcome feedback</span>
                          <select className="rounded border border-[var(--ll-border)] bg-transparent px-2 py-1" name="outcome" defaultValue="accurate">
                            {item.outcomeActions.map((action: string) => <option key={action} value={action}>{action.replaceAll("_", " ")}</option>)}
                          </select>
                        </label>
                        <textarea className="mt-2 min-h-16 w-full rounded border border-[var(--ll-border)] bg-transparent px-2 py-1" name="notes" placeholder="Optional notes; stored as length only" />
                        <button className="mt-2 rounded border border-[var(--ll-border)] px-3 py-1.5" type="submit">Record Outcome</button>
                      </form>
                    </div>
                  </div>
                </article>
              ))}
              {queue.items.length === 0 ? <p className="text-sm text-[var(--ll-text-muted)]">No prediction reviews queued for this window.</p> : null}
            </section>
          </>
        )}

        <section className="grid gap-2 text-sm sm:grid-cols-3">
          <Link className="rounded border border-[var(--ll-border)] px-3 py-2 underline" href="/admin/ops/forecast-calibration">Calibration dashboard</Link>
          <Link className="rounded border border-[var(--ll-border)] px-3 py-2 underline" href="/admin/ops/predictions">Predictions</Link>
          <Link className="rounded border border-[var(--ll-border)] px-3 py-2 underline" href="/admin/ops/early-warnings">Early warnings</Link>
        </section>
      </div>
    </main>
  );
}
