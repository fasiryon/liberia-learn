import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSystemHealth } from "@/lib/ops/healthCheck";
import { getErrorRates24h } from "@/lib/ops/errorRates";
import { getAISpend } from "@/lib/ops/aiSpend";
import { getPipelineStatus } from "@/lib/ops/pipelineStatus";
import { getActiveUsage } from "@/lib/ops/activeUsage";
import { getQueueDepths } from "@/lib/ops/queueDepths";
import RefreshButton from "./RefreshButton";

export const dynamic = "force-dynamic";
export const revalidate = 30;

function Dot({ status }: { status: "green" | "yellow" | "red" | string }) {
  const colors: Record<string, string> = {
    green: "bg-emerald-400",
    yellow: "bg-amber-400",
    red: "bg-red-500",
  };
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${colors[status] ?? "bg-zinc-500"} mr-2 flex-shrink-0`}
    />
  );
}

function Panel({
  title,
  status,
  children,
}: {
  title: string;
  status: "green" | "yellow" | "red" | string;
  children: React.ReactNode;
}) {
  const border: Record<string, string> = {
    green: "border-emerald-500/30",
    yellow: "border-amber-500/40",
    red: "border-red-500/50",
  };
  return (
    <section
      className={`rounded-xl border bg-[var(--ll-surface)] p-5 ${border[status] ?? "border-[var(--ll-border)]"}`}
    >
      <h2 className="flex items-center text-sm font-semibold uppercase tracking-wide text-[var(--ll-text-muted)]">
        <Dot status={status} />
        {title}
      </h2>
      <div className="mt-3 space-y-1.5 text-sm text-[var(--ll-text)]">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[var(--ll-text-muted)]">{label}</span>
      <span className="font-mono text-xs text-right">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    healthy: "text-emerald-400",
    degraded: "text-amber-400",
    down: "text-red-400",
    unconfigured: "text-zinc-500",
  };
  return (
    <span className={styles[status] ?? "text-zinc-400"}>{status}</span>
  );
}

export default async function OpsHealthPage() {
  const user = await requireUser();
  if (!user.isPlatformAdmin && user.role !== "ADMIN") redirect("/");

  const [health, errors, spend, pipeline, usage, queues] = await Promise.allSettled([
    getSystemHealth(),
    getErrorRates24h(),
    getAISpend(),
    getPipelineStatus(),
    getActiveUsage(),
    getQueueDepths(),
  ]);

  const h = health.status === "fulfilled" ? health.value : null;
  const e = errors.status === "fulfilled" ? errors.value : null;
  const s = spend.status === "fulfilled" ? spend.value : null;
  const p = pipeline.status === "fulfilled" ? pipeline.value : null;
  const u = usage.status === "fulfilled" ? usage.value : null;
  const q = queues.status === "fulfilled" ? queues.value : null;

  const overallColor = h?.overall ?? "yellow";

  const dlqDepth = q?.dlq?.depth ?? 0;
  const mainDepth = q?.mainQueue?.depth;
  const queueStatus =
    dlqDepth > 0 ? "red" : mainDepth != null && mainDepth > 100 ? "yellow" : "green";

  const usageStatus = u ? (u.stuckEventsLastHour > 20 ? "yellow" : "green") : "yellow";

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <Link className="text-sm underline" href="/admin/ops">
              ← Operations
            </Link>
            <h1 className="mt-2 text-2xl font-semibold">System Health</h1>
            <p className="text-sm text-[var(--ll-text-muted)]">
              Snapshot of platform health at a glance. Auto-refreshes every 30 s.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/moe/live"
              className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-[#080e1c] hover:bg-amber-300 transition-colors"
            >
              View Live (TV Mode)
            </Link>
            <RefreshButton />
          </div>
        </header>

        {/* Overall banner */}
        <div
          className={`rounded-xl border p-4 text-sm font-semibold ${
            overallColor === "green"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
              : overallColor === "yellow"
              ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
              : "border-red-500/40 bg-red-500/10 text-red-200"
          }`}
        >
          <Dot status={overallColor} />
          {overallColor === "green"
            ? "All systems operational"
            : overallColor === "yellow"
            ? "Degraded — check panels below"
            : "CRITICAL — immediate attention required"}
          {h && (
            <span className="ml-2 font-normal text-xs opacity-70">
              as of {new Date(h.timestamp).toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Panel 1: Deployment + System Health */}
          <Panel title="Deployment & System Health" status={overallColor}>
            {!h ? (
              <p className="text-[var(--ll-text-muted)]">Metrics unavailable</p>
            ) : (
              <>
                <Row
                  label="Commit"
                  value={
                    <span className="font-mono">
                      {h.deployment.commitSha.slice(0, 8)}
                    </span>
                  }
                />
                <Row label="Environment" value={h.deployment.environment} />
                {h.deployment.vercelUrl && (
                  <Row
                    label="URL"
                    value={
                      <a
                        href={h.deployment.vercelUrl}
                        className="underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {h.deployment.vercelUrl.replace("https://", "").slice(0, 30)}…
                      </a>
                    }
                  />
                )}
                <Row
                  label="Database"
                  value={
                    <>
                      <StatusBadge status={h.db.status} />
                      <span className="text-zinc-500"> {h.db.latencyMs}ms</span>
                    </>
                  }
                />
                <Row
                  label="Redis"
                  value={
                    <>
                      <StatusBadge status={h.redis.status} />
                      {h.redis.status !== "unconfigured" && (
                        <span className="text-zinc-500"> {h.redis.latencyMs}ms</span>
                      )}
                    </>
                  }
                />
              </>
            )}
          </Panel>

          {/* Panel 2: Error Rates (24h) */}
          <Panel
            title="Error Rates (24h)"
            status={
              e
                ? e.totalErrors24h > 50
                  ? "red"
                  : e.totalErrors24h > 10
                  ? "yellow"
                  : "green"
                : "yellow"
            }
          >
            {!e ? (
              <p className="text-[var(--ll-text-muted)]">Metrics unavailable</p>
            ) : (
              <>
                <Row label="Total errors" value={e.totalErrors24h} />
                {e.topKinds.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-[var(--ll-text-muted)] mb-1">Top event kinds</p>
                    {e.topKinds.map((k) => (
                      <Row key={k.kind} label={k.kind} value={k.count} />
                    ))}
                  </div>
                )}
                {e.sentryConfigured && e.sentryProjectUrl && (
                  <a
                    href={e.sentryProjectUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 block text-xs underline text-[var(--ll-text-muted)]"
                  >
                    Open Sentry →
                  </a>
                )}
                {!e.sentryConfigured && (
                  <p className="mt-2 text-xs text-amber-400">
                    Sentry DSN not configured — full error capture inactive
                  </p>
                )}
              </>
            )}
          </Panel>

          {/* Panel 3: AI Spend */}
          <Panel title="AI Spend" status={s?.status ?? "yellow"}>
            {!s ? (
              <p className="text-[var(--ll-text-muted)]">Metrics unavailable</p>
            ) : (
              <>
                <Row
                  label="Today"
                  value={`$${s.todayUsd.toFixed(4)} / $${s.dailyCap} (${s.dailyPct}%)`}
                />
                <Row
                  label="Month-to-date"
                  value={`$${s.mtdUsd.toFixed(2)} / $${s.monthlyCap} (${s.monthlyPct}%)`}
                />
                {s.byFeature.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-[var(--ll-text-muted)] mb-1">
                      Per feature (today)
                    </p>
                    {s.byFeature.map((f) => (
                      <Row
                        key={f.feature}
                        label={f.feature}
                        value={`$${f.costUsd.toFixed(4)}`}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </Panel>

          {/* Panel 4: Pipeline Status */}
          <Panel
            title="Pipeline Status"
            status={
              p
                ? p.curriculum.needsReview > 100
                  ? "yellow"
                  : "green"
                : "yellow"
            }
          >
            {!p ? (
              <p className="text-[var(--ll-text-muted)]">Metrics unavailable</p>
            ) : (
              <>
                <Row
                  label="Approved lessons"
                  value={`${p.curriculum.approved.toLocaleString()} / ${p.curriculum.total.toLocaleString()}`}
                />
                <Row
                  label="Needs review"
                  value={p.curriculum.needsReview}
                />
                <Row
                  label="Pending / Draft"
                  value={p.curriculum.pending}
                />
                <Row
                  label="Audio coverage"
                  value={`${p.audio.withAudio} narrated`}
                />
                <Row label="Scaffolds" value={p.scaffolds} />
                <Row
                  label="Code exercises"
                  value={`${p.codeExercises.validated} / ${p.codeExercises.total} validated`}
                />
              </>
            )}
          </Panel>

          {/* Panel 5: Active Usage */}
          <Panel title="Active Usage" status={usageStatus}>
            {!u ? (
              <p className="text-[var(--ll-text-muted)]">Metrics unavailable</p>
            ) : (
              <>
                <Row
                  label="Active sessions (5 min)"
                  value={u.activeSessionsLast5Min}
                />
                <Row
                  label="Submissions (last hour)"
                  value={u.submissionsLastHour}
                />
                <Row
                  label="Stuck events (last hour)"
                  value={u.stuckEventsLastHour}
                />
                {u.mostStuckLessonToday && (
                  <Row
                    label="Most stuck lesson today"
                    value={`${u.mostStuckLessonToday.lessonId.slice(0, 12)}… (${u.mostStuckLessonToday.count}×)`}
                  />
                )}
                {u.activeSessionsLast5Min === 0 &&
                  u.submissionsLastHour === 0 && (
                    <p className="text-xs text-[var(--ll-text-muted)] mt-2">
                      No active traffic — normal before pilot onboards
                    </p>
                  )}
              </>
            )}
          </Panel>

          {/* Panel 6: Queue Depths */}
          <Panel title="Queue Depths" status={queueStatus}>
            {!q ? (
              <p className="text-[var(--ll-text-muted)]">Metrics unavailable</p>
            ) : (
              <>
                <Row
                  label="Main queue"
                  value={
                    q.mainQueue.configured
                      ? q.mainQueue.depth ?? "error reading"
                      : "not configured"
                  }
                />
                <Row
                  label="DLQ"
                  value={
                    q.dlq.configured ? (
                      dlqDepth > 0 ? (
                        <span className="text-red-400 font-semibold">{dlqDepth} — investigate!</span>
                      ) : (
                        0
                      )
                    ) : (
                      <span className="text-amber-400">SQS_DLQ_URL not set</span>
                    )
                  }
                />
                <Row
                  label="Regen runs active"
                  value={q.regenRunsActive}
                />
                <p className="text-xs text-[var(--ll-text-muted)] mt-2 leading-relaxed">
                  {q.note}
                </p>
              </>
            )}
          </Panel>
        </div>

        <footer className="text-xs text-[var(--ll-text-faint)] flex gap-4">
          <Link href="/admin/ops/runtime" className="underline">
            Runtime Dashboard
          </Link>
          <Link href="/admin/curriculum/coverage" className="underline">
            Coverage Map
          </Link>
          <Link href="/admin/ops" className="underline">
            All Ops Tools
          </Link>
          <a href="/docs/ops/RUNBOOK.md" className="underline">
            Runbook
          </a>
        </footer>
      </div>
    </main>
  );
}
