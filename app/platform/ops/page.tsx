import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getOpsDashboardData } from "@/lib/ops/dashboard";

function statusClass(status: string) {
  if (status === "healthy") return "border-emerald-500/30 bg-[var(--ll-yellow)]/10 text-[var(--ll-yellow)]";
  if (status === "degraded") return "border-amber-500/30 bg-[var(--ll-yellow-soft)] text-[var(--ll-yellow)]";
  return "border-red-500/30 bg-red-500/10 text-red-200";
}

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export const dynamic = "force-dynamic";

export default async function PlatformOpsPage() {
  const user = await requireUser();
  if (!user.isPlatformAdmin) {
    redirect("/platform");
  }

  const data = await getOpsDashboardData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Platform Ops</h1>
        <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
          Real-time platform health, SLOs, AI usage, and daily activity for platform admins.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
          <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">DB Health</p>
          <p className="mt-2 text-2xl font-bold text-[var(--ll-text)]">{data.health.db}</p>
          <p className="mt-1 text-sm text-[var(--ll-text-muted)]">{data.health.dbLatencyMs} ms latency</p>
        </div>
        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
          <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">Rate Limit</p>
          <p className="mt-2 text-2xl font-bold text-[var(--ll-text)]">{data.health.rateLimitBackend}</p>
          <p className="mt-1 text-sm text-[var(--ll-text-muted)]">Current backend</p>
        </div>
        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
          <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">Sentry</p>
          <p className="mt-2 text-2xl font-bold text-[var(--ll-text)]">{data.health.sentryConfigured ? "configured" : "missing"}</p>
          <p className="mt-1 text-sm text-[var(--ll-text-muted)]">Observability wiring</p>
        </div>
        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
          <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">Worker Queue</p>
          <p className="mt-2 text-2xl font-bold text-[var(--ll-text)]">{data.health.workerQueueDepth ?? "-"}</p>
          <p className="mt-1 text-sm text-[var(--ll-text-muted)]">Approximate backlog</p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Object.entries(data.slo).map(([key, value]) => (
          <div key={key} className={`rounded-xl border p-5 ${statusClass(value.status)}`}>
            <p className="text-xs uppercase tracking-wide">{key} SLO</p>
            <p className="mt-2 text-2xl font-bold">{percent(value.current)}</p>
            <p className="mt-1 text-sm">Target {percent(value.target)}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
          <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">AI Requests Today</p>
          <p className="mt-2 text-3xl font-bold text-[var(--ll-text)]">{data.ai.totalRequestsToday}</p>
          <p className="mt-1 text-sm text-[var(--ll-text-muted)]">Fallback rate {data.ai.fallbackRatePercent}%</p>
        </div>
        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
          <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">AI Cost Today</p>
          <p className="mt-2 text-3xl font-bold text-[var(--ll-text)]">${data.ai.estimatedCostUsdToday.toFixed(4)}</p>
          <p className="mt-1 text-sm text-[var(--ll-text-muted)]">Estimated routed AI spend</p>
        </div>
        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
          <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">Errors Last 24h</p>
          <p className="mt-2 text-3xl font-bold text-[var(--ll-text)]">{data.errors.count5xxLast24h}</p>
          <p className="mt-1 text-sm text-[var(--ll-text-muted)]">Metric events with error severity</p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
          <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">Active Students Today</p>
          <p className="mt-2 text-3xl font-bold text-[var(--ll-text)]">{data.users.activeStudentsToday}</p>
        </div>
        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
          <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">Active Teachers Today</p>
          <p className="mt-2 text-3xl font-bold text-[var(--ll-text)]">{data.users.activeTeachersToday}</p>
        </div>
        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
          <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">Total Schools</p>
          <p className="mt-2 text-3xl font-bold text-[var(--ll-text)]">{data.users.totalSchools}</p>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">Build</p>
            <p className="mt-2 text-lg font-semibold text-[var(--ll-text)]">Version {data.build.version}</p>
          </div>
          <div className="text-sm text-[var(--ll-text-muted)]">
            <p>Commit: {data.build.commitSha}</p>
            <p>Environment: {data.build.environment}</p>
            <p>Snapshot: {new Date(data.timestamp).toLocaleString("en-LR")}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
