import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSignalCoverage, parseSignalCoverageRange } from "@/lib/autonomous/signals/signalCoverageService";

export const dynamic = "force-dynamic";

type SearchParams = {
  from?: string;
  to?: string;
};

function dateInputValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

function fmtDate(value: Date | null) {
  return value ? value.toISOString().slice(0, 16).replace("T", " ") : "not seen";
}

function pct(value: number | null) {
  return value === null ? "n/a" : `${Math.round(value * 100)}%`;
}

function scopeForUser(user: any) {
  const role = String(user.role ?? "");
  const isMoe = role === "MOE_OFFICIAL" || role === "MOE_SUPER_ADMIN" || role === "DISTRICT_ADMIN";
  if (user.isPlatformAdmin) return { scope: { aggregateSafe: true }, label: "Platform aggregate-safe view" };
  if (isMoe) return { scope: { aggregateSafe: true }, label: "MOE aggregate-safe view" };
  return { scope: { schoolId: user.schoolId ?? "__none__" }, label: "School tenant view" };
}

export default async function SignalCoveragePage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const allowed =
    user.isPlatformAdmin ||
    user.role === "ADMIN" ||
    user.role === "MOE_OFFICIAL" ||
    user.role === "DISTRICT_ADMIN" ||
    String(user.role) === "MOE_SUPER_ADMIN";
  if (!allowed) redirect("/");

  const range = parseSignalCoverageRange({ from: searchParams.from, to: searchParams.to });
  const { scope, label } = scopeForUser(user);
  const coverage = await getSignalCoverage({ scope, range });

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[var(--ll-text-muted)]">Autonomous OS</p>
            <h1 className="text-2xl font-semibold">Signal Coverage</h1>
            <p className="mt-2 text-sm text-[var(--ll-text-muted)]">
              LearningEvent product signals only. {label}. Window: {dateInputValue(range.from)} to {dateInputValue(range.to)}.
            </p>
          </div>
          <form className="flex flex-wrap items-end gap-3 rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-3 text-sm">
            <label className="grid gap-1">
              <span className="text-xs text-[var(--ll-text-muted)]">From</span>
              <input className="rounded border border-[var(--ll-border)] bg-transparent px-2 py-1" type="date" name="from" defaultValue={dateInputValue(range.from)} />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-[var(--ll-text-muted)]">To</span>
              <input className="rounded border border-[var(--ll-border)] bg-transparent px-2 py-1" type="date" name="to" defaultValue={dateInputValue(range.to)} />
            </label>
            <button className="rounded border border-[var(--ll-border)] px-3 py-1.5 font-medium" type="submit">Apply</button>
          </form>
        </header>

        {coverage.warnings.length > 0 ? (
          <section className="rounded border border-amber-500/40 bg-amber-500/10 p-4">
            <h2 className="text-lg font-semibold text-amber-100">Signal Warnings</h2>
            <ul className="mt-2 space-y-1 text-sm text-amber-50">
              {coverage.warnings.slice(0, 10).map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
            <div className="text-xs font-semibold uppercase text-[var(--ll-text-muted)]">Events ingested</div>
            <div className="mt-2 text-2xl font-semibold">{coverage.totalEvents}</div>
            <div className="mt-1 text-xs text-[var(--ll-text-muted)]">Canonical LearningEvent rows.</div>
          </div>
          <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
            <div className="text-xs font-semibold uppercase text-[var(--ll-text-muted)]">Signal freshness</div>
            <div className="mt-2 text-2xl font-semibold">{fmtDate(coverage.freshness.lastSeenAt)}</div>
            <div className="mt-1 text-xs text-[var(--ll-text-muted)]">Latest signal in selected window.</div>
          </div>
          <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
            <div className="text-xs font-semibold uppercase text-[var(--ll-text-muted)]">Detector evidence</div>
            <div className="mt-2 text-2xl font-semibold">{pct(coverage.coverage.detectorEvidenceCoverage)}</div>
            <div className="mt-1 text-xs text-[var(--ll-text-muted)]">
              {coverage.coverage.detectorRecommendationsWithLearningEvents}/{coverage.coverage.detectorRecommendations} recommendations cite LearningEvent evidence.
            </div>
          </div>
          <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
            <div className="text-xs font-semibold uppercase text-[var(--ll-text-muted)]">School/class coverage</div>
            <div className="mt-2 text-2xl font-semibold">
              {coverage.coverage.schoolCount === null ? "aggregate" : `${coverage.coverage.schoolCount}/${coverage.coverage.classCount}`}
            </div>
            <div className="mt-1 text-xs text-[var(--ll-text-muted)]">School and class IDs hidden in aggregate-safe views.</div>
          </div>
        </section>

        <section className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
          <h2 className="text-lg font-semibold">Counts By Category</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase text-[var(--ll-text-muted)]">
                <tr>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Events</th>
                  <th className="px-3 py-2">Last seen</th>
                  <th className="px-3 py-2">Event types</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ll-border)]">
                {coverage.byCategory.map((row) => (
                  <tr key={row.category}>
                    <td className="px-3 py-2 font-medium">{row.category}</td>
                    <td className="px-3 py-2">{row.count}</td>
                    <td className="px-3 py-2">{fmtDate(row.lastSeenAt)}</td>
                    <td className="px-3 py-2 text-xs text-[var(--ll-text-muted)]">
                      {row.eventTypes.map((eventType) => `${eventType.eventType}: ${eventType.count}`).join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
            <h2 className="text-lg font-semibold">Top Missing Signal Types</h2>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {coverage.topMissingSignalTypes.map((eventType) => (
                <span key={eventType} className="rounded border border-[var(--ll-border)] px-2 py-1">{eventType}</span>
              ))}
              {coverage.topMissingSignalTypes.length === 0 ? <span className="text-[var(--ll-text-muted)]">No missing signal types in this window.</span> : null}
            </div>
          </div>
          <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
            <h2 className="text-lg font-semibold">Related Views</h2>
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <Link className="rounded border border-[var(--ll-border)] px-3 py-2 underline" href="/admin/ops/effectiveness">Effectiveness dashboard</Link>
              <Link className="rounded border border-[var(--ll-border)] px-3 py-2 underline" href="/admin/ops/detectors">Detectors</Link>
              <Link className="rounded border border-[var(--ll-border)] px-3 py-2 underline" href="/admin/ops/evaluations">Evaluations</Link>
              <Link className="rounded border border-[var(--ll-border)] px-3 py-2 underline" href="/admin/ops/memory">Memory</Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

