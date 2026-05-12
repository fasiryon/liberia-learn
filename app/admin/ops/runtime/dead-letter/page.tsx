import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getDeadLetterSummary } from "@/lib/autonomous/runtime/deadLetterInspectionService";
import { isRuntimeDashboardEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

export default async function DeadLetterPage() {
  const user = await requireUser();
  if (!user.isPlatformAdmin && user.role !== "ADMIN") redirect("/");
  if (!isRuntimeDashboardEnabled()) redirect("/admin/ops");

  const summary = await getDeadLetterSummary({
    schoolId: user.isPlatformAdmin ? null : user.schoolId,
  });

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <Link className="text-sm underline" href="/admin/ops/runtime">← Runtime Dashboard</Link>
          <h1 className="mt-2 text-2xl font-semibold">Dead-Letter Items</h1>
          <p className="text-sm text-[var(--ll-text-muted)]">
            Workflows that exhausted retries or were quarantined due to unrecoverable failure.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Total", value: summary.total },
            { label: "Replay eligible", value: summary.replayEligible },
            { label: "Quarantined", value: summary.quarantined },
          ].map(({ label, value }) => (
            <div key={label} className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--ll-text-muted)]">{label}</div>
              <div className="mt-2 text-2xl font-semibold">{value}</div>
            </div>
          ))}
        </section>

        <section className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
          <h2 className="text-lg font-semibold">Items</h2>
          {summary.items.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--ll-text-muted)]">No dead-letter items. Good.</p>
          ) : (
            <div className="mt-3 divide-y divide-[var(--ll-border)] text-sm">
              {summary.items.map((item) => (
                <div key={item.workflowRunId} className="grid gap-1 py-3 md:grid-cols-[1fr_auto]">
                  <div>
                    <Link className="font-mono text-xs underline" href={`/admin/ops/workflows/${item.workflowRunId}`}>
                      {item.workflowRunId.slice(0, 16)}…
                    </Link>
                    <p className="text-[var(--ll-text-muted)]">
                      {item.workflowType} · attempt {item.attempt}/{item.maxAttempts}
                      {item.schoolId ? ` · school ${item.schoolId.slice(0, 8)}…` : " · platform"}
                    </p>
                    {item.lastErrorCode && (
                      <p className="font-mono text-xs text-red-400">{item.lastErrorCode}</p>
                    )}
                    {item.lastErrorMessage && (
                      <p className="text-xs text-[var(--ll-text-muted)]">{item.lastErrorMessage}</p>
                    )}
                  </div>
                  <div className="text-right text-xs">
                    {item.deadLetteredAt && (
                      <p className="text-[var(--ll-text-muted)]">{item.deadLetteredAt.slice(0, 16).replace("T", " ")}</p>
                    )}
                    <p className={item.replayEligible ? "text-sky-400" : "text-zinc-500"}>
                      {item.replayEligible ? "replay eligible" : "not replayable"}
                    </p>
                    {item.quarantined && <p className="text-red-400">quarantined</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 text-sm">
          <h2 className="text-lg font-semibold">Replay Instructions</h2>
          <p className="mt-2 text-[var(--ll-text-muted)]">
            Replay-eligible items can be replayed via <span className="font-mono">POST /api/admin/ops/workflows/&lt;id&gt;/replay</span> (analysis_only mode by default).
            Action replay requires explicit approval. See docs/ai/WORKFLOW_ENGINE.md for the replay model.
          </p>
        </section>
      </div>
    </main>
  );
}
