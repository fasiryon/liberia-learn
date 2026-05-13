import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { assertPredictiveAccess, forecastScopeForUser } from "@/lib/autonomous/predictions/access";
import { getEarlyWarnings } from "@/lib/autonomous/predictions/earlyWarningService";
import { parseForecastRange } from "@/lib/autonomous/predictions/predictiveEvidenceService";

export const dynamic = "force-dynamic";

type SearchParams = { from?: string; to?: string };

function dateValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

export default async function EarlyWarningsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  try {
    assertPredictiveAccess(user);
  } catch {
    redirect("/");
  }
  const range = parseForecastRange(searchParams);
  const { scope, label } = forecastScopeForUser(user);
  const result = await getEarlyWarnings({ scope, range });

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[var(--ll-text-muted)]">Autonomous OS</p>
            <h1 className="text-2xl font-semibold">Early Warnings</h1>
            <p className="mt-2 text-sm text-[var(--ll-text-muted)]">{label}. Warnings are review queues only; no high-risk action executes from forecasts.</p>
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
              <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4"><div className="text-xs uppercase text-[var(--ll-text-muted)]">Warnings</div><div className="mt-2 text-2xl font-semibold">{result.analytics?.totalWarnings ?? 0}</div></div>
              <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4"><div className="text-xs uppercase text-[var(--ll-text-muted)]">Approval gated</div><div className="mt-2 text-2xl font-semibold">{result.analytics?.approvalGated ?? 0}</div></div>
              <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4"><div className="text-xs uppercase text-[var(--ll-text-muted)]">High risk</div><div className="mt-2 text-2xl font-semibold">{result.analytics?.highRisk ?? 0}</div></div>
              <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4"><div className="text-xs uppercase text-[var(--ll-text-muted)]">Sparse/stale</div><div className="mt-2 text-2xl font-semibold">{result.analytics?.staleOrSparse ?? 0}</div></div>
            </section>

            <section className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)]">
              <div className="grid gap-3 p-4">
                {result.warnings.map((warning) => (
                  <article key={warning.id} className="rounded border border-[var(--ll-border)] p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h2 className="font-semibold">{warning.type.replaceAll("_", " ")}</h2>
                        <p className="text-sm text-[var(--ll-text-muted)]">{warning.trajectory} · {warning.riskBand} risk · {warning.confidenceBand} confidence · review state {warning.reviewState}</p>
                      </div>
                      <div className="text-sm font-semibold">{pct(warning.confidenceScore)}</div>
                    </div>
                    <div className="mt-3 text-sm">
                      <div className="font-medium">Evidence lineage</div>
                      <p className="text-[var(--ll-text-muted)]">{warning.evidenceRefs.length} evidence refs, replay-safe: {String(warning.replaySafe)}, execution mode: {warning.executionMode}</p>
                    </div>
                    {warning.warnings.length ? <p className="mt-3 text-sm text-amber-100">{warning.warnings.slice(0, 3).join(" ")}</p> : null}
                  </article>
                ))}
                {result.warnings.length === 0 ? <p className="text-sm text-[var(--ll-text-muted)]">No early warnings in this window.</p> : null}
              </div>
            </section>
          </>
        )}

        <Link className="text-sm underline" href="/admin/ops/predictions">Back to predictions</Link>
      </div>
    </main>
  );
}
