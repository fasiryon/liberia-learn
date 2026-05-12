import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/auth";
import { getManualRuntimeRunHistory } from "@/lib/autonomous/runtime/manualRuntimeRunService";
import { isRuntimeDashboardEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

const BADGE: Record<string, string> = {
  ok: "border-emerald-500/50 bg-emerald-500/10 text-emerald-100",
  skipped: "border-amber-500/50 bg-amber-500/10 text-amber-100",
  error: "border-red-500/50 bg-red-500/10 text-red-100",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${BADGE[status] ?? "border-zinc-500/50 text-zinc-300"}`}>
      {status}
    </span>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export default async function RuntimeRunsPage() {
  await requirePlatformAdmin();
  if (!isRuntimeDashboardEnabled()) redirect("/admin/ops");
  const runs = await getManualRuntimeRunHistory(100);

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <Link className="text-sm underline" href="/admin/ops/runtime">Back to Runtime Dashboard</Link>
          <h1 className="mt-2 text-2xl font-semibold">Operator Run History</h1>
          <p className="text-sm text-[var(--ll-text-muted)]">
            Manual runtime runs recorded from platform-admin controls. Cron remains separate and paused unless explicitly restored.
          </p>
        </header>

        <section className="overflow-x-auto rounded border border-[var(--ll-border)] bg-[var(--ll-surface)]">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead className="text-left">
              <tr>
                <th className="px-3 py-2">Run</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Pipeline</th>
                <th className="px-3 py-2">Operator</th>
                <th className="px-3 py-2">Counts</th>
                <th className="px-3 py-2">Duration</th>
                <th className="px-3 py-2">Result</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-t border-[var(--ll-border)]">
                  <td className="px-3 py-2">
                    <Link className="font-medium underline" href={`/admin/ops/runtime/runs/${run.id}`}>
                      {run.kind}
                    </Link>
                    <div className="text-xs text-[var(--ll-text-muted)]">{formatDate(run.ranAt)}</div>
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={run.status} />
                    {run.skipped && <div className="mt-1 text-xs text-amber-200">{run.reason ?? "skipped"}</div>}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{run.pipeline}</td>
                  <td className="px-3 py-2">{run.actor.name ?? run.actor.id ?? "system"}</td>
                  <td className="px-3 py-2">
                    processed {run.processed} / failed {run.failed}
                  </td>
                  <td className="px-3 py-2">{run.durationMs}ms</td>
                  <td className="px-3 py-2">{run.resultSummary}</td>
                </tr>
              ))}
              {runs.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-[var(--ll-text-muted)]" colSpan={7}>
                    No manual runtime runs have been recorded.
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
